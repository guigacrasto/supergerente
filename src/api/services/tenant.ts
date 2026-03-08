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

// In-memory tenant cache (refreshed every 5 min)
let tenantsCache = new Map<string, Tenant>();
let tenantsBySlug = new Map<string, Tenant>();
let tenantsByWebhookSecret = new Map<string, Tenant>();
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
  cacheLoadedAt = 0; // invalidate
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
  cacheLoadedAt = 0; // invalidate
  return mapRow(data);
}

export function invalidateTenantCache(): void {
  cacheLoadedAt = 0;
}
