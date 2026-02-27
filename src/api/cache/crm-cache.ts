import { KommoService } from "../../services/kommo.js";
import { PIPELINE_IDS, STATUS } from "../../config.js";

export interface VendedorMetrics {
  nome: string;
  funil: string;
  total: number;
  ganhos: number;
  perdidos: number;
  ativos: number;
  conversao: string;
  novosSemana: number;
  novosMes: number;
}

export interface FunilMetrics {
  nome: string;
  total: number;
  ganhos: number;
  perdidos: number;
  ativos: number;
  conversao: string;
  novosSemana: number;
  novosMes: number;
}

export interface CrmMetrics {
  funis: Record<string, FunilMetrics>;
  vendedores: VendedorMetrics[];
  geral: {
    total: number;
    ganhos: number;
    perdidos: number;
    ativos: number;
    conversao: string;
    novosHoje: number;
    novosSemana: number;
    novosMes: number;
  };
  atualizadoEm: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

let cachedMetrics: CrmMetrics | null = null;
let cacheExpiresAt = 0;
let fetchPromise: Promise<CrmMetrics> | null = null;

function toConversao(ganhos: number, perdidos: number): string {
  const total = ganhos + perdidos;
  if (total === 0) return "0.0%";
  return ((ganhos / total) * 100).toFixed(1) + "%";
}

function countPeriod(leads: any[], days: number): number {
  const cutoff = Date.now() / 1000 - days * 86400;
  return leads.filter((l) => l.created_at >= cutoff).length;
}

async function fetchAndCompute(service: KommoService): Promise<CrmMetrics> {
  console.log("[CrmCache] Buscando dados do CRM...");

  const [users, tryvionLeads, matrizLeads, axionLeads] = await Promise.all([
    service.getUsers(),
    service.getLeads({ filter: { pipeline_id: PIPELINE_IDS.TRYVION } }),
    service.getLeads({ filter: { pipeline_id: PIPELINE_IDS.MATRIZ } }),
    service.getLeads({ filter: { pipeline_id: PIPELINE_IDS.AXION } }),
  ]);

  const leadsPerFunil: Record<string, { nome: string; leads: any[] }> = {
    TRYVION: { nome: "FUNIL TRYVION", leads: tryvionLeads },
    MATRIZ: { nome: "FUNIL NEW MATRIZ", leads: matrizLeads },
    AXION: { nome: "FUNIL AXION", leads: axionLeads },
  };

  const allLeads = [...tryvionLeads, ...matrizLeads, ...axionLeads];

  // Métricas por funil
  const funis: Record<string, FunilMetrics> = {};
  for (const [key, { nome, leads }] of Object.entries(leadsPerFunil)) {
    const ganhos = leads.filter((l) => l.status_id === STATUS.WON).length;
    const perdidos = leads.filter((l) => l.status_id === STATUS.LOST).length;
    const ativos = leads.length - ganhos - perdidos;
    funis[key] = {
      nome,
      total: leads.length,
      ganhos,
      perdidos,
      ativos,
      conversao: toConversao(ganhos, perdidos),
      novosSemana: countPeriod(leads, 7),
      novosMes: countPeriod(leads, 30),
    };
  }

  // Métricas por vendedor × funil
  const vendedores: VendedorMetrics[] = [];
  for (const user of users) {
    for (const [key, { nome, leads }] of Object.entries(leadsPerFunil)) {
      const mine = leads.filter((l) => l.responsible_user_id === user.id);
      if (mine.length === 0) continue;
      const ganhos = mine.filter((l) => l.status_id === STATUS.WON).length;
      const perdidos = mine.filter((l) => l.status_id === STATUS.LOST).length;
      vendedores.push({
        nome: user.name,
        funil: nome,
        total: mine.length,
        ganhos,
        perdidos,
        ativos: mine.length - ganhos - perdidos,
        conversao: toConversao(ganhos, perdidos),
        novosSemana: countPeriod(mine, 7),
        novosMes: countPeriod(mine, 30),
      });
    }
  }

  // Resumo geral
  const totalGanhos = allLeads.filter((l) => l.status_id === STATUS.WON).length;
  const totalPerdidos = allLeads.filter((l) => l.status_id === STATUS.LOST).length;

  const geral = {
    total: allLeads.length,
    ganhos: totalGanhos,
    perdidos: totalPerdidos,
    ativos: allLeads.length - totalGanhos - totalPerdidos,
    conversao: toConversao(totalGanhos, totalPerdidos),
    novosHoje: countPeriod(allLeads, 1),
    novosSemana: countPeriod(allLeads, 7),
    novosMes: countPeriod(allLeads, 30),
  };

  console.log(
    `[CrmCache] Pronto — ${allLeads.length} leads, ${vendedores.length} entradas de vendedor`
  );

  return {
    funis,
    vendedores,
    geral,
    atualizadoEm: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  };
}

export async function getCrmMetrics(service: KommoService): Promise<CrmMetrics> {
  const now = Date.now();

  // Cache fresco — retorna imediatamente
  if (cachedMetrics && now < cacheExpiresAt) {
    return cachedMetrics;
  }

  // Cache expirado mas existe — retorna stale e revalida em background
  if (cachedMetrics && !fetchPromise) {
    fetchPromise = fetchAndCompute(service)
      .then((metrics) => {
        cachedMetrics = metrics;
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        return metrics;
      })
      .catch((err) => {
        console.error("[CrmCache] Erro no refresh:", err);
        return cachedMetrics!;
      })
      .finally(() => { fetchPromise = null; });
    return cachedMetrics;
  }

  // Sem cache — compartilha a Promise entre chamadas concorrentes
  if (!fetchPromise) {
    fetchPromise = fetchAndCompute(service)
      .then((metrics) => {
        cachedMetrics = metrics;
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        return metrics;
      })
      .catch((err) => {
        console.error("[CrmCache] Erro no fetch inicial:", err);
        throw err;
      })
      .finally(() => { fetchPromise = null; });
  }

  return fetchPromise;
}
