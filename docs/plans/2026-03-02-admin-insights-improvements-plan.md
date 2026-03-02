# Admin & Insights Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add manual insights refresh, admin users refresh button, and pipeline visibility management to reduce Gemini token waste and give admins full control over pipeline display.

**Architecture:** Backend changes add a cache-clear function for insights, a new `POST /insights/refresh` endpoint, and CRUD for `pipeline_visibility` in Supabase. Frontend changes convert InsightsPage to on-demand refresh, add refresh button to admin Users tab, and add a new "Visibilidade" admin tab with toggle grid.

**Tech Stack:** TypeScript, Express, Supabase (PostgreSQL), React 18, Tailwind CSS v4, Zustand, Axios

---

### Task 1: SQL — Create `pipeline_visibility` Table

**Files:**
- Create: `docs/plans/sql/pipeline-visibility.sql` (reference only, execute manually in Supabase Dashboard)

**Step 1: Write the SQL migration file**

```sql
-- Pipeline Visibility — global config per team
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS pipeline_visibility (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team TEXT NOT NULL,
  pipeline_id INTEGER NOT NULL,
  pipeline_name TEXT NOT NULL DEFAULT '',
  visible BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team, pipeline_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_pipeline_visibility_team
  ON pipeline_visibility(team);

-- RLS disabled (service role key bypasses anyway)
ALTER TABLE pipeline_visibility ENABLE ROW LEVEL SECURITY;
```

**Step 2: Save file and commit**

```bash
mkdir -p docs/plans/sql
git add docs/plans/sql/pipeline-visibility.sql
git commit -m "docs: add pipeline_visibility SQL migration"
```

**Step 3: Execute SQL in Supabase Dashboard**

Go to Supabase Dashboard → SQL Editor → paste and run the SQL above. Verify the table exists with:

```sql
SELECT * FROM pipeline_visibility LIMIT 1;
```

Expected: empty result, no errors.

---

### Task 2: Backend — Export Cache Clear Function

**Files:**
- Modify: `src/api/cache/conversation-cache.ts` (add ~10 lines at end of file)

**Step 1: Add `clearInsightsCache` export**

Add this function at the end of `conversation-cache.ts`, before the closing of the module:

```typescript
/**
 * Clears cached insights for a specific team or all teams.
 * After clearing, next call to getConversationInsights will trigger a fresh fetch.
 */
export function clearInsightsCache(team?: TeamKey): void {
  const teams = team ? [team] : (Object.keys(caches) as TeamKey[]);
  for (const t of teams) {
    caches[t].data = null;
    caches[t].expiresAt = 0;
    // Don't clear fetchPromise — if a fetch is in-flight, let it finish
  }
  console.log(`[InsightsCache] Cache cleared for: ${teams.join(", ")}`);
}
```

**Step 2: Verify backend compiles**

```bash
npm run build
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/api/cache/conversation-cache.ts
git commit -m "feat: add clearInsightsCache function"
```

---

### Task 3: Backend — POST /insights/refresh Endpoint

**Files:**
- Modify: `src/api/routes/insights.ts` (add ~25 lines after existing GET route)

**Step 1: Add the refresh endpoint**

Import `clearInsightsCache` at the top of `insights.ts`:

```typescript
import { getConversationInsights, clearInsightsCache } from "../cache/conversation-cache.js";
```

Add this route after the existing `router.get("/conversations", ...)` block (after line 47):

```typescript
router.post("/refresh", async (req: AuthRequest, res) => {
  const userTeams = req.userTeams || [];

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "SUA_CHAVE_AQUI") {
    res.status(400).json({ error: "GEMINI_API_KEY nao configurada" });
    return;
  }

  try {
    // Clear cache for user's teams
    for (const team of userTeams) {
      if (services[team]) {
        clearInsightsCache(team);
      }
    }

    // Trigger fresh fetch (returns immediately with processing: true)
    const allInsights = [];
    let anyProcessing = false;

    const teamResults = await Promise.all(
      userTeams.filter((t) => !!services[t]).map(async (team) => {
        try {
          return await getConversationInsights(team, services[team], genAI);
        } catch (teamErr: any) {
          console.error(`[Insights] Erro ao refresh equipe ${team}:`, teamErr.message);
          return { data: [], processing: false };
        }
      })
    );

    for (const result of teamResults) {
      allInsights.push(...result.data);
      if (result.processing) anyProcessing = true;
    }

    res.json({ insights: allInsights, processing: anyProcessing });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Insights] Refresh error:", error);
    res.status(500).json({ error: message });
  }
});
```

**Step 2: Verify backend compiles**

```bash
npm run build
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/api/routes/insights.ts
git commit -m "feat: add POST /insights/refresh endpoint"
```

---

### Task 4: Backend — Pipeline Visibility Endpoints

**Files:**
- Modify: `src/api/routes/admin.ts` (add ~60 lines at end, before `return router`)

**Step 1: Add imports**

At the top of `admin.ts`, add import for services and config if not already present:

```typescript
import { TEAMS, TeamKey } from "../../config.js";
```

The `adminRouter` function signature needs to accept services. Check current signature — if it's `adminRouter()` with no args, change it to:

```typescript
export function adminRouter(services: Record<TeamKey, KommoService>): Router {
```

And add the KommoService import:

```typescript
import { KommoService } from "../../services/kommo.js";
```

Also update `server.ts` line where `adminRouter()` is called to pass `services`:

```typescript
app.use("/api/admin", adminRouter(services));
```

**Step 2: Add GET /pipeline-visibility**

Add before `return router;` in `admin.ts`:

```typescript
// GET /api/admin/pipeline-visibility
router.get("/pipeline-visibility", async (_req, res) => {
  try {
    const allPipelines: Array<{
      pipeline_id: number;
      pipeline_name: string;
      team: string;
      visible: boolean;
    }> = [];

    // Fetch pipelines from Kommo API for each configured team
    const teamKeys = (Object.keys(TEAMS) as TeamKey[]).filter(
      (k) => TEAMS[k].subdomain && services[k]
    );

    const teamResults = await Promise.all(
      teamKeys.map(async (team) => {
        try {
          const excludeNames = TEAMS[team].excludePipelineNames;
          const pipelines = await services[team].getPipelines();
          return pipelines
            .filter((p: any) =>
              !excludeNames.some((ex) =>
                p.name.toUpperCase().includes(ex.toUpperCase())
              )
            )
            .map((p: any) => ({
              pipeline_id: p.id as number,
              pipeline_name: p.name as string,
              team,
            }));
        } catch (err: any) {
          console.error(`[Admin] Erro pipelines ${team}:`, err.message);
          return [];
        }
      })
    );

    const apiPipelines = teamResults.flat();

    // Fetch visibility overrides from Supabase
    const { data: overrides } = await supabase
      .from("pipeline_visibility")
      .select("team, pipeline_id, visible");

    const overrideMap = new Map<string, boolean>();
    for (const o of overrides || []) {
      overrideMap.set(`${o.team}:${o.pipeline_id}`, o.visible);
    }

    // Merge: default visible=true if no override
    for (const p of apiPipelines) {
      const key = `${p.team}:${p.pipeline_id}`;
      allPipelines.push({
        ...p,
        visible: overrideMap.has(key) ? overrideMap.get(key)! : true,
      });
    }

    res.json(allPipelines);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Admin] Pipeline visibility error:", error);
    res.status(500).json({ error: message });
  }
});
```

**Step 3: Add PUT /pipeline-visibility**

```typescript
// PUT /api/admin/pipeline-visibility
router.put("/pipeline-visibility", async (req, res) => {
  const { team, pipeline_id, pipeline_name, visible } = req.body;

  if (!team || !pipeline_id || typeof visible !== "boolean") {
    res.status(400).json({ error: "team, pipeline_id e visible sao obrigatorios" });
    return;
  }

  try {
    const { error } = await supabase
      .from("pipeline_visibility")
      .upsert(
        {
          team,
          pipeline_id,
          pipeline_name: pipeline_name || "",
          visible,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "team,pipeline_id" }
      );

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});
```

**Step 4: Verify backend compiles**

```bash
npm run build
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/api/routes/admin.ts src/api/server.ts
git commit -m "feat: add pipeline visibility admin endpoints"
```

---

### Task 5: Backend — Filter Pipelines by Visibility

**Files:**
- Modify: `src/api/routes/pipelines.ts` (add ~15 lines of visibility filtering)

**Step 1: Add visibility filter**

At the top of `pipelines.ts`, add supabase import:

```typescript
import { supabase } from "../supabase.js";
```

Inside the `GET /` handler, after building the `results` array from `teamResults.flat()`, add visibility filtering before sending the response. The key logic: if `req.userRole === "admin"`, skip filtering (admin sees all). Otherwise, check `pipeline_visibility` table:

```typescript
// Filter by pipeline_visibility (admin bypasses)
if (req.userRole !== "admin") {
  const { data: overrides } = await supabase
    .from("pipeline_visibility")
    .select("team, pipeline_id, visible")
    .eq("visible", false);

  if (overrides && overrides.length > 0) {
    const hiddenSet = new Set(
      overrides.map((o: any) => `${o.team}:${o.pipeline_id}`)
    );
    const filtered = results.filter(
      (p: any) => !hiddenSet.has(`${p.team}:${p.id}`)
    );
    results.length = 0;
    results.push(...filtered);
  }
}
```

Add this block just before `res.json(results)`.

Also ensure the `AuthRequest` type is used on the request so `req.userRole` is available. The `requireAuth` middleware already sets this.

**Step 2: Verify backend compiles**

```bash
npm run build
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/api/routes/pipelines.ts
git commit -m "feat: filter pipelines by visibility table"
```

---

### Task 6: Frontend — Insights Manual Refresh

**Files:**
- Modify: `web/src/pages/InsightsPage.tsx`

**Step 1: Refactor InsightsPage**

Replace the current auto-polling logic with manual refresh. Key changes:

1. Remove the auto-polling `useEffect` (current lines 63-68)
2. Add a `refreshing` state for the button
3. Add `handleRefresh` that calls `POST /insights/refresh`
4. Only poll after a manual refresh while `processing === true`
5. Add "Atualizar Insights" button in the header

Updated imports:

```typescript
import { Brain, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
```

Add state:

```typescript
const [refreshing, setRefreshing] = useState(false);
```

Add refresh handler:

```typescript
const handleRefresh = async () => {
  setRefreshing(true);
  try {
    const res = await api.post<InsightsResponse>('/insights/refresh');
    const { insights, processing: isProcessing } = res.data;
    setData(insights);
    setProcessing(isProcessing);
    if (insights.length > 0 && !selectedAgent) {
      setSelectedAgent(insights[0].nome);
    }
  } catch (err) {
    console.error('[InsightsPage] Erro ao atualizar:', err);
  } finally {
    setRefreshing(false);
  }
};
```

Keep the polling `useEffect` but it only activates after refresh sets `processing = true`:

```typescript
useEffect(() => {
  if (!processing) return;
  const timer = setInterval(() => fetchData(false), POLL_INTERVAL_MS);
  return () => clearInterval(timer);
}, [processing, fetchData]);
```

Add button to the header area (next to the h1):

```tsx
<Button
  variant="secondary"
  size="sm"
  loading={refreshing || processing}
  onClick={handleRefresh}
>
  <RefreshCw className="h-4 w-4" />
  Atualizar Insights
</Button>
```

Remove the `processing` badge that was shown inline — replace with the button's loading state.

**Step 2: Verify frontend compiles**

```bash
cd web && npm run build
```

Expected: no errors.

**Step 3: Commit**

```bash
git add web/src/pages/InsightsPage.tsx
git commit -m "feat: manual insights refresh button (saves Gemini tokens)"
```

---

### Task 7: Frontend — Admin Users Refresh Button

**Files:**
- Modify: `web/src/pages/AdminPage.tsx` (add ~10 lines in usuarios tab section)

**Step 1: Add refresh button**

Import `RefreshCw` from lucide-react at the top of AdminPage.tsx:

```typescript
import { Users, Bot, KeyRound, BarChart3, Plus, RefreshCw } from 'lucide-react';
```

Add a `refreshingUsers` state:

```typescript
const [refreshingUsers, setRefreshingUsers] = useState(false);
```

Add a refresh handler:

```typescript
const handleRefreshUsers = async () => {
  setRefreshingUsers(true);
  await fetchUsers();
  setRefreshingUsers(false);
};
```

In the `{activeTab === 'usuarios'}` section, wrap the content with a header that includes the button. Replace lines 164-176:

```tsx
{activeTab === 'usuarios' && (
  <>
    <div className="flex justify-end">
      <Button
        variant="secondary"
        size="sm"
        loading={refreshingUsers}
        onClick={handleRefreshUsers}
      >
        <RefreshCw className="h-4 w-4" />
        Atualizar
      </Button>
    </div>
    {users.length === 0 ? (
      <EmptyState
        icon={Users}
        title="Nenhum usuario encontrado"
        description="Nao ha usuarios cadastrados no sistema."
      />
    ) : (
      <UserTable users={users} onRefresh={fetchUsers} />
    )}
  </>
)}
```

**Step 2: Verify frontend compiles**

```bash
cd web && npm run build
```

Expected: no errors.

**Step 3: Commit**

```bash
git add web/src/pages/AdminPage.tsx
git commit -m "feat: add refresh button to admin users tab"
```

---

### Task 8: Frontend — Pipeline Visibility Admin Tab

**Files:**
- Create: `web/src/components/features/admin/PipelineVisibility.tsx`
- Modify: `web/src/pages/AdminPage.tsx` (add tab + component)

**Step 1: Create PipelineVisibility component**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, EmptyState } from '@/components/ui';

interface PipelineVisibilityItem {
  pipeline_id: number;
  pipeline_name: string;
  team: string;
  visible: boolean;
}

export function PipelineVisibility() {
  const [pipelines, setPipelines] = useState<PipelineVisibilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get<PipelineVisibilityItem[]>('/admin/pipeline-visibility');
      setPipelines(res.data);
    } catch (err) {
      console.error('[PipelineVisibility] Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (item: PipelineVisibilityItem) => {
    const key = `${item.team}:${item.pipeline_id}`;
    setTogglingId(key);

    // Optimistic update
    setPipelines((prev) =>
      prev.map((p) =>
        p.team === item.team && p.pipeline_id === item.pipeline_id
          ? { ...p, visible: !p.visible }
          : p
      )
    );

    try {
      await api.put('/admin/pipeline-visibility', {
        team: item.team,
        pipeline_id: item.pipeline_id,
        pipeline_name: item.pipeline_name,
        visible: !item.visible,
      });
    } catch (err) {
      console.error('[PipelineVisibility] Erro ao atualizar:', err);
      // Revert on error
      setPipelines((prev) =>
        prev.map((p) =>
          p.team === item.team && p.pipeline_id === item.pipeline_id
            ? { ...p, visible: item.visible }
            : p
        )
      );
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const azulPipelines = pipelines.filter((p) => p.team === 'azul');
  const amarelaPipelines = pipelines.filter((p) => p.team === 'amarela');

  if (pipelines.length === 0) {
    return (
      <EmptyState
        icon={Eye}
        title="Nenhum pipeline encontrado"
        description="Nao ha pipelines configurados nas equipes."
      />
    );
  }

  const renderTeamColumn = (
    teamLabel: string,
    teamPipelines: PipelineVisibilityItem[]
  ) => (
    <Card>
      <div className="p-5">
        <h3 className="font-heading text-heading-sm mb-4">{teamLabel}</h3>
        {teamPipelines.length === 0 ? (
          <p className="text-body-sm text-muted">Nenhum pipeline nesta equipe.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {teamPipelines.map((p) => {
              const key = `${p.team}:${p.pipeline_id}`;
              const isToggling = togglingId === key;
              return (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-button border border-glass-border/50 px-4 py-3 cursor-pointer hover:bg-surface-secondary/50 transition-colors"
                >
                  <span className="text-body-md">{p.pipeline_name}</span>
                  <div className="flex items-center gap-2">
                    {isToggling && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
                    )}
                    <input
                      type="checkbox"
                      checked={p.visible}
                      onChange={() => handleToggle(p)}
                      disabled={isToggling}
                      className="accent-primary h-4 w-4"
                    />
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {renderTeamColumn('Equipe Azul', azulPipelines)}
      {renderTeamColumn('Equipe Amarela', amarelaPipelines)}
    </div>
  );
}
```

**Step 2: Add "Visibilidade" tab to AdminPage**

In `AdminPage.tsx`, import the new component and the `Eye` icon:

```typescript
import { PipelineVisibility } from '@/components/features/admin/PipelineVisibility';
import { Users, Bot, KeyRound, BarChart3, Plus, RefreshCw, Eye } from 'lucide-react';
```

Update the `AdminTab` type and `TABS` array:

```typescript
type AdminTab = 'usuarios' | 'mentores' | 'tokens' | 'uso' | 'visibilidade';

const TABS: { key: AdminTab; label: string; icon: typeof Users }[] = [
  { key: 'usuarios', label: 'Usuarios', icon: Users },
  { key: 'mentores', label: 'Mentores', icon: Bot },
  { key: 'tokens', label: 'Tokens', icon: KeyRound },
  { key: 'uso', label: 'Uso IA', icon: BarChart3 },
  { key: 'visibilidade', label: 'Visibilidade', icon: Eye },
];
```

Add tab content section after the "Uso IA" block:

```tsx
{activeTab === 'visibilidade' && <PipelineVisibility />}
```

**Step 3: Verify frontend compiles**

```bash
cd web && npm run build
```

Expected: no errors.

**Step 4: Commit**

```bash
git add web/src/components/features/admin/PipelineVisibility.tsx web/src/pages/AdminPage.tsx
git commit -m "feat: add pipeline visibility admin tab"
```

---

### Task 9: Build Verification & Final Commit

**Step 1: Full build**

```bash
npm run build:all
```

Expected: no errors on backend or frontend.

**Step 2: Verify no TypeScript errors**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Push to deploy**

```bash
git push origin main
```

Expected: Railway auto-deploys. Verify at https://www.assistentekommo.site/

**Step 4: Post-deploy — Execute SQL**

Run the SQL from Task 1 in Supabase Dashboard if not already done.
