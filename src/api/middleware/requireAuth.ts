import { Request, Response, NextFunction } from "express";
import { supabase } from "../supabase.js";
import { TeamKey, TEAMS, getTeamConfigsFromTenant } from "../../config.js";
import { getTenantById } from "../services/tenant.js";

// All configured teams (those with a subdomain set)
const ALL_CONFIGURED_TEAMS = (Object.keys(TEAMS) as TeamKey[]).filter(
  (k) => TEAMS[k].subdomain
);

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userTeams?: string[];
  allowedFunnels?: Record<string, number[]>;
  allowedGroups?: Record<string, string[]>;
  pausedPipelines?: number[];
  canViewRanking?: boolean;
  tenantId?: string;
  tenant?: any;
}

// In-memory auth profile cache — avoids Supabase queries per request
interface CachedProfile {
  userId: string;
  role: string;
  teams: string[];
  allowedFunnels: Record<string, number[]>;
  allowedGroups: Record<string, string[]>;
  pausedPipelines: number[];
  canViewRanking: boolean;
  tenantId?: string;
  tenant?: any;
  expiresAt: number;
}

const AUTH_CACHE_TTL_MS = 60 * 1000; // 1 minute — reflect permission changes quickly
const authCache = new Map<string, CachedProfile>();

// Cleanup stale entries every 10 minutes
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
    res.status(401).json({ error: "Token não fornecido." });
    return;
  }

  // Check cache first
  const cached = authCache.get(token);
  if (cached && Date.now() < cached.expiresAt) {
    req.userId = cached.userId;
    req.userRole = cached.role;
    req.userTeams = cached.teams;
    req.allowedFunnels = cached.allowedFunnels;
    req.allowedGroups = cached.allowedGroups;
    req.pausedPipelines = cached.pausedPipelines;
    req.canViewRanking = cached.canViewRanking;
    req.tenantId = cached.tenantId;
    req.tenant = cached.tenant;
    return next();
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    authCache.delete(token);
    res.status(401).json({ error: "Token inválido." });
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role, teams, can_view_ranking, tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "approved") {
    res.status(403).json({ error: "Acesso pendente de aprovação." });
    return;
  }

  // Fetch funnel permissions (user_funnel_permissions may not exist yet)
  const allowedFunnels: Record<string, number[]> = {};
  try {
    const { data: perms } = await supabase
      .from("user_funnel_permissions")
      .select("team, allowed_funnels")
      .eq("user_id", user.id);
    if (perms) {
      for (const row of perms) {
        const funnels = Array.isArray(row.allowed_funnels) ? row.allowed_funnels : [];
        allowedFunnels[row.team] = funnels;
      }
    }
  } catch {
    // Table may not exist yet
  }

  // Fetch globally paused pipelines from settings
  let pausedPipelines: number[] = [];
  try {
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "paused_pipelines")
      .single();
    if (setting?.value) {
      pausedPipelines = Array.isArray(setting.value) ? setting.value : JSON.parse(setting.value);
    }
  } catch {
    // Table may not exist yet
  }

  // Fetch group permissions for this user from settings
  let allowedGroups: Record<string, string[]> = {};
  try {
    const { data: groupSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", `user_groups:${user.id}`)
      .single();
    if (groupSetting?.value) {
      allowedGroups = typeof groupSetting.value === "string"
        ? JSON.parse(groupSetting.value)
        : groupSetting.value;
    }
  } catch {
    // No group permissions set
  }

  // Load tenant if user has one (or superadmin override via header)
  let tenantId = profile.tenant_id || undefined;
  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
  if (profile.role === 'superadmin' && headerTenantId) {
    tenantId = headerTenantId;
  }

  let tenant: any = undefined;
  if (tenantId) {
    tenant = await getTenantById(tenantId);
  }

  // Determine teams: use tenant team configs if available, else fallback to static config
  let teams: string[];
  if (tenant?.settings?.teams) {
    const tenantTeamKeys = Object.keys(tenant.settings.teams);
    teams = (profile.role === "admin" || profile.role === "superadmin")
      ? tenantTeamKeys
      : (profile.teams || []).filter((t: string) => tenantTeamKeys.includes(t));
  } else {
    teams = (profile.role === "admin" || profile.role === "superadmin")
      ? ALL_CONFIGURED_TEAMS
      : (profile.teams || []);
  }

  const canViewRanking = profile.can_view_ranking ?? false;

  // Cache the result
  authCache.set(token, {
    userId: user.id,
    role: profile.role,
    teams,
    allowedFunnels,
    allowedGroups,
    pausedPipelines,
    canViewRanking,
    tenantId,
    tenant,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });

  req.userId = user.id;
  req.userRole = profile.role;
  req.userTeams = teams;
  req.allowedFunnels = allowedFunnels;
  req.allowedGroups = allowedGroups;
  req.pausedPipelines = pausedPipelines;
  req.canViewRanking = canViewRanking;
  req.tenantId = tenantId;
  req.tenant = tenant;

  next();
}
