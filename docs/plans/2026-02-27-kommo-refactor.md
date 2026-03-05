# SuperGerente — Plano de Implementação do Refactor

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganizar o projeto de forma que cada arquivo tenha uma responsabilidade clara, sem código duplicado e sem credenciais expostas.

**Architecture:** Um único projeto TypeScript com dois entry points (`src/api/index.ts` para o web server e `src/mcp/index.ts` para o MCP). Ambos compartilham `src/services/kommo.ts` e `src/config.ts`. As routes da API são separadas por recurso em `src/api/routes/`.

**Tech Stack:** TypeScript, Express 5, React (Vite), Google Gemini, MCP SDK, dotenv, axios, qs

---

## Task 1: Proteger credenciais e limpar arquivos desnecessários

**Contexto:** O `.env` com credenciais reais está sendo rastreado pelo git. Precisamos parar de rastreá-lo sem apagá-lo do disco.

**Files:**
- Modify: `.gitignore`

**Step 1: Verificar o que o git está rastreando**

```bash
cd /Users/guicrasto/antigravity-gui/supergerente
git ls-files | grep -E "\.env|build/|web/dist"
```

Esperado: ver `.env` listado (confirma que está sendo rastreado)

**Step 2: Atualizar o .gitignore**

Abrir `.gitignore` e garantir que contém estas linhas:
```
.env
build/
web/dist/
node_modules/
```

**Step 3: Remover .env do rastreamento git (sem apagar o arquivo)**

```bash
git rm --cached .env 2>/dev/null || echo "nao rastreado, ok"
git rm --cached -r build/ 2>/dev/null || echo "build nao rastreado, ok"
git rm --cached -r web/dist/ 2>/dev/null || echo "web/dist nao rastreado, ok"
```

**Step 4: Verificar que o arquivo ainda existe no disco**

```bash
ls .env
```

Esperado: arquivo ainda presente. Só saiu do rastreamento git.

**Step 5: Verificar resultado**

```bash
git status
```

Esperado: `.env` não aparece mais em "Changes to be committed".

---

## Task 2: Criar `src/config.ts` — centralizar constantes

**Contexto:** Valores como IDs de pipeline (12881607, 12882267, 13041243) e status codes (142=ganho, 143=perdido) estão hardcoded em vários lugares. Precisamos de um único arquivo de configuração.

**Files:**
- Create: `src/config.ts`

**Step 1: Criar o arquivo**

```typescript
// src/config.ts
import dotenv from "dotenv";
dotenv.config();

// IDs dos funis no Kommo CRM
export const PIPELINE_IDS = {
  TRYVION: 12881607,
  MATRIZ: 12882267,
  AXION: 13041243,
} as const;

export const ALLOWED_PIPELINE_IDS = Object.values(PIPELINE_IDS);

// Status codes do Kommo
export const STATUS = {
  WON: 142,
  LOST: 143,
} as const;

// Configuração do servidor web
export const PORT = parseInt(process.env.PORT || "3000", 10);

// Configuração do Kommo CRM
export const kommoConfig = {
  subdomain: process.env.KOMMO_SUBDOMAIN || "",
  clientId: process.env.KOMMO_CLIENT_ID || "",
  clientSecret: process.env.KOMMO_CLIENT_SECRET || "",
  redirectUri: process.env.KOMMO_REDIRECT_URI || "",
  accessToken: process.env.KOMMO_ACCESS_TOKEN || "",
};

// Validação de variáveis obrigatórias
export function validateConfig() {
  if (!kommoConfig.subdomain || !kommoConfig.accessToken) {
    console.error("Erro: KOMMO_SUBDOMAIN e KOMMO_ACCESS_TOKEN são obrigatórios no .env");
    process.exit(1);
  }
}
```

**Step 2: Verificar que compila**

```bash
npx tsx src/config.ts
```

Esperado: nenhum erro de TypeScript.

---

## Task 3: Criar estrutura de pastas da API

**Contexto:** Vamos criar os diretórios necessários antes de mover os arquivos.

**Files:**
- Create directories: `src/api/routes/`, `src/mcp/`

**Step 1: Criar os diretórios**

```bash
mkdir -p src/api/routes src/mcp
```

**Step 2: Confirmar**

```bash
ls src/
```

Esperado: `api/`, `mcp/`, `services/`, `types/`, `config.ts` (e os arquivos antigos ainda presentes por enquanto)

---

## Task 4: Criar `src/api/routes/pipelines.ts`

**Contexto:** Extrair a rota `GET /api/pipelines` do `web-server.ts` para um arquivo próprio.

**Files:**
- Create: `src/api/routes/pipelines.ts`

**Step 1: Criar o arquivo**

```typescript
// src/api/routes/pipelines.ts
import { Router } from "express";
import { KommoService } from "../../services/kommo.js";
import { ALLOWED_PIPELINE_IDS } from "../../config.js";

export function pipelinesRouter(service: KommoService) {
  const router = Router();

  // GET /api/pipelines — retorna apenas os funis permitidos (Tryvion, Matriz, Axion)
  router.get("/", async (req, res) => {
    try {
      const pipelines = await service.getPipelines();
      const filtered = pipelines.filter(p => ALLOWED_PIPELINE_IDS.includes(p.id));
      res.json(filtered.map(p => ({ id: p.id, name: p.name })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
```

**Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

---

## Task 5: Criar `src/api/routes/leads.ts`

**Contexto:** Extrair a rota `GET /api/leads/new/:pipelineId` do `web-server.ts`.

**Files:**
- Create: `src/api/routes/leads.ts`

**Step 1: Criar o arquivo**

```typescript
// src/api/routes/leads.ts
import { Router } from "express";
import { KommoService } from "../../services/kommo.js";

function formatDateOnly(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

function formatDateTimeGMT3(date: Date): string {
  const gmt3Time = date.getTime() + -3 * 60 * 60 * 1000;
  const d = new Date(gmt3Time);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min} (GMT-3)`;
}

export function leadsRouter(service: KommoService) {
  const router = Router();

  // GET /api/leads/new/:pipelineId — contagem de novos leads no período
  router.get("/new/:pipelineId", async (req, res) => {
    const { pipelineId } = req.params;
    const { from, to } = req.query;

    try {
      const pipelines = await service.getPipelines();
      const pipe = pipelines.find(p => p.id === parseInt(pipelineId));
      if (!pipe) return res.status(404).json({ error: "Pipeline não encontrado" });

      const newLeadStatuses = pipe._embedded.statuses
        .filter((s: any) =>
          s.name.toUpperCase().includes("NEW LEADS") ||
          s.name.toUpperCase().includes("ENTRADA")
        )
        .map((s: any) => s.id);

      if (newLeadStatuses.length === 0 && pipe._embedded.statuses.length > 0) {
        newLeadStatuses.push(pipe._embedded.statuses[0].id);
      }

      const filterCreated: any = { pipeline_id: [parseInt(pipelineId)] };
      if (from || to) {
        filterCreated.created_at = {};
        if (from) filterCreated.created_at.from = parseInt(from as string);
        if (to) filterCreated.created_at.to = parseInt(to as string);
      }

      const leadsCreated = await service.getLeads({ filter: filterCreated, limit: 250 });
      const filteredCreated = leadsCreated.filter(
        l => !l.name.toLowerCase().includes("autolead")
      );
      const remainingLeads = filteredCreated.filter(l =>
        newLeadStatuses.includes(l.status_id)
      );

      const periodStr =
        from && to
          ? `${formatDateOnly(parseInt(from as string))} até ${formatDateOnly(parseInt(to as string))}`
          : "Geral";

      res.json({
        created: filteredCreated.length,
        remaining: remainingLeads.length,
        brand: pipe.name.replace("FUNIL ", ""),
        period: periodStr,
        fetchedAt: formatDateTimeGMT3(new Date()),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
```

**Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

---

## Task 6: Criar `src/api/routes/reports.ts`

**Contexto:** A função `getAgentPerformanceData` e a rota `GET /api/reports/agents` saem do `web-server.ts` e entram aqui. Os 9 scripts de `src/scripts/` foram analisados — toda a lógica relevante que ainda não estava na web já está coberta por este endpoint de agentes.

**Files:**
- Create: `src/api/routes/reports.ts`

**Step 1: Criar o arquivo**

```typescript
// src/api/routes/reports.ts
import { Router } from "express";
import { KommoService } from "../../services/kommo.js";
import { STATUS } from "../../config.js";

async function getAgentPerformanceData(service: KommoService) {
  const [users, pipelines, leads] = await Promise.all([
    service.getUsers(),
    service.getPipelines(),
    service.getLeads(),
  ]);

  const userMap = new Map<number, string>();
  const agentStats: Record<string, any> = {};

  users.forEach(u => {
    userMap.set(u.id, u.name);
    agentStats[u.name] = {
      Agente: u.name,
      "Total Leads": 0,
      _wonCount: 0,
      _wonPrice: 0,
      _lostCount: 0,
      stages: {} as Record<string, number>,
    };
  });

  const statusMap: Record<number, string> = {};
  pipelines.forEach((p: any) => {
    p._embedded.statuses.forEach((s: any) => {
      statusMap[s.id] = s.name;
    });
  });

  leads.forEach(l => {
    const uName = userMap.get(l.responsible_user_id) || `ID: ${l.responsible_user_id}`;

    if (!agentStats[uName]) {
      agentStats[uName] = {
        Agente: uName,
        "Total Leads": 0,
        _wonCount: 0,
        _wonPrice: 0,
        _lostCount: 0,
        stages: {} as Record<string, number>,
      };
    }

    const stats = agentStats[uName];
    stats["Total Leads"]++;

    const stageName = statusMap[l.status_id] || `Status ${l.status_id}`;

    if (l.status_id !== STATUS.WON && l.status_id !== STATUS.LOST) {
      stats.stages[stageName] = (stats.stages[stageName] || 0) + 1;
    }

    if (l.status_id === STATUS.WON) {
      stats._wonCount++;
      stats._wonPrice += l.price || 0;
    }

    if (l.status_id === STATUS.LOST) {
      stats._lostCount++;
    }
  });

  return Object.values(agentStats).map(stats => {
    const total = stats["Total Leads"] || 1;
    const row: any = {
      Agente: stats.Agente,
      "Total Leads": stats["Total Leads"],
      "Venda Ganha": `${stats._wonCount || 0} (${(((stats._wonCount || 0) / total) * 100).toFixed(1)}%)`,
      "Venda Perdida": `${stats._lostCount || 0} (${(((stats._lostCount || 0) / total) * 100).toFixed(1)}%)`,
      "Ticket Médio": stats._wonPrice / (stats._wonCount || 1),
    };
    Object.entries(stats.stages).forEach(([name, count]) => {
      row[name] = count;
    });
    return row;
  });
}

export function reportsRouter(service: KommoService) {
  const router = Router();

  // GET /api/reports/agents — desempenho de todos os agentes
  router.get("/agents", async (req, res) => {
    try {
      const rawData = await getAgentPerformanceData(service);
      const formatted = rawData.map(row => ({
        ...row,
        "Ticket Médio":
          "R$ " +
          row["Ticket Médio"].toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        "Conversão %":
          ((parseInt(row["Venda Ganha"]) / row["Total Leads"]) * 100).toFixed(1) + "%",
      }));
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
```

**Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

---

## Task 7: Criar `src/api/routes/chat.ts`

**Contexto:** Extrair a rota `POST /api/chat` com Gemini do `web-server.ts`.

**Files:**
- Create: `src/api/routes/chat.ts`

**Step 1: Criar o arquivo**

```typescript
// src/api/routes/chat.ts
import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { KommoService } from "../../services/kommo.js";

export function chatRouter(service: KommoService) {
  const router = Router();

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });

  // POST /api/chat — chat com Gemini usando contexto do CRM
  router.post("/", async (req, res) => {
    const { message } = req.body;

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "SUA_CHAVE_AQUI") {
      return res.json({
        response:
          "Ops! Eu preciso de uma GEMINI_API_KEY no arquivo .env para funcionar.",
      });
    }

    try {
      const [pipelines, users, leads] = await Promise.all([
        service.getPipelines(),
        service.getUsers(),
        service.getLeads({ limit: 250 }),
      ]);

      const agentSummary = users.slice(0, 15).map(u => ({
        nome: u.name,
        leads: leads.filter((l: any) => l.responsible_user_id === u.id).length,
      }));

      const systemPrompt = `
Você é o assistente inteligente do Kommo CRM para a empresa Tryvion/Axion.
Seu objetivo é analisar dados e responder dúvidas de gerentes com precisão e tom profissional.

CONTEXTO ATUAL DO CRM:
Pipelines Ativos: ${pipelines.map((p: any) => p.name).join(", ")}
Resumo de Vendedores: ${JSON.stringify(agentSummary)}

Regras:
- Responda em Português Brasil.
- Use Markdown para formatar (tabelas, negrito, etc.).
- Baseie suas respostas estritamente no CONTEXTO ATUAL acima.
- Data/Hora Atual: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (GMT-3).
      `;

      const chat = model.startChat({
        history: [
          { role: "user", parts: [{ text: systemPrompt }] },
          {
            role: "model",
            parts: [
              {
                text: "Compreendido. Sou o assistente inteligente da Tryvion/Axion e estou pronto para analisar os dados do seu CRM. Como posso ajudar?",
              },
            ],
          },
        ],
      });

      const result = await chat.sendMessage(message);
      res.json({ response: result.response.text() });
    } catch (error: any) {
      console.error("Erro Gemini:", error);
      res.status(500).json({ response: "Erro ao consultar o Gemini.", error: error.message });
    }
  });

  return router;
}
```

**Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

---

## Task 8: Criar `src/api/server.ts` — montar o Express

**Contexto:** Juntar todas as routes num único arquivo de configuração do Express.

**Files:**
- Create: `src/api/server.ts`

**Step 1: Criar o arquivo**

```typescript
// src/api/server.ts
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { KommoService } from "../services/kommo.js";
import { pipelinesRouter } from "./routes/pipelines.js";
import { leadsRouter } from "./routes/leads.js";
import { reportsRouter } from "./routes/reports.js";
import { chatRouter } from "./routes/chat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createServer(service: KommoService) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api/pipelines", pipelinesRouter(service));
  app.use("/api/leads", leadsRouter(service));
  app.use("/api/reports", reportsRouter(service));
  app.use("/api/chat", chatRouter(service));

  // Servir o frontend React compilado
  const webPath = join(__dirname, "../../web/dist");
  app.use(express.static(webPath));

  return app;
}
```

**Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

---

## Task 9: Criar `src/api/index.ts` — entry point do web server

**Files:**
- Create: `src/api/index.ts`

**Step 1: Criar o arquivo**

```typescript
// src/api/index.ts
import { kommoConfig, validateConfig, PORT } from "../config.js";
import { KommoService } from "../services/kommo.js";
import { createServer } from "./server.js";

validateConfig();

const service = new KommoService(kommoConfig);
const app = createServer(service);

app.listen(PORT, () => {
  console.log(`Web server rodando em http://localhost:${PORT}`);
});
```

**Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

---

## Task 10: Criar `src/mcp/index.ts` — entry point do MCP server

**Contexto:** Mover e limpar o `src/index.ts` atual. A lógica é a mesma, mas agora usa `config.ts` e está no lugar certo.

**Files:**
- Create: `src/mcp/index.ts`

**Step 1: Criar o arquivo**

Copiar o conteúdo de `src/index.ts` para `src/mcp/index.ts`, com as seguintes mudanças:
- Substituir o bloco de configuração manual pelo import de `config.ts`
- Ajustar todos os imports relativos (ex: `../services/kommo.js` em vez de `./services/kommo.js`)

```typescript
// src/mcp/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { kommoConfig, validateConfig, STATUS } from "../config.js";
import { KommoService } from "../services/kommo.js";

validateConfig();

const kommoService = new KommoService(kommoConfig);

const server = new Server(
  { name: "supergerente", version: "1.0.0" },
  { capabilities: { resources: {}, tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_recent_leads",
      description: "Retorna os leads mais recentes do Kommo CRM",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade de leads (padrão: 10)" },
        },
      },
    },
    {
      name: "get_lead_details",
      description: "Retorna detalhes de um lead específico",
      inputSchema: {
        type: "object",
        properties: {
          lead_id: { type: "number", description: "ID do lead" },
        },
        required: ["lead_id"],
      },
    },
    {
      name: "get_lead_notes",
      description: "Retorna notas e histórico de um lead",
      inputSchema: {
        type: "object",
        properties: {
          lead_id: { type: "number", description: "ID do lead" },
        },
        required: ["lead_id"],
      },
    },
    {
      name: "add_lead_note",
      description: "Adiciona uma nota a um lead",
      inputSchema: {
        type: "object",
        properties: {
          lead_id: { type: "number", description: "ID do lead" },
          text: { type: "string", description: "Texto da nota" },
        },
        required: ["lead_id", "text"],
      },
    },
    {
      name: "get_team_report",
      description: "Gera relatório de desempenho da equipe",
      inputSchema: {
        type: "object",
        properties: {
          days: { type: "number", description: "Período em dias (padrão: 30)" },
          limit: { type: "number", description: "Limite de eventos por categoria (padrão: 100, máx: 500)" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_recent_leads") {
      const limit = args?.limit ? Number(args.limit) : 10;
      const leads = await kommoService.getRecentLeads(limit);
      return { content: [{ type: "text", text: JSON.stringify(leads, null, 2) }] };
    }

    if (name === "get_lead_details") {
      const leadId = Number(args?.lead_id);
      if (!leadId) throw new Error("lead_id obrigatório");
      const lead = await kommoService.getLeadDetails(leadId);
      return { content: [{ type: "text", text: JSON.stringify(lead, null, 2) }] };
    }

    if (name === "get_lead_notes") {
      const leadId = Number(args?.lead_id);
      if (!leadId) throw new Error("lead_id obrigatório");
      const notes = await kommoService.getLeadNotes(leadId);
      return { content: [{ type: "text", text: JSON.stringify(notes, null, 2) }] };
    }

    if (name === "add_lead_note") {
      const leadId = Number(args?.lead_id);
      const text = args?.text as string;
      if (!leadId || !text) throw new Error("lead_id e text são obrigatórios");
      const result = await kommoService.addNote(leadId, text);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "get_team_report") {
      const days = args?.days ? Number(args.days) : 30;
      const limit = args?.limit ? Math.min(Number(args.limit), 500) : 100;
      const timestamp = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

      const [users, pipelines, leadsCreated, leadsUpdated, activeLeads, events] =
        await Promise.all([
          kommoService.getUsers(),
          kommoService.getPipelines(),
          kommoService.getLeads({ filter: { created_at: { from: timestamp } }, limit }),
          kommoService.getLeads({ filter: { updated_at: { from: timestamp }, status: [STATUS.WON, STATUS.LOST] }, limit }),
          kommoService.getLeads({ limit }),
          kommoService.getEvents({ limit }),
        ]);

      const userMap = new Map<number, string>();
      users.forEach(u => userMap.set(u.id, u.name));

      const stats: any = {};
      users.forEach(u => {
        stats[u.id] = { name: u.name, responses: 0, notes: 0, moves: 0, sales_won: 0, sales_lost: 0, leads_received: 0 };
      });
      stats[0] = { name: "Sistema/Automação", responses: 0, notes: 0, moves: 0, sales_won: 0, sales_lost: 0, leads_received: 0 };

      events.forEach(event => {
        const userId = event.created_by || 0;
        if (!stats[userId]) {
          stats[userId] = { name: userMap.get(userId) || `User ${userId}`, responses: 0, notes: 0, moves: 0, sales_won: 0, sales_lost: 0, leads_received: 0 };
        }
        const type = event.type;
        if (type === "outgoing_chat_message" || type === "transport_message") stats[userId].responses++;
        else if (["common_note", "note_added", "service_note_added", "task_result_added"].includes(type)) stats[userId].notes++;
        else if (type === "lead_status_changed") stats[userId].moves++;
      });

      leadsCreated.forEach(lead => {
        const userId = lead.responsible_user_id || 0;
        if (stats[userId]) stats[userId].leads_received++;
      });

      leadsUpdated.forEach(lead => {
        const userId = lead.responsible_user_id || 0;
        if (stats[userId]) {
          if (lead.status_id === STATUS.WON) stats[userId].sales_won++;
          if (lead.status_id === STATUS.LOST) stats[userId].sales_lost++;
        }
      });

      const pipelineMap: any = {};
      pipelines.forEach((p: any) => {
        pipelineMap[p.id] = { id: p.id, name: p.name, stages: {} };
        p._embedded.statuses.forEach((s: any) => {
          pipelineMap[p.id].stages[s.id] = { name: s.name, count: 0 };
        });
      });

      activeLeads.forEach(lead => {
        const pid = lead.pipeline_id;
        const sid = lead.status_id;
        if (!pipelineMap[pid]) pipelineMap[pid] = { id: pid, name: `Pipeline ${pid}`, stages: {} };
        if (!pipelineMap[pid].stages[sid]) pipelineMap[pid].stages[sid] = { name: `Status ${sid}`, count: 0 };
        pipelineMap[pid].stages[sid].count++;
      });

      const agentMetrics = Object.values(stats)
        .filter((s: any) => s.name !== "Sistema/Automação" && (s.responses + s.notes + s.moves + s.sales_won + s.sales_lost + s.leads_received) > 0)
        .map((s: any) => ({
          agent: s.name,
          leads_received: s.leads_received,
          moves: s.moves,
          sales_won: s.sales_won,
          sales_lost: s.sales_lost,
          activity_score: s.responses + s.notes,
        }));

      const pipelineBreakdown = Object.values(pipelineMap)
        .map((p: any) => ({
          pipeline: p.name,
          total_leads: Object.values(p.stages).reduce((acc: number, s: any) => acc + s.count, 0),
          stages: Object.values(p.stages).filter((s: any) => s.count > 0).sort((a: any, b: any) => b.count - a.count),
        }))
        .filter(p => p.total_leads > 0)
        .sort((a, b) => b.total_leads - a.total_leads);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ period: `Last ${days} days`, agents: agentMetrics, pipeline_breakdown: pipelineBreakdown }, null, 2),
        }],
      };
    }

    throw new Error(`Tool não encontrado: ${name}`);
  } catch (error: any) {
    return { content: [{ type: "text", text: `Erro: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SuperGerente rodando via stdio");
}

main().catch(error => {
  console.error("Erro fatal:", error);
  process.exit(1);
});
```

**Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

---

## Task 11: Atualizar `package.json` com novos scripts

**Files:**
- Modify: `package.json`

**Step 1: Atualizar os scripts**

Substituir a seção `"scripts"` por:

```json
"scripts": {
  "build": "tsc",
  "web": "node build/api/index.js",
  "mcp": "node build/mcp/index.js",
  "dev:web": "tsx watch src/api/index.ts",
  "dev:mcp": "tsx watch src/mcp/index.ts"
}
```

**Step 2: Verificar que o build funciona**

```bash
npm run build
```

Esperado: pasta `build/` gerada com `build/api/index.js` e `build/mcp/index.js`.

---

## Task 12: Remover arquivos antigos

**Contexto:** Os arquivos originais já foram substituídos pelos novos. Podemos deletar com segurança.

**Files:**
- Delete: `src/index.ts`
- Delete: `src/web-server.ts`
- Delete: `src/inspect_pipelines.ts`
- Delete: `src/scripts/` (pasta inteira)
- Delete: `src/tools/` (pasta vazia)

**Step 1: Deletar**

```bash
rm src/index.ts src/web-server.ts src/inspect_pipelines.ts
rm -rf src/scripts/ src/tools/
```

**Step 2: Verificar que o build ainda funciona**

```bash
npm run build
```

Esperado: sem erros. Build completo.

**Step 3: Verificar estrutura final**

```bash
find src/ -type f | sort
```

Esperado:
```
src/api/index.ts
src/api/routes/chat.ts
src/api/routes/leads.ts
src/api/routes/pipelines.ts
src/api/routes/reports.ts
src/api/server.ts
src/config.ts
src/mcp/index.ts
src/services/kommo.ts
src/types/index.ts
```

---

## Task 13: Teste de smoke — verificar que o web server sobe

**Contexto:** Confirmar que o server roda e responde às rotas básicas.

**Step 1: Iniciar o server em background**

```bash
npm run dev:web &
```

**Step 2: Testar rota de pipelines**

```bash
curl http://localhost:3000/api/pipelines
```

Esperado: JSON com os 3 funis (Tryvion, Matriz, Axion).

**Step 3: Parar o server**

```bash
kill %1
```

---

## Resumo das mudanças

| Antes | Depois |
|---|---|
| `src/index.ts` (MCP) | `src/mcp/index.ts` |
| `src/web-server.ts` (Express monolítico) | `src/api/server.ts` + 4 routes separadas |
| `src/scripts/` (9 scripts duplicados) | Lógica integrada em `src/api/routes/reports.ts` |
| `src/inspect_pipelines.ts` | Removido |
| `src/tools/` (vazia) | Removido |
| Valores hardcoded espalhados | `src/config.ts` centralizado |
| `.env` rastreado pelo git | `.env` removido do rastreamento |
| `npm run start:web` | `npm run web` |
| `npm run dev` (MCP) | `npm run dev:mcp` |
