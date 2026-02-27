import dotenv from "dotenv";
dotenv.config();

// IDs dos funis no Kommo CRM
export const PIPELINE_IDS = {
  TRYVION: 12881607,
  MATRIZ: 12882267,
  AXION: 13041243,
} as const;

export const ALLOWED_PIPELINE_IDS = Object.values(PIPELINE_IDS);

// Status codes do Kommo
export const STATUS = {
  WON: 142,
  LOST: 143,
} as const;

// Configuração do servidor web
export const PORT = parseInt(process.env.PORT || "3000", 10);

// Configuração do Kommo CRM
export const kommoConfig = {
  subdomain: process.env.KOMMO_SUBDOMAIN || "",
  clientId: process.env.KOMMO_CLIENT_ID || "",
  clientSecret: process.env.KOMMO_CLIENT_SECRET || "",
  redirectUri: process.env.KOMMO_REDIRECT_URI || "",
  accessToken: process.env.KOMMO_ACCESS_TOKEN || "",
};

// Validação de variáveis obrigatórias
export function validateConfig() {
  if (!kommoConfig.subdomain || !kommoConfig.accessToken) {
    console.error("Erro: KOMMO_SUBDOMAIN e KOMMO_ACCESS_TOKEN são obrigatórios no .env");
    process.exit(1);
  }
}
