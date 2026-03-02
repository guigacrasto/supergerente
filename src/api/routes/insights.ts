import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { KommoService } from "../../services/kommo.js";
import { TeamKey } from "../../config.js";
import { requireAuth, AuthRequest } from "../middleware/requireAuth.js";
import { getConversationInsights } from "../cache/conversation-cache.js";

export function insightsRouter(services: Record<TeamKey, KommoService>) {
  const router = Router();
  router.use(requireAuth as any);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

  router.get("/conversations", async (req: AuthRequest, res) => {
    const userTeams = req.userTeams || [];

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "SUA_CHAVE_AQUI") {
      res.status(400).json({ error: "GEMINI_API_KEY nao configurada" });
      return;
    }

    try {
      const allInsights = [];

      for (const team of userTeams) {
        const service = services[team];
        if (!service) continue;

        const insights = await getConversationInsights(team, service, genAI);
        allInsights.push(...insights);
      }

      res.json(allInsights);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[Insights] Error:", error);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
