# TODO — SuperGerente v1.0

## Concluído
- [x] Renomear projeto para SuperGerente
- [x] Configurar API Kommo equipe amarela
- [x] Página Diário (leads/vendas/conversão dia/mês + date picker)
- [x] Multi-Tenant Architecture (Single DB + tenant_id + RLS)
  - [x] Migration 009 — tabela tenants + tenant_id em 7 tabelas + RLS
  - [x] Tenant service com CRUD + cache
  - [x] Auth middleware injeta tenant em toda request
  - [x] Todas as rotas filtram por tenant_id
  - [x] KommoService tenant-aware (tokens por tenant)
  - [x] Cache dinâmico (CRM + Activity + Conversation)
  - [x] Super-admin API (/api/super)
  - [x] Frontend: TenantSwitcher, SuperAdminPage, TenantTable, TenantForm
  - [x] Sidebar + routing para /super (superadmin only)
  - [x] Build passa sem erros

## Prioridade Alta

### F01 — Filtro de Tags Global
- [ ] Criar componente global de filtro por Tags (multi-select)
- [ ] Aplicar filtro de Tags em todos os módulos existentes
- [ ] Tags ativas do portfólio, lógica OR, persiste ao trocar aba
- [ ] Exportações incluem coluna Tag quando filtro aplicado

### F02 — Exclusão de Marcas Pausadas
- [ ] Implementar lógica de exclusão de marcas pausadas do relatório geral
- [ ] Recalcular métricas (volume total, taxa conversão, média diária, gráfico distribuição)
- [ ] Toggle "Exibir marcas pausadas" para reativar pontualmente
- [ ] Badge visual diferenciado para marcas pausadas no painel de config

### F03 — Relatório de Tempo Médio de Fechamento (TMF)
- [ ] Criar tela com cards topo: TMF geral, total fechamento dia, total remarketing, % remarketing
- [ ] Tabela por agente: fechamentos_dia, fechamentos_remarketing, TMF_horas, ranking
- [ ] Gráfico barras — fechamento_dia vs remarketing por agente
- [ ] Lógica: fechamento_do_dia (entrada == hoje) vs remarketing (fechamento > entrada + 1 dia)
- [ ] Filtros: período, agente, funil, tag, time
- [ ] Exportação CSV/PDF

### F07 — Dados em Tempo Real
- [ ] Auditoria de endpoints — garantir 100% dos registros sem truncamento
- [ ] Implementar WebSocket/SSE para telas ao vivo (Agentes e Chats)
- [ ] Polling a cada 30s com cache incremental para relatórios
- [ ] Timestamp "Atualizado às HH:MM:SS" em toda tela + spinner discreto
- [ ] Testes de carga com volume real de dados

### F08 — Gestão de Funis por Usuário (Admin)
- [ ] Criar tabela `user_funnel_permissions` (user_id, team, allowed_funnels, updated_by, updated_at)
- [ ] Checkboxes de funis no modal de aprovação de usuário
- [ ] Gestão de funis por usuário no admin (editar/salvar)
- [ ] Backend filtra por funis autorizados (não só frontend)
- [ ] Efeito imediato sem re-login
- [ ] Admin vê todos os funis independente de permissões

## Prioridade Média

### F04 — Tela de Motivos de Perda
- [ ] Criar tela com gráfico pizza/donut + tabela rankada + breakdown por agente
- [ ] Evolução temporal de cada motivo
- [ ] Cadastro de motivos no painel de configurações
- [ ] Campo obrigatório ao mover lead para etapa de perda
- [ ] Filtros: período, agente, funil, tag, time

### F05 — Tela de Renda do Lead
- [ ] Barras horizontais por faixa de renda + taxa conversão por faixa
- [ ] Tabela: faixa, volume, fechamentos, taxa_conversão, ticket_médio
- [ ] Comparativo temporal
- [ ] Faixas configuráveis no admin (até 2k, 2-5k, 5-10k, 10-20k, 20k+, não informado)
- [ ] Filtros: período, agente, funil, tag, time

### F06 — Tela de Profissão do Lead
- [ ] Nuvem de tags ou barras — profissões mais frequentes
- [ ] Tabela rankada + top 10 por fechamentos
- [ ] Cruzamento profissão x faixa_renda
- [ ] Campo Profissão no cadastro de lead (texto livre + autocomplete)
- [ ] Agrupamento automático de profissões similares (admin)
- [ ] Filtros: período, agente, funil, tag, time

## Geral
- [ ] Testes de regressão em todos os relatórios afetados
- [ ] Documentar API de filtros para integrações futuras
