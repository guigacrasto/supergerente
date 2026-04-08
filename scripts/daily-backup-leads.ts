/**
 * Backup diário de leads:
 * 1. Puxa TODOS os leads do Kommo (azul + amarela)
 * 2. Gera CSV
 * 3. Atualiza Google Sheets
 * 4. Envia email com CSV anexado para 3 destinatários
 *
 * Rodar: npx tsx scripts/daily-backup-leads.ts
 */
import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { Resend } from "resend";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@supergerente.com";

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
  "ID Lead", "Nome Lead",
  "ID Contato", "Nome Contato", "Telefone Contato", "Email Contato",
  "ID Empresa", "Nome Empresa", "Telefone Empresa", "Email Empresa",
  "Responsável ID", "Responsável",
  "Pipeline", "Status", "Valor (R$)", "Source ID", "Tags",
  "Criado em", "Atualizado em",
];

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
    if (page % 50 === 1) console.log(`  Fetching leads page ${page}...`);
    try {
      const res = await fetch(
        `https://${subdomain}.kommo.com/api/v4/leads?with=contacts,companies,source_id&limit=250&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.status === 204) break;
      if (!res.ok) { console.log(`  API error: ${res.status}`); break; }
      const text = await res.text();
      if (!text) break;
      const data = JSON.parse(text);
      const leads = data?._embedded?.leads || [];
      if (leads.length === 0) break;
      allLeads.push(...leads);
      if (leads.length < 250) break;
      await new Promise(r => setTimeout(r, 200));
    } catch (e: any) {
      console.log(`  Fetch error page ${page}: ${e.message}`);
      break;
    }
  }
  return allLeads;
}

type ContactInfo = { name: string; phone: string; email: string };
async function fetchAllContacts(subdomain: string, accessToken: string): Promise<Map<number, ContactInfo>> {
  const map = new Map<number, ContactInfo>();
  for (let page = 1; page <= 1000; page++) {
    if (page % 50 === 1) console.log(`  Fetching contacts page ${page}...`);
    try {
      const res = await fetch(
        `https://${subdomain}.kommo.com/api/v4/contacts?with=custom_fields_values&limit=250&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.status === 204) break;
      if (!res.ok) break;
      const text = await res.text();
      if (!text) break;
      const data = JSON.parse(text);
      const contacts = data?._embedded?.contacts || [];
      if (contacts.length === 0) break;
      for (const c of contacts) {
        map.set(c.id, {
          name: c.name || "",
          phone: extractCustomField(c.custom_fields_values, "PHONE"),
          email: extractCustomField(c.custom_fields_values, "EMAIL"),
        });
      }
      if (contacts.length < 250) break;
      await new Promise(r => setTimeout(r, 200));
    } catch {
      break;
    }
  }
  return map;
}

type CompanyInfo = { name: string; phone: string; email: string };
async function fetchAllCompanies(subdomain: string, accessToken: string): Promise<Map<number, CompanyInfo>> {
  const map = new Map<number, CompanyInfo>();
  for (let page = 1; page <= 1000; page++) {
    if (page % 50 === 1) console.log(`  Fetching companies page ${page}...`);
    try {
      const res = await fetch(
        `https://${subdomain}.kommo.com/api/v4/companies?with=custom_fields_values&limit=250&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.status === 204) break;
      if (!res.ok) break;
      const text = await res.text();
      if (!text) break;
      const data = JSON.parse(text);
      const companies = data?._embedded?.companies || [];
      if (companies.length === 0) break;
      for (const c of companies) {
        map.set(c.id, {
          name: c.name || "",
          phone: extractCustomField(c.custom_fields_values, "PHONE"),
          email: extractCustomField(c.custom_fields_values, "EMAIL"),
        });
      }
      if (companies.length < 250) break;
      await new Promise(r => setTimeout(r, 200));
    } catch {
      break;
    }
  }
  return map;
}

function extractCustomField(cfv: any[] | null | undefined, fieldCode: string): string {
  if (!Array.isArray(cfv)) return "";
  for (const cf of cfv) {
    if (cf.field_code === fieldCode) {
      return cf.values?.[0]?.value?.toString() || "";
    }
  }
  return "";
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

function formatDate(ts: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function extractTags(lead: any): string {
  return (lead._embedded?.tags || []).map((t: any) => t.name).join(", ");
}

function buildRows(
  leads: any[],
  userMap: Map<number, string>,
  pipelineMap: Map<number, string>,
  statusMap: Map<number, string>,
  contactMap: Map<number, ContactInfo>,
  companyMap: Map<number, CompanyInfo>,
): string[][] {
  return leads.map(lead => {
    const contactId = lead._embedded?.contacts?.[0]?.id;
    const companyId = lead._embedded?.companies?.[0]?.id;
    const contact = contactId ? contactMap.get(contactId) : undefined;
    const company = companyId ? companyMap.get(companyId) : undefined;

    return [
      String(lead.id),
      lead.name || "",
      contactId ? String(contactId) : "",
      contact?.name || "",
      contact?.phone || "",
      contact?.email || "",
      companyId ? String(companyId) : "",
      company?.name || "",
      company?.phone || "",
      company?.email || "",
      String(lead.responsible_user_id || ""),
      userMap.get(lead.responsible_user_id) || `#${lead.responsible_user_id}`,
      pipelineMap.get(lead.pipeline_id) || `#${lead.pipeline_id}`,
      statusMap.get(lead.status_id) || `#${lead.status_id}`,
      lead.price ? String(lead.price) : "",
      lead.source_id ? String(lead.source_id) : "",
      extractTags(lead),
      formatDate(lead.created_at),
      formatDate(lead.updated_at),
    ];
  });
}

function rowsToCsv(rows: string[][]): string {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [HEADERS.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  return "\uFEFF" + lines.join("\n"); // BOM for Excel compatibility
}

async function getSheetsClient() {
  const keyPath = path.resolve(__dirname, "../google-service-account.json");
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
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

async function sendEmail(csvBuffers: { team: string; csv: string; count: number }[]) {
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const attachments = csvBuffers.map(({ team, csv }) => ({
    filename: `leads-${team}-${today.replace(/\//g, "-")}.csv`,
    content: Buffer.from(csv, "utf-8").toString("base64"),
    type: "text/csv" as const,
  }));

  const summary = csvBuffers
    .map(({ team, count }) => `• <b>${team.toUpperCase()}</b>: ${count.toLocaleString("pt-BR")} leads`)
    .join("<br>");

  const { error } = await resend.emails.send({
    from: `SuperGerente Backup <${FROM_EMAIL}>`,
    to: RECIPIENTS,
    subject: `📊 Backup Leads Kommo — ${today}`,
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
    attachments,
  });

  if (error) {
    console.error("  Erro ao enviar email:", error);
    return false;
  }
  return true;
}

async function main() {
  console.log("=== BACKUP DIÁRIO DE LEADS ===\n");

  const sheets = await getSheetsClient();
  const csvBuffers: { team: string; csv: string; count: number }[] = [];

  for (const team of ["azul", "amarela"]) {
    console.log(`\n--- ${team.toUpperCase()} ---`);
    const token = await getToken(team);
    if (!token.subdomain || !token.accessToken) {
      console.log("  Token não encontrado, pulando...");
      continue;
    }

    const [allLeads, userMap, { pipelineMap, statusMap }, contactMap, companyMap] = await Promise.all([
      fetchAllLeads(token.subdomain, token.accessToken),
      fetchUsers(token.subdomain, token.accessToken),
      fetchPipelines(token.subdomain, token.accessToken),
      fetchAllContacts(token.subdomain, token.accessToken),
      fetchAllCompanies(token.subdomain, token.accessToken),
    ]);

    console.log(`  ${allLeads.length} leads | ${contactMap.size} contatos | ${companyMap.size} empresas`);

    const rows = buildRows(allLeads, userMap, pipelineMap, statusMap, contactMap, companyMap);

    // Google Sheets
    const spreadsheetId = SHEETS[team];
    if (spreadsheetId) {
      console.log(`  Atualizando Google Sheets...`);
      await writeToSheet(sheets, spreadsheetId, rows);
      console.log(`  ✅ Planilha atualizada!`);
    }

    // CSV
    const csv = rowsToCsv(rows);
    csvBuffers.push({ team, csv, count: allLeads.length });
    console.log(`  ✅ CSV gerado (${(csv.length / 1024 / 1024).toFixed(1)} MB)`);
  }

  // Email
  if (csvBuffers.length > 0) {
    console.log(`\nEnviando email para ${RECIPIENTS.length} destinatários...`);
    const ok = await sendEmail(csvBuffers);
    if (ok) {
      console.log(`✅ Email enviado para: ${RECIPIENTS.join(", ")}`);
    } else {
      console.log("❌ Falha ao enviar email");
    }
  }

  console.log("\n✅ BACKUP COMPLETO!");
}

main().catch(console.error);
