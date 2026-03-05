# Admin Microservice Isolation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the admin panel (users, mentors, tokens, OAuth, pipeline visibility) into a standalone microservice with its own backend (Railway) and frontend (Vercel), then remove all admin code from the main app.

**Architecture:** Monorepo with npm workspaces. Shared package for types/config/supabase. Admin backend is a standalone Express server. Admin frontend is a standalone React+Vite app. Main app is cleaned of all admin code.

**Tech Stack:** TypeScript, Express 5, React 18, Vite 5, Tailwind CSS v4, Zustand, Supabase, Axios

---

### Task 1: Set Up Monorepo Workspaces

**Files:**
- Modify: `package.json` (root)

**Step 1: Add workspaces to root package.json**

Add the `workspaces` field to the root `package.json`:

```json
{
  "name": "supergerente",
  "version": "1.0.0",
  "type": "module",
  "workspaces": [
    "packages/*",
    "admin/api",
    "admin/web"
  ],
  ...rest stays the same
}
```

Only add the `"workspaces"` field — do NOT change any other fields.

**Step 2: Create directory structure**

```bash
mkdir -p packages/shared/src
mkdir -p admin/api/src/routes
mkdir -p admin/api/src/middleware
mkdir -p admin/api/src/services
mkdir -p admin/web/src/pages
mkdir -p admin/web/src/components/ui
mkdir -p admin/web/src/components/features/admin
mkdir -p admin/web/src/stores
mkdir -p admin/web/src/lib
mkdir -p admin/web/src/types
mkdir -p admin/web/public/icons
```

**Step 3: Commit**

```bash
git add package.json packages/ admin/
git commit -m "chore: set up monorepo workspace structure"
```

---

### Task 2: Create Shared Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/config.ts`
- Create: `packages/shared/src/supabase.ts`
- Create: `packages/shared/src/token-store.ts`
- Create: `packages/shared/src/index.ts`

**Step 1: Create packages/shared/package.json**

```json
{
  "name": "@sg/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.98.0",
    "dotenv": "^16.3.1"
  }
}
```

**Step 2: Create packages/shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create packages/shared/src/types.ts**

Copy the backend types that admin needs. These are the EXACT types from `src/types/index.ts` and `web/src/types/index.ts` that the admin uses:

```typescript
export type TeamKey = "azul" | "amarela";

export interface TeamConfig {
  label: string;
  subdomain: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken: string;
  excludePipelineNames: string[];
}

export interface KommoConfig {
  subdomain: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken: string;
}

export interface KommoTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

// Frontend types
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  teams?: string[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: "pending" | "approved" | "denied";
  teams?: string[];
}

export interface Mentor {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  methodology_text?: string;
  is_active: boolean;
}

export interface MentorFormData {
  id?: string;
  name: string;
  description: string;
  system_prompt: string;
  methodology_text: string;
  is_active: boolean;
}

export interface TokenStatus {
  hasRefreshToken: boolean;
  expiresAt: string | null;
}

export interface TokenUsage {
  userId: string;
  name: string;
  email: string;
  messages: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: string | number;
}

export type Team = "azul" | "amarela";
```

**Step 4: Create packages/shared/src/config.ts**

```typescript
import dotenv from "dotenv";
dotenv.config();

import type { TeamKey, TeamConfig } from "./types.js";

export const TEAMS: Record<TeamKey, TeamConfig> = {
  azul: {
    label: "Equipe Azul",
    subdomain: process.env.KOMMO_SUBDOMAIN || "",
    clientId: process.env.KOMMO_CLIENT_ID || "",
    clientSecret: process.env.KOMMO_CLIENT_SECRET || "",
    redirectUri: process.env.KOMMO_REDIRECT_URI || "",
    accessToken: process.env.KOMMO_ACCESS_TOKEN || "",
    excludePipelineNames: [],
  },
  amarela: {
    label: "Equipe Amarela",
    subdomain: process.env.KOMMO_AMARELA_SUBDOMAIN || "",
    clientId: process.env.KOMMO_AMARELA_CLIENT_ID || "",
    clientSecret: process.env.KOMMO_AMARELA_CLIENT_SECRET || "",
    redirectUri: process.env.KOMMO_AMARELA_REDIRECT_URI || "",
    accessToken: process.env.KOMMO_AMARELA_ACCESS_TOKEN || "",
    excludePipelineNames: ["funil teste"],
  },
};

export const ALL_CONFIGURED_TEAMS = (Object.keys(TEAMS) as TeamKey[]).filter(
  (k) => TEAMS[k].subdomain
);

export const PORT = parseInt(process.env.PORT || "3001", 10);
```

**Step 5: Create packages/shared/src/supabase.ts**

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

**Step 6: Create packages/shared/src/token-store.ts**

Copy from `src/services/token-store.ts` but using the shared supabase factory:

```typescript
import { createSupabaseClient } from "./supabase.js";
import type { TeamKey, KommoTokens } from "./types.js";

export async function loadTokens(team: TeamKey): Promise<KommoTokens | null> {
  const supabase = createSupabaseClient();
  const accessKey = `kommo_${team}_access_token`;
  const refreshKey = `kommo_${team}_refresh_token`;
  const expiresKey = `kommo_${team}_expires_at`;

  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", [accessKey, refreshKey, expiresKey]);

  if (error || !data || data.length === 0) return null;

  const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
  const accessToken = map[accessKey] || "";
  const refreshToken = map[refreshKey] || "";
  const expiresAt = map[expiresKey] ? parseInt(map[expiresKey]) : undefined;

  if (!accessToken) return null;
  return { accessToken, refreshToken, expiresAt };
}

export async function saveTokens(team: TeamKey, tokens: KommoTokens): Promise<void> {
  const supabase = createSupabaseClient();
  const rows: Array<{ key: string; value: string; updated_at: string }> = [
    { key: `kommo_${team}_access_token`, value: tokens.accessToken, updated_at: new Date().toISOString() },
    { key: `kommo_${team}_refresh_token`, value: tokens.refreshToken, updated_at: new Date().toISOString() },
  ];
  if (tokens.expiresAt !== undefined) {
    rows.push({ key: `kommo_${team}_expires_at`, value: String(tokens.expiresAt), updated_at: new Date().toISOString() });
  }
  await supabase.from("settings").upsert(rows);
}
```

**Step 7: Create packages/shared/src/index.ts**

```typescript
export * from "./types.js";
export * from "./config.js";
export * from "./supabase.js";
export * from "./token-store.js";
```

**Step 8: Commit**

```bash
git add packages/
git commit -m "feat: create shared package with types, config, supabase, token-store"
```

---

### Task 3: Create Admin Backend

**Files:**
- Create: `admin/api/package.json`
- Create: `admin/api/tsconfig.json`
- Create: `admin/api/railway.toml`
- Create: `admin/api/src/server.ts`
- Create: `admin/api/src/index.ts`
- Create: `admin/api/src/middleware/requireAuth.ts`
- Create: `admin/api/src/services/kommo.ts`
- Create: `admin/api/src/routes/admin.ts`
- Create: `admin/api/src/routes/oauth.ts`
- Create: `admin/api/src/routes/auth.ts`

**Step 1: Create admin/api/package.json**

```json
{
  "name": "@sg/admin-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@sg/shared": "*",
    "@supabase/supabase-js": "^2.98.0",
    "axios": "^1.6.0",
    "cors": "^2.8.6",
    "dotenv": "^16.3.1",
    "express": "^5.2.1",
    "qs": "^6.15.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/node": "^20.0.0",
    "@types/qs": "^6.14.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Create admin/api/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create admin/api/railway.toml**

```toml
[build]
buildCommand = "cd ../.. && npm install && cd admin/api && npm run build"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 120
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

**Step 4: Create admin/api/src/services/kommo.ts**

Lean version of KommoService — only methods admin needs (exchangeAuthCode, refreshAccessToken, getPipelines, loadStoredToken):

```typescript
import axios, { AxiosInstance } from "axios";
import qs from "qs";
import { TeamKey, KommoConfig, loadTokens, saveTokens } from "@sg/shared";

export class KommoService {
  public client: AxiosInstance;
  private config: KommoConfig;
  private currentAccessToken: string;
  private team: TeamKey;

  constructor(config: KommoConfig, team: TeamKey) {
    this.config = config;
    this.team = team;
    this.currentAccessToken = config.accessToken ?? "";
    this.client = axios.create({
      baseURL: `https://${config.subdomain}.kommo.com/api/v4`,
      timeout: 15_000,
      headers: { "Content-Type": "application/json" },
      paramsSerializer: {
        serialize: (params) => qs.stringify(params, { arrayFormat: "brackets" }),
      },
    });

    this.setAccessToken(this.currentAccessToken);

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retried) {
          original._retried = true;
          try {
            const newToken = await this.refreshAccessToken();
            original.headers["Authorization"] = `Bearer ${newToken}`;
            return this.client(original);
          } catch (refreshErr) {
            console.error(`[KommoService:${this.team}] Token refresh failed:`, refreshErr);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  public async loadStoredToken(): Promise<void> {
    try {
      const stored = await loadTokens(this.team);
      if (stored?.accessToken && stored.accessToken !== this.currentAccessToken) {
        console.log(`[KommoService:${this.team}] Using stored access token from Supabase`);
        this.setAccessToken(stored.accessToken);
      }
    } catch (e) {
      console.warn(`[KommoService:${this.team}] Could not load stored token:`, e);
    }
  }

  private setAccessToken(token: string): void {
    this.currentAccessToken = token;
    this.client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  public async refreshAccessToken(): Promise<string> {
    const stored = await loadTokens(this.team);
    if (!stored?.refreshToken) {
      throw new Error(`[${this.team}] No refresh token available.`);
    }

    console.log(`[KommoService:${this.team}] Refreshing access token...`);
    const response = await axios.post(
      `https://${this.config.subdomain}.kommo.com/oauth2/access_token`,
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: stored.refreshToken,
        redirect_uri: this.config.redirectUri,
      }
    );

    const { access_token, refresh_token, expires_in, server_time } = response.data;
    const expiresAt = (server_time || Math.floor(Date.now() / 1000)) + (expires_in || 86400);
    await saveTokens(this.team, { accessToken: access_token, refreshToken: refresh_token, expiresAt });
    this.setAccessToken(access_token);
    console.log(`[KommoService:${this.team}] Token refreshed. Expires at ${new Date(expiresAt * 1000).toISOString()}`);
    return access_token;
  }

  public async proactiveRefresh(): Promise<void> {
    try {
      const stored = await loadTokens(this.team);
      if (!stored?.refreshToken) return;
      const now = Math.floor(Date.now() / 1000);
      const twoHours = 2 * 60 * 60;
      if (!stored.expiresAt || stored.expiresAt - now < twoHours) {
        await this.refreshAccessToken();
      }
    } catch (e: any) {
      console.error(`[KommoService:${this.team}] Proactive refresh failed:`, e.message);
    }
  }

  public async exchangeAuthCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await axios.post(
      `https://${this.config.subdomain}.kommo.com/oauth2/access_token`,
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
      }
    );

    const { access_token, refresh_token, expires_in, server_time } = response.data;
    const expiresAt = (server_time || Math.floor(Date.now() / 1000)) + (expires_in || 86400);
    await saveTokens(this.team, { accessToken: access_token, refreshToken: refresh_token, expiresAt });
    this.setAccessToken(access_token);
    console.log(`[KommoService:${this.team}] Auth code exchanged. Expires at ${new Date(expiresAt * 1000).toISOString()}`);
    return { accessToken: access_token, refreshToken: refresh_token };
  }

  public async getPipelines(): Promise<any[]> {
    try {
      const response = await this.client.get("/leads/pipelines");
      return response.data?._embedded?.pipelines || [];
    } catch (error) {
      console.error("Error fetching pipelines:", error);
      throw error;
    }
  }
}
```

**Step 5: Create admin/api/src/middleware/requireAuth.ts**

Copy from `src/api/middleware/requireAuth.ts` — uses shared imports:

```typescript
import { Request, Response, NextFunction } from "express";
import { createSupabaseClient, TeamKey, TEAMS, ALL_CONFIGURED_TEAMS } from "@sg/shared";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userTeams?: TeamKey[];
}

interface CachedProfile {
  userId: string;
  role: string;
  teams: TeamKey[];
  expiresAt: number;
}

const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
const authCache = new Map<string, CachedProfile>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of authCache) {
    if (now > entry.expiresAt) authCache.delete(key);
  }
}, 10 * 60 * 1000);

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Token nao fornecido." });
    return;
  }

  const cached = authCache.get(token);
  if (cached && Date.now() < cached.expiresAt) {
    req.userId = cached.userId;
    req.userRole = cached.role;
    req.userTeams = cached.teams;
    return next();
  }

  const supabase = createSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    authCache.delete(token);
    res.status(401).json({ error: "Token invalido." });
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role, teams")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "approved") {
    res.status(403).json({ error: "Acesso pendente de aprovacao." });
    return;
  }

  const teams: TeamKey[] = profile.role === "admin"
    ? ALL_CONFIGURED_TEAMS
    : (profile.teams || []) as TeamKey[];

  authCache.set(token, {
    userId: user.id,
    role: profile.role,
    teams,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });

  req.userId = user.id;
  req.userRole = profile.role;
  req.userTeams = teams;
  next();
}

export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, async () => {
    if (req.userRole !== "admin") {
      res.status(403).json({ error: "Acesso restrito a administradores." });
      return;
    }
    next();
  });
}
```

**Step 6: Create admin/api/src/routes/admin.ts**

Copy the EXACT content of `src/api/routes/admin.ts` but with updated imports:

```typescript
import { Router } from "express";
import { createSupabaseClient, TEAMS, TeamKey } from "@sg/shared";
import { requireAdmin, AuthRequest } from "../middleware/requireAuth.js";
import { KommoService } from "../services/kommo.js";

export function adminRouter(services: Record<TeamKey, KommoService>): Router {
  const router = Router();
  router.use(requireAdmin as any);

  const supabase = createSupabaseClient();

  // GET /api/admin/users
  router.get("/users", async (_req, res) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, status, role, teams, created_at")
      .neq("role", "admin")
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  });

  // POST /api/admin/users/:id/approve
  router.post("/users/:id/approve", async (req, res) => {
    const { teams } = req.body;
    const updateData: any = { status: "approved" };
    if (Array.isArray(teams) && teams.length > 0) {
      updateData.teams = teams;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ message: "Usuario aprovado." });
  });

  // POST /api/admin/users/:id/deny
  router.post("/users/:id/deny", async (req, res) => {
    const { error } = await supabase
      .from("profiles")
      .update({ status: "denied" })
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ message: "Usuario negado." });
  });

  // GET /api/admin/tokens (usage analytics)
  router.get("/tokens", async (_req, res) => {
    const { data, error } = await supabase
      .from("token_logs")
      .select(`user_id, total_tokens, prompt_tokens, completion_tokens, created_at, profiles!inner(name, email)`)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const byUser: Record<string, any> = {};
    for (const row of data || []) {
      const uid = row.user_id;
      if (!byUser[uid]) {
        byUser[uid] = {
          userId: uid,
          name: (row.profiles as any).name,
          email: (row.profiles as any).email,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          messages: 0,
          estimatedCostUSD: 0,
        };
      }
      byUser[uid].totalTokens += row.total_tokens;
      byUser[uid].promptTokens += row.prompt_tokens;
      byUser[uid].completionTokens += row.completion_tokens;
      byUser[uid].messages += 1;
      byUser[uid].estimatedCostUSD +=
        (row.prompt_tokens * 0.075 + row.completion_tokens * 0.30) / 1_000_000;
    }

    const result = Object.values(byUser)
      .sort((a: any, b: any) => b.totalTokens - a.totalTokens)
      .map((u: any) => ({ ...u, estimatedCostUSD: `$${u.estimatedCostUSD.toFixed(4)}` }));

    res.json(result);
  });

  // GET /api/admin/mentors
  router.get("/mentors", async (_req, res) => {
    const { data, error } = await supabase
      .from("mentors")
      .select("id, name, description, system_prompt, methodology_text, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // POST /api/admin/mentors
  router.post("/mentors", async (req, res) => {
    const { name, description, system_prompt, methodology_text, is_active } = req.body;
    if (!name || !system_prompt) return res.status(400).json({ error: "name e system_prompt sao obrigatorios" });
    const { data, error } = await supabase
      .from("mentors")
      .insert({ name, description, system_prompt, methodology_text, is_active: is_active ?? true })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // PUT /api/admin/mentors/:id
  router.put("/mentors/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description, system_prompt, methodology_text, is_active } = req.body;
    const { data, error } = await supabase
      .from("mentors")
      .update({ name, description, system_prompt, methodology_text, is_active })
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // DELETE /api/admin/mentors/:id
  router.delete("/mentors/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from("mentors").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // GET /api/admin/pipeline-visibility
  router.get("/pipeline-visibility", async (_req, res) => {
    try {
      const allPipelines: Array<{
        pipeline_id: number;
        pipeline_name: string;
        team: string;
        visible: boolean;
      }> = [];

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

      const { data: overrides } = await supabase
        .from("pipeline_visibility")
        .select("team, pipeline_id, visible");

      const overrideMap = new Map<string, boolean>();
      for (const o of overrides || []) {
        overrideMap.set(`${o.team}:${o.pipeline_id}`, o.visible);
      }

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

  // PUT /api/admin/pipeline-visibility
  router.put("/pipeline-visibility", async (req, res) => {
    const { team, pipeline_id, pipeline_name, visible } = req.body;
    const validTeams = Object.keys(TEAMS) as TeamKey[];

    if (!team || !pipeline_id || typeof visible !== "boolean") {
      res.status(400).json({ error: "team, pipeline_id e visible sao obrigatorios" });
      return;
    }

    if (!validTeams.includes(team)) {
      res.status(400).json({ error: "Equipe invalida" });
      return;
    }

    if (typeof pipeline_id !== "number" || !Number.isInteger(pipeline_id) || pipeline_id <= 0) {
      res.status(400).json({ error: "pipeline_id invalido" });
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

  return router;
}
```

**Step 7: Create admin/api/src/routes/oauth.ts**

Copy from `src/api/routes/oauth.ts` with updated imports:

```typescript
import { Router } from "express";
import { TEAMS, TeamKey, loadTokens } from "@sg/shared";
import { KommoService } from "../services/kommo.js";
import { requireAdmin } from "../middleware/requireAuth.js";

export function oauthRouter(services: Record<TeamKey, KommoService>): Router {
  const router = Router();
  router.use(requireAdmin as any);

  router.get("/start", (_req, res) => {
    const team = (_req.query.team as TeamKey) || "azul";
    const config = TEAMS[team];
    if (!config) {
      res.status(400).json({ error: "Team invalida." });
      return;
    }
    const url =
      `https://www.kommo.com/oauth/?` +
      `client_id=${config.clientId}` +
      `&state=renew` +
      `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
      `&response_type=code`;
    res.json({ url });
  });

  router.post("/exchange", async (req, res) => {
    const team = (req.query.team as TeamKey) || "azul";
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: "Codigo de autorizacao nao fornecido." });
      return;
    }
    const service = services[team];
    if (!service) {
      res.status(400).json({ error: "Team invalida." });
      return;
    }
    try {
      const tokens = await service.exchangeAuthCode(code);
      res.json({ message: "Token renovado com sucesso!", accessToken: tokens.accessToken.slice(0, 20) + "..." });
    } catch (err: any) {
      const kommoError = err.response?.data;
      console.error(`[OAuth:${team}] Exchange failed:`, kommoError || err.message);
      const detail = kommoError?.hint || kommoError?.detail || kommoError?.title || (typeof kommoError === "string" ? kommoError : err.message);
      res.status(500).json({ error: detail });
    }
  });

  router.get("/status", async (_req, res) => {
    try {
      const result: Record<TeamKey, { hasRefreshToken: boolean; expiresAt: string | null }> = {
        azul: { hasRefreshToken: false, expiresAt: null },
        amarela: { hasRefreshToken: false, expiresAt: null },
      };

      for (const team of (["azul", "amarela"] as TeamKey[])) {
        const stored = await loadTokens(team);
        result[team].hasRefreshToken = !!stored?.refreshToken;

        const token = stored?.accessToken || TEAMS[team].accessToken || "";
        if (token) {
          try {
            const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
            result[team].expiresAt = new Date(payload.exp * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
          } catch { /* ignore decode errors */ }
        }
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
```

**Step 8: Create admin/api/src/routes/auth.ts**

Admin needs its own login endpoint that verifies admin role:

```typescript
import { Router } from "express";
import { createSupabaseClient } from "@sg/shared";

export function authRouter(): Router {
  const router = Router();

  router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email e senha sao obrigatorios." });
      return;
    }

    const supabase = createSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      res.status(401).json({ error: "Email ou senha incorretos." });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("status, role, name, teams")
      .eq("id", data.user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      res.status(403).json({ error: "Acesso restrito a administradores." });
      return;
    }

    res.json({
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: profile.name,
        role: profile.role,
        teams: profile.teams || [],
      },
    });
  });

  return router;
}
```

**Step 9: Create admin/api/src/server.ts**

```typescript
import express from "express";
import cors from "cors";
import { TeamKey } from "@sg/shared";
import { adminRouter } from "./routes/admin.js";
import { oauthRouter } from "./routes/oauth.js";
import { authRouter } from "./routes/auth.js";
import { KommoService } from "./services/kommo.js";

export function createServer(services: Record<TeamKey, KommoService>) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "admin" });
  });

  app.use("/api/auth", authRouter());
  app.use("/api/admin", adminRouter(services));
  app.use("/api/oauth", oauthRouter(services));

  return app;
}
```

**Step 10: Create admin/api/src/index.ts**

```typescript
import { TEAMS, PORT } from "@sg/shared";
import { KommoService } from "./services/kommo.js";
import { createServer } from "./server.js";

const services = {
  azul: new KommoService(TEAMS.azul, "azul"),
  amarela: new KommoService(TEAMS.amarela, "amarela"),
};

const app = createServer(services);

const REFRESH_INTERVAL_MS = 20 * 60 * 60 * 1000;

async function refreshAllTokens() {
  console.log("[Admin] Verificando tokens Kommo...");
  await services.azul.proactiveRefresh();
  if (TEAMS.amarela.subdomain) {
    await services.amarela.proactiveRefresh();
  }
}

app.listen(PORT, async () => {
  console.log(`[Admin] Server running on http://localhost:${PORT}`);
  await services.azul.loadStoredToken();
  if (TEAMS.amarela.subdomain) {
    await services.amarela.loadStoredToken();
  }
  await refreshAllTokens();
  setInterval(refreshAllTokens, REFRESH_INTERVAL_MS);
});
```

**Step 11: Commit**

```bash
git add admin/api/
git commit -m "feat: create admin backend microservice"
```

---

### Task 4: Create Admin Frontend

**Files:**
- Create: `admin/web/package.json`
- Create: `admin/web/tsconfig.json`
- Create: `admin/web/vite.config.ts`
- Create: `admin/web/vercel.json`
- Create: `admin/web/index.html`
- Create: `admin/web/src/main.tsx`
- Create: `admin/web/src/index.css`
- Create: `admin/web/src/App.tsx`
- Create: `admin/web/src/vite-env.d.ts`

**Step 1: Create admin/web/package.json**

```json
{
  "name": "@sg/admin-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.7",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.344.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^7.13.1",
    "tailwind-merge": "^3.5.0",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.1",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "tailwindcss": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.2.0"
  }
}
```

**Step 2: Create admin/web/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 3: Create admin/web/vite.config.ts**

```typescript
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5174,
      proxy: {
        "/api": env.VITE_API_URL || "http://localhost:3001",
      },
    },
  };
});
```

**Step 4: Create admin/web/vercel.json**

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

**Step 5: Create admin/web/index.html**

```html
<!doctype html>
<html lang="pt-BR" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#9566F2" />
    <title>SuperGerente Admin</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Mulish:wght@400;500;600&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: Create admin/web/src/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />
```

**Step 7: Create admin/web/src/main.tsx**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 8: Create admin/web/src/App.tsx**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { AdminPage } from "@/pages/AdminPage";
import { useAuthStore } from "@/stores/authStore";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <AuthRoute>
              <div className="flex min-h-screen items-center justify-center bg-primary-900 p-4">
                <LoginPage />
              </div>
            </AuthRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div className="min-h-screen bg-primary-900 p-6">
                <AdminPage />
              </div>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 9: Commit**

```bash
git add admin/web/package.json admin/web/tsconfig.json admin/web/vite.config.ts admin/web/vercel.json admin/web/index.html admin/web/src/
git commit -m "feat: create admin frontend scaffold"
```

---

### Task 5: Copy Frontend Assets to Admin

Copy UI components, admin components, stores, lib, types, and CSS from the main app to the admin frontend. These are direct copies — the admin app is standalone.

**Files to copy:**
- `web/src/index.css` → `admin/web/src/index.css` (remove markdown-content styles — admin doesn't have chat)
- `web/tailwind.config.ts` → `admin/web/tailwind.config.ts`
- `web/src/lib/utils.ts` → `admin/web/src/lib/utils.ts`
- `web/src/lib/constants.ts` → `admin/web/src/lib/constants.ts` (only TEAM_LABELS, STORAGE_KEYS, APP_NAME)
- `web/src/lib/api.ts` → `admin/web/src/lib/api.ts` (change baseURL to use VITE_API_URL env var)
- `web/src/stores/authStore.ts` → `admin/web/src/stores/authStore.ts`
- `web/src/types/index.ts` → `admin/web/src/types/index.ts` (only admin-relevant types)
- All 8 UI components: `web/src/components/ui/*.tsx` → `admin/web/src/components/ui/`
- `web/src/components/ui/index.ts` → `admin/web/src/components/ui/index.ts`
- All 6 admin components: `web/src/components/features/admin/*.tsx` → `admin/web/src/components/features/admin/`

**Step 1: Copy files using bash**

```bash
# CSS and Tailwind config
cp web/src/index.css admin/web/src/index.css
cp web/tailwind.config.ts admin/web/tailwind.config.ts

# Lib
cp web/src/lib/utils.ts admin/web/src/lib/utils.ts

# Stores
cp web/src/stores/authStore.ts admin/web/src/stores/authStore.ts

# Types
cp web/src/types/index.ts admin/web/src/types/index.ts

# UI components
cp web/src/components/ui/*.tsx admin/web/src/components/ui/
cp web/src/components/ui/index.ts admin/web/src/components/ui/index.ts

# Admin feature components
cp web/src/components/features/admin/*.tsx admin/web/src/components/features/admin/
```

**Step 2: Create admin/web/src/lib/constants.ts**

Simplified version — only what admin needs:

```typescript
export const APP_NAME = "SuperGerente Admin";
export const APP_SHORT_NAME = "SG";

export const TEAM_LABELS: Record<string, string> = {
  azul: "Equipe Azul",
  amarela: "Equipe Amarela",
};

export const STORAGE_KEYS = {
  token: "sg_admin_token",
  user: "sg_admin_user",
} as const;
```

Note: STORAGE_KEYS use different keys (`sg_admin_token`) to avoid collision with the main app.

**Step 3: Create admin/web/src/lib/api.ts**

```typescript
import axios from "axios";
import { STORAGE_KEYS } from "@/lib/constants";

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.user);
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
```

**Step 4: Create admin/web/src/pages/LoginPage.tsx**

Admin-only login (no register link):

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Button, Input, Card } from "@/components/ui";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/constants";
import type { User } from "@/types";

interface LoginResponse {
  token: string;
  user: User;
}

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
      });
      login(data.token, data.user);
      navigate("/");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Erro ao fazer login.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-8">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-card bg-gradient-to-br from-primary to-accent-blue font-heading text-heading-lg text-white">
          {APP_SHORT_NAME}
        </div>
        <h1 className="font-heading text-heading-lg">{APP_NAME}</h1>
        <p className="mt-1 text-body-md text-muted">
          Painel de administracao
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="admin@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <Input
          label="Senha"
          type="password"
          placeholder="Sua senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        {error && (
          <div className="rounded-button bg-danger/10 px-3 py-2 text-body-sm text-danger">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          Entrar
        </Button>
      </form>
    </Card>
  );
}
```

**Step 5: Copy admin/web/src/pages/AdminPage.tsx**

Copy the EXACT `web/src/pages/AdminPage.tsx` file. It works as-is because all imports use `@/` paths which resolve within the admin frontend.

```bash
cp web/src/pages/AdminPage.tsx admin/web/src/pages/AdminPage.tsx
```

Then remove the route guard (no need — the App.tsx already protects the route, and the backend enforces admin role):

Remove these lines from the copy:
```tsx
// Remove this import:
import { useNavigate } from 'react-router-dom';

// Remove this line:
const navigate = useNavigate();

// Remove this useEffect:
useEffect(() => {
  if (user?.role !== 'admin') {
    navigate('/', { replace: true });
  }
}, [user, navigate]);

// Remove this guard:
if (user?.role !== 'admin') return null;
```

**Step 6: Trim admin/web/src/index.css**

Remove the `.markdown-content` styles (admin has no chat):

```css
@import 'tailwindcss';
@config '../tailwind.config.ts';

@layer base {
  body {
    @apply font-body text-body-md bg-primary-900 text-[#E0E3E9] overflow-hidden;
  }
}

@layer base {
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(149, 102, 242, 0.3);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(149, 102, 242, 0.5);
  }
}
```

Also change `overflow-hidden` to `overflow-auto` on the body since admin has no AppShell managing scroll.

**Step 7: Commit**

```bash
git add admin/web/
git commit -m "feat: create admin frontend with UI components and pages"
```

---

### Task 6: Build Verification — Admin Backend

**Step 1: Install dependencies**

```bash
cd admin/api && npm install
```

**Step 2: Build**

```bash
npm run build
```

Expected: Compiles without errors to `admin/api/dist/`

**Step 3: Fix any type errors**

If there are TypeScript errors from `@sg/shared` imports, fix them. The most likely issue is that the shared package isn't being resolved. If so, ensure the workspace link works:

```bash
cd ../.. && npm install
```

**Step 4: Commit if fixes were needed**

```bash
git add -A && git commit -m "fix: resolve admin backend build errors"
```

---

### Task 7: Build Verification — Admin Frontend

**Step 1: Install dependencies**

```bash
cd admin/web && npm install
```

**Step 2: Build**

```bash
npm run build
```

Expected: Compiles without errors, outputs to `admin/web/dist/`

**Step 3: Fix any issues**

Common issues:
- Missing `@/` path alias (check tsconfig paths)
- Missing type imports (check `admin/web/src/types/index.ts` has all types used by admin components)
- CSS classes not found (check tailwind.config.ts content paths)

**Step 4: Commit if fixes were needed**

```bash
git add -A && git commit -m "fix: resolve admin frontend build errors"
```

---

### Task 8: Clean Up Main App — Backend

**Files:**
- Delete: `src/api/routes/admin.ts`
- Delete: `src/api/routes/oauth.ts`
- Modify: `src/api/server.ts` — remove admin and oauth route imports/mounts
- Modify: `src/api/middleware/requireAuth.ts` — remove `requireAdmin` export (keep `requireAuth`)

**Step 1: Remove admin and oauth routes from server.ts**

In `src/api/server.ts`:
- Remove line: `import { adminRouter } from "./routes/admin.js";`
- Remove line: `import { oauthRouter } from "./routes/oauth.js";`
- Remove line: `app.use("/api/admin", adminRouter(services));`
- Remove line: `app.use("/api/oauth", oauthRouter(services));`

**Step 2: Remove requireAdmin from middleware**

In `src/api/middleware/requireAuth.ts`:
- Remove the `requireAdmin` function (lines 92-104)
- Keep the `requireAuth` function and `AuthRequest` interface

**Step 3: Delete admin route files**

```bash
rm src/api/routes/admin.ts
rm src/api/routes/oauth.ts
```

**Step 4: Build the main backend to verify**

```bash
npm run build
```

Expected: Compiles without errors. No references to deleted files remain.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove admin and oauth routes from main app backend"
```

---

### Task 9: Clean Up Main App — Frontend

**Files:**
- Delete: `web/src/pages/AdminPage.tsx`
- Delete: `web/src/components/features/admin/` (entire folder)
- Modify: `web/src/App.tsx` — remove admin route
- Modify: `web/src/components/layout/Sidebar.tsx` — remove admin link

**Step 1: Remove admin route from App.tsx**

In `web/src/App.tsx`:
- Remove line: `import { AdminPage } from '@/pages/AdminPage';`
- Remove line: `<Route path="/admin" element={<AdminPage />} />`

**Step 2: Remove admin link from Sidebar.tsx**

In `web/src/components/layout/Sidebar.tsx`:
- Remove the `Settings` icon import from lucide-react
- Remove the entire admin NavLink block (lines 160-177):

```tsx
// DELETE THIS ENTIRE BLOCK:
{user?.role === 'admin' && (
  <NavLink
    to="/admin"
    ...
  >
    <Settings className="h-5 w-5 shrink-0" />
    {!collapsed && 'Admin'}
  </NavLink>
)}
```

**Step 3: Delete admin page and components**

```bash
rm web/src/pages/AdminPage.tsx
rm -rf web/src/components/features/admin/
```

**Step 4: Clean up unused types from web/src/types/index.ts**

Remove types that are only used by admin:
- `AdminUser` interface
- `MentorFormData` interface
- `TokenUsage` interface
- `TokenStatus` interface

Keep: `User`, `Pipeline`, `Message`, `Mentor` (if used by chat), `SummaryPipeline`, `AgentReport`, `AlertTeamData`, `AlertItem`, `BrandTabData`, `ChatResponse`, `Team`, `AlertFilter`, `AlertEquipeFilter`

Check if `Mentor` is used by the chat feature — if yes, keep it. If only admin uses it, remove it too.

**Step 5: Build the main frontend**

```bash
cd web && npm run build
```

Expected: Compiles without errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove admin panel from main app frontend"
```

---

### Task 10: Full Build Verification

**Step 1: Build everything from root**

```bash
# Main app
npm run build:all

# Admin backend
cd admin/api && npm run build

# Admin frontend
cd ../web && npm run build
```

All three must compile without errors.

**Step 2: If any build fails, fix and commit**

```bash
git add -A && git commit -m "fix: resolve final build errors"
```

**Step 3: Update root build:all script (optional)**

In root `package.json`, update `build:all` to also build admin:

```json
"build:all": "npm install --prefix web && npm run build --prefix web && npm run build && npm install --prefix admin/api && npm run build --prefix admin/api && npm install --prefix admin/web && npm run build --prefix admin/web"
```

**Step 4: Commit**

```bash
git add package.json
git commit -m "chore: update build:all to include admin microservice"
```
