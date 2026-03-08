# Deploy — SuperGerente

## Ambiente de Produção

| Serviço | Plataforma | URL |
|---------|-----------|-----|
| **Backend + Frontend** | Railway | Auto-deploy on push to `main` |
| **Database** | Supabase | PostgreSQL + Auth + RLS |
| **Email** | Resend | Transacional (reset senha, boas-vindas) |

## Build

```bash
# Build completo (backend + frontend)
npm run build

# Isso executa:
# 1. npm install --prefix web     → deps frontend
# 2. npm run build --prefix web   → Vite build → web/dist/
# 3. tsc                          → TypeScript → build/api/
```

## Deploy Railway

### Setup Inicial (1x)

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Linkar projeto
railway link

# Configurar env vars
railway variables set KOMMO_SUBDOMAIN=xxx
railway variables set KOMMO_CLIENT_ID=xxx
railway variables set KOMMO_CLIENT_SECRET=xxx
railway variables set KOMMO_ACCESS_TOKEN=xxx
railway variables set GEMINI_API_KEY=xxx
railway variables set SUPABASE_URL=xxx
railway variables set SUPABASE_SERVICE_KEY=xxx
railway variables set RESEND_API_KEY=xxx
railway variables set RESEND_FROM_EMAIL=xxx
railway variables set APP_URL=https://xxx.up.railway.app
railway variables set CORS_ORIGINS=https://xxx.up.railway.app
```

### Deploy

```bash
# Push para main → deploy automático
git push origin main

# Ou deploy manual
railway up
```

### Verificar

```bash
# Logs
railway logs

# Health check
curl https://xxx.up.railway.app/health
# Retorna { ok: true } quando cache está quente
```

## Fluxo de Deploy

```
Código → Build local (npm run build) → Testes → Push GitHub → Railway auto-deploy → /health OK
```

## Health Check

- Endpoint: `GET /health`
- Retorna `503` até cache do CRM estar quente (~30s após start)
- Retorna `200 { ok: true }` quando pronto
- Railway usa isso para determinar quando o container está saudável

## White-Label Deploy

Para deploy de nova instância white-label:

```bash
# Rodar script interativo
bash scripts/setup-whitelabel.sh

# Ele vai:
# 1. Pedir nome da marca, cores, subdomain Kommo
# 2. Gerar .env com configuração
# 3. Criar tabelas no Supabase (migrations)
# 4. Buildar frontend com branding personalizado
```

Ver `docs/white-label-guide.md` para guia completo.

## Rollback

```bash
# Via Railway CLI
railway rollback

# Ou reverter commit e push
git revert HEAD
git push origin main
```

## Domínio Customizado

```bash
# Adicionar domínio no Railway
railway domain add supergerente.com.br

# Configurar DNS:
# CNAME → xxx.up.railway.app
```
