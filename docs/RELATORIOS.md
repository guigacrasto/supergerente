# Guia Técnico de Relatórios

Este documento descreve os scripts de extração de dados customizados localizados em `src/scripts/`.

## 1. Relatório Tryvion (`report_tryvion_marketing.ts`)
Focado em métricas de performance comercial e marketing.

*   **O que extrai**: Leads totais, Ganhos, Perdidos, Valor Monetário.
*   **KPIs**: Taxa de Conversão, Ticket Médio, Taxa de Fechamento.
*   **Público**: Diretoria e Marketing.

## 2. Relatório Matriz Recente (`report_matriz_recent.ts`)
Focado em velocidade de atendimento e novos fluxos.

*   **O que extrai**: Leads criados nos últimos 3 dias no funil Matriz.
*   **KPIs**: Volume de entrada, Distribuição por status inicial.
*   **Público**: Gerência de Operação.

## 3. Mapeamento de Marcas (`list_agents_brands.ts`)
Auxilia na organização da equipe.

*   **O que extrai**: Cruzamento de qual Agente possui leads em quais Funis (Pipelines).
*   **Público**: RH e Supervisores.

---

## 🛠️ Como criar um novo relatório?

1. Copie o arquivo `src/scripts/report_matriz_recent.ts`.
2. Altere o filtro `allowedNames` para o nome do funil desejado.
3. Ajuste a janela de tempo na variável `threeDaysAgo`.
4. Execute via terminal para testar.
