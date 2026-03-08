# Multi-Tenant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform SuperGerente from a single-tenant app into a multi-tenant SaaS with tenant isolation via RLS, a super-admin panel, and zero-downtime migration.

**Architecture:** Single Supabase database with `tenant_id` on all tenant-scoped tables. RLS policies enforce isolation. Super-admin bypasses RLS via role check. CRM cache and Kommo service become tenant-aware. Frontend gets tenant context in auth store and X-Tenant-Id header for super-admin switching.

**Tech Stack:** Express 5 + TypeScript + Supabase (PostgreSQL + RLS) + React 18 + Zustand + Tailwind CSS v4

---

## Task 1: Database Migration — Tenants Table + Alter Existing Tables

**Files:**
- Create: `docs/migrations/009-multi-tenant.sql`

**Step 1: Write the migration SQL**

```sql
-- 009-multi-tenant.sql
-- Multi-tenant: creates tenants table, adds tenant_id to existing tables,
-- creates default tenant from current data, sets up RLS policies.

-- 1. Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#9566F2',
  kommo_base_url TEXT,
  kommo_access_token TEXT,
  kommo_refresh_token TEXT,
  kommo_token_expires_at TIMESTAMPTZ,
  webhook_secret TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add tenant_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 3. Add superadmin role support (profiles.role already exists as text)
-- Current values: 'admin', 'user'. We add 'superadmin' as valid value.

-- 4. Add tenant_id to audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 5. Add tenant_id to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 6. Add tenant_id to push_subscriptions
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 7. Add tenant_id to settings (make settings tenant-scoped)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 8. Add tenant_id to token_logs
ALTER TABLE token_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 9. Add tenant_id to user_funnel_permissions
ALTER TABLE user_funnel_permissions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 10. Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant ON push_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_tenant ON settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_token_logs_tenant ON token_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_funnel_permissions_tenant ON user_funnel_permissions(tenant_id);

-- 11. Make settings key unique per tenant (not globally)
-- Drop old unique constraint on key if exists, add composite unique
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;
ALTER TABLE settings ADD CONSTRAINT settings_tenant_key_unique UNIQUE (tenant_id, key);

-- 12. Enable RLS on all tenant-scoped tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_funnel_permissions ENABLE ROW LEVEL SECURITY;

-- NOTE: RLS policies are NOT created here because our backend uses
-- supabase service key (bypasses RLS). Tenant isolation is enforced
-- in application middleware. RLS is enabled as defense-in-depth
-- but the service key bypasses it by design.
```

**Step 2: Commit**

```bash
git add docs/migrations/009-multi-tenant.sql
git commit -m "feat: add multi-tenant migration (009)"
```

---

## Task 2: Tenant Types + Config Refactor

**Files:**
- Modify: `src/types/index.ts` — add Tenant interface
- Modify: `src/config.ts` — make team config dynamic (from tenant)

**Step 1: Add Tenant type to `src/types/index.ts`**

Add at the end of the file:

```typescript
// Multi-tenant types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  kommoBaseUrl: string | null;
  kommoAccessToken: string | null;
  kommoRefreshToken: string | null;
  kommoTokenExpiresAt: string | null;
  webhookSecret: string | null;
  settings: TenantSettings;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  teams?: Record<string, TenantTeamConfig>;
  hotLeadStatuses?: number[];
  [key: string]: unknown;
}

export interface TenantTeamConfig {
  label: string;
  subdomain: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  excludePipelineNames?: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'superadmin';
  tenantId: string;
  tenant: Tenant;
  teams: string[];
}
```

**Step 2: Refactor `src/config.ts`**

Keep the existing config for backward compatibility during migration, but add a function to build team config from tenant:

Add at the end of the file:

```typescript
import type { Tenant, TenantTeamConfig } from './types/index.js';

export function getTeamConfigsFromTenant(tenant: Tenant): Record<string, TeamConfig> {
  const teamsSettings = tenant.settings?.teams;
  if (!teamsSettings) return {};

  const result: Record<string, TeamConfig> = {};
  for (const [key, teamCfg] of Object.entries(teamsSettings)) {
    result[key] = {
      label: teamCfg.label,
      subdomain: teamCfg.subdomain,
      clientId: teamCfg.clientId,
      clientSecret: teamCfg.clientSecret,
      redirectUri: teamCfg.redirectUri,
      accessToken: '', // managed via tenant table columns or per-team in settings
      excludePipelineNames: teamCfg.excludePipelineNames || [],
    };
  }
  return result;
}
```

**Step 3: Commit**

```bash
git add src/types/index.ts src/config.ts
git commit -m "feat: add Tenant types and config helper"
```

---

## Task 3: Tenant Service — CRUD + Lookup

**Files:**
- Create: `src/api/services/tenant.ts`

**Step 1: Create tenant service**

```typescript
// src/api/services/tenant.ts
import { supabase } from '../supabase.js';
import type { Tenant } from '../../types/index.js';

function mapRow(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    logoUrl: (row.logo_url as string) || null,
    primaryColor: (row.primary_color as string) || '#9566F2',
    kommoBaseUrl: (row.kommo_base_url as string) || null,
    kommoAccessToken: (row.kommo_access_token as string) || null,
    kommoRefreshToken: (row.kommo_refresh_token as string) || null,
    kommoTokenExpiresAt: (row.kommo_token_expires_at as string) || null,
    webhookSecret: (row.webhook_secret as string) || null,
    settings: (row.settings as Tenant['settings']) || {},
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Cache tenants in memory (refreshed every 5 min)
let tenantsCache: Map<string, Tenant> = new Map();
let tenantsBySlug: Map<string, Tenant> = new Map();
let tenantsByWebhookSecret: Map<string, Tenant> = new Map();
let cacheLoadedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function loadTenants(): Promise<void> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('[TenantService] Erro ao carregar tenants:', error.message);
    return;
  }

  tenantsCache = new Map();
  tenantsBySlug = new Map();
  tenantsByWebhookSecret = new Map();

  for (const row of data || []) {
    const tenant = mapRow(row);
    tenantsCache.set(tenant.id, tenant);
    tenantsBySlug.set(tenant.slug, tenant);
    if (tenant.webhookSecret) {
      tenantsByWebhookSecret.set(tenant.webhookSecret, tenant);
    }
  }

  cacheLoadedAt = Date.now();
  console.log(`[TenantService] ${tenantsCache.size} tenants carregados`);
}

async function ensureCache(): Promise<void> {
  if (Date.now() - cacheLoadedAt > CACHE_TTL || tenantsCache.size === 0) {
    await loadTenants();
  }
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  await ensureCache();
  return tenantsCache.get(id) || null;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  await ensureCache();
  return tenantsBySlug.get(slug) || null;
}

export async function getTenantByWebhookSecret(secret: string): Promise<Tenant | null> {
  await ensureCache();
  return tenantsByWebhookSecret.get(secret) || null;
}

export async function getAllTenants(): Promise<Tenant[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

export async function createTenant(input: {
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
  kommoBaseUrl?: string;
  kommoAccessToken?: string;
  kommoRefreshToken?: string;
  kommoTokenExpiresAt?: string;
  webhookSecret?: string;
  settings?: Record<string, unknown>;
}): Promise<Tenant> {
  const { data, error } = await supabase
    .from('tenants')
    .insert({
      name: input.name,
      slug: input.slug,
      logo_url: input.logoUrl || null,
      primary_color: input.primaryColor || '#9566F2',
      kommo_base_url: input.kommoBaseUrl || null,
      kommo_access_token: input.kommoAccessToken || null,
      kommo_refresh_token: input.kommoRefreshToken || null,
      kommo_token_expires_at: input.kommoTokenExpiresAt || null,
      webhook_secret: input.webhookSecret || null,
      settings: input.settings || {},
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Invalidate cache
  cacheLoadedAt = 0;

  return mapRow(data);
}

export async function updateTenant(
  id: string,
  updates: Partial<{
    name: string;
    slug: string;
    logoUrl: string;
    primaryColor: string;
    kommoBaseUrl: string;
    kommoAccessToken: string;
    kommoRefreshToken: string;
    kommoTokenExpiresAt: string;
    webhookSecret: string;
    settings: Record<string, unknown>;
    isActive: boolean;
  }>
): Promise<Tenant> {
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
  if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl;
  if (updates.primaryColor !== undefined) dbUpdates.primary_color = updates.primaryColor;
  if (updates.kommoBaseUrl !== undefined) dbUpdates.kommo_base_url = updates.kommoBaseUrl;
  if (updates.kommoAccessToken !== undefined) dbUpdates.kommo_access_token = updates.kommoAccessToken;
  if (updates.kommoRefreshToken !== undefined) dbUpdates.kommo_refresh_token = updates.kommoRefreshToken;
  if (updates.kommoTokenExpiresAt !== undefined) dbUpdates.kommo_token_expires_at = updates.kommoTokenExpiresAt;
  if (updates.webhookSecret !== undefined) dbUpdates.webhook_secret = updates.webhookSecret;
  if (updates.settings !== undefined) dbUpdates.settings = updates.settings;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

  const { data, error } = await supabase
    .from('tenants')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Invalidate cache
  cacheLoadedAt = 0;

  return mapRow(data);
}

export function invalidateTenantCache(): void {
  cacheLoadedAt = 0;
}
```

**Step 2: Commit**

```bash
git add src/api/services/tenant.ts
git commit -m "feat: add tenant service with CRUD and caching"
```

---

## Task 4: Auth Middleware — Inject Tenant Context

**Files:**
- Modify: `src/api/middleware/requireAuth.ts` — add tenantId + tenant object injection
- Create: `src/api/middleware/requireSuperAdmin.ts` — guard for /super routes

**Step 1: Modify requireAuth.ts**

Key changes:
1. Fetch `tenant_id` from profiles table (already fetched)
2. Look up tenant from tenant service
3. Add `tenantId` and `tenant` to the AuthRequest
4. Support `X-Tenant-Id` header for superadmin context switching

At the top of `requireAuth.ts`, add import:
```typescript
import { getTenantById } from '../services/tenant.js';
import type { Tenant } from '../../types/index.js';
```

Modify the `AuthRequest` interface to add:
```typescript
  tenantId?: string;
  tenant?: Tenant;
```

In the `requireAuth` function, after fetching the profile, add tenant lookup:
```typescript
// After: const profile = profileData;
const tenantId = profile.tenant_id;
if (!tenantId) {
  res.status(403).json({ error: 'Usuário sem tenant associado' });
  return;
}

const tenant = await getTenantById(tenantId);
if (!tenant || !tenant.isActive) {
  res.status(403).json({ error: 'Tenant inativo ou não encontrado' });
  return;
}

// Superadmin tenant switching via header
let activeTenantId = tenantId;
let activeTenant = tenant;
if (profile.role === 'superadmin') {
  const headerTenantId = req.headers['x-tenant-id'] as string;
  if (headerTenantId && headerTenantId !== tenantId) {
    const switchedTenant = await getTenantById(headerTenantId);
    if (switchedTenant) {
      activeTenantId = headerTenantId;
      activeTenant = switchedTenant;
    }
  }
}
```

Set on req object:
```typescript
req.tenantId = activeTenantId;
req.tenant = activeTenant;
```

Update the cached result to include `tenantId` and `tenant`.

**Step 2: Create requireSuperAdmin.ts**

```typescript
// src/api/middleware/requireSuperAdmin.ts
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './requireAuth.js';

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== 'superadmin') {
    res.status(403).json({ error: 'Acesso restrito ao super-admin' });
    return;
  }
  next();
}
```

**Step 3: Commit**

```bash
git add src/api/middleware/requireAuth.ts src/api/middleware/requireSuperAdmin.ts
git commit -m "feat: inject tenant context in auth middleware + superadmin guard"
```

---

## Task 5: Audit Log Middleware — Add tenant_id

**Files:**
- Modify: `src/api/middleware/auditLog.ts`

**Step 1: Add tenant_id to audit log insert**

In the `auditLog` middleware, where it inserts into `audit_logs`, add `tenant_id`:

```typescript
// Change the insert from:
// { user_id, action, resource, method, details, ip }
// To:
{ user_id: authReq.userId, tenant_id: authReq.tenantId, action, resource: req.path, method: req.method, details, ip }
```

**Step 2: Commit**

```bash
git add src/api/middleware/auditLog.ts
git commit -m "feat: add tenant_id to audit log entries"
```

---

## Task 6: CRM Cache — Key by Tenant ID

**Files:**
- Modify: `src/api/cache/crm-cache.ts` — change cache key from team to `tenantId:team`

**Step 1: Modify cache key structure**

Currently the cache uses `team` as the key. Change to `${tenantId}:${team}`:

1. Change `metricsCache` Map key from `string` (team) to `string` (`tenantId:team`)
2. Update `getCrmMetrics(team)` signature to `getCrmMetrics(tenantId: string, team: string, tenantTeamConfig?: TeamConfig)`
3. Update `registerTeamForRefresh` to include tenantId
4. When fetching metrics, use tenant's Kommo config instead of global config
5. The `KommoService` instance should be created from tenant config, not from global `TEAMS`

Key change — `getCrmMetrics` function:

```typescript
export async function getCrmMetrics(
  tenantId: string,
  team: string,
  kommoService: KommoService
): Promise<CrmMetrics> {
  const cacheKey = `${tenantId}:${team}`;
  // ... rest uses cacheKey instead of team
}
```

**Step 2: Commit**

```bash
git add src/api/cache/crm-cache.ts
git commit -m "feat: key CRM cache by tenantId:team"
```

---

## Task 7: Kommo Service — Accept Tenant Config

**Files:**
- Modify: `src/services/kommo.ts` — token storage/refresh uses tenant table instead of env vars
- Modify: `src/services/token-store.ts` — update to use tenant table for token persistence

**Step 1: Modify KommoService constructor**

Currently `KommoService` takes a `KommoConfig` from env vars. Change to also accept `tenantId` so token refresh updates the tenant table:

Add `tenantId` parameter:
```typescript
constructor(config: KommoConfig, teamKey: string, tenantId?: string) {
  // ... existing code
  this.tenantId = tenantId;
}
```

**Step 2: Modify token persistence**

In `refreshAccessToken()` and `loadStoredToken()`, if `tenantId` is set, read/write from `tenants` table instead of `kommo_tokens` table:

```typescript
// In refreshAccessToken, after getting new tokens:
if (this.tenantId) {
  await supabase.from('tenants').update({
    kommo_access_token: newAccessToken,
    kommo_refresh_token: newRefreshToken,
    kommo_token_expires_at: expiresAt,
  }).eq('id', this.tenantId);
}
```

**Step 3: Commit**

```bash
git add src/services/kommo.ts src/services/token-store.ts
git commit -m "feat: KommoService supports tenant-scoped token management"
```

---

## Task 8: Backend Routes — Use Tenant Context

**Files:**
- Modify: `src/api/routes/reports.ts` — use `req.tenant` for Kommo credentials
- Modify: `src/api/routes/admin.ts` — filter by `req.tenantId`
- Modify: `src/api/routes/webhooks.ts` — lookup tenant by webhook secret
- Modify: `src/api/routes/notifications.ts` — filter by `req.tenantId`
- Modify: `src/api/routes/chat.ts` — use tenant context for CRM data

**Step 1: Modify reports.ts**

All report queries that fetch CRM metrics should use `getCrmMetrics(req.tenantId, team, kommoService)` where `kommoService` is built from `req.tenant`'s Kommo config.

Add helper at top of file:
```typescript
import { getTeamConfigsFromTenant } from '../../config.js';

function getKommoServiceForTenant(tenant: Tenant, team: string): KommoService | null {
  const teamConfigs = getTeamConfigsFromTenant(tenant);
  const cfg = teamConfigs[team];
  if (!cfg) return null;
  return new KommoService(cfg, team, tenant.id);
}
```

In each route handler, replace:
```typescript
// Old: const metrics = await getCrmMetrics(team);
// New:
const kommoService = getKommoServiceForTenant(req.tenant!, team);
if (!kommoService) { res.status(400).json({ error: 'Equipe não configurada' }); return; }
const metrics = await getCrmMetrics(req.tenantId!, team, kommoService);
```

**Step 2: Modify admin.ts**

Add `tenant_id` filter to all Supabase queries:
```typescript
// Old: .from('audit_logs').select('*')
// New: .from('audit_logs').select('*').eq('tenant_id', req.tenantId)

// Old: .from('settings').select('*').eq('key', 'paused_pipelines')
// New: .from('settings').select('*').eq('key', 'paused_pipelines').eq('tenant_id', req.tenantId)
```

**Step 3: Modify webhooks.ts**

Replace secret validation with tenant lookup:
```typescript
// Old:
const secret = req.headers['x-webhook-secret'];
if (secret !== process.env.KOMMO_WEBHOOK_SECRET) { ... }

// New:
import { getTenantByWebhookSecret } from '../services/tenant.js';

const secret = req.headers['x-webhook-secret'] as string;
if (!secret) { res.status(401).json({ error: 'Missing webhook secret' }); return; }

const tenant = await getTenantByWebhookSecret(secret);
if (!tenant) { res.status(401).json({ error: 'Invalid webhook secret' }); return; }

// Use tenant.id for all subsequent queries
const tenantId = tenant.id;
```

**Step 4: Modify notifications.ts**

Add `tenant_id` filter to all queries:
```typescript
// All .from('notifications') queries add: .eq('tenant_id', req.tenantId)
// All .from('push_subscriptions') queries add: .eq('tenant_id', req.tenantId)
// All inserts add: tenant_id: req.tenantId
```

**Step 5: Modify chat.ts**

Use `req.tenantId` when fetching CRM metrics:
```typescript
// Old: const metrics = await getCrmMetrics(team);
// New: const metrics = await getCrmMetrics(req.tenantId!, team, kommoService);
```

**Step 6: Commit**

```bash
git add src/api/routes/reports.ts src/api/routes/admin.ts src/api/routes/webhooks.ts src/api/routes/notifications.ts src/api/routes/chat.ts
git commit -m "feat: all routes use tenant context for data isolation"
```

---

## Task 9: Super-Admin API Routes

**Files:**
- Create: `src/api/routes/super.ts`
- Modify: `src/api/server.ts` — register /api/super routes

**Step 1: Create super.ts**

```typescript
// src/api/routes/super.ts
import { Router } from 'express';
import type { AuthRequest } from '../middleware/requireAuth.js';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js';
import { getAllTenants, createTenant, updateTenant, getTenantById } from '../services/tenant.js';
import { supabase } from '../supabase.js';
import crypto from 'crypto';

const router = Router();

// All routes require superadmin
router.use(requireSuperAdmin as any);

// GET /api/super/tenants — List all tenants with user count
router.get('/tenants', async (req: AuthRequest, res) => {
  try {
    const tenants = await getAllTenants();

    // Get user counts per tenant
    const { data: counts } = await supabase
      .from('profiles')
      .select('tenant_id');

    const userCounts: Record<string, number> = {};
    for (const row of counts || []) {
      const tid = row.tenant_id as string;
      userCounts[tid] = (userCounts[tid] || 0) + 1;
    }

    const result = tenants.map(t => ({
      ...t,
      userCount: userCounts[t.id] || 0,
    }));

    res.json({ tenants: result });
  } catch (err: any) {
    console.error('[Super] Erro ao listar tenants:', err.message);
    res.status(500).json({ error: 'Erro ao listar tenants' });
  }
});

// GET /api/super/tenants/:id — Get single tenant details
router.get('/tenants/:id', async (req: AuthRequest, res) => {
  try {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) { res.status(404).json({ error: 'Tenant não encontrado' }); return; }
    res.json({ tenant });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar tenant' });
  }
});

// POST /api/super/tenants — Create new tenant
router.post('/tenants', async (req: AuthRequest, res) => {
  try {
    const { name, slug, kommoBaseUrl, kommoAccessToken, kommoRefreshToken, settings } = req.body;

    if (!name || !slug) {
      res.status(400).json({ error: 'Nome e slug são obrigatórios' });
      return;
    }

    const tenant = await createTenant({
      name,
      slug,
      kommoBaseUrl,
      kommoAccessToken,
      kommoRefreshToken,
      webhookSecret: crypto.randomBytes(32).toString('hex'),
      settings: settings || {},
    });

    res.status(201).json({ tenant });
  } catch (err: any) {
    if (err.message?.includes('duplicate')) {
      res.status(409).json({ error: 'Slug já existe' });
      return;
    }
    console.error('[Super] Erro ao criar tenant:', err.message);
    res.status(500).json({ error: 'Erro ao criar tenant' });
  }
});

// PATCH /api/super/tenants/:id — Update tenant
router.patch('/tenants/:id', async (req: AuthRequest, res) => {
  try {
    const tenant = await updateTenant(req.params.id, req.body);
    res.json({ tenant });
  } catch (err: any) {
    console.error('[Super] Erro ao atualizar tenant:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar tenant' });
  }
});

// GET /api/super/stats — Global stats
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const tenants = await getAllTenants();
    const active = tenants.filter(t => t.isActive).length;

    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    res.json({
      totalTenants: tenants.length,
      activeTenants: active,
      totalUsers: userCount || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

export { router as superRouter };
```

**Step 2: Register in server.ts**

Add import and route:
```typescript
import { superRouter } from './routes/super.js';

// After admin routes:
app.use('/api/super', requireAuth, superRouter);
```

**Step 3: Commit**

```bash
git add src/api/routes/super.ts src/api/server.ts
git commit -m "feat: add super-admin API routes (CRUD tenants + stats)"
```

---

## Task 10: Startup Flow — Load Tenants + Multi-Tenant Cache

**Files:**
- Modify: `src/api/index.ts` — load tenants on startup, init CRM cache per tenant

**Step 1: Modify index.ts startup**

Replace the hardcoded 2-team initialization with tenant-based initialization:

```typescript
import { loadTenants, getAllTenants } from './services/tenant.js';

// In startServer():
// 1. Load tenants first
await loadTenants();
const tenants = await getAllTenants();

// 2. For each active tenant, initialize KommoService instances + cache warmup
for (const tenant of tenants.filter(t => t.isActive)) {
  const teamConfigs = getTeamConfigsFromTenant(tenant);
  for (const [teamKey, teamCfg] of Object.entries(teamConfigs)) {
    const kommoService = new KommoService(teamCfg, teamKey, tenant.id);
    await kommoService.loadStoredToken();
    // Register for proactive refresh + cache warmup
    registerTeamForRefresh(tenant.id, teamKey, kommoService);
  }
}
```

Keep backward compatibility: if no tenants exist in DB, fall back to env vars (for initial migration).

**Step 2: Commit**

```bash
git add src/api/index.ts
git commit -m "feat: startup initializes KommoService per tenant"
```

---

## Task 11: Frontend — Auth Store + Types

**Files:**
- Modify: `web/src/types/index.ts` — add Tenant type
- Modify: `web/src/stores/authStore.ts` — add tenant, activeTenantId
- Modify: `web/src/lib/api.ts` — add X-Tenant-Id header interceptor

**Step 1: Add Tenant type to frontend types**

Add to `web/src/types/index.ts`:
```typescript
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  isActive: boolean;
}
```

Update User interface:
```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'superadmin';
  teams?: string[];
  phone?: string;
  tenantId?: string;
  tenant?: Tenant;
}
```

**Step 2: Update authStore.ts**

Add `activeTenantId` for superadmin switching:
```typescript
interface AuthState {
  token: string | null;
  user: User | null;
  activeTenantId: string | null; // superadmin can switch tenants
  isAuthenticated: boolean;
  login(token: string, user: User): void;
  logout(): void;
  setActiveTenantId(tenantId: string | null): void;
}
```

In the store:
```typescript
activeTenantId: localStorage.getItem('sg_active_tenant') || null,

setActiveTenantId: (tenantId) => {
  if (tenantId) {
    localStorage.setItem('sg_active_tenant', tenantId);
  } else {
    localStorage.removeItem('sg_active_tenant');
  }
  set({ activeTenantId: tenantId });
},
```

**Step 3: Update api.ts interceptor**

Add X-Tenant-Id header for superadmin:
```typescript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sg_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const activeTenantId = localStorage.getItem('sg_active_tenant');
  if (activeTenantId) config.headers['X-Tenant-Id'] = activeTenantId;

  return config;
});
```

**Step 4: Commit**

```bash
git add web/src/types/index.ts web/src/stores/authStore.ts web/src/lib/api.ts
git commit -m "feat: frontend auth store + API client support multi-tenant"
```

---

## Task 12: Frontend — Tenant Switcher Component

**Files:**
- Create: `web/src/components/features/super/TenantSwitcher.tsx`

**Step 1: Create TenantSwitcher**

```typescript
// web/src/components/features/super/TenantSwitcher.tsx
import { useEffect, useState, useRef } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import type { Tenant } from '@/types';

export function TenantSwitcher() {
  const user = useAuthStore((s) => s.user);
  const activeTenantId = useAuthStore((s) => s.activeTenantId);
  const setActiveTenantId = useAuthStore((s) => s.setActiveTenantId);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isSuperAdmin = user?.role === 'superadmin';
  if (!isSuperAdmin) return null;

  const currentTenantId = activeTenantId || user?.tenantId;
  const currentTenant = tenants.find((t) => t.id === currentTenantId);

  useEffect(() => {
    api.get<{ tenants: Tenant[] }>('/super/tenants').then((res) => {
      setTenants(res.data.tenants);
    });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-button border border-glass-border bg-surface-secondary px-3 py-1.5 text-body-sm text-foreground hover:bg-surface-secondary/80 transition-colors cursor-pointer"
      >
        <Building2 className="h-4 w-4 text-primary" />
        <span className="max-w-[120px] truncate">{currentTenant?.name || 'Selecionar'}</span>
        <ChevronDown className={cn('h-3 w-3 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-card border border-glass-border bg-surface p-1 shadow-lg">
          <div className="px-2 py-1.5 text-body-xs text-muted font-medium uppercase tracking-wider">
            Trocar Tenant
          </div>
          {tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTenantId(t.id === user?.tenantId ? null : t.id);
                setOpen(false);
                window.location.reload();
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-button px-2 py-1.5 text-body-sm transition-colors cursor-pointer',
                t.id === currentTenantId
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-surface-secondary'
              )}
            >
              <div
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: t.primaryColor || '#9566F2' }}
              />
              <span className="truncate flex-1 text-left">{t.name}</span>
              {t.id === currentTenantId && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/components/features/super/TenantSwitcher.tsx
git commit -m "feat: add TenantSwitcher component for superadmin"
```

---

## Task 13: Frontend — TopBar Integration

**Files:**
- Modify: `web/src/components/layout/TopBar.tsx` — add TenantSwitcher + tenant name

**Step 1: Update TopBar**

Add import:
```typescript
import { TenantSwitcher } from '../features/super/TenantSwitcher';
```

Add TenantSwitcher before NotificationBell in the right side:
```typescript
<div className="flex items-center gap-3">
  <TenantSwitcher />
  <NotificationBell />
  {/* existing avatar */}
</div>
```

**Step 2: Commit**

```bash
git add web/src/components/layout/TopBar.tsx
git commit -m "feat: add TenantSwitcher to TopBar"
```

---

## Task 14: Frontend — Super Admin Page

**Files:**
- Create: `web/src/pages/SuperAdminPage.tsx`
- Create: `web/src/components/features/super/TenantTable.tsx`
- Create: `web/src/components/features/super/TenantForm.tsx`

**Step 1: Create TenantTable.tsx**

Table showing all tenants with: name, slug, status (active/inactive badge), user count, actions (edit, toggle active).

Component pattern: follow existing `AuditLogTable.tsx` pattern — paginated table with Supabase data, uses `Card`, `Badge`, `Button` from `@/components/ui`.

**Step 2: Create TenantForm.tsx**

Modal/form for creating or editing a tenant:
- Fields: name, slug, primaryColor, kommoBaseUrl, kommoAccessToken, kommoRefreshToken
- Settings JSON editor for teams config
- Submit calls `POST /api/super/tenants` or `PATCH /api/super/tenants/:id`

Follow existing form patterns (Input, Button components from ui/).

**Step 3: Create SuperAdminPage.tsx**

```typescript
// web/src/pages/SuperAdminPage.tsx
import { useState, useEffect } from 'react';
import { Building2, Users, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui';
import { TenantTable } from '@/components/features/super/TenantTable';
import { TenantForm } from '@/components/features/super/TenantForm';

export function SuperAdminPage() {
  const [stats, setStats] = useState({ totalTenants: 0, activeTenants: 0, totalUsers: 0 });
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);

  useEffect(() => {
    api.get('/super/stats').then(res => setStats(res.data));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-heading-md">Super Admin</h1>
        <p className="mt-1 text-body-md text-muted">Gestão de tenants e clientes</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-button bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-heading-md font-heading font-bold">{stats.totalTenants}</p>
              <p className="text-body-sm text-muted">Total Tenants</p>
            </div>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-button bg-success/10">
              <Activity className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-heading-md font-heading font-bold text-success">{stats.activeTenants}</p>
              <p className="text-body-sm text-muted">Ativos</p>
            </div>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-button bg-accent-blue/10">
              <Users className="h-5 w-5 text-accent-blue" />
            </div>
            <div>
              <p className="text-heading-md font-heading font-bold">{stats.totalUsers}</p>
              <p className="text-body-sm text-muted">Usuários</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tenant Table */}
      <TenantTable
        onEdit={(tenant) => { setEditingTenant(tenant); setShowForm(true); }}
        onNew={() => { setEditingTenant(null); setShowForm(true); }}
      />

      {/* Tenant Form Modal */}
      {showForm && (
        <TenantForm
          tenant={editingTenant}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); window.location.reload(); }}
        />
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add web/src/pages/SuperAdminPage.tsx web/src/components/features/super/TenantTable.tsx web/src/components/features/super/TenantForm.tsx
git commit -m "feat: add SuperAdminPage with tenant management"
```

---

## Task 15: Frontend — Routing + Sidebar

**Files:**
- Modify: `web/src/App.tsx` — add /super route
- Modify: `web/src/components/layout/Sidebar.tsx` — add "Super Admin" link (superadmin only)

**Step 1: Add route in App.tsx**

```typescript
import { SuperAdminPage } from './pages/SuperAdminPage';

// Inside AppShell routes, add:
<Route path="/super" element={<SuperAdminPage />} />
```

**Step 2: Add sidebar link**

In Sidebar.tsx, add conditional nav item:
```typescript
// After existing NAV_ITEMS, add conditional rendering:
{user?.role === 'superadmin' && (
  <NavLink to="/super" icon={Building2} label="Super Admin" />
)}
```

Import `Building2` from lucide-react.

**Step 3: Commit**

```bash
git add web/src/App.tsx web/src/components/layout/Sidebar.tsx
git commit -m "feat: add /super route and sidebar link for superadmin"
```

---

## Task 16: Auth Routes — Return Tenant in Login Response

**Files:**
- Modify: `src/api/routes/auth.ts` — include tenant info in login response

**Step 1: Modify login endpoint**

After fetching profile, also fetch tenant:
```typescript
import { getTenantById } from '../services/tenant.js';

// In POST /login handler, after profile fetch:
const tenant = profile.tenant_id ? await getTenantById(profile.tenant_id) : null;

// Return tenant info (without sensitive fields):
res.json({
  token: session.access_token,
  user: {
    id: user.id,
    email: user.email,
    name: profile.name,
    role: profile.role,
    teams: profile.teams,
    tenantId: profile.tenant_id,
    tenant: tenant ? {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      isActive: tenant.isActive,
    } : null,
  },
});
```

**Step 2: Commit**

```bash
git add src/api/routes/auth.ts
git commit -m "feat: return tenant info in login response"
```

---

## Task 17: Build + Verify

**Step 1: Run TypeScript build (backend + frontend)**

```bash
cd /Users/guicrasto/supergerente && npm run build
```

Expected: Build passes with zero errors.

**Step 2: Fix any type errors**

If build fails, fix type mismatches. Common issues:
- `AuthRequest` missing new properties → update interface
- `getCrmMetrics` signature changes → update all callers
- Import paths → ensure `.js` extension for ESM

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve type errors from multi-tenant refactor"
```

---

## Task 18: Update Documentation

**Files:**
- Modify: `docs/changelog.md` — add multi-tenant entry
- Modify: `docs/CEO.md` — update status
- Modify: `docs/APIs.md` — add /super endpoints
- Modify: `TODO.md` — add multi-tenant as completed
- Modify: `.env.example` — document any new env vars

**Step 1: Update all docs**

changelog.md — add:
```markdown
## [2026-03-08] — Multi-Tenant Architecture

### Adicionado
- **Multi-Tenant**: Tabela `tenants` com isolamento por `tenant_id`. RLS habilitado em todas as tabelas.
- **Super Admin**: Painel `/super` para gestão de tenants (CRUD), métricas globais.
- **Tenant Switcher**: Dropdown no TopBar para super-admin trocar de contexto.
- **Tenant Service**: Cache de tenants, lookup por ID/slug/webhook-secret.
- **Migration**: `009-multi-tenant.sql` — criação de tabela + alterações + indexes.

### Modificado
- `requireAuth` — injeta `tenantId` e `tenant` em toda request autenticada.
- CRM Cache — keyed por `tenantId:team` em vez de apenas `team`.
- KommoService — suporta token management per-tenant.
- Todas as rotas filtram por `tenant_id`.
- Frontend auth store + API client suportam multi-tenant.
```

**Step 2: Commit docs**

```bash
git add docs/ TODO.md .env.example
git commit -m "docs: update changelog, CEO, APIs for multi-tenant"
```

---

## Task 19: Sync to Google Drive

**Step 1: Sync docs**

```bash
~/.local/bin/rclone sync ./docs/ "gdrive:Super-CLAUDE/supergerente/docs/" -v
```

**Step 2: Done**

All tasks complete. The multi-tenant architecture is implemented.

---

## Summary of All Files

### Created (7 files):
1. `docs/migrations/009-multi-tenant.sql`
2. `src/api/services/tenant.ts`
3. `src/api/middleware/requireSuperAdmin.ts`
4. `src/api/routes/super.ts`
5. `web/src/components/features/super/TenantSwitcher.tsx`
6. `web/src/components/features/super/TenantTable.tsx`
7. `web/src/components/features/super/TenantForm.tsx`
8. `web/src/pages/SuperAdminPage.tsx`

### Modified (16 files):
1. `src/types/index.ts`
2. `src/config.ts`
3. `src/api/middleware/requireAuth.ts`
4. `src/api/middleware/auditLog.ts`
5. `src/api/cache/crm-cache.ts`
6. `src/services/kommo.ts`
7. `src/services/token-store.ts`
8. `src/api/routes/reports.ts`
9. `src/api/routes/admin.ts`
10. `src/api/routes/webhooks.ts`
11. `src/api/routes/notifications.ts`
12. `src/api/routes/chat.ts`
13. `src/api/routes/auth.ts`
14. `src/api/server.ts`
15. `src/api/index.ts`
16. `web/src/types/index.ts`
17. `web/src/stores/authStore.ts`
18. `web/src/lib/api.ts`
19. `web/src/components/layout/TopBar.tsx`
20. `web/src/components/layout/Sidebar.tsx`
21. `web/src/App.tsx`
