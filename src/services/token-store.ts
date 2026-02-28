import { createClient } from "@supabase/supabase-js";
import { TeamKey } from "../config.js";

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

export async function loadTokens(team: TeamKey): Promise<KommoTokens | null> {
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

export async function saveTokens(team: TeamKey, tokens: KommoTokens): Promise<void> {
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
