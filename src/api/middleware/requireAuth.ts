import { Request, Response, NextFunction } from "express";
import { supabase } from "../supabase.js";
import { TeamKey } from "../../config.js";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userTeams?: TeamKey[];
}

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

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Token inválido." });
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role, teams")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "approved") {
    res.status(403).json({ error: "Acesso pendente de aprovação." });
    return;
  }

  req.userId = user.id;
  req.userRole = profile.role;
  req.userTeams = (profile.teams || []) as TeamKey[];
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
