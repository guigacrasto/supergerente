import { supabase } from "../api/supabase.js";
import { KommoService } from "./kommo.js";
import { getTeamConfigsFromTenant } from "../config.js";
import { getAllTenants } from "../api/services/tenant.js";
import {
  sendWhatsAppDisconnectedEmail,
  sendWhatsAppReconnectedEmail,
} from "../api/services/email.js";
import type { Tenant } from "../types/index.js";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const ADMIN_EMAIL = "guilherme@onigroup.com.br";

interface WhatsAppNumber {
  id: string;
  tenant_id: string;
  user_id: string;
  team: string;
  phone: string;
  kommo_source_name: string | null;
  kommo_user_id: number | null;
  kommo_source_id: number | null;
  connection_status: string;
  disconnected_at: string | null;
  last_alert_at: string | null;
  active: boolean;
}

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

export class WhatsAppHealthMonitor {
  private static intervalHandle: ReturnType<typeof setInterval> | null = null;

  static start(): void {
    if (this.intervalHandle) return;
    console.log(`[WhatsAppHealth] Monitor started — checking every ${CHECK_INTERVAL_MS / 60000}min`);
    // First check after 2 minutes (let tokens warm up)
    setTimeout(() => this.checkAll(), 2 * 60 * 1000);
    this.intervalHandle = setInterval(() => this.checkAll(), CHECK_INTERVAL_MS);
  }

  static stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  static async checkAll(): Promise<void> {
    console.log("[WhatsAppHealth] Starting health check...");
    try {
      const tenants = await getAllTenants();
      const activeTenants = tenants.filter((t) => t.isActive);

      for (const tenant of activeTenants) {
        await this.checkTenant(tenant).catch((err) => {
          console.error(`[WhatsAppHealth] Error checking tenant ${tenant.slug}:`, err.message);
          this.sendAdminAlert(
            `Erro ao verificar WhatsApp do tenant ${tenant.name}: ${err.message}`
          );
        });
      }
      console.log("[WhatsAppHealth] Health check complete");
    } catch (err: any) {
      console.error("[WhatsAppHealth] Fatal error:", err.message);
    }
  }

  private static async checkTenant(tenant: Tenant): Promise<void> {
    // Get all active numbers for this tenant
    const { data: numbers, error } = await supabase
      .from("whatsapp_numbers")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("active", true);

    if (error) throw error;
    if (!numbers || numbers.length === 0) return;

    const teamConfigs = getTeamConfigsFromTenant(tenant);
    const teamGroups = new Map<string, WhatsAppNumber[]>();

    for (const n of numbers as WhatsAppNumber[]) {
      if (!teamGroups.has(n.team)) teamGroups.set(n.team, []);
      teamGroups.get(n.team)!.push(n);
    }

    for (const [team, teamNumbers] of teamGroups) {
      const tc = teamConfigs[team];
      if (!tc?.subdomain) {
        console.log(`[WhatsAppHealth] Skipping team ${team} — no subdomain`);
        continue;
      }

      try {
        const service = new KommoService(tc, team, tenant.id);
        const sources = await service.getSources();
        const sourceNames = sources.map((s) => s.name.toLowerCase());
        const sourceMap = new Map(sources.map((s) => [s.name.toLowerCase(), s]));

        for (const num of teamNumbers) {
          await this.checkNumber(num, sourceNames, sourceMap, service, tenant);
        }
      } catch (err: any) {
        console.error(`[WhatsAppHealth] API error for ${tenant.slug}:${team}:`, err.message);
        this.sendAdminAlert(
          `Erro na API Kommo (${tenant.name}, time ${team}): ${err.message}`
        );
      }
    }
  }

  private static async checkNumber(
    num: WhatsAppNumber,
    sourceNames: string[],
    sourceMap: Map<string, { id: number; name: string }>,
    service: KommoService,
    tenant: Tenant
  ): Promise<void> {
    const now = new Date().toISOString();
    const sourceName = num.kommo_source_name?.toLowerCase() || "";

    // Try to find the source in Kommo
    let found = false;
    let matchedSourceId: number | null = num.kommo_source_id;

    if (sourceName) {
      // Match by source name (substring match, case-insensitive)
      for (const [name, source] of sourceMap) {
        if (name.includes(sourceName) || sourceName.includes(name)) {
          found = true;
          matchedSourceId = source.id;
          break;
        }
      }
    }

    // If no source name configured or sources API returned empty, try account connectivity check
    if (!sourceName || sourceNames.length === 0) {
      try {
        const account = await service.getAccountInfo();
        found = !!account;
      } catch {
        found = false;
      }
    }

    const wasDisconnected = num.connection_status === "disconnected";

    if (!found && sourceName) {
      // SOURCE NOT FOUND — disconnected
      if (!wasDisconnected) {
        console.log(`[WhatsAppHealth] DISCONNECTED: ${formatPhone(num.phone)} (${num.kommo_source_name})`);
        await this.markDisconnected(num, now);
        await this.alertDisconnection(num, tenant);
      } else {
        // Already disconnected — check cooldown for re-alert
        const lastAlert = num.last_alert_at ? new Date(num.last_alert_at).getTime() : 0;
        if (Date.now() - lastAlert >= ALERT_COOLDOWN_MS) {
          console.log(`[WhatsAppHealth] Still disconnected, re-alerting: ${formatPhone(num.phone)}`);
          await this.alertDisconnection(num, tenant);
        }
      }
    } else if (found) {
      // SOURCE FOUND — connected
      if (wasDisconnected) {
        console.log(`[WhatsAppHealth] RECONNECTED: ${formatPhone(num.phone)} (${num.kommo_source_name})`);
        await this.markConnected(num, matchedSourceId, now);
        await this.alertReconnection(num, tenant);
      } else {
        // Update check timestamp
        await supabase
          .from("whatsapp_numbers")
          .update({
            connection_status: "connected",
            kommo_source_id: matchedSourceId,
            last_checked_at: now,
          })
          .eq("id", num.id);
      }
    }
  }

  private static async markDisconnected(num: WhatsAppNumber, now: string): Promise<void> {
    await supabase
      .from("whatsapp_numbers")
      .update({
        connection_status: "disconnected",
        disconnected_at: num.disconnected_at || now,
        last_checked_at: now,
        last_alert_at: now,
      })
      .eq("id", num.id);
  }

  private static async markConnected(
    num: WhatsAppNumber,
    sourceId: number | null,
    now: string
  ): Promise<void> {
    await supabase
      .from("whatsapp_numbers")
      .update({
        connection_status: "connected",
        kommo_source_id: sourceId,
        disconnected_at: null,
        last_checked_at: now,
        last_alert_at: null,
      })
      .eq("id", num.id);
  }

  private static async alertDisconnection(num: WhatsAppNumber, tenant: Tenant): Promise<void> {
    const phone = formatPhone(num.phone);
    const agentName = await this.getAgentName(num.kommo_user_id);

    // Get the user who registered this number
    const userEmail = await this.getUserEmail(num.user_id);

    // Notification in-app for the registering user
    await supabase.from("notifications").insert({
      user_id: num.user_id,
      team: num.team,
      type: "whatsapp_disconnected",
      title: "WhatsApp desconectado",
      body: `O numero ${phone} (${num.kommo_source_name || "sem fonte"}) foi desconectado do Kommo. Reconecte para continuar recebendo leads.`,
      data: {
        phone: num.phone,
        team: num.team,
        source_name: num.kommo_source_name,
        tenant_name: tenant.name,
      },
    });

    // Email to the registering user
    if (userEmail) {
      await sendWhatsAppDisconnectedEmail(
        userEmail,
        phone,
        num.kommo_source_name || "",
        num.team,
        agentName
      );
    }

    // Also email admin for all disconnections
    await sendWhatsAppDisconnectedEmail(
      ADMIN_EMAIL,
      phone,
      num.kommo_source_name || "",
      num.team,
      agentName
    );

    // Update last_alert_at
    await supabase
      .from("whatsapp_numbers")
      .update({ last_alert_at: new Date().toISOString() })
      .eq("id", num.id);
  }

  private static async alertReconnection(num: WhatsAppNumber, tenant: Tenant): Promise<void> {
    const phone = formatPhone(num.phone);

    // Notification in-app
    await supabase.from("notifications").insert({
      user_id: num.user_id,
      team: num.team,
      type: "whatsapp_reconnected",
      title: "WhatsApp reconectado",
      body: `O numero ${phone} (${num.kommo_source_name || "sem fonte"}) voltou a funcionar no Kommo.`,
      data: {
        phone: num.phone,
        team: num.team,
        source_name: num.kommo_source_name,
        tenant_name: tenant.name,
      },
    });

    // Email to the registering user
    const userEmail = await this.getUserEmail(num.user_id);
    if (userEmail) {
      await sendWhatsAppReconnectedEmail(
        userEmail,
        phone,
        num.kommo_source_name || "",
        num.team
      );
    }
  }

  private static async getUserEmail(userId: string): Promise<string | null> {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();
      return data?.email || null;
    } catch {
      return null;
    }
  }

  private static async getAgentName(kommoUserId: number | null): Promise<string> {
    if (!kommoUserId) return "—";
    return `Agente #${kommoUserId}`;
  }

  private static async sendAdminAlert(message: string): Promise<void> {
    try {
      const { sendEmail } = await import("../api/services/email.js");
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[SuperGerente] Erro no monitor WhatsApp`,
        html: `<div style="font-family: sans-serif; padding: 16px;">
          <h3 style="color: #EF4444;">Erro no Monitor WhatsApp</h3>
          <p>${message}</p>
          <p style="color: #999; font-size: 12px;">Verifique os logs do servidor para mais detalhes.</p>
        </div>`,
      });
    } catch (e: any) {
      console.error(`[WhatsAppHealth] Failed to send admin alert:`, e.message);
    }
  }
}
