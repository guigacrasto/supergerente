# Monitoring — SuperGerente

## Monitoramento Atual

### Health Check
- **Endpoint:** `GET /health`
- **Resposta OK:** `{ ok: true }` (200)
- **Resposta Down:** 503 (cache não carregado)
- **Usado por:** Railway para determinar readiness do container

### Logs
- **Railway logs:** `railway logs` (CLI)
- **Console:** Backend loga erros, cache refresh, token refresh
- **Token logs:** Tabela `token_logs` no Supabase (uso de IA)

### Cache Monitoring
- Cache CRM: refresh a cada 25min (proativo)
- Cache Activity: 5min TTL
- Cache Insights: 1h TTL
- Token OAuth: refresh proativo a cada 20h

## Pendente

### Alta Prioridade
- [ ] **Sentry** — error tracking (frontend + backend)
- [ ] **Uptime monitoring** — Better Uptime ou UptimeRobot
- [ ] **Alertas** — notificar quando /health retorna 503

### Média Prioridade
- [ ] **APM** — Application Performance Monitoring (latência de endpoints)
- [ ] **Dashboard de uso** — quantos requests/dia, endpoints mais usados
- [ ] **Gemini cost tracking** — monitorar custo diário de tokens
- [ ] **Kommo rate limit tracking** — monitorar proximidade do limite (7 req/s)

### Baixa Prioridade
- [ ] **Log aggregation** — centralizar logs (Datadog, Logflare)
- [ ] **Custom metrics** — tempo de resposta por endpoint
- [ ] **Real-time dashboard** — Grafana ou similar

## Métricas Recomendadas

| Métrica | Tipo | Alerta |
|---------|------|--------|
| Health check status | Uptime | Se 503 por > 5min |
| Response time P95 | Performance | Se > 2s |
| Error rate | Reliability | Se > 5% |
| Gemini token cost/dia | Custo | Se > $5/dia |
| Kommo API rate | Rate limit | Se > 5 req/s |
| Memory usage | Infra | Se > 80% |
| Cache hit ratio | Performance | Se < 90% |

## Scripts de Monitoramento

```bash
# Check health
curl -s https://xxx.up.railway.app/health | jq .

# Railway logs em tempo real
railway logs --follow

# Token usage (Supabase SQL)
# SELECT date_trunc('day', created_at) as dia, SUM(total_tokens) as tokens
# FROM token_logs GROUP BY dia ORDER BY dia DESC LIMIT 7;
```
