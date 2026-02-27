import { kommoConfig, validateConfig, PORT } from "../config.js";
import { KommoService } from "../services/kommo.js";
import { createServer } from "./server.js";

validateConfig();

const service = new KommoService(kommoConfig);
const app = createServer(service);

app.listen(PORT, () => {
  console.log(`Web server rodando em http://localhost:${PORT}`);
});
