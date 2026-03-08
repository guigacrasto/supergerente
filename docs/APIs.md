# APIs — SuperGerente

## Base URL

- **Local:** `http://localhost:3000`
- **Produção:** `https://xxx.up.railway.app`

## Autenticação

Todas as rotas protegidas exigem header:
```
Authorization: Bearer <jwt_token>
```

Token obtido via `POST /api/auth/login`.

---

## Endpoints

### Auth (`/api/auth`)

| Método | Endpoint | Auth | Body/Params | Resposta |
|--------|----------|------|-------------|----------|
| `POST` | `/register` | Não | `{ email, password, name }` | `{ user, message }` |
| `POST` | `/login` | Não | `{ email, password }` | `{ token, user }` |
| `POST` | `/forgot-password` | Não | `{ email }` | `{ message }` |
| `POST` | `/reset-password` | Não | `{ token, password }` | `{ message }` |
| `GET` | `/profile` | Sim | — | `{ user }` |
| `PATCH` | `/profile` | Sim | `{ name?, phone? }` | `{ user }` |
| `PATCH` | `/password` | Sim | `{ currentPassword, newPassword }` | `{ message }` |

### Chat (`/api/chat`)

| Método | Endpoint | Auth | Body/Params | Resposta |
|--------|----------|------|-------------|----------|
| `GET` | `/mentors` | Sim | — | `[ { id, name, description } ]` |
| `POST` | `/` | Sim | `{ message, sessionId?, mentorIds? }` | `{ response, sessionId }` |

**Modos de chat:**
- Sem mentorIds → resposta genérica com contexto CRM
- 1 mentorId → mentor específico responde
- 2+ mentorIds → "conselho" (cada mentor responde + síntese)

### Reports (`/api/reports`)

| Método | Endpoint | Auth | Params | Resposta |
|--------|----------|------|--------|----------|
| `GET` | `/summary` | Sim | `?team=azul&filter={json}` | KPIs + métricas filtradas |

**Filtros disponíveis (JSON):**
```json
{
  "tags": ["tag1", "tag2"],
  "funil": "nome-do-funil",
  "agente": "nome-do-agente",
  "group": "nome-do-grupo",
  "from": "2026-01-01",
  "to": "2026-03-08"
}
```

### Pipelines (`/api/pipelines`)

| Método | Endpoint | Auth | Resposta |
|--------|----------|------|----------|
| `GET` | `/` | Sim | Lista de pipelines filtrada por equipe + visibilidade |

### Leads (`/api/leads`)

| Método | Endpoint | Auth | Params | Resposta |
|--------|----------|------|--------|----------|
| `GET` | `/new/:pipelineId` | Sim | `?from=<ts>&to=<ts>` | Leads novos no pipeline |

### Insights (`/api/insights`) — Admin Only

| Método | Endpoint | Auth | Params | Resposta |
|--------|----------|------|--------|----------|
| `GET` | `/filters` | Admin | `?team=azul` | Filtros disponíveis (funis, agentes) |
| `GET` | `/conversations` | Admin | `?team=azul&funil=X&agente=Y` | Análise de conversas com Gemini |
| `POST` | `/refresh` | Admin | `?team=azul&funil=X&agente=Y` | Force refresh (rate-limit 5min) |

### Admin (`/api/admin`) — Admin Only

| Método | Endpoint | Auth | Body | Resposta |
|--------|----------|------|------|----------|
| `GET` | `/pipelines` | Admin | — | Pipelines com status de pausa |
| `POST` | `/pipelines/pause` | Admin | `{ pipelineId, paused }` | Toggle pausa |
| `GET` | `/groups` | Admin | — | Grupos Kommo por equipe |
| `GET` | `/users` | Admin | — | Todos os usuários + permissões |
| `PATCH` | `/users/:id/funnels` | Admin | `{ team, funnels[] }` | Permissões de funil |
| `PATCH` | `/users/:id/groups` | Admin | `{ team, groups[] }` | Permissões de grupo |
| `PATCH` | `/users/:id/teams` | Admin | `{ teams[] }` | Acesso a equipes |

### Super Admin (`/api/super`) — SuperAdmin Only

| Método | Endpoint | Auth | Body/Params | Resposta |
|--------|----------|------|-------------|----------|
| `GET` | `/tenants` | SuperAdmin | — | `{ tenants: [{ id, name, slug, ... userCount }] }` |
| `GET` | `/tenants/:id` | SuperAdmin | — | `{ tenant }` |
| `POST` | `/tenants` | SuperAdmin | `{ name, slug, primaryColor?, kommoBaseUrl?, isActive? }` | `{ tenant }` |
| `PATCH` | `/tenants/:id` | SuperAdmin | `{ name?, slug?, primaryColor?, ... }` | `{ tenant }` |
| `GET` | `/stats` | SuperAdmin | — | `{ totalTenants, activeTenants, totalUsers }` |

### Webhooks (`/api/webhooks`)

| Método | Endpoint | Auth | Body | Resposta |
|--------|----------|------|------|----------|
| `POST` | `/kommo` | Header `X-Webhook-Secret` | Evento Kommo | `{ ok: true }` |

### Notifications (`/api/notifications`)

| Método | Endpoint | Auth | Body/Params | Resposta |
|--------|----------|------|-------------|----------|
| `GET` | `/` | Sim | `?limit=20` | Lista de notificações do usuário |
| `PATCH` | `/:id/read` | Sim | — | Marca notificação como lida |
| `POST` | `/read-all` | Sim | — | Marca todas como lidas |
| `POST` | `/subscribe` | Sim | `{ subscription }` | Registra push subscription |

### Multi-Tenant Headers

Todas as rotas autenticadas suportam:
```
X-Tenant-Id: <tenant-uuid>
```
Apenas superadmin pode enviar este header para trocar contexto de tenant.

### Health

| Método | Endpoint | Auth | Resposta |
|--------|----------|------|----------|
| `GET` | `/health` | Não | `{ ok: true }` (200) ou 503 se cache frio |

---

## Integrações Externas

### Kommo CRM API v4

- **Base:** `https://{subdomain}.kommo.com/api/v4/`
- **Auth:** OAuth 2.0 (access_token + refresh_token)
- **Endpoints usados:** leads, contacts, pipelines, users, events
- **Rate limit:** 7 req/s por conta

### Google Gemini 2.5 Flash

- **SDK:** `@google/generative-ai`
- **Modelo:** `gemini-2.5-flash`
- **Uso:** Chat com mentores + análise de conversas

### Supabase

- **SDK:** `@supabase/supabase-js`
- **Uso:** Auth (JWT), Database (PostgreSQL), RLS

### Resend

- **SDK:** `resend`
- **Uso:** Email transacional (reset senha, boas-vindas, aprovação)
