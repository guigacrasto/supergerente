import { TEAMS, PORT } from "@sg/shared";
import { KommoService } from "./services/kommo.js";
import { createServer } from "./server.js";

const services = {
  azul: new KommoService(TEAMS.azul, "azul"),
  amarela: new KommoService(TEAMS.amarela, "amarela"),
};

const app = createServer(services);

const REFRESH_INTERVAL_MS = 20 * 60 * 60 * 1000;

async function refreshAllTokens() {
  console.log("[Admin] Verificando tokens Kommo...");
  await services.azul.proactiveRefresh();
  if (TEAMS.amarela.subdomain) {
    await services.amarela.proactiveRefresh();
  }
}

app.listen(PORT, async () => {
  console.log(`[Admin] Server running on http://localhost:${PORT}`);
  await services.azul.loadStoredToken();
  if (TEAMS.amarela.subdomain) {
    await services.amarela.loadStoredToken();
  }
  await refreshAllTokens();
  setInterval(refreshAllTokens, REFRESH_INTERVAL_MS);
});
