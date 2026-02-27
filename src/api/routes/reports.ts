import { Router } from "express";
import { KommoService } from "../../services/kommo.js";
import { STATUS } from "../../config.js";

async function getAgentPerformanceData(service: KommoService) {
  const [users, pipelines, leads] = await Promise.all([
    service.getUsers(),
    service.getPipelines(),
    service.getLeads(),
  ]);

  const userMap = new Map<number, string>();
  const agentStats: Record<string, any> = {};

  users.forEach(u => {
    userMap.set(u.id, u.name);
    agentStats[u.name] = {
      Agente: u.name,
      "Total Leads": 0,
      _wonCount: 0,
      _wonPrice: 0,
      _lostCount: 0,
      stages: {} as Record<string, number>,
    };
  });

  const statusMap: Record<number, string> = {};
  pipelines.forEach((p: any) => {
    p._embedded.statuses.forEach((s: any) => {
      statusMap[s.id] = s.name;
    });
  });

  leads.forEach(l => {
    const uName = userMap.get(l.responsible_user_id) || `ID: ${l.responsible_user_id}`;

    if (!agentStats[uName]) {
      agentStats[uName] = {
        Agente: uName,
        "Total Leads": 0,
        _wonCount: 0,
        _wonPrice: 0,
        _lostCount: 0,
        stages: {} as Record<string, number>,
      };
    }

    const stats = agentStats[uName];
    stats["Total Leads"]++;

    const stageName = statusMap[l.status_id] || `Status ${l.status_id}`;

    if (l.status_id !== STATUS.WON && l.status_id !== STATUS.LOST) {
      stats.stages[stageName] = (stats.stages[stageName] || 0) + 1;
    }

    if (l.status_id === STATUS.WON) {
      stats._wonCount++;
      stats._wonPrice += l.price || 0;
    }

    if (l.status_id === STATUS.LOST) {
      stats._lostCount++;
    }
  });

  return Object.values(agentStats).map(stats => {
    const total = stats["Total Leads"] || 1;
    const row: any = {
      Agente: stats.Agente,
      "Total Leads": stats["Total Leads"],
      "Venda Ganha": `${stats._wonCount || 0} (${(((stats._wonCount || 0) / total) * 100).toFixed(1)}%)`,
      "Venda Perdida": `${stats._lostCount || 0} (${(((stats._lostCount || 0) / total) * 100).toFixed(1)}%)`,
      "Ticket Médio": stats._wonPrice / (stats._wonCount || 1),
    };
    Object.entries(stats.stages).forEach(([name, count]) => {
      row[name] = count;
    });
    return row;
  });
}

export function reportsRouter(service: KommoService) {
  const router = Router();

  // GET /api/reports/agents — desempenho de todos os agentes
  router.get("/agents", async (req, res) => {
    try {
      const rawData = await getAgentPerformanceData(service);
      const formatted = rawData.map(row => ({
        ...row,
        "Ticket Médio":
          "R$ " +
          row["Ticket Médio"].toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        "Conversão %":
          ((parseInt(row["Venda Ganha"]) / row["Total Leads"]) * 100).toFixed(1) + "%",
      }));
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
