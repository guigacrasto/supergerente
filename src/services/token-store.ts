import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export interface KommoTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number; // Unix timestamp (seconds)
}

export async function loadTokens(team: string): Promise<KommoTokens | null> {
  const supabase = getClient();
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

export async function saveTokens(team: string, tokens: KommoTokens): Promise<void> {
  const supabase = getClient();
  const rows: Array<{ key: string; value: string; updated_at: string }> = [
    { key: `kommo_${team}_access_token`, value: tokens.accessToken, updated_at: new Date().toISOString() },
    { key: `kommo_${team}_refresh_token`, value: tokens.refreshToken, updated_at: new Date().toISOString() },
  ];
  if (tokens.expiresAt !== undefined) {
    rows.push({ key: `kommo_${team}_expires_at`, value: String(tokens.expiresAt), updated_at: new Date().toISOString() });
  }
  await supabase.from("settings").upsert(rows);
}

// Tenant-based token storage (reads/writes directly from tenants table)
export async function loadTokensFromTenant(tenantId: string): Promise<KommoTokens | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("kommo_access_token, kommo_refresh_token, kommo_token_expires_at")
    .eq("id", tenantId)
    .single();

  if (error || !data) return null;
  if (!data.kommo_access_token) return null;

  return {
    accessToken: data.kommo_access_token,
    refreshToken: data.kommo_refresh_token || "",
    expiresAt: data.kommo_token_expires_at
      ? Math.floor(new Date(data.kommo_token_expires_at).getTime() / 1000)
      : undefined,
  };
}

export async function saveTokensToTenant(tenantId: string, tokens: KommoTokens): Promise<void> {
  const supabase = getClient();
  const updates: Record<string, unknown> = {
    kommo_access_token: tokens.accessToken,
    kommo_refresh_token: tokens.refreshToken,
    updated_at: new Date().toISOString(),
  };
  if (tokens.expiresAt !== undefined) {
    updates.kommo_token_expires_at = new Date(tokens.expiresAt * 1000).toISOString();
  }
  await supabase.from("tenants").update(updates).eq("id", tenantId);
}
