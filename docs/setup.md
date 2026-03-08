# Setup — SuperGerente

## Requisitos

- Node.js v20+
- npm
- Conta Supabase (free tier OK)
- Conta Kommo CRM com integração OAuth
- API key do Google Gemini
- Conta Resend (free tier OK)

## Passo a Passo

### 1. Clonar o repositório

```bash
git clone <repo-url>
cd supergerente
```

### 2. Instalar dependências

```bash
# Backend
npm install

# Frontend
npm install --prefix web
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Editar .env com seus valores
```

**Variáveis obrigatórias:**
- `SUPABASE_URL` — URL do projeto Supabase
- `SUPABASE_SERVICE_KEY` — Service role key do Supabase
- `KOMMO_SUBDOMAIN` — Subdomain da conta Kommo
- `KOMMO_CLIENT_ID` — Client ID da integração Kommo
- `KOMMO_CLIENT_SECRET` — Client Secret da integração
- `KOMMO_ACCESS_TOKEN` — Access token inicial
- `GEMINI_API_KEY` — API key do Google Gemini
- `RESEND_API_KEY` — API key do Resend
- `RESEND_FROM_EMAIL` — Email de envio verificado

**Variáveis opcionais:**
- `KOMMO_AMARELA_*` — Se tiver segunda equipe
- `VITE_APP_NAME` — Nome customizado (default: SuperGerente)
- `PORT` — Porta do servidor (default: 3000)

### 4. Configurar Supabase

1. Criar projeto no Supabase
2. Rodar migrations:
```bash
# As migrations estão em docs/migrations/
# Executar no SQL Editor do Supabase
```
3. Verificar que RLS está ativo nas tabelas
4. Criar primeiro admin:
```sql
-- Após o usuário se registrar, promover a admin:
UPDATE profiles SET role = 'admin', status = 'approved' WHERE email = 'seu@email.com';
```

### 5. Configurar Kommo CRM

1. Acessar Kommo → Configurações → Integrações
2. Criar nova integração
3. Configurar redirect URI: `http://localhost:3000/api/oauth/callback`
4. Copiar Client ID, Client Secret e Access Token
5. Adicionar ao `.env`

### 6. Rodar em desenvolvimento

```bash
# Terminal 1 — Backend
npm run dev:web

# Terminal 2 — Frontend (com hot reload)
cd web && npm run dev
```

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173` (proxy para API)

### 7. Build para produção

```bash
npm run build
npm start
```

### 8. Deploy

Ver `docs/deploy.md` para instruções completas de deploy no Railway.

## Estrutura de Pastas

```
supergerente/
├── src/          ← Backend (Express + TypeScript)
├── web/          ← Frontend (React + Vite + Tailwind)
├── build/        ← Backend compilado
├── docs/         ← Documentação
├── scripts/      ← Scripts utilitários
├── admin/        ← Scripts admin
└── packages/     ← Packages compartilhados
```

## Troubleshooting

### Health check retorna 503
- O cache demora ~30s para carregar após start
- Verificar que tokens Kommo estão válidos
- Checar logs: `npm run dev:web`

### Token OAuth expirado
- O sistema faz refresh automático a cada 20h
- Se falhar, obter novo access token no Kommo

### Frontend não conecta ao backend
- Verificar proxy no `vite.config.ts`
- Confirmar que backend está rodando na porta correta
- Checar CORS_ORIGINS no `.env`
