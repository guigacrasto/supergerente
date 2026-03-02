import { Router } from "express";
import { loadTokens, TEAMS } from "@sg/shared";
import type { TeamKey } from "@sg/shared";
import { requireAdmin } from "../middleware/requireAuth.js";
import { KommoService } from "../services/kommo.js";

export function oauthRouter(
  services: Record<TeamKey, KommoService>
): Router {
  const router = Router();
  router.use(requireAdmin as any);

  // GET /api/oauth/start?team=azul — returns the Kommo authorization URL
  router.get("/start", (_req, res) => {
    const team = (_req.query.team as TeamKey) || "azul";
    const config = TEAMS[team];
    if (!config) {
      res.status(400).json({ error: "Team inválida." });
      return;
    }
    const authUrl =
      `https://www.kommo.com/oauth/?` +
      `client_id=${config.clientId}` +
      `&state=renew` +
      `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
      `&response_type=code`;
    res.json({ url: authUrl });
  });

  // POST /api/oauth/exchange?team=azul — exchange the authorization code for tokens
  router.post("/exchange", async (req, res) => {
    const team = (req.query.team as TeamKey) || "azul";
    const { code } = req.body;
    if (!code) {
      res
        .status(400)
        .json({ error: "Código de autorização não fornecido." });
      return;
    }
    const service = services[team];
    if (!service) {
      res.status(400).json({ error: "Team inválida." });
      return;
    }
    try {
      const tokens = await service.exchangeAuthCode(code);
      res.json({
        message: "Token renovado com sucesso!",
        accessToken: tokens.accessToken.slice(0, 20) + "...",
      });
    } catch (err: unknown) {
      const axiosErr = err as Record<string, Record<string, unknown>>;
      const kommoError = axiosErr?.response?.data;
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[OAuth:${team}] Exchange failed:`,
        kommoError || errMessage
      );
      const detail =
        (kommoError as Record<string, unknown>)?.hint ||
        (kommoError as Record<string, unknown>)?.detail ||
        (kommoError as Record<string, unknown>)?.title ||
        (typeof kommoError === "string" ? kommoError : errMessage);
      res.status(500).json({ error: detail });
    }
  });

  // GET /api/oauth/status — token info for both teams
  router.get("/status", async (_req, res) => {
    try {
      const result: Record<
        TeamKey,
        { hasRefreshToken: boolean; expiresAt: string | null }
      > = {
        azul: { hasRefreshToken: false, expiresAt: null },
        amarela: { hasRefreshToken: false, expiresAt: null },
      };

      for (const team of ["azul", "amarela"] as TeamKey[]) {
        const stored = await loadTokens(team);
        result[team].hasRefreshToken = !!stored?.refreshToken;

        const token =
          stored?.accessToken || TEAMS[team].accessToken || "";
        if (token) {
          try {
            const payload = JSON.parse(
              Buffer.from(token.split(".")[1], "base64").toString()
            );
            result[team].expiresAt = new Date(
              payload.exp * 1000
            ).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
          } catch {
            /* ignore decode errors */
          }
        }
      }

      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
