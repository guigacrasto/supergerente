import { Router } from "express";
import { KommoService } from "../../services/kommo.js";
import { getCrmMetrics } from "../cache/crm-cache.js";

export function reportsRouter(service: KommoService) {
  const router = Router();

  // GET /api/reports/agents — desempenho de todos os agentes (usa cache CRM)
  router.get("/agents", async (_req, res) => {
    try {
      const metrics = await getCrmMetrics(service);

      // Agrega métricas por agente somando todos os funis
      const byAgent: Record<string, {
        Agente: string;
        "Total Leads": number;
        _won: number;
        _lost: number;
        funnels: Record<string, number>;
      }> = {};

      for (const v of metrics.vendedores) {
        if (!byAgent[v.nome]) {
          byAgent[v.nome] = {
            Agente: v.nome,
            "Total Leads": 0,
            _won: 0,
            _lost: 0,
            funnels: {},
          };
        }
        byAgent[v.nome]["Total Leads"] += v.total;
        byAgent[v.nome]._won += v.ganhos;
        byAgent[v.nome]._lost += v.perdidos;
        byAgent[v.nome].funnels[v.funil.replace("FUNIL ", "")] = v.ativos;
      }

      const rows = Object.values(byAgent)
        .sort((a, b) => b["Total Leads"] - a["Total Leads"])
        .map(a => {
          const total = a["Total Leads"] || 1;
          const wonPct = ((a._won / total) * 100).toFixed(1);
          const lostPct = ((a._lost / total) * 100).toFixed(1);
          const convBase = a._won + a._lost;
          const convPct = convBase > 0 ? ((a._won / convBase) * 100).toFixed(1) : "0.0";
          return {
            Agente: a.Agente,
            "Total Leads": a["Total Leads"],
            "Venda Ganha": `${a._won} (${wonPct}%)`,
            "Venda Perdida": `${a._lost} (${lostPct}%)`,
            "Conversão %": `${convPct}%`,
            ...a.funnels,
          };
        });

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
