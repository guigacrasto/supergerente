import { CrmMetrics, ActiveLead, LeadSnapshot } from "../cache/crm-cache.js";

export interface LeadPrediction {
  leadId: number;
  titulo: string;
  agente: string;
  funil: string;
  score: number;           // 0-100
  nivel: "alto" | "medio" | "baixo";
  fatores: PredictionFactor[];
  valor: number;
  ultimaAtualizacao: number;
}

export interface PredictionFactor {
  nome: string;
  valor: string;
  peso: number;       // contribuição para o score
  impacto: "positivo" | "negativo" | "neutro";
}

// Score weights
const WEIGHTS = {
  tempo: 0.25,
  interacao: 0.25,
  engajamento: 0.20,
  valor: 0.15,
  agente: 0.15,
};

export function calculatePredictions(
  metrics: CrmMetrics,
  team: string
): LeadPrediction[] {
  const now = Math.floor(Date.now() / 1000);
  const predictions: LeadPrediction[] = [];

  // Build agent conversion rates
  const agenteConversao: Record<string, number> = {};
  for (const v of metrics.vendedores) {
    const rate = v.total > 0 ? (v.ganhos / v.total) : 0;
    // Use best conversion rate across funnels
    if (!agenteConversao[v.nome] || rate > agenteConversao[v.nome]) {
      agenteConversao[v.nome] = rate;
    }
  }

  // Average deal value for normalization
  const allValues = metrics.leadSnapshots
    .filter((l) => l.price > 0)
    .map((l) => l.price);
  const avgValue = allValues.length > 0
    ? allValues.reduce((a, b) => a + b, 0) / allValues.length
    : 1;
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;

  for (const lead of metrics.activeLeads) {
    const snapshot = metrics.leadSnapshots.find((s) => s.id === lead.id);
    if (!snapshot) continue;

    const fatores: PredictionFactor[] = [];

    // 1. Tempo no funil (menos = melhor) — max 30 dias
    const diasNoFunil = (now - snapshot.created_at) / 86400;
    const tempoScore = Math.max(0, 100 - (diasNoFunil / 30) * 100);
    fatores.push({
      nome: "Tempo no Funil",
      valor: `${Math.round(diasNoFunil)} dias`,
      peso: tempoScore * WEIGHTS.tempo,
      impacto: tempoScore > 60 ? "positivo" : tempoScore > 30 ? "neutro" : "negativo",
    });

    // 2. Última interação (mais recente = melhor) — max 14 dias
    const diasSemInteracao = (now - lead.updatedAt) / 86400;
    const interacaoScore = Math.max(0, 100 - (diasSemInteracao / 14) * 100);
    fatores.push({
      nome: "Última Interação",
      valor: diasSemInteracao < 1
        ? "Hoje"
        : `${Math.round(diasSemInteracao)} dias atrás`,
      peso: interacaoScore * WEIGHTS.interacao,
      impacto: interacaoScore > 60 ? "positivo" : interacaoScore > 30 ? "neutro" : "negativo",
    });

    // 3. Engajamento (tags como proxy — leads com mais tags = mais qualificados)
    const tagCount = snapshot.tags.length;
    const engajamentoScore = Math.min(100, tagCount * 25); // 4+ tags = 100
    fatores.push({
      nome: "Qualificação",
      valor: `${tagCount} tags`,
      peso: engajamentoScore * WEIGHTS.engajamento,
      impacto: engajamentoScore > 50 ? "positivo" : engajamentoScore > 0 ? "neutro" : "negativo",
    });

    // 4. Valor do deal
    const valorScore = lead.price > 0
      ? Math.min(100, (lead.price / maxValue) * 100)
      : 0;
    fatores.push({
      nome: "Valor do Deal",
      valor: lead.price > 0
        ? `R$ ${lead.price.toLocaleString("pt-BR")}`
        : "Sem valor",
      peso: valorScore * WEIGHTS.valor,
      impacto: valorScore > 50 ? "positivo" : valorScore > 0 ? "neutro" : "negativo",
    });

    // 5. Taxa de conversão do agente
    const agentName = lead.responsibleUserName;
    const agentRate = agenteConversao[agentName] || 0;
    const agenteScore = agentRate * 100;
    fatores.push({
      nome: "Conversão do Agente",
      valor: `${(agentRate * 100).toFixed(1)}%`,
      peso: agenteScore * WEIGHTS.agente,
      impacto: agenteScore > 20 ? "positivo" : agenteScore > 10 ? "neutro" : "negativo",
    });

    // Calculate final score
    const score = Math.round(
      tempoScore * WEIGHTS.tempo +
      interacaoScore * WEIGHTS.interacao +
      engajamentoScore * WEIGHTS.engajamento +
      valorScore * WEIGHTS.valor +
      agenteScore * WEIGHTS.agente
    );

    const funilName = metrics.pipelineNames[lead.pipelineId] || "Desconhecido";

    predictions.push({
      leadId: lead.id,
      titulo: lead.titulo,
      agente: agentName,
      funil: funilName,
      score,
      nivel: score >= 70 ? "alto" : score >= 40 ? "medio" : "baixo",
      fatores,
      valor: lead.price,
      ultimaAtualizacao: lead.updatedAt,
    });
  }

  // Sort by score descending
  predictions.sort((a, b) => b.score - a.score);

  return predictions;
}
