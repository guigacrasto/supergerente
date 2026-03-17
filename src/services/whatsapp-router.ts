import { supabase } from "../api/supabase.js";
import { KommoService } from "./kommo.js";
import { getTeamConfigsFromTenant } from "../config.js";
import type { Tenant } from "../types/index.js";

const ROUTING_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const SOURCE_PATTERN = /fonte|source|canal|origin|channel/i;

interface QueueItem {
  id: string;
  tenant_id: string;
  team: string;
  lead_id: number;
  pipeline_id: number | null;
  scheduled_at: string;
}

export class WhatsAppRouter {
  /**
   * Schedule routing for a new lead. Inserts into queue and sets setTimeout.
   */
  static async schedule(
    leadId: number,
    pipelineId: number | null,
    tenantId: string,
    team: string
  ): Promise<void> {
    // Check if tenant has any whatsapp_numbers registered for this team
    const { count } = await supabase
      .from("whatsapp_numbers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("team", team)
      .eq("active", true);

    if (!count || count === 0) return;

    const scheduledAt = new Date(Date.now() + ROUTING_DELAY_MS).toISOString();

    const { data: item, error } = await supabase
      .from("whatsapp_routing_queue")
      .insert({
        tenant_id: tenantId,
        team,
        lead_id: leadId,
        pipeline_id: pipelineId,
        scheduled_at: scheduledAt,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[WhatsAppRouter] Failed to insert queue item:", error.message);
      return;
    }

    console.log(`[WhatsAppRouter] Scheduled routing for lead ${leadId} in 5 min (queue: ${item.id})`);

    setTimeout(() => {
      WhatsAppRouter.processQueueItem(item.id).catch((err) =>
        console.error(`[WhatsAppRouter] Timer error for ${item.id}:`, err.message)
      );
    }, ROUTING_DELAY_MS);
  }

  /**
   * Process a single queue item by ID.
   */
  static async processQueueItem(queueId: string): Promise<void> {
    const { data: item } = await supabase
      .from("whatsapp_routing_queue")
      .select("*")
      .eq("id", queueId)
      .eq("status", "pending")
      .single();

    if (!item) return;

    try {
      await WhatsAppRouter.processRouting(item as QueueItem);
    } catch (err: any) {
      console.error(`[WhatsAppRouter] Error processing ${queueId}:`, err.message);
      await supabase
        .from("whatsapp_routing_queue")
        .update({ status: "failed", result: { error: err.message }, processed_at: new Date().toISOString() })
        .eq("id", queueId);
    }
  }

  /**
   * Core routing logic: fetch lead, match source, reassign.
   */
  static async processRouting(item: QueueItem): Promise<void> {
    const { tenant_id, team, lead_id } = item;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenant_id)
      .single();

    if (!tenant) {
      await WhatsAppRouter.markProcessed(item.id, "skipped", { reason: "tenant_not_found" });
      return;
    }

    const teamConfigs = getTeamConfigsFromTenant(tenant as Tenant);
    const tc = teamConfigs[team];
    if (!tc?.subdomain) {
      await WhatsAppRouter.markProcessed(item.id, "skipped", { reason: "team_config_missing" });
      return;
    }

    const service = new KommoService(tc, team, tenant_id);

    let lead: any;
    try {
      lead = await service.getLeadDetails(lead_id);
    } catch (err: any) {
      await WhatsAppRouter.markProcessed(item.id, "failed", { reason: "lead_fetch_failed", error: err.message });
      return;
    }

    const sourceName = WhatsAppRouter.extractSourceName(lead);

    const { data: numbers } = await supabase
      .from("whatsapp_numbers")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("team", team)
      .eq("active", true);

    if (!numbers || numbers.length === 0) {
      await WhatsAppRouter.markProcessed(item.id, "skipped", { reason: "no_numbers_registered" });
      return;
    }

    let matchedNumber = sourceName
      ? numbers.find((n: any) => n.kommo_source_name && sourceName.toLowerCase().includes(n.kommo_source_name.toLowerCase()))
      : null;

    if (!matchedNumber) {
      const contactPhone = WhatsAppRouter.extractContactPhone(lead);
      if (contactPhone) {
        const normalizedPhone = WhatsAppRouter.normalizePhone(contactPhone);
        matchedNumber = numbers.find((n: any) => WhatsAppRouter.normalizePhone(n.phone) === normalizedPhone);
      }
    }

    if (!matchedNumber) {
      await WhatsAppRouter.markProcessed(item.id, "skipped", {
        reason: "no_match",
        source: sourceName || "unknown",
      });
      return;
    }

    const targetKommoUserId = matchedNumber.kommo_user_id;
    if (!targetKommoUserId) {
      await WhatsAppRouter.markProcessed(item.id, "skipped", { reason: "no_kommo_user_id" });
      return;
    }

    if (lead.responsible_user_id === targetKommoUserId) {
      await WhatsAppRouter.markProcessed(item.id, "skipped", { reason: "already_assigned" });
      return;
    }

    const fromUserId = lead.responsible_user_id;
    await service.updateLeadResponsible(lead_id, targetKommoUserId);

    const contacts = lead._embedded?.contacts || [];
    for (const contact of contacts) {
      try {
        await service.updateContactResponsible(contact.id, targetKommoUserId);
      } catch (err: any) {
        console.warn(`[WhatsAppRouter] Failed to update contact ${contact.id}:`, err.message);
      }
    }

    const companies = lead._embedded?.companies || [];
    for (const company of companies) {
      try {
        await service.updateCompanyResponsible(company.id, targetKommoUserId);
      } catch (err: any) {
        console.warn(`[WhatsAppRouter] Failed to update company ${company.id}:`, err.message);
      }
    }

    await supabase.from("whatsapp_routing_logs").insert({
      tenant_id,
      team,
      lead_id,
      lead_name: lead.name || `Lead ${lead_id}`,
      from_user_id: fromUserId,
      to_user_id: targetKommoUserId,
      to_user_name: matchedNumber.kommo_source_name || matchedNumber.phone,
      phone_matched: matchedNumber.phone,
      source_name: sourceName || "unknown",
    });

    console.log(`[WhatsAppRouter] Routed lead ${lead_id}: user ${fromUserId} -> ${targetKommoUserId} (phone: ${matchedNumber.phone})`);

    await WhatsAppRouter.markProcessed(item.id, "processed", {
      from: fromUserId,
      to: targetKommoUserId,
      phone: matchedNumber.phone,
    });
  }

  /**
   * Catch-up: process pending queue items that survived a restart.
   */
  static async processPendingQueue(): Promise<void> {
    const { data: pending } = await supabase
      .from("whatsapp_routing_queue")
      .select("id, scheduled_at")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (!pending || pending.length === 0) return;

    console.log(`[WhatsAppRouter] Catch-up: ${pending.length} pending items found`);

    for (const item of pending) {
      await WhatsAppRouter.processQueueItem(item.id);
    }
  }

  private static extractSourceName(lead: any): string | null {
    const cfValues = lead.custom_fields_values;
    if (!cfValues || !Array.isArray(cfValues)) return null;

    for (const cf of cfValues) {
      if (SOURCE_PATTERN.test(cf.field_name || "")) {
        return cf.values?.[0]?.value?.toString() || null;
      }
    }
    return null;
  }

  private static extractContactPhone(lead: any): string | null {
    const contacts = lead._embedded?.contacts || [];
    for (const contact of contacts) {
      const cfs = contact.custom_fields_values || [];
      for (const cf of cfs) {
        if (cf.field_code === "PHONE" || /phone|telefone|celular/i.test(cf.field_name || "")) {
          return cf.values?.[0]?.value?.toString() || null;
        }
      }
    }
    return null;
  }

  private static normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "").replace(/^0+/, "");
  }

  private static async markProcessed(
    queueId: string,
    status: string,
    result: Record<string, any>
  ): Promise<void> {
    await supabase
      .from("whatsapp_routing_queue")
      .update({ status, result, processed_at: new Date().toISOString() })
      .eq("id", queueId);
  }
}
