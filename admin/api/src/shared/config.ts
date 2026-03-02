import dotenv from "dotenv";
dotenv.config();

import type { TeamKey, TeamConfig } from "./types.js";

export const TEAMS: Record<TeamKey, TeamConfig> = {
  azul: {
    label: "Equipe Azul",
    subdomain: process.env.KOMMO_SUBDOMAIN || "",
    clientId: process.env.KOMMO_CLIENT_ID || "",
    clientSecret: process.env.KOMMO_CLIENT_SECRET || "",
    redirectUri: process.env.KOMMO_REDIRECT_URI || "",
    accessToken: process.env.KOMMO_ACCESS_TOKEN || "",
    excludePipelineNames: [],
  },
  amarela: {
    label: "Equipe Amarela",
    subdomain: process.env.KOMMO_AMARELA_SUBDOMAIN || "",
    clientId: process.env.KOMMO_AMARELA_CLIENT_ID || "",
    clientSecret: process.env.KOMMO_AMARELA_CLIENT_SECRET || "",
    redirectUri: process.env.KOMMO_AMARELA_REDIRECT_URI || "",
    accessToken: process.env.KOMMO_AMARELA_ACCESS_TOKEN || "",
    excludePipelineNames: ["funil teste"],
  },
};

export const ALL_CONFIGURED_TEAMS = (Object.keys(TEAMS) as TeamKey[]).filter(
  (k) => TEAMS[k].subdomain
);

export const PORT = parseInt(process.env.PORT || "3001", 10);
