# Dashboard Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 4 dashboard features: remove conversion colors, replace pie charts with horizontal bar charts, add conversation analysis with AI, and add per-team KPI totals.

**Architecture:** Features 1, 2, and 4 are frontend-only changes to existing components and pages. Feature 3 requires a new backend endpoint using Gemini for conversation analysis, a new cache layer, and a new frontend page `/insights` with its own components.

**Tech Stack:** React 18, Recharts, Tailwind CSS, Express, Google Gemini 2.5 Flash, Kommo API v4

---

### Task 1: Remove conversion color badges from AgentTable

**Files:**
- Modify: `web/src/components/features/agents/AgentTable.tsx`

**Step 1: Remove `getConversionVariant` function and update the Conversao column rendering**

In `web/src/components/features/agents/AgentTable.tsx`, remove the `getConversionVariant` function (lines 12-18) and change the `Conversão %` column rendering (lines 61-68) from a colored Badge to plain text:

```tsx
// REMOVE this function entirely:
// function getConversionVariant(...)

// In the column rendering, REPLACE the Conversão % block:
if (col === 'Conversão %') {
  return (
    <td key={col} className="px-4 py-3 whitespace-nowrap font-heading font-medium">
      {value ?? '0%'}
    </td>
  );
}
```

Also remove the `Badge` import if it's only used for conversions.

**Step 2: Verify the build compiles**

Run: `cd web && npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add web/src/components/features/agents/AgentTable.tsx
git commit -m "fix: remove color badges from conversion column in agents table"
```

---

### Task 2: Create TeamBarChart component

**Files:**
- Create: `web/src/components/features/dashboard/TeamBarChart.tsx`

**Step 1: Create the horizontal bar chart component**

Create `web/src/components/features/dashboard/TeamBarChart.tsx`:

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui';

interface AgentData {
  nome: string;
  total: number;
  ativos: number;
}

interface TeamBarChartProps {
  team: string;
  label: string;
  agents: AgentData[];
  color: string;
}

export function TeamBarChart({ team, label, agents, color }: TeamBarChartProps) {
  const chartData = agents
    .map((a) => ({
      name: a.nome,
      value: a.total,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);
  const barHeight = 40;
  const chartHeight = Math.max(chartData.length * barHeight + 40, 120);

  return (
    <Card>
      <CardHeader>
        <CardTitle
          className={
            team === 'azul' ? 'text-accent-blue' : 'text-warning'
          }
        >
          {label} — Atendimentos
        </CardTitle>
      </CardHeader>

      <div className="px-5 py-4">
        {total === 0 ? (
          <p className="text-center text-body-md text-muted py-8">
            Sem dados de atendimentos.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fill: '#959CA6', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fill: '#E0E3E9', fontSize: 13 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#22182D',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: '#E0E3E9',
                  fontSize: '0.875rem',
                }}
                formatter={(value: number) => [
                  `${value} leads (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                  'Total',
                ]}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                    fillOpacity={1 - index * 0.04}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
```

**Step 2: Verify the build compiles**

Run: `cd web && npm run build`
Expected: Build succeeds (component created but not yet used)

**Step 3: Commit**

```bash
git add web/src/components/features/dashboard/TeamBarChart.tsx
git commit -m "feat: add TeamBarChart horizontal bar chart component"
```

---

### Task 3: Replace pie charts with bar charts in DashboardPage

**Files:**
- Modify: `web/src/pages/DashboardPage.tsx`
- Delete: `web/src/components/features/dashboard/TeamPieChart.tsx`

**Step 1: Update DashboardPage imports and chart section**

In `web/src/pages/DashboardPage.tsx`:

1. Change import from `TeamPieChart` to `TeamBarChart`:
```tsx
// REPLACE:
import { TeamPieChart } from '@/components/features/dashboard/TeamPieChart';
// WITH:
import { TeamBarChart } from '@/components/features/dashboard/TeamBarChart';
```

2. Change the chart section (lines 240-253) from `lg:grid-cols-2` to `grid-cols-1` and use `TeamBarChart`:
```tsx
{/* Bar Charts — full width per team */}
{hasBothTeams && (
  <div className="flex flex-col gap-6">
    {availableTeams.map((team) => (
      <TeamBarChart
        key={team}
        team={team}
        label={TEAM_LABELS[team] || team}
        agents={agentsByTeam[team]}
        color={TEAM_COLORS[team] || '#9566F2'}
      />
    ))}
  </div>
)}
```

**Step 2: Delete the old TeamPieChart component**

Delete: `web/src/components/features/dashboard/TeamPieChart.tsx`

**Step 3: Verify the build compiles**

Run: `cd web && npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add web/src/pages/DashboardPage.tsx
git rm web/src/components/features/dashboard/TeamPieChart.tsx
git commit -m "feat: replace pie charts with full-width horizontal bar charts per team"
```

---

### Task 4: Add per-team KPI cards to DashboardPage

**Files:**
- Create: `web/src/components/features/dashboard/TeamKPICard.tsx`
- Modify: `web/src/pages/DashboardPage.tsx`

**Step 1: Create TeamKPICard component**

Create `web/src/components/features/dashboard/TeamKPICard.tsx`:

```tsx
import { TrendingUp, Users, Target } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui';

interface TeamKPICardProps {
  label: string;
  team: string;
  novosHoje: number;
  ativos: number;
  novosMes: number;
}

export function TeamKPICard({
  label,
  team,
  novosHoje,
  ativos,
  novosMes,
}: TeamKPICardProps) {
  const titleColor = team === 'azul' ? 'text-accent-blue' : 'text-warning';
  const accentBorder = team === 'azul' ? 'border-l-accent-blue' : 'border-l-warning';

  return (
    <Card className={`border-l-4 ${accentBorder}`}>
      <CardHeader>
        <CardTitle className={titleColor}>{label}</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-3 gap-4 px-5 pb-5">
        <div className="flex flex-col items-center gap-1 rounded-button bg-surface-secondary p-3">
          <TrendingUp className={`h-4 w-4 ${titleColor}`} />
          <span className="font-heading text-heading-sm">{novosHoje}</span>
          <span className="text-body-sm text-muted">Hoje</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-button bg-surface-secondary p-3">
          <Users className={`h-4 w-4 ${titleColor}`} />
          <span className="font-heading text-heading-sm">{ativos}</span>
          <span className="text-body-sm text-muted">Ativos</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-button bg-surface-secondary p-3">
          <Target className={`h-4 w-4 ${titleColor}`} />
          <span className="font-heading text-heading-sm">{novosMes}</span>
          <span className="text-body-sm text-muted">Mes</span>
        </div>
      </div>
    </Card>
  );
}
```

**Step 2: Add TeamKPICard to DashboardPage**

In `web/src/pages/DashboardPage.tsx`:

1. Add import:
```tsx
import { TeamKPICard } from '@/components/features/dashboard/TeamKPICard';
```

2. Compute per-team totals (add after the existing KPI calculations, around line 117):
```tsx
// Per-team KPI totals
const teamKPIs = teams
  .map((team) => {
    const pipes = summary.filter((s) => s.team === team);
    return {
      team,
      label: TEAM_LABELS[team] || team,
      novosHoje: pipes.reduce((sum, p) => sum + p.novosHoje, 0),
      ativos: pipes.reduce((sum, p) => sum + p.ativos, 0),
      novosMes: pipes.reduce((sum, p) => sum + p.novosMes, 0),
    };
  })
  .filter((tk) => tk.novosHoje > 0 || tk.ativos > 0 || tk.novosMes > 0);
```

3. Add the TeamKPICard section right after the existing KPI Cards grid (after line 189):
```tsx
{/* Per-team KPI Cards */}
{teamKPIs.length > 1 && (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {teamKPIs.map((tk) => (
      <TeamKPICard
        key={tk.team}
        label={tk.label}
        team={tk.team}
        novosHoje={tk.novosHoje}
        ativos={tk.ativos}
        novosMes={tk.novosMes}
      />
    ))}
  </div>
)}
```

**Step 3: Verify the build compiles**

Run: `cd web && npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add web/src/components/features/dashboard/TeamKPICard.tsx web/src/pages/DashboardPage.tsx
git commit -m "feat: add per-team KPI summary cards to dashboard"
```

---

### Task 5: Add `getChatMessages` method to KommoService

**Files:**
- Modify: `src/services/kommo.ts`

**Step 1: Add getChatMessages method to KommoService**

In `src/services/kommo.ts`, add this method to the class (before the closing `}`):

```typescript
/**
 * Get notes (including chat messages) for a lead.
 * Kommo stores chat messages as notes of type "message_cashier" or text notes.
 * Returns all notes sorted by created_at ascending.
 */
public async getLeadNotesAll(leadId: number): Promise<Array<{
  id: number;
  note_type: string;
  text: string;
  created_at: number;
  responsible_user_id: number;
  params?: { text?: string };
}>> {
  try {
    const allNotes: any[] = [];
    let page = 1;

    while (true) {
      const response = await this.client.get(`/leads/${leadId}/notes`, {
        params: { page, limit: 250 },
      });
      const notes = response.data?._embedded?.notes || [];
      if (notes.length === 0) break;
      allNotes.push(...notes);
      if (notes.length < 250) break;
      if (page > 10) break; // safety
      page++;
    }

    return allNotes.sort((a: any, b: any) => a.created_at - b.created_at);
  } catch (error) {
    console.error(`Error fetching notes for lead ${leadId}:`, error);
    return [];
  }
}
```

**Step 2: Verify backend compiles**

Run: `npm run build`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add src/services/kommo.ts
git commit -m "feat: add getLeadNotesAll method for paginated note fetching"
```

---

### Task 6: Create conversation analysis cache and endpoint

**Files:**
- Create: `src/api/cache/conversation-cache.ts`
- Create: `src/api/routes/insights.ts`
- Modify: `src/api/server.ts`

**Step 1: Create conversation-cache.ts**

Create `src/api/cache/conversation-cache.ts`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { KommoService } from "../../services/kommo.js";
import { TeamKey } from "../../config.js";
import { getCrmMetrics, ActiveLead } from "./crm-cache.js";

export interface ConversationInsight {
  leadId: number;
  leadNome: string;
  vendedor: string;
  sentimentScore: number; // 1-5
  qualityScore: number;   // 1-5
  resumo: string;
  pontosPositivos: string[];
  pontosMelhoria: string[];
  analisadoEm: string;
}

export interface AgentInsightSummary {
  nome: string;
  team: string;
  mediasentimento: number;
  mediaQualidade: number;
  totalAnalisados: number;
  insights: ConversationInsight[];
}

interface InsightsCacheEntry {
  data: AgentInsightSummary[] | null;
  expiresAt: number;
  fetchPromise: Promise<AgentInsightSummary[]> | null;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CONVERSATIONS_PER_AGENT = 5;
const MAX_LEADS_SAMPLE = 50; // max leads to sample per team

const caches: Record<TeamKey, InsightsCacheEntry> = {
  azul: { data: null, expiresAt: 0, fetchPromise: null },
  amarela: { data: null, expiresAt: 0, fetchPromise: null },
};

const ANALYSIS_PROMPT = `Você é um analista de qualidade de atendimento comercial. Analise a conversa abaixo entre o vendedor e o lead/cliente.

Retorne EXATAMENTE neste formato JSON (sem markdown, sem code blocks):
{
  "sentimentScore": <1 a 5, onde 1=muito negativo, 5=muito positivo>,
  "qualityScore": <1 a 5, onde 1=atendimento ruim, 5=excelente>,
  "resumo": "<resumo de 1-2 frases da conversa>",
  "pontosPositivos": ["<ponto 1>", "<ponto 2>"],
  "pontosMelhoria": ["<ponto 1>", "<ponto 2>"]
}

Critérios de qualidade:
- Tempo de resposta implícito (gaps entre mensagens)
- Tom profissional e empático
- Proatividade em oferecer soluções
- Clareza na comunicação
- Follow-up adequado

Conversa:
`;

async function analyzeConversation(
  genAI: GoogleGenerativeAI,
  leadNome: string,
  vendedor: string,
  notes: Array<{ text: string; created_at: number; note_type: string }>
): Promise<Omit<ConversationInsight, 'leadId' | 'leadNome' | 'vendedor' | 'analisadoEm'> | null> {
  if (notes.length === 0) return null;

  const conversationText = notes
    .filter((n) => n.text && n.text.trim().length > 0)
    .map((n) => {
      const date = new Date(n.created_at * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const tipo = n.note_type === "message_cashier" ? "Mensagem" : "Nota";
      return `[${date}] (${tipo}) ${n.text}`;
    })
    .join("\n");

  if (conversationText.trim().length < 20) return null;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(ANALYSIS_PROMPT + conversationText);
    const text = result.response.text().trim();

    // Parse JSON from response (strip markdown code blocks if present)
    const jsonStr = text.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(jsonStr);

    return {
      sentimentScore: Math.min(5, Math.max(1, parsed.sentimentScore || 3)),
      qualityScore: Math.min(5, Math.max(1, parsed.qualityScore || 3)),
      resumo: parsed.resumo || "Sem resumo disponível",
      pontosPositivos: parsed.pontosPositivos || [],
      pontosMelhoria: parsed.pontosMelhoria || [],
    };
  } catch (err) {
    console.error(`[ConversationCache] Error analyzing lead "${leadNome}":`, err);
    return null;
  }
}

async function fetchInsights(
  team: TeamKey,
  service: KommoService,
  genAI: GoogleGenerativeAI
): Promise<AgentInsightSummary[]> {
  console.log(`[ConversationCache:${team}] Fetching conversation insights...`);

  const metrics = await getCrmMetrics(team, service);
  const users = await service.getUsers();
  const userMap = new Map<number, string>(users.map((u: any) => [u.id, u.name]));

  // Sample recent active leads (updated in last 7 days)
  const cutoff7d = Date.now() / 1000 - 7 * 86400;
  const recentLeads = metrics.activeLeads
    .filter((l) => l.updatedAt >= cutoff7d)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_LEADS_SAMPLE);

  // Group leads by agent
  const leadsByAgent = new Map<string, ActiveLead[]>();
  for (const lead of recentLeads) {
    const agentName = lead.responsibleUserName;
    if (!leadsByAgent.has(agentName)) {
      leadsByAgent.set(agentName, []);
    }
    leadsByAgent.get(agentName)!.push(lead);
  }

  const agentSummaries: AgentInsightSummary[] = [];

  for (const [agentName, leads] of leadsByAgent) {
    const sampled = leads.slice(0, MAX_CONVERSATIONS_PER_AGENT);
    const insights: ConversationInsight[] = [];

    for (const lead of sampled) {
      const notes = await service.getLeadNotesAll(lead.id);
      if (notes.length === 0) continue;

      const analysis = await analyzeConversation(
        genAI,
        lead.titulo,
        agentName,
        notes.map((n) => ({
          text: n.params?.text || n.text || "",
          created_at: n.created_at,
          note_type: n.note_type,
        }))
      );

      if (analysis) {
        insights.push({
          leadId: lead.id,
          leadNome: lead.titulo,
          vendedor: agentName,
          ...analysis,
          analisadoEm: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        });
      }
    }

    if (insights.length > 0) {
      const avgSentiment = insights.reduce((s, i) => s + i.sentimentScore, 0) / insights.length;
      const avgQuality = insights.reduce((s, i) => s + i.qualityScore, 0) / insights.length;

      agentSummaries.push({
        nome: agentName,
        team,
        mediasentimento: Math.round(avgSentiment * 10) / 10,
        mediaQualidade: Math.round(avgQuality * 10) / 10,
        totalAnalisados: insights.length,
        insights,
      });
    }
  }

  agentSummaries.sort((a, b) => b.mediaQualidade - a.mediaQualidade);
  console.log(`[ConversationCache:${team}] Done — ${agentSummaries.length} agents analyzed`);
  return agentSummaries;
}

export async function getConversationInsights(
  team: TeamKey,
  service: KommoService,
  genAI: GoogleGenerativeAI
): Promise<AgentInsightSummary[]> {
  const entry = caches[team];
  const now = Date.now();

  if (entry.data && now < entry.expiresAt) return entry.data;

  if (entry.data && !entry.fetchPromise) {
    entry.fetchPromise = fetchInsights(team, service, genAI)
      .then((data) => {
        entry.data = data;
        entry.expiresAt = Date.now() + CACHE_TTL_MS;
        return data;
      })
      .catch((err) => {
        console.error(`[ConversationCache:${team}] Refresh error:`, err);
        return entry.data!;
      })
      .finally(() => { entry.fetchPromise = null; });
    return entry.data;
  }

  if (!entry.fetchPromise) {
    entry.fetchPromise = fetchInsights(team, service, genAI)
      .then((data) => {
        entry.data = data;
        entry.expiresAt = Date.now() + CACHE_TTL_MS;
        return data;
      })
      .catch((err) => {
        console.error(`[ConversationCache:${team}] Initial fetch error:`, err);
        throw err;
      })
      .finally(() => { entry.fetchPromise = null; });
  }

  return entry.fetchPromise;
}
```

**Step 2: Create insights route**

Create `src/api/routes/insights.ts`:

```typescript
import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { KommoService } from "../../services/kommo.js";
import { TeamKey } from "../../config.js";
import { requireAuth, AuthRequest } from "../middleware/requireAuth.js";
import { getConversationInsights } from "../cache/conversation-cache.js";

export function insightsRouter(services: Record<TeamKey, KommoService>) {
  const router = Router();
  router.use(requireAuth as any);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

  // GET /api/insights/conversations — conversation analysis per agent
  router.get("/conversations", async (req: AuthRequest, res) => {
    const userTeams = req.userTeams || [];

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "SUA_CHAVE_AQUI") {
      return res.status(400).json({ error: "GEMINI_API_KEY nao configurada" });
    }

    try {
      const allInsights = [];

      for (const team of userTeams) {
        const service = services[team];
        if (!service) continue;

        const insights = await getConversationInsights(team, service, genAI);
        allInsights.push(...insights);
      }

      res.json(allInsights);
    } catch (error: any) {
      console.error("[Insights] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
```

**Step 3: Register the insights route in server.ts**

In `src/api/server.ts`, add:

1. Import:
```typescript
import { insightsRouter } from "./routes/insights.js";
```

2. Register route (after the chat router line):
```typescript
app.use("/api/insights", insightsRouter(services));
```

**Step 4: Verify backend compiles**

Run: `npm run build`
Expected: Compiles with no errors

**Step 5: Commit**

```bash
git add src/api/cache/conversation-cache.ts src/api/routes/insights.ts src/api/server.ts
git commit -m "feat: add conversation analysis endpoint with Gemini + 1h cache"
```

---

### Task 7: Create InsightsPage frontend

**Files:**
- Create: `web/src/pages/InsightsPage.tsx`
- Create: `web/src/components/features/insights/AgentScoreCard.tsx`
- Create: `web/src/components/features/insights/ConversationCard.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/layout/Sidebar.tsx`

**Step 1: Create AgentScoreCard component**

Create `web/src/components/features/insights/AgentScoreCard.tsx`:

```tsx
import { User, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentScoreCardProps {
  nome: string;
  team: string;
  mediaSentimento: number;
  mediaQualidade: number;
  totalAnalisados: number;
  isSelected: boolean;
  onClick: () => void;
}

function ScoreStars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i <= Math.round(score)
              ? 'fill-warning text-warning'
              : 'text-muted/30'
          )}
        />
      ))}
      <span className="ml-1 text-body-sm text-muted">{score.toFixed(1)}</span>
    </div>
  );
}

export function AgentScoreCard({
  nome,
  team,
  mediaSentimento,
  mediaQualidade,
  totalAnalisados,
  isSelected,
  onClick,
}: AgentScoreCardProps) {
  const teamColor = team === 'azul' ? 'border-l-accent-blue' : 'border-l-warning';

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-2 rounded-card border border-glass-border bg-surface p-4 text-left transition-colors border-l-4 cursor-pointer',
        teamColor,
        isSelected
          ? 'ring-1 ring-primary bg-surface-secondary'
          : 'hover:bg-surface-secondary/50'
      )}
    >
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted" />
        <span className="font-heading text-heading-sm">{nome}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-body-sm text-muted">Qualidade</span>
          <ScoreStars score={mediaQualidade} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-body-sm text-muted">Sentimento</span>
          <ScoreStars score={mediaSentimento} />
        </div>
      </div>
      <span className="text-body-sm text-muted">
        {totalAnalisados} conversa{totalAnalisados !== 1 ? 's' : ''} analisada{totalAnalisados !== 1 ? 's' : ''}
      </span>
    </button>
  );
}
```

**Step 2: Create ConversationCard component**

Create `web/src/components/features/insights/ConversationCard.tsx`:

```tsx
import { MessageSquare, ThumbsUp, AlertCircle, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui';

interface ConversationCardProps {
  leadId: number;
  leadNome: string;
  vendedor: string;
  sentimentScore: number;
  qualityScore: number;
  resumo: string;
  pontosPositivos: string[];
  pontosMelhoria: string[];
  analisadoEm: string;
  kommoSubdomain?: string;
}

function scoreToBadge(score: number): { variant: 'success' | 'warning' | 'danger'; label: string } {
  if (score >= 4) return { variant: 'success', label: 'Bom' };
  if (score >= 3) return { variant: 'warning', label: 'Regular' };
  return { variant: 'danger', label: 'Atenção' };
}

export function ConversationCard({
  leadId,
  leadNome,
  sentimentScore,
  qualityScore,
  resumo,
  pontosPositivos,
  pontosMelhoria,
  analisadoEm,
  kommoSubdomain,
}: ConversationCardProps) {
  const sentiment = scoreToBadge(sentimentScore);
  const quality = scoreToBadge(qualityScore);

  return (
    <div className="flex flex-col gap-3 rounded-card border border-glass-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-heading text-heading-sm">{leadNome}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={quality.variant}>Qualidade: {quality.label}</Badge>
          <Badge variant={sentiment.variant}>Sentimento: {sentiment.label}</Badge>
          {kommoSubdomain && (
            <a
              href={`https://${kommoSubdomain}.kommo.com/leads/detail/${leadId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-primary transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      <p className="text-body-md text-muted-light">{resumo}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pontosPositivos.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-body-sm font-medium text-success">
              <ThumbsUp className="h-3.5 w-3.5" />
              Pontos positivos
            </div>
            <ul className="list-disc pl-5 text-body-sm text-muted-light">
              {pontosPositivos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {pontosMelhoria.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-body-sm font-medium text-warning">
              <AlertCircle className="h-3.5 w-3.5" />
              Pontos de melhoria
            </div>
            <ul className="list-disc pl-5 text-body-sm text-muted-light">
              {pontosMelhoria.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <span className="text-body-sm text-muted">Analisado em: {analisadoEm}</span>
    </div>
  );
}
```

**Step 3: Create InsightsPage**

Create `web/src/pages/InsightsPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { api } from '@/lib/api';
import { PageSpinner, EmptyState } from '@/components/ui';
import { AgentScoreCard } from '@/components/features/insights/AgentScoreCard';
import { ConversationCard } from '@/components/features/insights/ConversationCard';

interface ConversationInsight {
  leadId: number;
  leadNome: string;
  vendedor: string;
  sentimentScore: number;
  qualityScore: number;
  resumo: string;
  pontosPositivos: string[];
  pontosMelhoria: string[];
  analisadoEm: string;
}

interface AgentInsightSummary {
  nome: string;
  team: string;
  mediasentimento: number;
  mediaQualidade: number;
  totalAnalisados: number;
  insights: ConversationInsight[];
}

export function InsightsPage() {
  const [data, setData] = useState<AgentInsightSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await api.get<AgentInsightSummary[]>('/insights/conversations');
        if (!cancelled) {
          setData(res.data);
          if (res.data.length > 0) {
            setSelectedAgent(res.data[0].nome);
          }
        }
      } catch (err) {
        console.error('[InsightsPage] Erro ao carregar dados:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <PageSpinner />;
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-heading-lg">Insights de Atendimento</h1>
        <EmptyState
          icon={Brain}
          title="Nenhuma analise disponivel"
          description="As conversas dos atendentes serao analisadas automaticamente. Aguarde a proxima atualizacao."
        />
      </div>
    );
  }

  const selected = data.find((a) => a.nome === selectedAgent);
  const conversations = selected?.insights ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-heading-lg">Insights de Atendimento</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* Agent list */}
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-heading-sm text-muted">Agentes</h2>
          {data.map((agent) => (
            <AgentScoreCard
              key={agent.nome}
              nome={agent.nome}
              team={agent.team}
              mediaSentimento={agent.mediasentimento}
              mediaQualidade={agent.mediaQualidade}
              totalAnalisados={agent.totalAnalisados}
              isSelected={selectedAgent === agent.nome}
              onClick={() => setSelectedAgent(agent.nome)}
            />
          ))}
        </div>

        {/* Conversations */}
        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-heading-sm text-muted">
            Conversas analisadas — {selected?.nome ?? ''}
          </h2>
          {conversations.length === 0 ? (
            <p className="text-body-md text-muted py-8 text-center">
              Selecione um agente para ver as conversas.
            </p>
          ) : (
            conversations.map((c) => (
              <ConversationCard
                key={c.leadId}
                {...c}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Add route to App.tsx**

In `web/src/App.tsx`:

1. Add import:
```tsx
import { InsightsPage } from '@/pages/InsightsPage';
```

2. Add route inside the `<AppShell>` routes (after the alerts route):
```tsx
<Route path="/insights" element={<InsightsPage />} />
```

**Step 5: Add nav item to Sidebar**

In `web/src/components/layout/Sidebar.tsx`:

1. Add `Brain` to the lucide-react import:
```tsx
import {
  PieChart,
  MessageSquare,
  BarChart3,
  AlertTriangle,
  Brain,
  LogOut,
  Settings,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
```

2. Add the Insights nav item to `NAV_ITEMS` (after Alertas):
```tsx
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: PieChart },
  { to: '/chat', label: 'Chat IA', icon: MessageSquare },
  { to: '/agents', label: 'Agentes', icon: BarChart3 },
  { to: '/alerts', label: 'Alertas', icon: AlertTriangle },
  { to: '/insights', label: 'Insights', icon: Brain },
] as const;
```

**Step 6: Verify full build compiles**

Run: `npm run build:all` (or `npm run build && cd web && npm run build`)
Expected: Both backend and frontend compile with no errors

**Step 7: Commit**

```bash
git add web/src/pages/InsightsPage.tsx web/src/components/features/insights/ web/src/App.tsx web/src/components/layout/Sidebar.tsx
git commit -m "feat: add Insights page with AI conversation analysis per agent"
```

---

### Task 8: Update README.md and TODO.md

**Files:**
- Modify: `README.md`
- Modify: `TODO.md`

**Step 1: Update README.md**

Add to the features list:
```markdown
- **Dashboard Aprimorado**: KPIs por equipe, gráficos de barras horizontais por agente.
- **Insights de Atendimento**: Análise automática de conversas com IA (sentimento + qualidade + resumo).
```

**Step 2: Update TODO.md**

Mark completed items and add new phase:
- Mark "Dashboard em Tempo Real" as `[x]` in Fase 3
- Mark "Análise de Sentimento" as `[x]` in Fase 3
- Add completed items for the features built

**Step 3: Commit**

```bash
git add README.md TODO.md
git commit -m "docs: update README and TODO with new dashboard features"
```

---

### Task 9: Final verification

**Step 1: Run full build**

Run: `npm run build:all`
Expected: Backend and frontend compile cleanly

**Step 2: Start dev server and visually verify**

Run: `npm run dev`
Check:
- Dashboard shows per-team KPI cards below general KPIs
- Bar charts show horizontally per team (full width)
- Agents page shows conversion without colored badges
- Sidebar shows "Insights" nav item
- Insights page loads and shows agent analysis (if Gemini API key is set)

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address review feedback from final verification"
```
