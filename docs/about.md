# About — SuperGerente

## Visão Geral

**SuperGerente** (SG) é uma PWA de gestão comercial inteligente integrada ao Kommo CRM, com chat IA (Google Gemini 2.5 Flash), dashboards em tempo real e sistema de alertas para equipes de vendas.

## Specs Técnicas

### Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 + Vite 5 + Tailwind CSS v4 + React Router v7 + Zustand |
| **Backend** | Node.js 20+ + Express 5 + TypeScript 5 |
| **Database** | Supabase (PostgreSQL + Auth + RLS) |
| **IA** | Google Gemini 2.5 Flash |
| **Email** | Resend |
| **CRM** | Kommo CRM API v4 (OAuth) |
| **Deploy** | Railway (auto-deploy on push to main) |
| **PWA** | vite-plugin-pwa (service worker + manifest) |

### Arquitetura

```
Browser (React PWA)
    ↓ HTTP + JWT
Express Server (Railway)
    ├── Supabase (DB + Auth)
    ├── Kommo CRM (Leads, Pipelines, Agentes)
    ├── Gemini AI (Chat + Análise)
    └── Resend (Email transacional)
```

### Schema do Banco (Supabase)

| Tabela | Propósito |
|--------|-----------|
| `profiles` | Perfis de usuário (role, status, teams) |
| `mentors` | Mentores IA para chat |
| `user_funnel_permissions` | Controle de acesso por funil |
| `settings` | Key-value store (pipelines pausados, grupos) |
| `token_store` | Tokens OAuth do Kommo |
| `token_logs` | Log de uso de tokens Gemini |
| `password_reset_tokens` | Tokens de reset de senha |
| `pipeline_visibility` | Visibilidade de pipelines |

### Multi-Tenant

O sistema é multi-tenant. Cada tenant tem credenciais Kommo, configurações e usuários **isolados**.

**REGRA: Tenants têm features DIFERENTES entre si.** Configurações, labels, automações e páginas visíveis são específicas por tenant. Uma mudança para um tenant NÃO se aplica automaticamente a outro. Sempre verificar o tenant-alvo antes de qualquer alteração.

| Tenant | ID | Slug | Contas Kommo | Admin | Notas |
|--------|-----|------|-------------|-------|-------|
| **GAME** | `1e29dae5-38f2-4ac4-91c3-9189606f36b0` | `game` | `ferramentasempresa001` (azul) + `iadeoperacoes` (amarela) | guilherme@onigroup.com.br | Tenant original. customLabels: vendas→"BT" |
| **Embalaqui** | `bf393e84-2151-4d6e-8b90-7a02c534ad9c` | `embalaqui` | `marketinglojaembalaquicombr` (principal) | embalaqui@onigroup.com.br | hiddenPages: /renda, /profissao, /ddd. dddProibidoEnabled: true |

**Superadmin**: admin@onigroup.com.br (acessa todos os tenants via header `x-tenant-id`)

**Logins para testar cada tenant:**
- GAME: `guilherme@onigroup.com.br`
- Embalaqui: `embalaqui@onigroup.com.br`

### Configurações por Tenant (settings JSON)

| Setting | Tipo | Descrição |
|---------|------|-----------|
| `teams` | `Record<string, TeamConfig>` | Credenciais Kommo por equipe |
| `hiddenPages` | `string[]` | Páginas ocultas na sidebar |
| `customLabels` | `Record<string, string>` | Labels customizados (ex: vendas→"BT") |
| `dddProibidoEnabled` | `boolean` | Automação de fechar leads com DDD proibido |

### White-Label

O sistema suporta white-label via variáveis de ambiente (`VITE_APP_NAME`, `VITE_APP_THEME_COLOR`, etc.) e script de setup interativo (`scripts/setup-whitelabel.sh`).

## Env Vars

Ver `.env.example` para lista completa. Categorias:
- Branding (VITE_APP_*)
- Kommo CRM Azul (KOMMO_*)
- Kommo CRM Amarela (KOMMO_AMARELA_*)
- Gemini AI (GEMINI_API_KEY)
- Supabase (SUPABASE_URL, SUPABASE_SERVICE_KEY)
- Email (RESEND_API_KEY, RESEND_FROM_EMAIL)
- Server (PORT, APP_URL, CORS_ORIGINS)
