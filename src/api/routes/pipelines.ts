import { Router } from "express";
import { KommoService } from "../../services/kommo.js";
import { ALLOWED_PIPELINE_IDS } from "../../config.js";

export function pipelinesRouter(service: KommoService) {
  const router = Router();

  // GET /api/pipelines — retorna apenas os funis permitidos (Tryvion, Matriz, Axion)
  router.get("/", async (req, res) => {
    try {
      const pipelines = await service.getPipelines();
      const filtered = pipelines.filter(p => ALLOWED_PIPELINE_IDS.includes(p.id));
      res.json(filtered.map(p => ({ id: p.id, name: p.name })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
