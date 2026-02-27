# Chat: Cache + Métricas + Histórico — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tornar o chat do CRM rápido (cache stale-while-revalidate), inteligente (métricas pré-computadas ricas) e com memória de conversa (session history).

**Architecture:** Um módulo de cache (`crm-cache.ts`) busca todos os leads dos 3 funis em background e entrega métricas pré-calculadas (conversão, ranking, novos leads por período). A rota de chat usa essas métricas no system prompt do Gemini e mantém histórico de conversa por `sessionId` em memória.

**Tech Stack:** TypeScript, Express 5, `@google/generative-ai` (Gemini 2.5 Flash), `crypto.randomUUID`, KommoService existente, STATUS e PIPELINE_IDS de `src/config.ts`.

---

### Task 1: Criar `src/api/cache/crm-cache.ts`

**Files:**
- Create: `src/api/cache/crm-cache.ts`

**Step 1: Criar o arquivo com o código completo**

```typescript
import { KommoService } from "../../services/kommo.js";
import { PIPELINE_IDS, STATUS } from "../../config.js";

export interface VendedorMetrics {
  nome: string;
  funil: string;
  total: number;
  ganhos: number;
  perdidos: number;
  ativos: number;
  conversao: string;
  novosSemana: number;
  novosMes: number;
}

export interface FunilMetrics {
  nome: string;
  total: number;
  ganhos: number;
  perdidos: number;
  ativos: number;
  conversao: string;
  novosSemana: number;
  novosMes: number;
}

export interface CrmMetrics {
  funis: Record<string, FunilMetrics>;
  vendedores: VendedorMetrics[];
  geral: {
    total: number;
    ganhos: number;
    perdidos: number;
    ativos: number;
    conversao: string;
    novosHoje: number;
    novosSemana: number;
    novosMes: number;
  };
  atualizadoEm: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

let cachedMetrics: CrmMetrics | null = null;
let cacheExpiresAt = 0;
let isRefreshing = false;

function toConversao(ganhos: number, perdidos: number): string {
  const total = ganhos + perdidos;
  if (total === 0) return "0.0%";
  return ((ganhos / total) * 100).toFixed(1) + "%";
}

function countPeriod(leads: any[], days: number): number {
  const cutoff = Date.now() / 1000 - days * 86400;
  return leads.filter((l) => l.created_at >= cutoff).length;
}

async function fetchAndCompute(service: KommoService): Promise<CrmMetrics> {
  console.log("[CrmCache] Buscando dados do CRM...");

  const [users, tryvionLeads, matrizLeads, axionLeads] = await Promise.all([
    service.getUsers(),
    service.getLeads({ filter: { pipeline_id: PIPELINE_IDS.TRYVION } }),
    service.getLeads({ filter: { pipeline_id: PIPELINE_IDS.MATRIZ } }),
    service.getLeads({ filter: { pipeline_id: PIPELINE_IDS.AXION } }),
  ]);

  const leadsPerFunil: Record<string, { nome: string; leads: any[] }> = {
    TRYVION: { nome: "FUNIL TRYVION", leads: tryvionLeads },
    MATRIZ: { nome: "FUNIL NEW MATRIZ", leads: matrizLeads },
    AXION: { nome: "FUNIL AXION", leads: axionLeads },
  };

  const allLeads = [...tryvionLeads, ...matrizLeads, ...axionLeads];

  // Métricas por funil
  const funis: Record<string, FunilMetrics> = {};
  for (const [key, { nome, leads }] of Object.entries(leadsPerFunil)) {
    const ganhos = leads.filter((l) => l.status_id === STATUS.WON).length;
    const perdidos = leads.filter((l) => l.status_id === STATUS.LOST).length;
    const ativos = leads.length - ganhos - perdidos;
    funis[key] = {
      nome,
      total: leads.length,
      ganhos,
      perdidos,
      ativos,
      conversao: toConversao(ganhos, perdidos),
      novosSemana: countPeriod(leads, 7),
      novosMes: countPeriod(leads, 30),
    };
  }

  // Métricas por vendedor × funil
  const vendedores: VendedorMetrics[] = [];
  for (const user of users) {
    for (const [key, { nome, leads }] of Object.entries(leadsPerFunil)) {
      const mine = leads.filter((l) => l.responsible_user_id === user.id);
      if (mine.length === 0) continue;
      const ganhos = mine.filter((l) => l.status_id === STATUS.WON).length;
      const perdidos = mine.filter((l) => l.status_id === STATUS.LOST).length;
      vendedores.push({
        nome: user.name,
        funil: nome,
        total: mine.length,
        ganhos,
        perdidos,
        ativos: mine.length - ganhos - perdidos,
        conversao: toConversao(ganhos, perdidos),
        novosSemana: countPeriod(mine, 7),
        novosMes: countPeriod(mine, 30),
      });
    }
  }

  // Resumo geral
  const totalGanhos = allLeads.filter((l) => l.status_id === STATUS.WON).length;
  const totalPerdidos = allLeads.filter((l) => l.status_id === STATUS.LOST).length;

  const geral = {
    total: allLeads.length,
    ganhos: totalGanhos,
    perdidos: totalPerdidos,
    ativos: allLeads.length - totalGanhos - totalPerdidos,
    conversao: toConversao(totalGanhos, totalPerdidos),
    novosHoje: countPeriod(allLeads, 1),
    novosSemana: countPeriod(allLeads, 7),
    novosMes: countPeriod(allLeads, 30),
  };

  console.log(
    `[CrmCache] Pronto — ${allLeads.length} leads, ${vendedores.length} entradas de vendedor`
  );

  return {
    funis,
    vendedores,
    geral,
    atualizadoEm: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  };
}

export async function getCrmMetrics(service: KommoService): Promise<CrmMetrics> {
  const now = Date.now();

  // Cache fresco — retorna imediatamente
  if (cachedMetrics && now < cacheExpiresAt) {
    return cachedMetrics;
  }

  // Cache expirado mas existe — retorna stale e revalida em background
  if (cachedMetrics && !isRefreshing) {
    isRefreshing = true;
    fetchAndCompute(service)
      .then((metrics) => {
        cachedMetrics = metrics;
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      })
      .catch((err) => console.error("[CrmCache] Erro no refresh:", err))
      .finally(() => { isRefreshing = false; });
    return cachedMetrics;
  }

  // Sem cache — aguarda primeira carga
  const metrics = await fetchAndCompute(service);
  cachedMetrics = metrics;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return metrics;
}
```

**Step 2: Verificar que TypeScript compila**

Run: `cd /Users/guicrasto/antigravity-gui/kommo-mcp-agent && npx tsc --noEmit`
Expected: zero erros

---

### Task 2: Atualizar `src/api/routes/chat.ts`

**Files:**
- Modify: `src/api/routes/chat.ts`

**Step 1: Substituir o conteúdo completo do arquivo**

```typescript
import { Router } from "express";
import { randomUUID } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { KommoService } from "../../services/kommo.js";
import { getCrmMetrics, VendedorMetrics } from "../cache/crm-cache.js";

interface ChatSession {
  history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
  lastActivity: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutos
const sessions = new Map<string, ChatSession>();

function buildSystemPrompt(metrics: Awaited<ReturnType<typeof getCrmMetrics>>): string {
  const { funis, vendedores, geral } = metrics;

  const funisTexto = Object.values(funis)
    .map(
      (f) =>
        `  ${f.nome}: ${f.total} leads | ganhos: ${f.ganhos} | perdidos: ${f.perdidos} | ativos: ${f.ativos} | conversão: ${f.conversao} | novos semana: ${f.novosSemana} | novos mês: ${f.novosMes}`
    )
    .join("\n");

  // Agrupa vendedores por nome para totais consolidados
  const porNome: Record<string, { total: number; ganhos: number; conversao: number[]; funis: string[] }> = {};
  for (const v of vendedores) {
    if (!porNome[v.nome]) porNome[v.nome] = { total: 0, ganhos: 0, conversao: [], funis: [] };
    porNome[v.nome].total += v.total;
    porNome[v.nome].ganhos += v.ganhos;
    porNome[v.nome].funis.push(`${v.funil}(${v.total})`);
  }

  const vendedoresTexto = vendedores
    .map(
      (v) =>
        `  ${v.nome} | ${v.funil} | total: ${v.total} | ganhos: ${v.ganhos} | perdidos: ${v.perdidos} | ativos: ${v.ativos} | conversão: ${v.conversao} | novos semana: ${v.novosSemana} | novos mês: ${v.novosMes}`
    )
    .join("\n");

  return `Você é o assistente inteligente do Kommo CRM da empresa Tryvion/Axion.
Responda perguntas de gerentes com precisão, profissionalismo e análise aprofundada.

DADOS ATUALIZADOS EM: ${metrics.atualizadoEm}

## RESUMO GERAL
Total de leads: ${geral.total}
Ganhos: ${geral.ganhos} | Perdidos: ${geral.perdidos} | Ativos: ${geral.ativos}
Conversão geral: ${geral.conversao}
Novos hoje: ${geral.novosHoje} | Novos esta semana: ${geral.novosSemana} | Novos este mês: ${geral.novosMes}

## MÉTRICAS POR FUNIL
${funisTexto}

## MÉTRICAS POR VENDEDOR × FUNIL
${vendedoresTexto}

## REGRAS
- Responda SEMPRE em Português Brasil.
- Use Markdown (tabelas, negrito, listas) para formatar respostas.
- Baseie suas respostas EXCLUSIVAMENTE nos dados acima.
- Se não tiver o dado solicitado, informe claramente que a informação não está disponível no contexto.
- Para rankings, ordene do maior para o menor.
- Conversão = ganhos ÷ (ganhos + perdidos) × 100.`;
}

export function chatRouter(service: KommoService) {
  const router = Router();

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  router.post("/", async (req, res) => {
    const { message, sessionId: incomingSessionId } = req.body;

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "SUA_CHAVE_AQUI") {
      return res.json({
        response: "Ops! Eu preciso de uma GEMINI_API_KEY no arquivo .env para funcionar.",
      });
    }

    try {
      const metrics = await getCrmMetrics(service);
      const systemPrompt = buildSystemPrompt(metrics);

      // Gerencia sessão
      const sessionId = incomingSessionId || randomUUID();
      const now = Date.now();

      // Limpa sessões expiradas
      for (const [id, session] of sessions.entries()) {
        if (now - session.lastActivity > SESSION_TTL_MS) sessions.delete(id);
      }

      const session: ChatSession = sessions.get(sessionId) ?? { history: [], lastActivity: now };

      const chat = model.startChat({
        systemInstruction: systemPrompt,
        history: session.history,
      });

      const result = await chat.sendMessage(message);
      const responseText = result.response.text();

      // Salva histórico
      session.history.push(
        { role: "user", parts: [{ text: message }] },
        { role: "model", parts: [{ text: responseText }] }
      );
      session.lastActivity = now;
      sessions.set(sessionId, session);

      res.json({ response: responseText, sessionId });
    } catch (error: any) {
      console.error("Erro Gemini:", error);
      res.status(500).json({ response: "Erro ao consultar o Gemini.", error: error.message });
    }
  });

  return router;
}
```

**Step 2: Compilar TypeScript**

Run: `npx tsc --noEmit`
Expected: zero erros

---

### Task 3: Smoke test completo

**Step 1: Subir o servidor**

Run: `npm run dev:web > /tmp/kommo-chat.log 2>&1 &`

**Step 2: Aguardar primeira carga do cache**

Run: `sleep 5 && echo "servidor ok"`

**Step 3: Testar chat — primeira mensagem (pode demorar ~90s na primeira vez)**

Run:
```bash
time curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Qual a taxa de conversão geral e quem são os top 3 vendedores?"}' \
  --max-time 120 | node -e "const d=[]; process.stdin.on('data',c=>d.push(c)); process.stdin.on('end',()=>{ const j=JSON.parse(d.join('')); console.log('sessionId:', j.sessionId); console.log(j.response); });"
```
Expected: resposta com taxa de conversão + ranking de vendedores + `sessionId` UUID

**Step 4: Testar follow-up (deve ser instantâneo — usa cache)**

Substitua `SEU_SESSION_ID` pelo UUID retornado no Step 3:
```bash
time curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Me fala mais sobre o primeiro colocado", "sessionId":"SEU_SESSION_ID"}' \
  --max-time 30
```
Expected: resposta em <5s referenciando o mesmo vendedor da mensagem anterior

**Step 5: Parar servidor**

Run: `pkill -f "tsx watch"`
