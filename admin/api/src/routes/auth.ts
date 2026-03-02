import { Router } from "express";
import { createSupabaseClient } from "../shared/index.js";

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
