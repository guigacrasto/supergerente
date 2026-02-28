import { TEAMS, validateConfig, PORT } from "../config.js";
import { KommoService } from "../services/kommo.js";
import { createServer } from "./server.js";
import { getCrmMetrics } from "./cache/crm-cache.js";

validateConfig();

const services = {
  azul: new KommoService(TEAMS.azul, "azul"),
  amarela: new KommoService(TEAMS.amarela, "amarela"),
};

const app = createServer(services);

const REFRESH_INTERVAL_MS = 20 * 60 * 60 * 1000; // 20 hours

async function refreshAllTokens() {
  console.log("[Scheduler] Verificando tokens Kommo...");
  await services.azul.proactiveRefresh();
  if (TEAMS.amarela.subdomain) {
    await services.amarela.proactiveRefresh();
  }
}

app.listen(PORT, async () => {
  console.log(`Web server rodando em http://localhost:${PORT}`);
  await services.azul.loadStoredToken();
  if (TEAMS.amarela.subdomain) {
    await services.amarela.loadStoredToken();
  }
  // Refresh proactively on startup if token is near expiry or expiry is unknown
  await refreshAllTokens();
  // Schedule proactive refresh every 20 hours
  setInterval(refreshAllTokens, REFRESH_INTERVAL_MS);
  // Warm-up caches in background
  getCrmMetrics("azul", services.azul).catch((e) =>
    console.error("[WarmUp:azul] Erro ao pré-carregar cache:", e)
  );
  if (TEAMS.amarela.subdomain) {
    getCrmMetrics("amarela", services.amarela).catch((e) =>
      console.error("[WarmUp:amarela] Erro ao pré-carregar cache:", e)
    );
  }
});
