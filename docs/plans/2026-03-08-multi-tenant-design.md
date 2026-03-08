# Design: Multi-Tenant — SuperGerente

**Data:** 2026-03-08
**Status:** Aprovado

---

## Contexto

SuperGerente precisa suportar 20+ clientes (empresas diferentes, cada uma com Kommo CRM próprio, gerentes isolados). Arquitetura escolhida: **Single DB com tenant_id + RLS** (Supabase).

- Login único em `supergerente.com/login`
- 1 usuário = 1 tenant (exceto super-admin que vê todos)
- Cada tenant tem credenciais Kommo, equipes, configs e dados isolados

## 1. Modelo de Dados

### Tabela `tenants` (nova)

```sql
tenants (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  slug                    TEXT UNIQUE NOT NULL,
  logo_url                TEXT,
  primary_color           TEXT DEFAULT '#9566F2',
  kommo_base_url          TEXT,
  kommo_access_token      TEXT,
  kommo_refresh_token     TEXT,
  kommo_token_expires_at  TIMESTAMPTZ,
  webhook_secret          TEXT,
  settings                JSONB DEFAULT '{}',
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT now()
)
```

### Alterações em tabelas existentes

- `users` → adicionar `tenant_id UUID REFERENCES tenants(id)` + `role TEXT DEFAULT 'user'` (valores: user, admin, superadmin)
- `audit_logs` → adicionar `tenant_id UUID REFERENCES tenants(id)`
- `notifications` → adicionar `tenant_id UUID REFERENCES tenants(id)`
- `push_subscriptions` → adicionar `tenant_id UUID REFERENCES tenants(id)`

### RLS Policies

Todas as tabelas com tenant_id recebem:
- Policy `tenant_isolation`: `USING (tenant_id = current_user_tenant_id())`
- Policy `superadmin_bypass`: `USING (current_user_role() = 'superadmin')`

## 2. Fluxo de Auth

1. Login em `supergerente.com/login` (Supabase Auth existente)
2. Middleware `requireAuth` busca `user.tenant_id` e `user.role`
3. Injeta `req.user = { id, email, name, role, tenantId, tenant }` onde `tenant` = objeto completo da tabela `tenants`
4. Frontend recebe tenant no login e armazena no `authStore`

### Roles

| Role | Acesso |
|------|--------|
| `user` | Dashboard, Chat, Agents, Alerts, Predictions, DDD |
| `admin` | Tudo acima + Admin do tenant |
| `superadmin` | Tudo acima + `/super` (gestão de tenants) |

## 3. Super-Admin

### Página `/super`
- Tabela de tenants (nome, slug, status, qtd users, última atividade)
- CRUD tenant (criar, editar, ativar/desativar)
- Métricas globais (total tenants, total users, tenants ativos)

### Tenant Switcher (TopBar)
- Só aparece para `superadmin`
- Dropdown com lista de tenants
- Ao trocar: seta `activeTenantId` no store → API envia header `X-Tenant-Id`
- Backend aceita `X-Tenant-Id` apenas de superadmin

### Criar novo tenant
1. Super-admin preenche form (nome, slug, credenciais Kommo)
2. Sistema cria registro em `tenants`
3. Cria primeiro user admin do tenant
4. Envia email de boas-vindas

## 4. Impacto no Código

### Backend — Modificações

| Arquivo | Mudança |
|---------|---------|
| `src/config.ts` | Remover Kommo tokens hardcoded |
| `src/api/middleware/requireAuth.ts` | Injetar tenantId e tenant object |
| `src/api/middleware/auditLog.ts` | Adicionar tenant_id no log |
| `src/api/services/kommo-service.ts` | Receber tenantConfig como parâmetro |
| `src/api/services/crm-cache.ts` | Cache keyed por tenantId |
| `src/api/routes/reports.ts` | Usar req.user.tenant para Kommo |
| `src/api/routes/admin.ts` | Filtrar por tenant_id |
| `src/api/routes/webhooks.ts` | Lookup tenant pelo webhook secret |
| `src/api/routes/notifications.ts` | Filtrar por tenant_id |
| `src/api/routes/chat.ts` | Contexto IA com dados do tenant |

### Backend — Novos

| Arquivo | Propósito |
|---------|-----------|
| `src/api/routes/super.ts` | CRUD tenants, métricas globais |
| `src/api/middleware/requireSuperAdmin.ts` | Guard para rotas /super |

### Frontend — Modificações

| Arquivo | Mudança |
|---------|---------|
| `web/src/stores/authStore.ts` | Adicionar tenant, activeTenantId |
| `web/src/lib/api.ts` | Interceptor X-Tenant-Id header |
| `web/src/components/layout/TopBar.tsx` | Tenant switcher + nome tenant |
| `web/src/App.tsx` | Rota /super + guard |

### Frontend — Novos

| Arquivo | Propósito |
|---------|-----------|
| `web/src/pages/SuperAdminPage.tsx` | Painel gestão tenants |
| `web/src/components/features/super/TenantTable.tsx` | Tabela CRUD |
| `web/src/components/features/super/TenantSwitcher.tsx` | Dropdown switcher |
| `web/src/components/features/super/TenantForm.tsx` | Form criar/editar |

### Migration

`docs/migrations/009-multi-tenant.sql`:
1. Criar tabela `tenants`
2. Inserir tenant "default" com credenciais Kommo atuais
3. Adicionar `tenant_id` nas tabelas existentes
4. Atualizar registros existentes com `tenant_id = default`
5. Setar user do dono como `role = 'superadmin'`
6. Criar RLS policies

## 5. Estratégia de Migração

- Zero downtime: criar tenant "default" com tudo que já existe
- Todos os users existentes recebem `tenant_id = default_tenant_id`
- User do dono recebe `role = 'superadmin'`
- Sistema continua funcionando exatamente igual após migration
