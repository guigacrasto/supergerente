# WhatsApp Routing — Design Doc

**Data:** 2026-03-17
**Tenant:** GAME
**Status:** Aprovacao pendente

## Objetivo

Quando um lead entra pelo WhatsApp pessoal de um agente no Kommo, o round robin distribui para qualquer agente. Apos 5 minutos, o sistema corrige automaticamente reatribuindo o lead, contato e empresa para o agente dono daquele numero WhatsApp.

## Fluxo

```
1. Agente cadastra seu WhatsApp na tela /whatsapp
   -> Supabase: whatsapp_numbers (tenant_id, user_id, team, phone, kommo_source_name)

2. Lead entra via WhatsApp pessoal no Kommo
   -> Webhook POST /api/webhooks/kommo (leads.add)
   -> handleLeadCreated() detecta novo lead

3. Agenda roteamento para 5 min depois
   -> scheduleWhatsAppRouting(leadId, pipelineId, tenantId, team)
   -> setTimeout(300_000) + backup em Supabase (whatsapp_routing_queue)

4. Apos 5 min, executa roteamento:
   a. GET /leads/{id}?with=contacts -> pega lead completo
   b. Extrai custom_fields_values do lead -> procura campo com "fonte" ou source
   c. Cruza a fonte com whatsapp_numbers por kommo_source_name
   d. Se match E responsible_user_id != dono do numero:
      - PATCH /leads -> responsible_user_id = agente dono
      - PATCH /contacts/{id} -> responsible_user_id = agente dono
      - PATCH /companies/{id} -> responsible_user_id = agente dono (se existir)
   e. Loga em whatsapp_routing_logs (Supabase)

5. Catch-up no startup do server:
   -> Busca whatsapp_routing_queue com status "pending" e scheduled_at < now()
   -> Processa os que ficaram pendentes (protecao contra restart)
```

## Banco de Dados (Supabase)

### Tabela `whatsapp_numbers`

```sql
CREATE TABLE whatsapp_numbers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  team TEXT NOT NULL,
  phone TEXT NOT NULL,
  kommo_source_name TEXT,
  kommo_user_id INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_whatsapp_numbers_unique
  ON whatsapp_numbers (tenant_id, phone);
```

### Tabela `whatsapp_routing_queue`

```sql
CREATE TABLE whatsapp_routing_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  team TEXT NOT NULL,
  lead_id INTEGER NOT NULL,
  pipeline_id INTEGER,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_routing_queue_pending
  ON whatsapp_routing_queue (status, scheduled_at)
  WHERE status = 'pending';
```

### Tabela `whatsapp_routing_logs`

```sql
CREATE TABLE whatsapp_routing_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  team TEXT NOT NULL,
  lead_id INTEGER NOT NULL,
  lead_name TEXT,
  from_user_id INTEGER,
  to_user_id INTEGER,
  to_user_name TEXT,
  phone_matched TEXT,
  source_name TEXT,
  routed_at TIMESTAMPTZ DEFAULT now()
);
```

## Backend

### `src/api/routes/whatsapp.ts` (NOVO)

Router com 4 endpoints:

- **`GET /api/whatsapp/numbers`** — Lista numeros do tenant (filtrado por team do user, admin ve todos)
- **`POST /api/whatsapp/numbers`** — Cadastra numero (qualquer user cadastra o proprio)
  - Body: `{ phone, kommo_source_name?, kommo_user_id? }`
  - Usa `req.tenantId`, `req.userId`
- **`DELETE /api/whatsapp/numbers/:id`** — Remove numero (proprio ou admin)
- **`GET /api/whatsapp/logs`** — Lista logs de roteamento (ultimos 50, filtrado por team)

### `src/services/whatsapp-router.ts` (NOVO)

```typescript
export class WhatsAppRouter {
  // Agenda roteamento 5 min no futuro
  static async schedule(leadId, pipelineId, tenantId, team): Promise<void>

  // Executa a logica de match + reatribuicao
  static async processRouting(queueItem): Promise<void>

  // Catch-up: processa itens pendentes no startup
  static async processPendingQueue(): Promise<void>
}
```

Logica de `processRouting`:
1. Busca lead completo via `getLeadDetails(leadId)` com contacts
2. Extrai `custom_fields_values` do lead -> procura campo "fonte", "source", "canal", "origin"
3. Busca `whatsapp_numbers` do tenant/team com `active = true`
4. Match por `kommo_source_name` (nome da integracao) OU `phone` (se tiver no CF)
5. Se match e `responsible_user_id` diferente -> PATCH lead + contacts + companies
6. Loga resultado em `whatsapp_routing_logs`

### `src/services/kommo.ts` (+3 metodos)

```typescript
async updateLeadResponsible(leadId: number, userId: number): Promise<void>
async updateContactResponsible(contactId: number, userId: number): Promise<void>
async updateCompanyResponsible(companyId: number, userId: number): Promise<void>
```

### `src/api/routes/webhooks.ts` (MODIFICADO)

Adiciona ao `handleLeadCreated`:
- Identifica tenant pelo webhook (query param `?team=azul` ou header)
- Chama `WhatsAppRouter.schedule(lead.id, lead.pipeline_id, tenantId, team)`

### `src/api/server.ts` (MODIFICADO)

```typescript
import { whatsappRouter } from "./routes/whatsapp.js";
app.use("/api/whatsapp", requireAuth as any, whatsappRouter());
```

Startup: chama `WhatsAppRouter.processPendingQueue()` para catch-up.

## Frontend

### `web/src/pages/WhatsAppPage.tsx` (NOVO)

```
WhatsAppPage
+-- Header ("WhatsApp Routing" + descricao)
+-- Card: Cadastrar Numero
|   +-- Input telefone (+55...)
|   +-- Input nome da fonte no Kommo (opcional)
|   +-- Botao "Cadastrar"
+-- Tabela: Meus Numeros
|   +-- Telefone | Fonte Kommo | Status | Acoes (remover)
|   +-- Se admin: ve todos os numeros do tenant
+-- Divider
+-- Tabela: Ultimos Roteamentos (logs)
    +-- Data | Lead | De -> Para | Telefone | Fonte
```

### `web/src/App.tsx` (MODIFICADO)

```tsx
<Route path="/whatsapp" element={<WhatsAppPage />} />
```

### `web/src/components/layout/Sidebar.tsx` (MODIFICADO)

```tsx
{ to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle }
```

## Deteccao da Fonte (campo Kommo)

O campo "Fonte" no Kommo eh um custom field do lead. Para ser robusto:

1. Na tela de cadastro, o agente informa o **nome exato da fonte** como aparece no Kommo
2. No processamento, o sistema busca em `custom_fields_values` do lead por campos que contenham "fonte", "source", "canal", "origin"
3. Compara o valor encontrado com `kommo_source_name` cadastrado
4. Fallback: extrai telefone do contato e compara com `phone` cadastrado

## Arquivos

| Arquivo | Acao |
|---|---|
| SQL (3 tabelas) | **Novo** — rodar no Supabase |
| `src/api/routes/whatsapp.ts` | **Novo** — CRUD + logs |
| `src/services/whatsapp-router.ts` | **Novo** — logica de roteamento |
| `src/services/kommo.ts` | +3 metodos update responsible |
| `src/api/routes/webhooks.ts` | +schedule no handleLeadCreated |
| `src/api/server.ts` | +import, +app.use, +startup catch-up |
| `web/src/pages/WhatsAppPage.tsx` | **Novo** — tela completa |
| `web/src/App.tsx` | +Route /whatsapp |
| `web/src/components/layout/Sidebar.tsx` | +item WhatsApp |

## O que NAO muda

- Nenhuma tela existente
- Cache CRM existente
- Rotas de reports/metricas
- Middleware de auth (webhook continua publico)
- Embalaqui tenant (apenas adicionar `/whatsapp` ao hiddenPages)

## Verificacao

1. Criar 3 tabelas no Supabase
2. `npx tsc --noEmit` em backend e frontend — zero erros
3. Abrir /whatsapp -> cadastrar numero -> aparecer na tabela
4. Simular webhook lead.add -> verificar que item aparece na queue
5. Apos 5 min -> lead reatribuido no Kommo + log na tela
6. Restart server -> catch-up processa itens pendentes
7. Sidebar mostra "WhatsApp" para GAME, oculto para Embalaqui
