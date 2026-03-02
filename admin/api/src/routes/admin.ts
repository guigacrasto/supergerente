import { Router } from "express";
import { createSupabaseClient, TEAMS } from "@sg/shared";
import type { TeamKey } from "@sg/shared";
import { requireAdmin } from "../middleware/requireAuth.js";
import { KommoService } from "../services/kommo.js";

export function adminRouter(
  services: Record<TeamKey, KommoService>
): Router {
  const router = Router();
  router.use(requireAdmin as any);

  // GET /api/admin/users
  router.get("/users", async (_req, res) => {
    const supabase = createSupabaseClient();
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
    const supabase = createSupabaseClient();
    const { teams } = req.body;
    const updateData: Record<string, unknown> = { status: "approved" };
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
    res.json({ message: "Usuário aprovado." });
  });

  // POST /api/admin/users/:id/deny
  router.post("/users/:id/deny", async (req, res) => {
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("profiles")
      .update({ status: "denied" })
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ message: "Usuário negado." });
  });

  // GET /api/admin/tokens
  router.get("/tokens", async (_req, res) => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("token_logs")
      .select(
        `user_id, total_tokens, prompt_tokens, completion_tokens, created_at, profiles!inner(name, email)`
      )
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const byUser: Record<string, Record<string, unknown>> = {};
    for (const row of data || []) {
      const uid = row.user_id;
      if (!byUser[uid]) {
        byUser[uid] = {
          userId: uid,
          name: (row.profiles as Record<string, unknown>).name,
          email: (row.profiles as Record<string, unknown>).email,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          messages: 0,
          estimatedCostUSD: 0,
        };
      }
      (byUser[uid].totalTokens as number) += row.total_tokens;
      (byUser[uid].promptTokens as number) += row.prompt_tokens;
      (byUser[uid].completionTokens as number) += row.completion_tokens;
      (byUser[uid].messages as number) += 1;
      (byUser[uid].estimatedCostUSD as number) +=
        (row.prompt_tokens * 0.075 + row.completion_tokens * 0.3) / 1_000_000;
    }

    const result = Object.values(byUser)
      .sort(
        (a, b) =>
          (b.totalTokens as number) - (a.totalTokens as number)
      )
      .map((u) => ({
        ...u,
        estimatedCostUSD: `$${(u.estimatedCostUSD as number).toFixed(4)}`,
      }));

    res.json(result);
  });

  // GET /api/admin/mentors
  router.get("/mentors", async (_req, res) => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("mentors")
      .select(
        "id, name, description, system_prompt, methodology_text, is_active, created_at"
      )
      .order("created_at", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  });

  // POST /api/admin/mentors
  router.post("/mentors", async (req, res) => {
    const supabase = createSupabaseClient();
    const { name, description, system_prompt, methodology_text, is_active } =
      req.body;
    if (!name || !system_prompt) {
      res
        .status(400)
        .json({ error: "name e system_prompt são obrigatórios" });
      return;
    }
    const { data, error } = await supabase
      .from("mentors")
      .insert({
        name,
        description,
        system_prompt,
        methodology_text,
        is_active: is_active ?? true,
      })
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  });

  // PUT /api/admin/mentors/:id
  router.put("/mentors/:id", async (req, res) => {
    const supabase = createSupabaseClient();
    const { id } = req.params;
    const { name, description, system_prompt, methodology_text, is_active } =
      req.body;
    const { data, error } = await supabase
      .from("mentors")
      .update({ name, description, system_prompt, methodology_text, is_active })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  });

  // DELETE /api/admin/mentors/:id
  router.delete("/mentors/:id", async (req, res) => {
    const supabase = createSupabaseClient();
    const { id } = req.params;
    const { error } = await supabase.from("mentors").delete().eq("id", id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ ok: true });
  });

  // GET /api/admin/pipeline-visibility
  router.get("/pipeline-visibility", async (_req, res) => {
    try {
      const supabase = createSupabaseClient();
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
              .filter(
                (p) =>
                  !excludeNames.some((ex) =>
                    p.name.toUpperCase().includes(ex.toUpperCase())
                  )
              )
              .map((p) => ({
                pipeline_id: p.id as number,
                pipeline_name: p.name as string,
                team,
              }));
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[Admin] Erro pipelines ${team}:`, message);
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

  // PUT /api/admin/pipeline-visibility
  router.put("/pipeline-visibility", async (req, res) => {
    const supabase = createSupabaseClient();
    const { team, pipeline_id, pipeline_name, visible } = req.body;
    const validTeams = Object.keys(TEAMS) as TeamKey[];

    if (!team || !pipeline_id || typeof visible !== "boolean") {
      res
        .status(400)
        .json({ error: "team, pipeline_id e visible sao obrigatorios" });
      return;
    }

    if (!validTeams.includes(team)) {
      res.status(400).json({ error: "Equipe invalida" });
      return;
    }

    if (
      typeof pipeline_id !== "number" ||
      !Number.isInteger(pipeline_id) ||
      pipeline_id <= 0
    ) {
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
