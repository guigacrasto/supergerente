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

### Multi-Team

- **Equipe Azul**: Conta Kommo primária (obrigatória)
- **Equipe Amarela**: Conta Kommo secundária (opcional)
- Cada equipe tem suas próprias métricas, funis e agentes

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
