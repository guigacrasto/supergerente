# Activity Panel + Smart Chat — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan.

**Goal:** Add a dedicated "Painel de Alertas" tab showing leads without contact and overdue tasks (with direct Kommo links), and upgrade the chat assistant with proactive insights, comparisons, and professional analysis.

**Architecture:** Backend adds `getActivityMetrics()` cache function and `GET /api/reports/activity` endpoint using Kommo `/events` and `/tasks` APIs. Frontend adds a new sidebar tab with clickable alert cards. The chat system prompt is expanded with activity data and executive analysis instructions.

**Tech Stack:** TypeScript, Express, React 18, Lucide React, Kommo REST API v4, Google Gemini 2.5 Flash.

---

## Feature 1: Painel de Alertas Tab

### Backend

**New file:** `src/api/cache/activity-cache.ts`

Exports `getActivityMetrics(team, service, activeLeadIds)` with 30-minute cache (same TTL as CRM cache).

**Data fetched:**
1. `GET /events?filter[type][]=lead_note_added&filter[created_at][from]=<unix 7 days ago>&limit=250` — recent note events, paginated
2. `GET /tasks?filter[is_completed]=0&filter[entity_type]=leads&limit=250` — open tasks, paginated, filter `due_date < now()`

**ActivityMetrics shape:**
```typescript
export interface AlertLead {
  id: number;
  nome: string;         // lead title from Kommo
  vendedor: string;     // responsible user name
  diasSemNota: number;  // days since last note
  kommoUrl: string;     // https://{subdomain}.kommo.com/leads/detail/{id}
}

export interface AlertTask {
  id: number;
  nome: string;         // task text
  vendedor: string;     // responsible user name
  leadId: number;
  leadNome: string;
  diasVencida: number;  // days past due
  kommoUrl: string;     // link to lead
}

export interface ActivityMetrics {
  leadsAbandonados48h: AlertLead[];   // active leads with no note in last 48h
  leadsEmRisco7d: AlertLead[];        // active leads with no note in last 7d (superset)
  tarefasVencidas: AlertTask[];
  atualizadoEm: string;
}
```

**How abandonment is computed:**
- Take all active lead IDs from the existing CRM cache (no extra API call)
- From the events response, collect lead IDs that had a note in the last 48h / 7d
- Subtract → leads without notes = abandoned / at risk
- For each lead without notes, fetch minimal lead detail (`/leads/{id}?with=users`) to get title + responsible user name

**New route:** `GET /api/reports/activity` in `src/api/routes/reports.ts`
- Protected by `requireAuth`
- Iterates `userTeams` (same pattern as `/agents` and `/summary`)
- Returns `{ [team]: ActivityMetrics }[]`
- Includes `subdomain` per team so frontend can build Kommo URLs (already computed server-side and included in `kommoUrl` fields)

---

### Frontend

**New sidebar button:** "Painel de Alertas" with `AlertTriangle` icon, between "Resumo Geral" and "Relatório Agentes".

**New tab key:** `'alerts'`

**`loadTabData('alerts')` case:** calls `GET /api/reports/activity`, sets `tabData`.

**`renderContent()` branch for `activeTab === 'alerts'`:**

Layout — three sections per team:
```
[Equipe Azul]
  🔴 Sem contato há +48h (4 leads)
     [Lead Name]  · João Silva · 3 dias  →  [abre Kommo]
     [Lead Name]  · Maria      · 2 dias  →  [abre Kommo]
  ⚠️  Em risco +7d (7 leads)
     ...
  📋 Tarefas vencidas (3)
     [Task text] · João Silva · 2 dias vencida  →  [abre Kommo]
```

Each row is clickable (`<a href={kommoUrl} target="_blank" rel="noopener noreferrer">`).

**CSS:** New `.alerts-panel`, `.alert-section`, `.alert-row`, `.alert-badge` classes.

---

## Feature 2: Smart Chat Improvements

### System Prompt Enhancements

**Data added to system prompt:**
```
ALERTAS DE ATIVIDADE:
  Leads abandonados (48h sem nota): 4 leads — Pedro Leal, Ana Costa, ...
  Leads em risco (7d sem nota): 7 leads
  Tarefas vencidas: João Silva (2), Maria (1)
```

**New behavioral instructions added to the prompt:**

```
## MODO ANALÍTICO
- Ao receber uma pergunta sobre performance, identifique proativamente os TOP 3 INSIGHTS relevantes
  antes de responder o que foi perguntado diretamente.
- Sempre que possível, faça COMPARATIVOS: esta semana vs. semana passada, funil A vs. B,
  agente X vs. média da equipe.
- Use LINGUAGEM EXECUTIVA: conclua com uma recomendação clara de ação.
- Identifique ANOMALIAS: agentes muito abaixo/acima da média, funis com conversão caindo.
- Para análise de notas/acompanhamento: use os dados de ALERTAS DE ATIVIDADE acima.
```

### Chat System Prompt Data Flow

```
loadTabData('chat') or any chat message
  → getCrmMetrics(team, service)    [existing, 30min cache]
  → getActivityMetrics(team, ...)   [new, 30min cache]
  → buildSystemPrompt(allMetrics, allActivity)
  → Gemini 2.5 Flash
```

Activity metrics are fetched alongside CRM metrics on every chat request (both cached, so fast after first call).

---

## Implementation Scope

All in one sprint:
1. `src/api/cache/activity-cache.ts` — new file
2. `src/api/routes/reports.ts` — add `/activity` route
3. `src/api/routes/chat.ts` — update `buildSystemPrompt` signature + add activity data + new instructions
4. `web/src/App.tsx` — alerts tab (sidebar button, loadTabData case, renderContent branch)
5. `web/src/index.css` — alerts panel CSS
