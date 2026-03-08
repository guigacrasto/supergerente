# Design: 3 Features Finais — SuperGerente

**Data:** 2026-03-08
**Status:** Aprovado

---

## Feature 1: Log de Auditoria

### Database
```sql
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL,        -- 'login', 'view_dashboard', 'admin_action', 'chat_message', etc.
  resource TEXT,               -- '/api/reports/summary', '/api/chat', etc.
  method TEXT,                 -- 'GET', 'POST', 'PATCH', etc.
  details JSONB DEFAULT '{}',  -- request params, body summary, etc.
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

### Backend
- **Middleware:** `src/api/middleware/auditLog.ts` — intercepta requests autenticados e salva no Supabase
- **Endpoint:** `GET /api/admin/audit-logs?userId=X&action=Y&from=Z&to=W&page=1&limit=50`
- **Cleanup:** Cron-like (setInterval) a cada 24h para deletar logs > 90 dias

### Frontend
- Nova aba "Auditoria" no AdminPage
- Tabela com colunas: Usuário, Ação, Recurso, IP, Data/Hora
- Filtros: por usuário, ação, período

---

## Feature 2: Webhooks Kommo + Notificações

### Database
```sql
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  team TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'hot_lead', 'lead_created', 'lead_status_changed'
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',     -- lead_id, pipeline, agent, etc.
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,          -- { p256dh, auth }
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
```

### Backend
- **Webhook endpoint:** `POST /api/webhooks/kommo` (público, validado por secret)
- **Rota de notificações:** `GET /api/notifications` (autenticada) + `PATCH /api/notifications/:id/read`
- **Push:** Package `web-push` com VAPID keys em env vars
- **Email:** Resend para gerente responsável
- **Config admin:** Settings key `hot_lead_statuses` — IDs de status que disparam alerta

### Frontend
- **NotificationBell** no TopBar com badge de unread count
- **NotificationPanel** dropdown com lista de notificações
- **Service Worker:** Registrar push subscription no login
- **Admin:** Config de "status quentes" por pipeline

### Env Vars Novas
```
KOMMO_WEBHOOK_SECRET=your-webhook-secret
VAPID_PUBLIC_KEY=generated-vapid-public
VAPID_PRIVATE_KEY=generated-vapid-private
VAPID_EMAIL=mailto:admin@supergerente.com
```

---

## Feature 3: Predictive Sales

### Score Formula (0-100)
```
score = (
  tempoScore * 0.25 +        // Menos tempo no funil = melhor
  interacaoScore * 0.25 +    // Interação recente = melhor
  engajamentoScore * 0.20 +  // Mais notas/mensagens = melhor
  valorScore * 0.15 +        // Deal value proporcional
  agenteScore * 0.15         // Agente com boa conversão = melhor
)
```

### Backend
- **Service:** `src/api/services/prediction.ts` — calcula score por lead
- **Endpoint:** `GET /api/reports/predictions?team=azul&funil=X&agente=Y`
- **Cache:** Scores calculados no refresh do CRM cache, armazenados in-memory
- **Gemini (opcional):** Para top 10 leads, pedir análise qualitativa

### Frontend
- **Nova página:** `/predictions` (PredictionsPage)
- **Cards por lead:** score com cor (verde >70, amarelo 40-70, vermelho <40)
- **Detalhe:** Breakdown dos fatores ao expandir
- **Filtros:** Equipe, Funil, Agente
- **Sidebar:** Novo link "Previsões" com ícone TrendingUp

---

## Ordem de Implementação

1. **Log de Auditoria** (mais simples, menos dependências)
2. **Webhooks Kommo + Notificações** (middleware, push, email)
3. **Predictive Sales** (requer dados do cache + UI nova)

## Arquivos a Criar/Modificar

### Criar
- `src/api/middleware/auditLog.ts`
- `src/api/routes/webhooks.ts`
- `src/api/routes/notifications.ts`
- `src/api/services/prediction.ts`
- `src/api/services/push.ts`
- `web/src/pages/PredictionsPage.tsx`
- `web/src/components/features/notifications/NotificationBell.tsx`
- `web/src/components/features/notifications/NotificationPanel.tsx`
- `web/src/components/features/predictions/PredictionCard.tsx`
- `web/src/components/features/predictions/ScoreBreakdown.tsx`
- `web/src/components/features/admin/AuditLogTable.tsx`
- `web/src/stores/notificationStore.ts`
- `docs/migrations/007-audit-logs.sql`
- `docs/migrations/008-notifications.sql`

### Modificar
- `src/api/server.ts` — registrar novas rotas
- `src/api/routes/admin.ts` — endpoint de audit logs + config webhooks
- `src/api/cache/crm-cache.ts` — incluir cálculo de scores
- `web/src/App.tsx` — nova rota /predictions
- `web/src/components/layout/Sidebar.tsx` — novo link Previsões
- `web/src/components/layout/TopBar.tsx` — NotificationBell
- `web/src/pages/AdminPage.tsx` — aba Auditoria
- `.env.example` — novas vars
