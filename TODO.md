# TODO - Próximos Passos (Evolução)

Este documento mapeia o futuro do **SuperGerente** para permitir o uso descentralizado pelos gerentes.

## Fase 1: Estabilização e Documentação (Concluído)
- [x] Scripts de relatórios para Tryvion e Matriz.
- [x] Mapeamento de agentes vs funis.
- [x] Documentação base (README, Manual).

## Fase 2: Cloud e Interface (Concluído)
- [x] **Hospedagem do Servidor**: Deploy no Railway com auto-deploy on push.
- [x] **Interface de Chat Web**: PWA React com chat IA integrado (Gemini 2.5 Flash).
- [x] **Integração Automação**: Webhooks Kommo + notificações (painel, email, push PWA).

## Fase 3: Inteligência Avançada (Concluído)
- [x] **Análise de Sentimento**: Analise automatica de conversas via Gemini (score de sentimento + qualidade + resumo).
- [x] **Predictive Sales**: Score de probabilidade de fechamento (0-100) por lead ativo.
- [x] **Dashboard em Tempo Real**: Graficos de barras por agente, KPIs por equipe, rankings de vendas.

## Fase 4: Dashboard Aprimorado (Concluído)
- [x] **KPIs por Equipe**: Cards separados com totais de leads por equipe (Azul/Amarela).
- [x] **Graficos de Barras**: Barras horizontais por agente substituindo pie charts.
- [x] **Pagina de Insights**: Analise de conversas com IA por atendente (sentimento + qualidade + resumo).
- [x] **Tabela de Agentes**: Conversao exibida sem cores (texto simples).

## Melhorias Técnicas (Concluído)
- [x] Paginacao completa de leads e notas na API Kommo.
- [x] Cache de metricas CRM e atividade (TTL 5min) + cache de insights (TTL 1h).
- [x] Log de auditoria de consultas dos gerentes.
- [x] Sistema de notificações (painel + email + push PWA).

## Futuro (Backlog)
- [ ] CI/CD com GitHub Actions
- [ ] Testes automatizados (unit + integration)
- [ ] Rate limiting em endpoints sensíveis
- [ ] App nativo iOS/Android
- [ ] Integração WhatsApp Business API
- [ ] Export de relatórios (PDF/CSV)
- [ ] Gamificação (ranking com badges)
