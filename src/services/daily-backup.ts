/**
 * Backup diário automático de leads do Kommo → Google Sheets + Email CSV
 * Roda às 6h BRT (9h UTC) todos os dias
 */
import { google } from "googleapis";
import { Resend } from "resend";
import { supabase } from "../api/supabase.js";

const RECIPIENTS = [
  "guilherme@onigroup.com.br",
  "Gleibsonbarrosnascimento89@gmail.com",
  "Operacional.geral2025@gmail.com",
];

const SHEETS: Record<string, string> = {
  azul: "1k2kxUaB1FyFWKKHd71v5b6LtMhlSk_q3wUKZR9OR5D8",
  amarela: "1dyEgqslq4kp1UXYNlJ99aiXinzkSi-oOgzivSQ16VN0",
};

const HEADERS = [
  "ID", "Nome", "Telefone", "Email", "Responsável ID", "Responsável",
  "Pipeline", "Status", "Valor (R$)", "Source ID", "Tags",
  "Criado em", "Atualizado em",
];

const TARGET_HOUR_UTC = 9; // 6h BRT = 9h UTC

async function getToken(team: string) {
  const subdomain = team === "amarela"
    ? (process.env.KOMMO_AMARELA_SUBDOMAIN || "")
    : (process.env.KOMMO_SUBDOMAIN || "");
  const { data: tokenRows } = await supabase
    .from("settings").select("key, value")
    .eq("key", `kommo_${team}_access_token`);
  const accessToken = (tokenRows || [])[0]?.value || "";
  return { subdomain, accessToken };
}

async function fetchAllLeads(subdomain: string, accessToken: string) {
  const allLeads: any[] = [];
  for (let page = 1; page <= 1000; page++) {
    try {
      const res = await fetch(
        `https://${subdomain}.kommo.com/api/v4/leads?with=contacts,source_id&limit=250&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.status === 204) break;
      if (!res.ok) break;
      const text = await res.text();
      if (!text) break;
      const data = JSON.parse(text);
      const leads = data?._embedded?.leads || [];
      if (leads.length === 0) break;
      allLeads.push(...leads);
      if (leads.length < 250) break;
      await new Promise(r => setTimeout(r, 200));
    } catch {
      break;
    }
  }
  return allLeads;
}

async function fetchUsers(subdomain: string, accessToken: string): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const res = await fetch(`https://${subdomain}.kommo.com/api/v4/users?limit=250`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    for (const u of data?._embedded?.users || []) map.set(u.id, u.name);
  } catch {}
  return map;
}

async function fetchPipelines(subdomain: string, accessToken: string) {
  const pipelineMap = new Map<number, string>();
  const statusMap = new Map<number, string>();
  try {
    const res = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/pipelines`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    for (const p of data?._embedded?.pipelines || []) {
      pipelineMap.set(p.id, p.name);
      for (const s of p._embedded?.statuses || []) statusMap.set(s.id, s.name);
    }
  } catch {}
  return { pipelineMap, statusMap };
}

function extractContactField(lead: any, fieldCode: string): string {
  for (const c of lead._embedded?.contacts || []) {
    for (const cf of c.custom_fields_values || []) {
      if (cf.field_code === fieldCode) return cf.values?.[0]?.value?.toString() || "";
    }
  }
  return "";
}

function formatDate(ts: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function buildRows(leads: any[], userMap: Map<number, string>, pipelineMap: Map<number, string>, statusMap: Map<number, string>): string[][] {
  return leads.map(lead => [
    String(lead.id),
    lead.name || "",
    extractContactField(lead, "PHONE"),
    extractContactField(lead, "EMAIL"),
    String(lead.responsible_user_id || ""),
    userMap.get(lead.responsible_user_id) || `#${lead.responsible_user_id}`,
    pipelineMap.get(lead.pipeline_id) || `#${lead.pipeline_id}`,
    statusMap.get(lead.status_id) || `#${lead.status_id}`,
    lead.price ? String(lead.price) : "",
    lead.source_id ? String(lead.source_id) : "",
    (lead._embedded?.tags || []).map((t: any) => t.name).join(", "),
    formatDate(lead.created_at),
    formatDate(lead.updated_at),
  ]);
}

function rowsToCsv(rows: string[][]): string {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [HEADERS.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  return "\uFEFF" + lines.join("\n");
}

async function getSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "{}");
  if (!credentials.client_email) return null;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function writeToSheet(sheets: any, spreadsheetId: string, rows: string[][]) {
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: "A:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [HEADERS, ...rows] },
  });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.2, green: 0.2, blue: 0.3 },
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)",
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    },
  });
}

async function runBackup() {
  console.log("[DailyBackup] Iniciando backup de leads...");
  const startTime = Date.now();

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@supergerente.com";
  const sheets = await getSheetsClient();
  const csvBuffers: { team: string; csv: string; count: number }[] = [];

  for (const team of ["azul", "amarela"]) {
    console.log(`[DailyBackup] Processando ${team}...`);
    const token = await getToken(team);
    if (!token.subdomain || !token.accessToken) {
      console.log(`[DailyBackup] ${team}: sem token, pulando`);
      continue;
    }

    const [allLeads, userMap, { pipelineMap, statusMap }] = await Promise.all([
      fetchAllLeads(token.subdomain, token.accessToken),
      fetchUsers(token.subdomain, token.accessToken),
      fetchPipelines(token.subdomain, token.accessToken),
    ]);

    console.log(`[DailyBackup] ${team}: ${allLeads.length} leads`);
    const rows = buildRows(allLeads, userMap, pipelineMap, statusMap);

    // Google Sheets
    if (sheets && SHEETS[team]) {
      try {
        await writeToSheet(sheets, SHEETS[team], rows);
        console.log(`[DailyBackup] ${team}: Google Sheets atualizado`);
      } catch (e: any) {
        console.error(`[DailyBackup] ${team}: erro ao atualizar Sheets:`, e.message);
      }
    }

    // CSV
    csvBuffers.push({ team, csv: rowsToCsv(rows), count: allLeads.length });
  }

  // Email
  if (csvBuffers.length > 0 && process.env.RESEND_API_KEY) {
    const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const summary = csvBuffers
      .map(({ team, count }) => `• <b>${team.toUpperCase()}</b>: ${count.toLocaleString("pt-BR")} leads`)
      .join("<br>");

    try {
      await resend.emails.send({
        from: `SuperGerente Backup <${fromEmail}>`,
        to: RECIPIENTS,
        subject: `Backup Leads Kommo — ${today}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #9566F2;">Backup Diário de Leads</h2>
            <p>Segue em anexo o backup completo dos leads do Kommo.</p>
            <p><b>Data:</b> ${today}</p>
            <p>${summary}</p>
            <br>
            <p style="color: #666; font-size: 12px;">Enviado automaticamente pelo SuperGerente.</p>
          </div>
        `,
        attachments: csvBuffers.map(({ team, csv }) => ({
          filename: `leads-${team}-${today.replace(/\//g, "-")}.csv`,
          content: Buffer.from(csv, "utf-8").toString("base64"),
          type: "text/csv" as const,
        })),
      });
      console.log(`[DailyBackup] Email enviado para ${RECIPIENTS.length} destinatários`);
    } catch (e: any) {
      console.error("[DailyBackup] Erro ao enviar email:", e.message);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`[DailyBackup] Concluído em ${duration}s`);
}

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(TARGET_HOUR_UTC, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export function startDailyBackup(): void {
  const ms = msUntilNextRun();
  const hours = Math.round(ms / 3600000 * 10) / 10;
  console.log(`[DailyBackup] Próximo backup em ${hours}h (6h BRT)`);

  setTimeout(() => {
    runBackup().catch(e => console.error("[DailyBackup] Erro:", e.message));

    // Repetir a cada 24h
    setInterval(() => {
      runBackup().catch(e => console.error("[DailyBackup] Erro:", e.message));
    }, 24 * 60 * 60 * 1000);
  }, ms);
}
