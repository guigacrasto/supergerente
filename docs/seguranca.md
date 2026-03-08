# Seguranca — SuperGerente

## Implementado

### Autenticação
- [x] JWT via Supabase Auth (tokens assinados)
- [x] Middleware `requireAuth` em todas as rotas protegidas
- [x] Password reset com token de uso único (15min expiry)
- [x] Aprovação manual de novos usuários (status: pending → approved)
- [x] Roles: `user` e `admin`

### Autorização
- [x] RLS (Row Level Security) no Supabase
- [x] Permissões por equipe (azul/amarela)
- [x] Permissões por funil (user_funnel_permissions)
- [x] Permissões por grupo (settings key)
- [x] Pipeline visibility (admin controla)
- [x] Rotas admin-only no backend

### Dados
- [x] Env vars para todos os secrets (nunca no código)
- [x] `.env` no `.gitignore`
- [x] `.env.example` atualizado
- [x] Service role key apenas no backend (nunca no frontend)
- [x] OAuth tokens no banco (token_store) com refresh automático

### Infraestrutura
- [x] HTTPS via Railway (automático)
- [x] CORS configurável via env var
- [x] Health check endpoint

## Pendente

### Alta Prioridade
- [ ] **Rate limiting** em endpoints de auth (login, forgot-password)
- [ ] **Rate limiting** em endpoints de chat (Gemini API)
- [ ] **CSRF protection** para operações de escrita
- [ ] **Input validation** com zod em todas as rotas

### Média Prioridade
- [ ] **Audit logging** — registrar ações admin (quem fez o quê)
- [ ] **Session timeout** — expirar sessão após inatividade
- [ ] **2FA** para contas admin
- [ ] **Helmet.js** — headers de segurança (X-Frame-Options, CSP, etc.)

### Baixa Prioridade
- [ ] **IP allowlist** para painel admin
- [ ] **Brute force protection** (lockout após N tentativas)
- [ ] **Security headers audit** (Lighthouse/Observatory)

## Checklist Pre-Deploy

- [x] `.env` está no `.gitignore`?
- [x] `.env.example` existe e está atualizado?
- [ ] Inputs do usuário validados no backend?
- [x] RLS ativo nas tabelas do Supabase?
- [x] CORS restrito aos domínios corretos?
- [ ] Rate limiting configurado?
- [ ] Headers de segurança ativos?

## OWASP Top 10

| Vulnerabilidade | Status |
|----------------|--------|
| Injection (SQL/NoSQL) | Mitigado (Supabase SDK parametriza) |
| Broken Auth | Parcial (falta rate limit + 2FA) |
| Sensitive Data Exposure | OK (secrets em env vars) |
| XXE | N/A (não processa XML) |
| Broken Access Control | OK (RLS + middleware) |
| Security Misconfiguration | Parcial (falta helmet) |
| XSS | Parcial (React auto-escapa, mas falta CSP) |
| Insecure Deserialization | N/A |
| Known Vulnerabilities | Monitorar npm audit |
| Insufficient Logging | Pendente (falta audit log) |
