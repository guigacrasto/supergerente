import { Router } from "express";
import { supabase } from "../supabase.js";
import { sendPushToUser } from "../services/push.js";
import { sendEmail } from "../services/email.js";
import { getTenantByWebhookSecret } from "../services/tenant.js";
import type { Tenant } from "../../types/index.js";

export function webhooksRouter() {
  const router = Router();

  // POST /api/webhooks/kommo — Recebe eventos do Kommo
  router.post("/kommo", async (req, res) => {
    // Lookup tenant by webhook secret
    const secret = req.headers["x-webhook-secret"] as string;
    if (!secret) {
      res.status(401).json({ error: "Missing webhook secret" });
      return;
    }

    const tenant = await getTenantByWebhookSecret(secret);
    if (!tenant) {
      res.status(403).json({ error: "Invalid webhook secret" });
      return;
    }

    try {
      const payload = req.body;
      const statusEvents = payload?.leads?.status || [];
      const addEvents = payload?.leads?.add || [];
      const updateEvents = payload?.leads?.update || [];

      for (const lead of statusEvents) {
        await handleLeadStatusChange(lead, tenant);
      }

      for (const lead of addEvents) {
        await handleLeadCreated(lead, tenant);
      }

      for (const lead of updateEvents) {
        await handleLeadUpdated(lead);
      }

      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Webhook] Erro ao processar:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

async function handleLeadStatusChange(lead: any, tenant: Tenant): Promise<void> {
  const pipelineId = lead.pipeline_id;
  const statusId = lead.status_id;
  const leadName = lead.name || `Lead ${lead.id}`;
  const responsibleUserId = lead.responsible_user_id;

  // Check if this status is configured as "hot" for this tenant
  const isHot = await isHotStatus(statusId, tenant.id);
  if (!isHot) return;

  console.log(`[Webhook:${tenant.slug}] Lead quente detectado: ${leadName} (pipeline ${pipelineId}, status ${statusId})`);

  // Find all admin users for this tenant
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, email, name")
    .eq("role", "admin")
    .eq("status", "approved")
    .eq("tenant_id", tenant.id);

  if (!admins || admins.length === 0) return;

  const title = `Lead Quente: ${leadName}`;
  const body = `O lead "${leadName}" avançou para uma etapa quente no funil.`;

  for (const admin of admins) {
    await createNotification(admin.id, tenant.id, "hot_lead", title, body, {
      lead_id: lead.id,
      pipeline_id: pipelineId,
      status_id: statusId,
      responsible_user_id: responsibleUserId,
    });

    await sendPushToUser(admin.id, title, body, { lead_id: lead.id });

    if (admin.email) {
      await sendEmail({
        to: admin.email,
        subject: title,
        html: `
          <h2>${title}</h2>
          <p>${body}</p>
          <p><strong>Pipeline:</strong> ${pipelineId}</p>
          <p><strong>Responsável:</strong> User ${responsibleUserId}</p>
        `,
      });
    }
  }
}

async function handleLeadCreated(lead: any, tenant: Tenant): Promise<void> {
  const pipelineId = lead.pipeline_id;
  const leadName = lead.name || `Lead ${lead.id}`;

  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("status", "approved")
    .eq("tenant_id", tenant.id);

  if (!admins) return;

  for (const admin of admins) {
    await createNotification(
      admin.id,
      tenant.id,
      "lead_created",
      `Novo Lead: ${leadName}`,
      `Um novo lead "${leadName}" foi criado.`,
      { lead_id: lead.id, pipeline_id: pipelineId }
    );
  }
}

async function handleLeadUpdated(lead: any): Promise<void> {
  console.log(`[Webhook] Lead atualizado: ${lead.name || lead.id}`);
}

async function isHotStatus(statusId: number, tenantId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "hot_lead_statuses")
      .eq("tenant_id", tenantId)
      .single();

    if (!data?.value) return false;

    const hotStatuses: number[] = Array.isArray(data.value)
      ? data.value
      : JSON.parse(data.value);

    return hotStatuses.includes(statusId);
  } catch {
    return false;
  }
}

async function createNotification(
  userId: string,
  tenantId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, any>
): Promise<void> {
  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      tenant_id: tenantId,
      team: "default",
      type,
      title,
      body,
      data,
    });
  } catch (err: any) {
    console.error("[Webhook] Erro ao criar notificação:", err.message);
  }
}
