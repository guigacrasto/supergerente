# TODO - Próximos Passos (Evolução)

Este documento mapeia o futuro do **SuperGerente** para permitir o uso descentralizado pelos gerentes.

## 🏁 Fase 1: Estabilização e Documentação (Concluído)
- [x] Scripts de relatórios para Tryvion e Matriz.
- [x] Mapeamento de agentes vs funis.
- [x] Documentação base (README, Manual).

## ☁️ Fase 2: Cloud e Interface (Concluido)
- [x] **Hospedagem do Servidor**: Deploy no Railway com auto-deploy on push.
- [x] **Interface de Chat Web**: PWA React com chat IA integrado (Gemini 2.5 Flash).
- [ ] **Integração Automação**: Criar webhooks no Kommo para alertar o agente sobre novos leads "quentes".

## 📈 Fase 3: Inteligência Avançada
- [x] **Análise de Sentimento**: Analise automatica de conversas via Gemini (score de sentimento + qualidade + resumo).
- [ ] **Predictive Sales**: Calcular probabilidade de fechamento com base no histórico do lead.
- [x] **Dashboard em Tempo Real**: Graficos de barras por agente, KPIs por equipe, rankings de vendas.

## 🔍 Fase 4: Dashboard Aprimorado (Concluido)
- [x] **KPIs por Equipe**: Cards separados com totais de leads por equipe (Azul/Amarela).
- [x] **Graficos de Barras**: Barras horizontais por agente substituindo pie charts.
- [x] **Pagina de Insights**: Analise de conversas com IA por atendente (sentimento + qualidade + resumo).
- [x] **Tabela de Agentes**: Conversao exibida sem cores (texto simples).

## ⚙️ Melhorias Técnicas
- [x] Paginacao completa de leads e notas na API Kommo.
- [x] Cache de metricas CRM e atividade (TTL 30min) + cache de insights (TTL 1h).
- [ ] Log de auditoria de consultas dos gerentes.
