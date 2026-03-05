# Gfin Fácil — Design Document

**Data:** 2026-03-02
**Status:** Aprovado
**Produto:** Gfin Fácil — Painel de Gestão Financeira & Contábil para BPO Financeiro

---

## 1. Visão Geral

**O que é:** Plataforma SaaS para empresas de BPO Financeiro que gerenciam finanças de múltiplas pequenas empresas de serviços.

**Problema:** Operadores BPO usam planilhas, sistemas contábeis separados e acessos bancários individuais. Perdem tempo conciliando informações e agendando pagamentos manualmente. Sem visão consolidada.

**Diferencial:** Software com gestão de tarefas multi-empresa, onde o operador vê pendências de todos os clientes em um só lugar, com fluxo de aprovação pelo dono da empresa.

**Público-alvo:** PMEs de serviços, faturamento 30k+, 5-30 funcionários. Operado por BPOs que gerenciam 5-15 empresas por operador.

**Concorrentes:** Nibo, Controlle, Bom Controle, Conta Azul, XFin.

---

## 2. Arquitetura Multi-Tenant

```
Organização (BPO)
├── Usuários (operadores, admin)
├── Empresa Cliente 1
│   ├── Contas a Pagar
│   ├── Contas a Receber
│   ├── Fluxo de Caixa
│   ├── Tarefas
│   └── Usuários Externos (dono, contador)
├── Empresa Cliente 2
│   └── ...
└── Empresa Cliente N
```

### Papéis de Acesso

| Papel | Vê | Faz |
|---|---|---|
| **Admin BPO** | Todas as empresas, config, relatórios globais | Tudo + gerenciar operadores e empresas |
| **Operador BPO** | Empresas atribuídas a ele | CRUD financeiro, tarefas, relatórios |
| **Dono da Empresa** | Só a empresa dele | Visualiza dashboards, aprova pagamentos |

### Fluxo de Aprovação

- BPO agenda pagamentos
- Dono da empresa autoriza dentro do sistema (qualquer valor)
- BPO só executa após aprovação

---

## 3. Módulos MVP (Fase 1)

### 3.1 Contas a Pagar
- CRUD de títulos com: fornecedor, valor, vencimento, categoria, centro de custo, anexos
- Status: aberto → agendado → aguardando aprovação → aprovado → pago
- Filtros: período, status, fornecedor, categoria
- Ação "Enviar p/ aprovação" → aparece no painel do dono

### 3.2 Contas a Receber
- CRUD de títulos com: cliente, valor, vencimento, categoria
- Status: pendente → recebido / atrasado / parcial
- Registro de recebimento parcial
- Filtros: período, status, cliente

### 3.3 Fluxo de Caixa
- Visão consolidada AP + AR
- Gráfico de barras: entradas vs saídas (dia/semana/mês)
- Projeção futura baseada em títulos abertos
- Realizado vs projetado
- Tabela detalhada por período

### 3.4 Tarefas
- Misto: auto-geradas + manuais
- Auto-geradas: vencimentos próximos, conciliação pendente, aprovações aguardando
- Manuais: operador ou dono cria livremente
- Agrupamento por empresa ou por data
- Filtros: urgência, tipo, empresa, status
- Clica na tarefa → navega para resolver a pendência

### 3.5 Cadastros
- Clientes (da empresa)
- Fornecedores
- Categorias financeiras
- Centros de custo
- Plano de contas básico

### 3.6 Importação
- Upload de OFX/CSV (extratos bancários)
- Preview dos lançamentos antes de confirmar
- Match automático com categorias existentes
- Histórico de importações

### 3.7 Dashboard
- KPI cards: saldo atual, a receber, a pagar, vencidos
- Gráfico fluxo de caixa 30 dias
- Últimas movimentações
- Tarefas urgentes (widget)

### 3.8 Portal do Dono (visão simplificada)
- Dashboard read-only com KPIs da empresa
- Lista "Aguardando sua aprovação" com Aprovar/Recusar
- Sem acesso a edição de lançamentos

---

## 4. Fase 2 (Pós-MVP)

- Emissão de NF-e/NFS-e (integração SEFAZ/Prefeituras)
- Emissão de boletos
- Cobrança automatizada
- Pagamento via Pix
- Conciliação bancária automática (API bancária via Pluggy/Belvo)
- DRE e relatórios contábeis
- Orçamento/Budget
- Gestão de cartões
- Rateio de despesas
- Leitura automática de documentos (OCR): extratos PDF, NFs, boletos, comprovantes
- Certificado digital (e-CNPJ/e-CPF)
- SPED / ECD / ECF
- Folha de pagamento
- Controle de ativo fixo
- Fechamento mensal contábil
- WhatsApp (alertas e notificações)
- Integração com ERPs existentes
- Integração com sistemas contábeis

---

## 5. Estrutura de Telas

### Sidebar (sempre visível)
```
┌─────────────────┐
│  GFIN FÁCIL     │
│  [Empresa ▼]    │  ← dropdown troca empresa ativa
│─────────────────│
│  ◆ Dashboard    │
│  ◆ Contas Pagar │
│  ◆ Contas Receber│
│  ◆ Fluxo Caixa  │
│  ◆ Tarefas      │
│  ◆ Cadastros    │
│─────────────────│
│  ◆ Importar     │  ← OFX/CSV
│─────────────────│
│  ◇ Relatórios   │  ← fase 2
│  ◇ Config       │
│  ◇ Empresas     │  ← admin only
│  ◇ Usuários     │  ← admin only
└─────────────────┘
```

### Rotas
| Path | Page | Auth |
|---|---|---|
| `/login` | LoginPage | Público |
| `/` | DashboardPage | Protegido |
| `/contas-pagar` | ContasPagarPage | Protegido |
| `/contas-receber` | ContasReceberPage | Protegido |
| `/fluxo-caixa` | FluxoCaixaPage | Protegido |
| `/tarefas` | TarefasPage | Protegido |
| `/cadastros/*` | CadastrosPage (sub-rotas) | Protegido |
| `/importar` | ImportarPage | Protegido |
| `/empresas` | EmpresasPage | Admin |
| `/usuarios` | UsuariosPage | Admin |
| `/config` | ConfigPage | Admin |
| `/aprovacoes` | AprovacoesPage | Dono |

---

## 6. Stack Técnica

- **Frontend:** React 18 + Vite 5 + Tailwind CSS v4 + React Router v6
- **State:** Zustand (stores: auth, companies, accounts, tasks, filters)
- **Backend:** Express + TypeScript
- **Database:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Deploy:** Railway
- **Monorepo:** npm workspaces

### Estrutura do Repositório

```
gfin-facil/
├── package.json              ← workspace root
├── packages/
│   └── shared/               ← tipos, utils, constantes
│       ├── types/
│       └── utils/
├── apps/
│   ├── api/                  ← backend Express
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── middleware/   ← auth, rls, audit-log
│   │   │   └── jobs/        ← tarefas auto-geradas (cron)
│   │   └── package.json
│   └── web/                  ← frontend React
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/
│       │   │   ├── layout/
│       │   │   └── features/
│       │   ├── pages/
│       │   ├── stores/
│       │   ├── hooks/
│       │   ├── lib/
│       │   └── types/
│       └── package.json
├── supabase/
│   ├── migrations/
│   └── seed.sql
└── docs/
    └── plans/
```

---

## 7. Segurança

- **Auth:** Supabase Auth (email/senha, magic link futuro)
- **RLS:** Toda query filtrada por `organization_id` no Postgres
- **JWT:** Payload com `org_id` + `role` + `company_ids[]`
- **Audit:** Trigger automático no Postgres para log de alterações
- **LGPD:** Dados sensíveis criptografados, endpoints de export/delete

---

## 8. Modelo de Dados (Principais Tabelas)

```sql
-- Organizações (BPOs)
organizations (id, name, slug, created_at)

-- Empresas clientes
companies (id, org_id, name, cnpj, regime_tributario, status, created_at)

-- Usuários
users (id, org_id, email, name, role, created_at)  -- role: admin, operator, owner

-- Vínculo usuário ↔ empresas
user_companies (user_id, company_id, role)

-- Contas a Pagar
payables (id, company_id, supplier_id, description, amount, due_date, paid_date, status, category_id, cost_center_id, approval_status, approved_by, attachments, created_by, created_at, updated_at)

-- Contas a Receber
receivables (id, company_id, customer_id, description, amount, due_date, received_date, received_amount, status, category_id, created_by, created_at, updated_at)

-- Fornecedores
suppliers (id, company_id, name, cnpj_cpf, contact, created_at)

-- Clientes (da empresa)
customers (id, company_id, name, cnpj_cpf, contact, created_at)

-- Categorias
categories (id, company_id, name, type, parent_id, created_at)  -- type: income/expense

-- Centros de custo
cost_centers (id, company_id, name, code, active, created_at)

-- Tarefas
tasks (id, company_id, title, description, type, priority, status, due_date, assigned_to, source, source_id, created_by, created_at, completed_at)
-- type: payment, receivable, reconciliation, custom
-- source: auto, manual

-- Importações
imports (id, company_id, file_name, file_type, status, records_count, imported_by, created_at)

-- Audit log
audit_logs (id, org_id, company_id, user_id, table_name, record_id, action, old_data, new_data, created_at)
```

---

## 9. Regimes Tributários Suportados

- Simples Nacional
- Lucro Presumido
- Lucro Real
- MEI

---

## 10. Integrações (Roadmap)

### MVP
- Import/Export OFX e CSV

### Fase 2
- Bancos via agregador (Pluggy/Belvo)
- SEFAZ (NF-e)
- Prefeituras (NFS-e)
- Gateway de pagamento
- WhatsApp (alertas)
- ERPs existentes
- Sistemas contábeis

### Bancos prioritários
Banco do Brasil, Bradesco, Itaú, Santander, Caixa, Cora, Nubank, Inter, BTG

---

## 11. Compliance

- LGPD para dados dos clientes
- Normas do CFC para escrituração contábil
- Obrigações acessórias da Receita Federal (SPED, DCTF, EFD) — fase 2
- Legislação estadual/municipal para notas fiscais — fase 2
- Certificado digital (e-CNPJ/e-CPF) — fase 2
- Todo lançamento com log de quem fez e quando

---

## 12. Modelo de Negócio

- **Monetização:** A definir (SaaS provável, concorrentes a partir de R$79/mês)
- **Multi-tenant:** Sim, cada BPO é um tenant
- **Concorrentes:** Nibo, Controlle, Bom Controle, Conta Azul, XFin
