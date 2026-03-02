# Admin & Insights Improvements — Design

**Data:** 2026-03-02
**Status:** Aprovado

## Contexto

Quatro melhorias identificadas a partir de uso real do sistema em producao:

1. Insights consome tokens Gemini a cada reload automatico
2. Aba "Usuarios" do admin nao tem botao de refresh manual
3. Admin so ve dados da Equipe Azul (deveria ver todas)
4. Nao existe controle de visibilidade de funis por equipe

---

## 1. Insights — Refresh Manual

**Problema:** A pagina de Insights faz polling automatico a cada 15s enquanto `processing === true`, e qualquer reload dispara analise nova, consumindo tokens Gemini desnecessariamente.

**Solucao:**

- Remover auto-polling ao carregar a pagina
- Adicionar botao "Atualizar Insights" que dispara `POST /insights/refresh`
- Backend: novo endpoint `POST /insights/refresh` que limpa o cache e recalcula
- Apos o clique, ativar polling temporario (15s) ate `processing === false`
- Primeira carga (`GET /insights/conversations`) retorna dados do cache existente sem disparar analise nova

**Fluxo:**
```
Pagina carrega → GET /conversations (cache) → mostra dados existentes
Usuario clica "Atualizar" → POST /refresh → polling 15s ate pronto
```

---

## 2. Admin Usuarios — Botao Refresh

**Problema:** Quando um novo usuario se registra, o admin precisa recarregar a pagina inteira para ver o registro pendente.

**Solucao:**

- Manter carregamento inicial automatico (ja existe)
- Adicionar botao "Atualizar" ao lado do titulo da aba
- Botao chama `fetchUsers()` (ja implementado) com feedback visual (spinner no botao)

---

## 3. Admin — Visibilidade de Todas as Equipes

**Problema:** O admin so ve dados da Equipe Azul no sidebar e dashboard, porque o middleware filtra por `userTeams` do perfil.

**Solucao:**

- No middleware `requireAuth`, se `role === 'admin'`, definir `userTeams = ALL_CONFIGURED_TEAMS`
- Isso ja foi parcialmente feito no commit `4a7f732`, mas verificar se sidebar e dashboard respeitam a lista completa
- Garantir que sidebar mostra pipelines de ambas as equipes
- Dashboard deve agregar metricas de todas as equipes

---

## 4. Visibilidade de Pipelines — Nova Aba Admin

**Problema:** Nao existe forma de controlar quais funis aparecem para cada equipe. Todos os funis retornados pela API Kommo sao exibidos.

**Solucao:**

### Tabela Supabase: `pipeline_visibility`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | ID auto-gerado |
| team | text | Equipe (azul, amarela) |
| pipeline_id | integer | ID do pipeline no Kommo |
| pipeline_name | text | Nome (cache para exibicao) |
| visible | boolean | Se esta visivel (default true) |
| updated_at | timestamptz | Ultima atualizacao |

**Constraint:** UNIQUE(team, pipeline_id)

### Backend

- `GET /admin/pipeline-visibility` — retorna grid completo (busca pipelines da API + merge com tabela)
- `PUT /admin/pipeline-visibility` — atualiza visibilidade `{ team, pipeline_id, visible }`
- `GET /api/pipelines` — filtra resultados pela tabela `pipeline_visibility` (se registro existe e `visible === false`, oculta)
- Admin sempre ve todos os pipelines (bypass do filtro)

### Frontend — Nova aba "Visibilidade"

- Grid com duas colunas: Equipe Azul | Equipe Amarela
- Cada coluna lista os pipelines da equipe com checkbox toggle
- Toggle faz `PUT` imediato (otimistic update)
- Regra de equipe mantida: usuario azul so ve funis azul habilitados, usuario amarelo so ve funis amarela habilitados

### Regras

- Config global (nao per-user) — admin configura uma vez, vale pra todos
- Respeita regra de equipe existente: azul so ve azul, amarelo so ve amarelo
- Admin sempre ve todos (bypass)
- Pipelines novos aparecem como `visible = true` por default (se nao tem registro na tabela, esta visivel)

---

## Decisoes de Arquitetura

- **Cache de pipelines:** Manter cache existente, apenas adicionar filtro de visibilidade na resposta
- **Sem migracao automatica:** SQL executado manualmente no Supabase Dashboard
- **Otimistic UI:** Toggle de visibilidade atualiza UI imediatamente, reverte se erro
- **Backward compatible:** Pipelines sem registro na tabela sao considerados visiveis
