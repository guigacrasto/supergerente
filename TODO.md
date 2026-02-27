# TODO - Próximos Passos (Evolução)

Este documento mapeia o futuro do **Kommo MCP Agent** para permitir o uso descentralizado pelos gerentes.

## 🏁 Fase 1: Estabilização e Documentação (Concluído)
- [x] Scripts de relatórios para Tryvion e Matriz.
- [x] Mapeamento de agentes vs funis.
- [x] Documentação base (README, Manual).

## ☁️ Fase 2: Cloud e Interface (Próximo Passo)
- [ ] **Hospedagem do Servidor**: Migrar o servidor MCP para um ambiente Node.js na nuvem (ex: Railway, Vercel ou VPS).
- [ ] **Interface de Chat Web**: Criar um site simples (Next.js/React) que se conecte ao agente para que os gerentes possam perguntar via browser.
- [ ] **Integração Automação**: Criar webhooks no Kommo para alertar o agente sobre novos leads "quentes".

## 📈 Fase 3: Inteligência Avançada
- [ ] **Análise de Sentimento**: Integrar com LLM para ler o histórico de notas e dizer se o atendimento está "positivo" ou "negativo".
- [ ] **Predictive Sales**: Calcular probabilidade de fechamento com base no histórico do lead.
- [ ] **Dashboard em Tempo Real**: Transformar os scripts de terminal em gráficos visuais.

## ⚙️ Melhorias Técnicas
- [ ] Implementar paginação completa (atualmente limitada a amostras de ~1000 leads).
- [ ] Cache de usuários e pipelines para reduzir chamadas de API.
- [ ] Log de auditoria de consultas dos gerentes.
