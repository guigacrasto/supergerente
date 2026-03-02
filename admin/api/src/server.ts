import express from "express";
import cors from "cors";
import { TeamKey } from "@sg/shared";
import { adminRouter } from "./routes/admin.js";
import { oauthRouter } from "./routes/oauth.js";
import { authRouter } from "./routes/auth.js";
import { KommoService } from "./services/kommo.js";

export function createServer(services: Record<TeamKey, KommoService>) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "admin" });
  });

  app.use("/api/auth", authRouter());
  app.use("/api/admin", adminRouter(services));
  app.use("/api/oauth", oauthRouter(services));

  return app;
}
