# Summary Tab + Sidebar Accordion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a "Resumo Geral" tab showing new leads today/month + actives per funnel across all teams, and make sidebar funnel groups collapsible (accordion).

**Architecture:** Backend adds `novosHoje` to `FunilMetrics` and a new `/api/reports/summary` endpoint reusing the existing `getCrmMetrics` cache. Frontend adds accordion state to team groups, a new sidebar button, and a summary rendering path in `renderContent()`.

**Tech Stack:** TypeScript, Express, React 18, Lucide React icons, CSS in `web/src/index.css`.

---

### Task 1: Add `novosHoje` to `FunilMetrics` in the CRM cache

**Files:**
- Modify: `src/api/cache/crm-cache.ts`

**Context:** `FunilMetrics` currently tracks `novosSemana` and `novosMes` but not `novosHoje`. The summary endpoint needs per-funnel today count. The `countPeriod(leads, 1)` helper already exists.

**Step 1: Add `novosHoje` to the `FunilMetrics` interface**

In `src/api/cache/crm-cache.ts`, find the `FunilMetrics` interface (around line 17) and add `novosHoje`:

```typescript
export interface FunilMetrics {
  nome: string;
  team: TeamKey;
  total: number;
  ganhos: number;
  perdidos: number;
  ativos: number;
  conversao: string;
  novosHoje: number;   // ← ADD THIS LINE
  novosSemana: number;
  novosMes: number;
}
```

**Step 2: Compute `novosHoje` in `fetchAndCompute`**

Find the `funis[key] = { ... }` block (around line 110) and add `novosHoje`:

```typescript
funis[key] = {
  nome,
  team,
  total: leads.length,
  ganhos,
  perdidos,
  ativos,
  conversao: toConversao(ganhos, perdidos),
  novosHoje: countPeriod(leads, 1),   // ← ADD THIS LINE
  novosSemana: countPeriod(leads, 7),
  novosMes: countPeriod(leads, 30),
};
```

**Step 3: Build to verify no TypeScript errors**

```bash
cd /Users/guicrasto/antigravity-gui/supergerente && npm run build
```
Expected: zero errors.

**Step 4: Commit**

```bash
git add src/api/cache/crm-cache.ts
git commit -m "feat: add novosHoje per funnel to CRM cache metrics"
```

---

### Task 2: Add `GET /api/reports/summary` endpoint

**Files:**
- Modify: `src/api/routes/reports.ts`

**Context:** This file already exports `reportsRouter` with a `/agents` route. The server mounts it at `/api/reports`, so a new route here becomes `/api/reports/summary`. Uses `getCrmMetrics` cache (same as `/agents`) — no new Kommo API calls.

**Step 1: Add the summary route inside `reportsRouter`, after the `/agents` route**

```typescript
// GET /api/reports/summary — novos hoje/mês + ativos por funil para todas as equipes autorizadas
router.get("/summary", async (req: AuthRequest, res) => {
  const userTeams = req.userTeams || [];
  try {
    const result: Array<{
      nome: string;
      team: TeamKey;
      novosHoje: number;
      novosMes: number;
      ativos: number;
    }> = [];

    for (const team of userTeams) {
      const service = services[team];
      if (!service) continue;

      const metrics = await getCrmMetrics(team, service);
      for (const funil of Object.values(metrics.funis)) {
        result.push({
          nome: funil.nome,
          team,
          novosHoje: funil.novosHoje,
          novosMes: funil.novosMes,
          ativos: funil.ativos,
        });
      }
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

Place this block immediately before `return router;` at the end of the function.

**Step 2: Build**

```bash
npm run build
```
Expected: zero errors.

**Step 3: Commit**

```bash
git add src/api/routes/reports.ts
git commit -m "feat: add /api/reports/summary endpoint for per-funnel overview"
```

---

### Task 3: Sidebar accordion

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/index.css`

**Context:** The sidebar team groups live at lines 656–674 of `App.tsx`. Currently the label is static and the pipeline buttons are always rendered. We need to:
1. Add `ChevronDown` to the lucide-react import
2. Add `expandedTeams` state (Set, empty by default)
3. Make the label clickable to toggle
4. Conditionally render pipeline buttons

**Step 1: Add `ChevronDown` to lucide-react imports**

Find the import block at the top of `App.tsx` (around line 2–17). `ChevronRight` is already imported. Add `ChevronDown`:

```typescript
import {
    MessageSquare,
    BarChart3,
    Settings,
    LogOut,
    ChevronRight,
    ChevronDown,      // ← ADD
    Send,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Filter,
    RefreshCw,
    PieChart,
    Clock
} from 'lucide-react';
```

**Step 2: Add `expandedTeams` state near the other useState declarations (around line 132)**

```typescript
const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
```

**Step 3: Replace the static sidebar team section with the accordion version**

Find and replace the block that starts with:
```tsx
{(['azul', 'amarela'] as const)
    .filter(team => pipelines.some(p => p.team === team))
    .map(team => (
        <div className="group" key={team}>
            <label className={`team-label ${team}`}>
                {team === 'azul' ? 'Equipe Azul' : 'Equipe Amarela'}
            </label>
            {pipelines.filter(p => p.team === team).map(p => (
```

Replace the entire block (until the closing `})}` after the map) with:

```tsx
{(['azul', 'amarela'] as const)
    .filter(team => pipelines.some(p => p.team === team))
    .map(team => (
        <div className="group" key={team}>
            <label
                className={`team-label ${team} accordion-label`}
                onClick={() => setExpandedTeams(prev => {
                    const next = new Set(prev);
                    next.has(team) ? next.delete(team) : next.add(team);
                    return next;
                })}
            >
                {expandedTeams.has(team)
                    ? <ChevronDown size={14} />
                    : <ChevronRight size={14} />}
                {team === 'azul' ? 'Equipe Azul' : 'Equipe Amarela'}
            </label>
            {expandedTeams.has(team) && pipelines.filter(p => p.team === team).map(p => (
                <button
                    key={p.id}
                    className={activeTab === `brand-${p.id}` && page !== 'admin' ? 'active' : ''}
                    onClick={() => { setPage('app'); loadTabData(`brand-${p.id}`); }}
                >
                    <ChevronRight size={14} /> {p.name.replace('FUNIL ', '').substring(0, 15)}
                </button>
            ))}
        </div>
    ))
}
```

**Step 4: Add CSS for accordion label in `web/src/index.css`**

Find the `.team-label` styles in `index.css` and add:

```css
.team-label.accordion-label {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}
.team-label.accordion-label:hover {
  opacity: 0.8;
}
```

**Step 5: Build the web app**

```bash
cd /Users/guicrasto/antigravity-gui/supergerente && npm run build:all 2>&1 | tail -20
```
Expected: no errors.

**Step 6: Commit**

```bash
git add web/src/App.tsx web/src/index.css
git commit -m "feat: collapsible accordion for sidebar team groups"
```

---

### Task 4: Summary tab — data loading, rendering, and CSS

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/index.css`

**Context:** `loadTabData(tab)` switches on tab key to fetch data. `renderContent()` has early-return branches for `admin`, `chat`, and then falls through to a generic tab view. We add `summary` handling in both.

**Step 1: Add "Resumo Geral" button in the sidebar**

In the sidebar nav `<div className="group">` that contains Chat Atual and Relatório Agentes, add the new button **between** Chat Atual and Relatório Agentes:

```tsx
<button
    className={activeTab === 'summary' && page !== 'admin' ? 'active' : ''}
    onClick={() => { setPage('app'); loadTabData('summary'); }}
>
    <PieChart size={18} /> Resumo Geral
</button>
```

**Step 2: Add `summary` case in `loadTabData`**

In the `loadTabData` function, after the `else if (tab.startsWith('brand-'))` block and before the closing `}`, add:

```typescript
} else if (tab === 'summary') {
    res = await axios.get('/api/reports/summary', {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    setTabData(res.data);
}
```

**Step 3: Add summary rendering in `renderContent()`**

In `renderContent()`, after the `if (activeTab === 'chat') { return ... }` block and before the `const currentPipe = ...` line, add:

```tsx
if (activeTab === 'summary') {
    const teams = ['azul', 'amarela'] as const;
    return (
        <div className="tab-view">
            <header className="view-header">
                <div className="title-area">
                    <h1>Resumo Geral</h1>
                </div>
            </header>
            <section className="view-body">
                {loading ? (
                    <div className="loading">
                        <RefreshCw className="spin" />
                        <span>Processando dados...</span>
                    </div>
                ) : tabData ? (
                    <div className="summary-content">
                        {teams
                            .filter(team => (tabData as any[]).some((f: any) => f.team === team))
                            .map(team => (
                                <div key={team} className="summary-team-section">
                                    <h2 className={`summary-team-title ${team}`}>
                                        {team === 'azul' ? 'Equipe Azul' : 'Equipe Amarela'}
                                    </h2>
                                    <div className="summary-grid">
                                        {(tabData as any[])
                                            .filter((f: any) => f.team === team)
                                            .map((funil: any, i: number) => (
                                                <div key={i} className={`summary-card glass team-border-${team}`}>
                                                    <div className="summary-card-name">
                                                        {funil.nome.replace('FUNIL ', '')}
                                                    </div>
                                                    <div className="summary-stats">
                                                        <div className="summary-stat">
                                                            <span className="summary-value highlight">{funil.novosHoje}</span>
                                                            <span className="summary-label">hoje</span>
                                                        </div>
                                                        <div className="summary-stat">
                                                            <span className="summary-value">{funil.novosMes}</span>
                                                            <span className="summary-label">este mês</span>
                                                        </div>
                                                        <div className="summary-stat">
                                                            <span className="summary-value">{funil.ativos}</span>
                                                            <span className="summary-label">ativos</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                ) : (
                    <div className="empty">Nenhum dado disponível.</div>
                )}
            </section>
        </div>
    );
}
```

**Step 4: Add CSS for summary cards in `web/src/index.css`**

Append to the end of `web/src/index.css`:

```css
/* ── Summary Tab ──────────────────────────────────── */
.summary-content {
  padding: 24px;
}
.summary-team-section {
  margin-bottom: 32px;
}
.summary-team-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
}
.summary-team-title.azul   { color: #60a5fa; }
.summary-team-title.amarela { color: #fbbf24; }

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 14px;
}
.summary-card {
  padding: 16px 20px;
  border-radius: 10px;
  border-left: 3px solid transparent;
}
.summary-card.team-border-azul    { border-left-color: #3b82f6; }
.summary-card.team-border-amarela { border-left-color: #f59e0b; }

.summary-card-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.summary-stats {
  display: flex;
  gap: 20px;
}
.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #e2e8f0;
  line-height: 1;
}
.summary-value.highlight { color: #a78bfa; }
.summary-label {
  font-size: 0.62rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

**Step 5: Full build**

```bash
cd /Users/guicrasto/antigravity-gui/supergerente && npm run build:all 2>&1 | tail -20
```
Expected: no TypeScript errors, Vite build succeeds.

**Step 6: Commit**

```bash
git add web/src/App.tsx web/src/index.css
git commit -m "feat: add Resumo Geral tab with per-funnel today/month/active counts"
```

---

### Task 5: Push and verify on Railway

**Step 1: Push**

```bash
git push origin main
```

**Step 2: After Railway redeploys, verify the summary endpoint manually**

```bash
# Replace TOKEN with a valid user session token from localStorage in the browser
curl -s "https://<railway-url>/api/reports/summary" \
  -H "Authorization: Bearer TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} funnels returned'); [print(f'  {f[\"team\"]} | {f[\"nome\"]} | hoje={f[\"novosHoje\"]} mês={f[\"novosMes\"]} ativos={f[\"ativos\"]}') for f in d]"
```
Expected: list of funnels with numeric values for each metric.

**Step 3: In the browser**
- Sidebar: "Equipe Azul" and "Equipe Amarela" should be collapsed by default. Clicking expands the funnels.
- Clicking "Resumo Geral" shows cards per team with today/month/actives.
