# Multi-Team (Equipe Azul / Equipe Amarela) Design

**Goal:** Support two separate Kommo CRM accounts in a single panel, with per-user team access control.

**Architecture:** Two hardcoded KommoService instances (one per team), team-scoped CRM caches, team assignment stored in `profiles.teams` array in Supabase.

**Tech Stack:** Express + TypeScript + Supabase + React

---

## Teams

| Team key | Label | Kommo account | Env prefix |
|---|---|---|---|
| `azul` | Equipe Azul | ferramentasempresa001.kommo.com | `KOMMO_` (existing) |
| `amarela` | Equipe Amarela | iadeoperacoes.kommo.com | `KOMMO_AMARELA_` (new) |

---

## Backend Changes

### 1. `src/config.ts`
- Rename `kommoConfig` → `kommoAzulConfig` (same env vars `KOMMO_*`)
- Add `kommoAmarelaConfig` using env vars `KOMMO_AMARELA_*`
- Export `TEAMS` record: `{ azul: { label, config, excludePipelines }, amarela: { ... } }`
- Export `TeamKey = "azul" | "amarela"`
- `excludePipelines` for amarela: `["funil teste"]` (case-insensitive match)
- Keep `validateConfig()` checking both teams

### 2. `src/services/token-store.ts`
- Add `team: TeamKey` parameter to `loadTokens(team)` and `saveTokens(team, tokens)`
- Token keys: `kommo_azul_access_token`, `kommo_azul_refresh_token`, `kommo_amarela_access_token`, `kommo_amarela_refresh_token`
- On `loadTokens("azul")`, fall back to `kommo_access_token` / `kommo_refresh_token` (migration from old keys)

### 3. `src/services/kommo.ts`
- Constructor receives `team: TeamKey` alongside config
- `loadStoredToken()`, `refreshAccessToken()`, `exchangeAuthCode()` all use `loadTokens(team)` / `saveTokens(team, tokens)`
- No other changes needed

### 4. `src/api/cache/crm-cache.ts`
- `fetchAndCompute(service, excludePipelines)` fetches all pipelines dynamically (calls `service.getPipelines()`) then filters out excluded names
- Two module-level cache entries: `caches: Record<TeamKey, { metrics, expiresAt, fetchPromise }>`
- `getCrmMetrics(team, service)` — routes to the correct cache entry
- Pipeline data includes `team` field in each `FunilMetrics` and `VendedorMetrics`

### 5. `src/api/index.ts`
- Create `serviceAzul = new KommoService(kommoAzulConfig, "azul")`
- Create `serviceAmarela = new KommoService(kommoAmarelaConfig, "amarela")`
- On boot: `loadStoredToken()` for both; warm-up cache for both
- Pass `{ azul: serviceAzul, amarela: serviceAmarela }` to `createServer()`

### 6. `src/api/server.ts`
- Accept `services: Record<TeamKey, KommoService>` instead of single `service`
- Pass to all routers

### 7. `src/api/middleware/requireAuth.ts`
- `getUserTeams(userId)` — fetches `teams` column from `profiles` table
- Attach `req.userTeams: TeamKey[]` to request object

### 8. `src/api/routes/pipelines.ts`
- For each team in `req.userTeams`, call `services[team].getPipelines()` filtering out excluded names
- Return `Pipeline[]` with `team: TeamKey` added to each item

### 9. `src/api/routes/reports.ts`
- Fetch `getCrmMetrics` from all authorized teams
- Merge `vendedores` arrays, adding `team` label to each row

### 10. `src/api/routes/leads.ts`
- `GET /api/leads/new/:pid`: determine team by checking which team has this pipeline ID in its cached metrics; use that service

### 11. `src/api/routes/oauth.ts`
- All endpoints accept `?team=azul` or `?team=amarela` query param (default: `"azul"` for backward compat)
- `/api/oauth/start?team=amarela` returns URL with `kommoAmarelaConfig.clientId`
- `/api/oauth/exchange?team=amarela` uses `services.amarela.exchangeAuthCode(code)`
- `/api/oauth/status` returns status for both teams: `{ azul: {...}, amarela: {...} }`

### 12. `src/api/routes/admin.ts`
- `POST /api/admin/users/:id/approve` accepts `{ teams: ["azul"] | ["amarela"] | ["azul","amarela"] }`
- Updates `profiles.teams` column in Supabase

### 13. `src/api/routes/chat.ts`
- Pass CRM metrics from all authorized teams to AI context

---

## Database Changes

### Supabase SQL (run in SQL Editor)

```sql
-- Add teams column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS teams text[] DEFAULT '{}';

-- Give existing admin access to both teams
UPDATE public.profiles SET teams = '{"azul","amarela"}' WHERE role = 'admin';

-- Add Equipe Amarela token rows to settings
INSERT INTO public.settings (key, value) VALUES
  ('kommo_amarela_access_token', ''),
  ('kommo_amarela_refresh_token', '')
ON CONFLICT (key) DO NOTHING;

-- Migrate existing azul tokens to new keys
INSERT INTO public.settings (key, value, updated_at)
SELECT 'kommo_azul_access_token', value, updated_at FROM public.settings WHERE key = 'kommo_access_token'
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

INSERT INTO public.settings (key, value, updated_at)
SELECT 'kommo_azul_refresh_token', value, updated_at FROM public.settings WHERE key = 'kommo_refresh_token'
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
```

---

## Railway Env Vars (add these)

```
KOMMO_AMARELA_SUBDOMAIN=iadeoperacoes
KOMMO_AMARELA_CLIENT_ID=23bd9614-85d2-45fa-9adf-42e4ef25048b
KOMMO_AMARELA_CLIENT_SECRET=7Pz8zJ7oUGtWsfDOTbfoStu9MZXAFiiKgar4XXggl6PFt2O5SHoAv9PqAyTtZfd6
KOMMO_AMARELA_REDIRECT_URI=https://example.com
```

Note: `KOMMO_AMARELA_ACCESS_TOKEN` is not needed as an env var — token will be set via OAuth exchange from the admin panel after deploy.

---

## Frontend Changes

### App.tsx

1. **Pipeline type** — add `team: TeamKey` field
2. **Sidebar** — group pipelines under "Equipe Azul" / "Equipe Amarela" headers (only for teams the user has access to)
3. **loadTabData** — pipeline-team routing already implicit (pipeline IDs are unique)
4. **Admin panel → Token section** — render one card per team with independent status + OAuth flow
5. **Admin panel → Approve dialog** — checkboxes for teams when approving a user
6. **oauthCode / oauthMsg state** — extend to `Record<TeamKey, string>` for per-team UI

### index.css
- Team color labels: `.team-label.azul { color: #3b82f6; }` / `.team-label.amarela { color: #f59e0b; }`

---

## Post-Deploy Steps (for Equipe Amarela OAuth)

1. Deploy with new env vars
2. Admin opens the panel → Token Kommo → Equipe Amarela → "Autorizar Kommo"
3. Authorize on www.kommo.com, copy code, paste and confirm
4. System saves amarela tokens to Supabase, pipelines load automatically
