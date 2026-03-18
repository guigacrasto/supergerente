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

interface SourceInfo {
  id: number;
  name: string;
  external_id?: string;
  services?: any[];
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

        // Strategy 1: Check Kommo /sources endpoint
        const sources = await service.getSources();
        console.log(
          `[WhatsAppHealth] ${tenant.slug}:${team} — /sources returned ${sources.length} entries:`,
          sources.length > 0
            ? sources.map((s) => `"${s.name}" (id:${s.id}, services:${JSON.stringify(s.services || [])})`).join(", ")
            : "EMPTY"
        );

        const sourceMap = new Map<string, SourceInfo>(
          sources.map((s) => [s.name.toLowerCase(), s])
        );

        // Strategy 2: If sources empty, check recent lead activity as fallback
        let recentLeadSourceIds: Set<number> | null = null;
        if (sources.length === 0) {
          console.log(`[WhatsAppHealth] ${tenant.slug}:${team} — Sources API empty, checking recent leads...`);
          recentLeadSourceIds = await this.getRecentLeadSourceIds(service, team, tenant.slug);
        }

        for (const num of teamNumbers) {
          await this.checkNumber(num, sourceMap, sources.length > 0, recentLeadSourceIds, service, tenant);
        }
      } catch (err: any) {
        console.error(`[WhatsAppHealth] API error for ${tenant.slug}:${team}:`, err.message);
        this.sendAdminAlert(
          `Erro na API Kommo (${tenant.name}, time ${team}): ${err.message}`
        );
      }
    }
  }

  /**
   * When /sources returns empty (common for WhatsApp managed by Amojo system),
   * check recent leads to find active source IDs as a fallback signal.
   */
  private static async getRecentLeadSourceIds(
    service: KommoService,
    team: string,
    tenantSlug: string
  ): Promise<Set<number>> {
    const sourceIds = new Set<number>();
    try {
      const threeHoursAgo = Math.floor(Date.now() / 1000) - 3 * 3600;
      const recentLeads = await service.getLeads({
        limit: 50,
        filter: { created_at: { from: threeHoursAgo } },
      });

      for (const lead of recentLeads) {
        const sourceId = (lead as any).source_id;
        if (sourceId && typeof sourceId === "number") {
          sourceIds.add(sourceId);
        }
      }

      console.log(
        `[WhatsAppHealth] ${tenantSlug}:${team} — ${recentLeads.length} recent leads, ` +
        `${sourceIds.size} unique source IDs: [${Array.from(sourceIds).join(", ")}]`
      );
    } catch (err: any) {
      console.log(`[WhatsAppHealth] ${tenantSlug}:${team} — Lead fallback check failed: ${err.message}`);
    }
    return sourceIds;
  }

  private static async checkNumber(
    num: WhatsAppNumber,
    sourceMap: Map<string, SourceInfo>,
    sourcesApiHasData: boolean,
    recentLeadSourceIds: Set<number> | null,
    service: KommoService,
    tenant: Tenant
  ): Promise<void> {
    const now = new Date().toISOString();
    const sourceName = num.kommo_source_name?.toLowerCase() || "";

    // No source name configured — can't check, just update timestamp
    if (!sourceName) {
      await supabase
        .from("whatsapp_numbers")
        .update({ last_checked_at: now })
        .eq("id", num.id);
      return;
    }

    let found = false;
    let matchedSourceId: number | null = num.kommo_source_id;

    if (sourcesApiHasData) {
      // === STRATEGY 1: Match by source name in /sources response ===
      for (const [name, source] of sourceMap) {
        if (name.includes(sourceName) || sourceName.includes(name)) {
          found = true;
          matchedSourceId = source.id;

          // Check if source has error/disabled status in services array
          if (source.services && Array.isArray(source.services)) {
            const hasError = source.services.some(
              (svc: any) =>
                svc.status === "error" ||
                svc.status === "disconnected" ||
                svc.is_disabled === true
            );
            if (hasError) {
              console.log(
                `[WhatsAppHealth] Source "${name}" found but has error/disabled status — treating as disconnected`
              );
              found = false;
            }
          }
          break;
        }
      }
    } else if (recentLeadSourceIds) {
      // === STRATEGY 2: Sources API empty — use lead activity fallback ===
      if (num.kommo_source_id && recentLeadSourceIds.has(num.kommo_source_id)) {
        // We have a known source_id and it appears in recent leads → still active
        found = true;
        console.log(
          `[WhatsAppHealth] Source detected via lead activity (source_id: ${num.kommo_source_id}) for ${formatPhone(num.phone)}`
        );
      } else if (num.kommo_source_id && recentLeadSourceIds.size > 0) {
        // We have a known source_id but it's NOT in recent leads → suspicious
        // However, low traffic could cause this — only flag if previously connected
        if (num.connection_status === "connected") {
          found = false;
          console.log(
            `[WhatsAppHealth] Source_id ${num.kommo_source_id} NOT in recent leads ` +
            `(active: [${Array.from(recentLeadSourceIds).join(",")}]) — marking disconnected`
          );
        } else {
          // Status was already unknown/disconnected — don't change
          await supabase
            .from("whatsapp_numbers")
            .update({ last_checked_at: now })
            .eq("id", num.id);
          return;
        }
      } else {
        // No known source_id OR no recent leads at all — can't determine
        console.log(
          `[WhatsAppHealth] Can't determine status for ${formatPhone(num.phone)} — ` +
          `no source_id (${num.kommo_source_id}) and/or no recent leads`
        );
        await supabase
          .from("whatsapp_numbers")
          .update({ last_checked_at: now })
          .eq("id", num.id);
        return;
      }
    } else {
      // Both strategies failed — leave status unchanged
      await supabase
        .from("whatsapp_numbers")
        .update({ last_checked_at: now })
        .eq("id", num.id);
      return;
    }

    const wasDisconnected = num.connection_status === "disconnected";

    if (!found) {
      // === DISCONNECTED ===
      if (!wasDisconnected) {
        console.log(
          `[WhatsAppHealth] DISCONNECTED: ${formatPhone(num.phone)} (${num.kommo_source_name})`
        );
        await this.markDisconnected(num, now);
        await this.alertDisconnection(num, tenant);
      } else {
        // Already disconnected — check cooldown for re-alert
        const lastAlert = num.last_alert_at ? new Date(num.last_alert_at).getTime() : 0;
        if (Date.now() - lastAlert >= ALERT_COOLDOWN_MS) {
          console.log(
            `[WhatsAppHealth] Still disconnected, re-alerting: ${formatPhone(num.phone)}`
          );
          await this.alertDisconnection(num, tenant);
        }
      }
    } else {
      // === CONNECTED ===
      if (wasDisconnected) {
        console.log(
          `[WhatsAppHealth] RECONNECTED: ${formatPhone(num.phone)} (${num.kommo_source_name})`
        );
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
