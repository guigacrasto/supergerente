# Design — 4 Features Dashboard SuperGerente

**Data:** 2026-03-01
**Status:** Aprovado

---

## Feature 1: Remover cores de conversão na tela de Agentes

**Arquivo:** `web/src/components/features/agents/AgentTable.tsx`

- Remover a função `getConversionVariant()` que retorna verde/amarelo/vermelho
- Exibir "Conversão %" como texto simples (sem Badge colorido)
- Manter a coluna ordenável
- 1 arquivo afetado

---

## Feature 2: Trocar pie chart por barras horizontais (full-width por equipe)

**Problema:** Dois donuts lado a lado (50/50) ficam apertados com muitos agentes.

**Solução:**
- Novo componente `TeamBarChart` substituindo `TeamPieChart`
- Barras horizontais com Recharts `BarChart layout="vertical"`
- Cada equipe ocupa 100% da largura (stack vertical)
- Eixo Y = nomes dos agentes, Eixo X = quantidade de leads
- Cor = cor da equipe (azul #1F74EC / amarela #F9AA3C)
- Altura dinâmica (~40px por agente)
- Tooltip com nome + valor + percentual

**Arquivos:**
- Criar: `web/src/components/features/dashboard/TeamBarChart.tsx`
- Editar: `web/src/pages/DashboardPage.tsx` (trocar grid para `grid-cols-1`)
- Remover: `web/src/components/features/dashboard/TeamPieChart.tsx`

---

## Feature 3: Análise de conversas com IA (sentimento + resumo)

**Abordagem:**

### Backend
- Novo endpoint `GET /api/reports/conversation-analysis`
- Busca leads ativos recentes (últimos 7 dias)
- Para cada lead: busca notes/chat via Kommo API (`getLeadNotes`)
- Envia mensagens para Gemini 2.5 Flash para análise
- Retorna: score de sentimento (1-5), qualidade, resumo, melhorias
- Cache de 1h (mesmo padrão do crm-cache)
- Limite: 5 conversas mais recentes por agente/dia (controle de tokens)

### Frontend
- Nova página `/insights` com rota protegida
- Cards por agente com score médio
- Lista de conversas com resumo + sentimento
- Filtro por equipe/agente

**Arquivos:**
- Criar: `src/api/cache/conversation-cache.ts`
- Criar: `src/api/routes/insights.ts`
- Editar: `src/services/kommo.ts` (adicionar `getChatMessages`)
- Criar: `web/src/pages/InsightsPage.tsx`
- Criar: `web/src/components/features/insights/`
- Editar: `web/src/App.tsx` (nova rota)
- Editar: sidebar/navegação (novo item "Insights")

---

## Feature 4: Totais por equipe nos KPI cards

**Solução:** Nova fileira de KPI cards separados por equipe abaixo dos gerais.

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│ [Leads Novos Hoje] [Leads Ativos] [Novos Mes] [Alertas]  ← gerais
├──────────────────────────┬───────────────────────────┤
│ Equipe Azul              │ Equipe Amarela            │
│ Hoje: 12  Ativos: 89    │ Hoje: 8   Ativos: 67     │
│ Mês: 234                 │ Mês: 178                  │
└──────────────────────────┴───────────────────────────┘
```

- Grid 2 colunas, cada card com 3 métricas
- Cor do título = cor da equipe
- Usa dados do `summary` (filtro por `team`)
- Nenhuma mudança no backend

**Arquivos:**
- Criar: `web/src/components/features/dashboard/TeamKPICard.tsx`
- Editar: `web/src/pages/DashboardPage.tsx`
