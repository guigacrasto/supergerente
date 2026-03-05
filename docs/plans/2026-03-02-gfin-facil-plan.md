# Gfin Fácil — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the MVP of Gfin Fácil — a multi-tenant BPO Financial management platform with Contas a Pagar, Contas a Receber, Fluxo de Caixa, Tarefas, Cadastros, Importação OFX/CSV, and Dashboard.

**Architecture:** Monorepo with npm workspaces. `apps/api` is an Express + TypeScript backend, `apps/web` is a React + Vite + Tailwind frontend, `packages/shared` holds shared types and utils. Supabase provides PostgreSQL (with RLS), Auth, and Storage. Multi-tenant via `organization_id` on all tables, with `company_id` sub-isolation.

**Tech Stack:** React 18, Vite 5, Tailwind CSS v4, React Router v6, Zustand, CVA, lucide-react, Recharts, Axios, Express 5, TypeScript, Supabase, npm workspaces.

**Design Doc:** `docs/plans/2026-03-02-gfin-facil-design.md`

---

## Task 1: Initialize Monorepo

**Files:**
- Create: `gfin-facil/package.json`
- Create: `gfin-facil/.gitignore`
- Create: `gfin-facil/tsconfig.base.json`
- Create: `gfin-facil/packages/shared/package.json`
- Create: `gfin-facil/packages/shared/tsconfig.json`
- Create: `gfin-facil/packages/shared/src/index.ts`

**Step 1: Create root directory and init git**

```bash
mkdir -p ~/antigravity-gui/gfin-facil
cd ~/antigravity-gui/gfin-facil
git init
```

**Step 2: Create root package.json with workspaces**

```json
{
  "name": "gfin-facil",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "dev:api": "npm run dev -w apps/api",
    "dev:web": "npm run dev -w apps/web",
    "dev": "concurrently \"npm run dev:api\" \"npm run dev:web\"",
    "build:api": "npm run build -w apps/api",
    "build:web": "npm run build -w apps/web",
    "build:all": "npm run build:api && npm run build:web"
  },
  "devDependencies": {
    "concurrently": "^9.2.1",
    "typescript": "^5.7.0"
  }
}
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
build/
.env
.env.local
*.log
.DS_Store
```

**Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 5: Create shared package**

`packages/shared/package.json`:
```json
{
  "name": "@gfin/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

`packages/shared/src/index.ts`:
```ts
export * from './types';
export * from './constants';
```

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: initialize monorepo with npm workspaces"
```

---

## Task 2: Shared Types & Constants

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/constants.ts`

**Step 1: Create all shared TypeScript types**

`packages/shared/src/types.ts`:
```ts
// ── Auth & Users ──

export type UserRole = 'admin' | 'operator' | 'owner';

export interface User {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

// ── Companies ──

export type RegimeTributario = 'simples' | 'lucro_presumido' | 'lucro_real' | 'mei';
export type CompanyStatus = 'active' | 'inactive';

export interface Company {
  id: string;
  org_id: string;
  name: string;
  cnpj: string;
  regime_tributario: RegimeTributario;
  status: CompanyStatus;
  created_at: string;
}

export interface UserCompany {
  user_id: string;
  company_id: string;
  role: UserRole;
}

// ── Payables (Contas a Pagar) ──

export type PayableStatus = 'open' | 'scheduled' | 'awaiting_approval' | 'approved' | 'paid' | 'cancelled';

export interface Payable {
  id: string;
  company_id: string;
  supplier_id: string | null;
  description: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: PayableStatus;
  category_id: string | null;
  cost_center_id: string | null;
  approval_status: 'pending' | 'approved' | 'rejected' | null;
  approved_by: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  supplier?: Supplier;
  category?: Category;
  cost_center?: CostCenter;
}

export interface CreatePayableInput {
  supplier_id?: string;
  description: string;
  amount: number;
  due_date: string;
  category_id?: string;
  cost_center_id?: string;
  notes?: string;
}

// ── Receivables (Contas a Receber) ──

export type ReceivableStatus = 'pending' | 'received' | 'overdue' | 'partial' | 'cancelled';

export interface Receivable {
  id: string;
  company_id: string;
  customer_id: string | null;
  description: string;
  amount: number;
  due_date: string;
  received_date: string | null;
  received_amount: number;
  status: ReceivableStatus;
  category_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  customer?: Customer;
  category?: Category;
}

export interface CreateReceivableInput {
  customer_id?: string;
  description: string;
  amount: number;
  due_date: string;
  category_id?: string;
  notes?: string;
}

// ── Suppliers & Customers ──

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  cnpj_cpf: string | null;
  contact: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  cnpj_cpf: string | null;
  contact: string | null;
  created_at: string;
}

// ── Categories & Cost Centers ──

export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  company_id: string;
  name: string;
  type: CategoryType;
  parent_id: string | null;
  created_at: string;
}

export interface CostCenter {
  id: string;
  company_id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
}

// ── Tasks ──

export type TaskType = 'payment' | 'receivable' | 'reconciliation' | 'custom';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskSource = 'auto' | 'manual';

export interface Task {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  assigned_to: string | null;
  source: TaskSource;
  source_id: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  // Joined
  company?: Company;
}

export interface CreateTaskInput {
  company_id: string;
  title: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  due_date?: string;
  assigned_to?: string;
}

// ── Imports ──

export type ImportStatus = 'processing' | 'completed' | 'failed';
export type ImportFileType = 'ofx' | 'csv';

export interface Import {
  id: string;
  company_id: string;
  file_name: string;
  file_type: ImportFileType;
  status: ImportStatus;
  records_count: number;
  imported_by: string;
  created_at: string;
}

// ── Cash Flow (computed, not stored) ──

export interface CashFlowEntry {
  date: string;
  income: number;
  expense: number;
  balance: number;
  projected: boolean;
}

// ── Dashboard KPIs ──

export interface DashboardKPIs {
  total_receivable: number;
  total_payable: number;
  current_balance: number;
  overdue_count: number;
  pending_approvals: number;
  tasks_today: number;
}

// ── API Response wrapper ──

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}
```

**Step 2: Create constants**

`packages/shared/src/constants.ts`:
```ts
export const STORAGE_KEYS = {
  token: 'gfin_token',
  user: 'gfin_user',
  activeCompany: 'gfin_active_company',
} as const;

export const PAYABLE_STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  scheduled: 'Agendado',
  awaiting_approval: 'Aguardando Aprovação',
  approved: 'Aprovado',
  paid: 'Pago',
  cancelled: 'Cancelado',
};

export const RECEIVABLE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  received: 'Recebido',
  overdue: 'Atrasado',
  partial: 'Parcial',
  cancelled: 'Cancelado',
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  payment: 'Pagamento',
  receivable: 'Recebimento',
  reconciliation: 'Conciliação',
  custom: 'Personalizada',
};

export const REGIME_LABELS: Record<string, string> = {
  simples: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
  mei: 'MEI',
};
```

**Step 3: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types and constants for all MVP modules"
```

---

## Task 3: Supabase Database Migrations

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/seed.sql`

**Step 1: Create the full database schema migration**

`supabase/migrations/001_initial_schema.sql`:
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ══════════════════════════════════
-- ORGANIZATIONS
-- ══════════════════════════════════
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════
-- USERS (extends Supabase auth.users)
-- ══════════════════════════════════
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'owner')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════
-- COMPANIES
-- ══════════════════════════════════
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  cnpj TEXT,
  regime_tributario TEXT CHECK (regime_tributario IN ('simples', 'lucro_presumido', 'lucro_real', 'mei')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_org ON companies(org_id);

-- ══════════════════════════════════
-- USER ↔ COMPANY ASSIGNMENTS
-- ══════════════════════════════════
CREATE TABLE user_companies (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'owner')),
  PRIMARY KEY (user_id, company_id)
);

-- ══════════════════════════════════
-- SUPPLIERS
-- ══════════════════════════════════
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj_cpf TEXT,
  contact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suppliers_company ON suppliers(company_id);

-- ══════════════════════════════════
-- CUSTOMERS
-- ══════════════════════════════════
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj_cpf TEXT,
  contact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_company ON customers(company_id);

-- ══════════════════════════════════
-- CATEGORIES
-- ══════════════════════════════════
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_company ON categories(company_id);

-- ══════════════════════════════════
-- COST CENTERS
-- ══════════════════════════════════
CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cost_centers_company ON cost_centers(company_id);

-- ══════════════════════════════════
-- PAYABLES (Contas a Pagar)
-- ══════════════════════════════════
CREATE TABLE payables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'scheduled', 'awaiting_approval', 'approved', 'paid', 'cancelled')),
  category_id UUID REFERENCES categories(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payables_company ON payables(company_id);
CREATE INDEX idx_payables_due_date ON payables(due_date);
CREATE INDEX idx_payables_status ON payables(status);

-- ══════════════════════════════════
-- RECEIVABLES (Contas a Receber)
-- ══════════════════════════════════
CREATE TABLE receivables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  received_date DATE,
  received_amount NUMERIC(15,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'overdue', 'partial', 'cancelled')),
  category_id UUID REFERENCES categories(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receivables_company ON receivables(company_id);
CREATE INDEX idx_receivables_due_date ON receivables(due_date);
CREATE INDEX idx_receivables_status ON receivables(status);

-- ══════════════════════════════════
-- TASKS
-- ══════════════════════════════════
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'custom' CHECK (type IN ('payment', 'receivable', 'reconciliation', 'custom')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date DATE,
  assigned_to UUID REFERENCES profiles(id),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('auto', 'manual')),
  source_id UUID,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_company ON tasks(company_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);

-- ══════════════════════════════════
-- IMPORTS
-- ══════════════════════════════════
CREATE TABLE imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('ofx', 'csv')),
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  records_count INTEGER DEFAULT 0,
  imported_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════
-- AUDIT LOG
-- ══════════════════════════════════
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID REFERENCES companies(id),
  user_id UUID REFERENCES profiles(id),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs(org_id);
CREATE INDEX idx_audit_table ON audit_logs(table_name, record_id);

-- ══════════════════════════════════
-- AUTO-UPDATE updated_at trigger
-- ══════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payables_updated_at
  BEFORE UPDATE ON payables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER receivables_updated_at
  BEFORE UPDATE ON receivables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users see their own org
CREATE POLICY profiles_org_isolation ON profiles
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Companies: org isolation
CREATE POLICY companies_org_isolation ON companies
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- User-companies: org isolation via company
CREATE POLICY user_companies_isolation ON user_companies
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()))
  );

-- Suppliers: company isolation within org
CREATE POLICY suppliers_isolation ON suppliers
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()))
  );

-- Customers: same pattern
CREATE POLICY customers_isolation ON customers
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()))
  );

-- Categories: same pattern
CREATE POLICY categories_isolation ON categories
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()))
  );

-- Cost centers: same pattern
CREATE POLICY cost_centers_isolation ON cost_centers
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()))
  );

-- Payables: same pattern
CREATE POLICY payables_isolation ON payables
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()))
  );

-- Receivables: same pattern
CREATE POLICY receivables_isolation ON receivables
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()))
  );

-- Tasks: same pattern
CREATE POLICY tasks_isolation ON tasks
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()))
  );

-- Imports: same pattern
CREATE POLICY imports_isolation ON imports
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()))
  );

-- Audit logs: org isolation
CREATE POLICY audit_org_isolation ON audit_logs
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));
```

**Step 2: Create seed data**

`supabase/seed.sql`:
```sql
-- Seed data is inserted via the API after Supabase Auth signup.
-- This file documents the expected seed flow:
--
-- 1. Create organization via API (auto on first signup)
-- 2. Create profile linked to auth.users
-- 3. Create sample companies
-- 4. Assign user to companies
-- 5. Create sample categories per company
--
-- For local dev, use the Supabase dashboard or API to seed.
```

**Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema with RLS and audit triggers"
```

---

## Task 4: API Backend Setup

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/lib/supabase.ts`
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/middleware/company.ts`

**Step 1: Create API package**

`apps/api/package.json`:
```json
{
  "name": "@gfin/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@gfin/shared": "*",
    "@supabase/supabase-js": "^2.49.0",
    "cors": "^2.8.6",
    "dotenv": "^16.4.0",
    "express": "^5.2.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 2: Create Express server entry point**

`apps/api/src/index.ts`:
```ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRoutes } from './routes/auth.js';
import { companiesRoutes } from './routes/companies.js';
import { payablesRoutes } from './routes/payables.js';
import { receivablesRoutes } from './routes/receivables.js';
import { tasksRoutes } from './routes/tasks.js';
import { cadastrosRoutes } from './routes/cadastros.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { importsRoutes } from './routes/imports.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/payables', payablesRoutes);
app.use('/api/receivables', receivablesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/cadastros', cadastrosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/imports', importsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Gfin API running on port ${PORT}`);
});
```

**Step 3: Create Supabase client**

`apps/api/src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client (bypasses RLS, used for server-side operations)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create a client scoped to a user's JWT (respects RLS)
export function createUserClient(accessToken: string) {
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
```

**Step 4: Create auth middleware**

`apps/api/src/middleware/auth.ts`:
```ts
import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';

export interface AuthenticatedRequest extends Request {
  userId: string;
  orgId: string;
  userRole: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Token inválido' });
    return;
  }

  // Get profile with org info
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    res.status(403).json({ error: 'Perfil não encontrado' });
    return;
  }

  (req as AuthenticatedRequest).userId = user.id;
  (req as AuthenticatedRequest).orgId = profile.org_id;
  (req as AuthenticatedRequest).userRole = profile.role;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as AuthenticatedRequest).userRole !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores' });
    return;
  }
  next();
}
```

**Step 5: Create company context middleware**

`apps/api/src/middleware/company.ts`:
```ts
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { supabase } from '../lib/supabase.js';

export interface CompanyRequest extends AuthenticatedRequest {
  companyId: string;
}

export async function requireCompany(req: Request, res: Response, next: NextFunction) {
  const companyId = req.headers['x-company-id'] as string;
  if (!companyId) {
    res.status(400).json({ error: 'Header X-Company-Id é obrigatório' });
    return;
  }

  const authReq = req as AuthenticatedRequest;

  // Verify company belongs to user's org
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('id', companyId)
    .eq('org_id', authReq.orgId)
    .single();

  if (!company) {
    res.status(403).json({ error: 'Empresa não encontrada ou sem acesso' });
    return;
  }

  (req as CompanyRequest).companyId = companyId;
  next();
}
```

**Step 6: Create .env.example**

`apps/api/.env.example`:
```
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Step 7: Commit**

```bash
git add apps/api/
git commit -m "feat: setup API with Express, Supabase, auth and company middleware"
```

---

## Task 5: API Routes — Auth

**Files:**
- Create: `apps/api/src/routes/auth.ts`

**Step 1: Create auth routes (signup, login, me)**

`apps/api/src/routes/auth.ts`:
```ts
import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

export const authRoutes = Router();

// POST /api/auth/signup
authRoutes.post('/signup', async (req, res) => {
  const { email, password, name, orgName } = req.body;

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    res.status(400).json({ error: authError.message });
    return;
  }

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: orgName, slug: orgName.toLowerCase().replace(/\s+/g, '-') })
    .select()
    .single();

  if (orgError) {
    res.status(500).json({ error: 'Erro ao criar organização' });
    return;
  }

  // Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      org_id: org.id,
      name,
      email,
      role: 'admin',
    });

  if (profileError) {
    res.status(500).json({ error: 'Erro ao criar perfil' });
    return;
  }

  // Sign in to get token
  const { data: session } = await supabase.auth.signInWithPassword({ email, password });

  res.json({
    data: {
      token: session.session?.access_token,
      user: { id: authData.user.id, name, email, role: 'admin', org_id: org.id },
    },
  });
});

// POST /api/auth/login
authRoutes.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  res.json({
    data: {
      token: data.session.access_token,
      user: profile,
    },
  });
});

// GET /api/auth/me
authRoutes.get('/me', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(name, slug)')
    .eq('id', authReq.userId)
    .single();

  res.json({ data: profile });
});
```

**Step 2: Commit**

```bash
git add apps/api/src/routes/auth.ts
git commit -m "feat: add auth routes (signup, login, me)"
```

---

## Task 6: API Routes — Companies & Cadastros

**Files:**
- Create: `apps/api/src/routes/companies.ts`
- Create: `apps/api/src/routes/cadastros.ts`

**Step 1: Create companies CRUD**

`apps/api/src/routes/companies.ts`:
```ts
import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';

export const companiesRoutes = Router();
companiesRoutes.use(requireAuth);

// GET /api/companies
companiesRoutes.get('/', async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('org_id', authReq.orgId)
    .order('name');

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

// POST /api/companies
companiesRoutes.post('/', requireAdmin, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { name, cnpj, regime_tributario } = req.body;

  const { data, error } = await supabase
    .from('companies')
    .insert({ org_id: authReq.orgId, name, cnpj, regime_tributario })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ data });
});

// PUT /api/companies/:id
companiesRoutes.put('/:id', requireAdmin, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { name, cnpj, regime_tributario, status } = req.body;

  const { data, error } = await supabase
    .from('companies')
    .update({ name, cnpj, regime_tributario, status })
    .eq('id', req.params.id)
    .eq('org_id', authReq.orgId)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

// DELETE /api/companies/:id
companiesRoutes.delete('/:id', requireAdmin, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { error } = await supabase
    .from('companies')
    .update({ status: 'inactive' })
    .eq('id', req.params.id)
    .eq('org_id', authReq.orgId);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data: { message: 'Empresa desativada' } });
});
```

**Step 2: Create cadastros routes (suppliers, customers, categories, cost_centers)**

`apps/api/src/routes/cadastros.ts`:
```ts
import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCompany, type CompanyRequest } from '../middleware/company.js';

export const cadastrosRoutes = Router();
cadastrosRoutes.use(requireAuth, requireCompany);

// ── Generic CRUD factory ──
function crudRoutes(tableName: string) {
  const router = Router();

  router.get('/', async (req, res) => {
    const { companyId } = req as CompanyRequest;
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ data });
  });

  router.post('/', async (req, res) => {
    const { companyId } = req as CompanyRequest;
    const { data, error } = await supabase
      .from(tableName)
      .insert({ ...req.body, company_id: companyId })
      .select()
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json({ data });
  });

  router.put('/:id', async (req, res) => {
    const { companyId } = req as CompanyRequest;
    const { data, error } = await supabase
      .from(tableName)
      .update(req.body)
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .select()
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ data });
  });

  router.delete('/:id', async (req, res) => {
    const { companyId } = req as CompanyRequest;
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', companyId);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ data: { message: 'Removido' } });
  });

  return router;
}

cadastrosRoutes.use('/suppliers', crudRoutes('suppliers'));
cadastrosRoutes.use('/customers', crudRoutes('customers'));
cadastrosRoutes.use('/categories', crudRoutes('categories'));
cadastrosRoutes.use('/cost-centers', crudRoutes('cost_centers'));
```

**Step 3: Commit**

```bash
git add apps/api/src/routes/companies.ts apps/api/src/routes/cadastros.ts
git commit -m "feat: add companies and cadastros CRUD routes"
```

---

## Task 7: API Routes — Payables & Receivables

**Files:**
- Create: `apps/api/src/routes/payables.ts`
- Create: `apps/api/src/routes/receivables.ts`

**Step 1: Create payables routes**

`apps/api/src/routes/payables.ts`:
```ts
import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCompany, type CompanyRequest } from '../middleware/company.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export const payablesRoutes = Router();
payablesRoutes.use(requireAuth, requireCompany);

// GET /api/payables?status=open&from=2026-01-01&to=2026-03-31
payablesRoutes.get('/', async (req, res) => {
  const { companyId } = req as CompanyRequest;
  const { status, from, to, supplier_id, category_id, page = '1', per_page = '50' } = req.query;

  let query = supabase
    .from('payables')
    .select('*, supplier:suppliers(name), category:categories(name), cost_center:cost_centers(name)', { count: 'exact' })
    .eq('company_id', companyId)
    .order('due_date', { ascending: true });

  if (status) query = query.eq('status', status);
  if (from) query = query.gte('due_date', from);
  if (to) query = query.lte('due_date', to);
  if (supplier_id) query = query.eq('supplier_id', supplier_id);
  if (category_id) query = query.eq('category_id', category_id);

  const pageNum = parseInt(page as string);
  const perPage = parseInt(per_page as string);
  query = query.range((pageNum - 1) * perPage, pageNum * perPage - 1);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data, total: count, page: pageNum, per_page: perPage });
});

// POST /api/payables
payablesRoutes.post('/', async (req, res) => {
  const { companyId, userId } = req as CompanyRequest & AuthenticatedRequest;
  const { data, error } = await supabase
    .from('payables')
    .insert({ ...req.body, company_id: companyId, created_by: userId, status: 'open' })
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ data });
});

// PUT /api/payables/:id
payablesRoutes.put('/:id', async (req, res) => {
  const { companyId } = req as CompanyRequest;
  const { data, error } = await supabase
    .from('payables')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('company_id', companyId)
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

// POST /api/payables/:id/send-approval
payablesRoutes.post('/:id/send-approval', async (req, res) => {
  const { companyId } = req as CompanyRequest;
  const { data, error } = await supabase
    .from('payables')
    .update({ status: 'awaiting_approval', approval_status: 'pending' })
    .eq('id', req.params.id)
    .eq('company_id', companyId)
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

// POST /api/payables/:id/approve
payablesRoutes.post('/:id/approve', async (req, res) => {
  const { companyId, userId } = req as CompanyRequest & AuthenticatedRequest;
  const { data, error } = await supabase
    .from('payables')
    .update({ status: 'approved', approval_status: 'approved', approved_by: userId })
    .eq('id', req.params.id)
    .eq('company_id', companyId)
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

// POST /api/payables/:id/reject
payablesRoutes.post('/:id/reject', async (req, res) => {
  const { companyId, userId } = req as CompanyRequest & AuthenticatedRequest;
  const { data, error } = await supabase
    .from('payables')
    .update({ status: 'open', approval_status: 'rejected', approved_by: userId })
    .eq('id', req.params.id)
    .eq('company_id', companyId)
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

// POST /api/payables/:id/mark-paid
payablesRoutes.post('/:id/mark-paid', async (req, res) => {
  const { companyId } = req as CompanyRequest;
  const { data, error } = await supabase
    .from('payables')
    .update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] })
    .eq('id', req.params.id)
    .eq('company_id', companyId)
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

// DELETE /api/payables/:id
payablesRoutes.delete('/:id', async (req, res) => {
  const { companyId } = req as CompanyRequest;
  const { error } = await supabase
    .from('payables')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .eq('company_id', companyId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data: { message: 'Cancelado' } });
});
```

**Step 2: Create receivables routes**

`apps/api/src/routes/receivables.ts`:
```ts
import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { requireCompany, type CompanyRequest } from '../middleware/company.js';

export const receivablesRoutes = Router();
receivablesRoutes.use(requireAuth, requireCompany);

// GET /api/receivables
receivablesRoutes.get('/', async (req, res) => {
  const { companyId } = req as CompanyRequest;
  const { status, from, to, customer_id, page = '1', per_page = '50' } = req.query;

  let query = supabase
    .from('receivables')
    .select('*, customer:customers(name), category:categories(name)', { count: 'exact' })
    .eq('company_id', companyId)
    .order('due_date', { ascending: true });

  if (status) query = query.eq('status', status);
  if (from) query = query.gte('due_date', from);
  if (to) query = query.lte('due_date', to);
  if (customer_id) query = query.eq('customer_id', customer_id);

  const pageNum = parseInt(page as string);
  const perPage = parseInt(per_page as string);
  query = query.range((pageNum - 1) * perPage, pageNum * perPage - 1);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data, total: count, page: pageNum, per_page: perPage });
});

// POST /api/receivables
receivablesRoutes.post('/', async (req, res) => {
  const { companyId, userId } = req as CompanyRequest & AuthenticatedRequest;
  const { data, error } = await supabase
    .from('receivables')
    .insert({ ...req.body, company_id: companyId, created_by: userId, status: 'pending', received_amount: 0 })
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ data });
});

// PUT /api/receivables/:id
receivablesRoutes.put('/:id', async (req, res) => {
  const { companyId } = req as CompanyRequest;
  const { data, error } = await supabase
    .from('receivables')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('company_id', companyId)
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

// POST /api/receivables/:id/receive
receivablesRoutes.post('/:id/receive', async (req, res) => {
  const { companyId } = req as CompanyRequest;
  const { amount } = req.body;

  // Get current receivable
  const { data: current } = await supabase
    .from('receivables')
    .select('amount, received_amount')
    .eq('id', req.params.id)
    .eq('company_id', companyId)
    .single();

  if (!current) { res.status(404).json({ error: 'Não encontrado' }); return; }

  const newReceived = (current.received_amount || 0) + amount;
  const isFullyReceived = newReceived >= current.amount;

  const { data, error } = await supabase
    .from('receivables')
    .update({
      received_amount: newReceived,
      received_date: new Date().toISOString().split('T')[0],
      status: isFullyReceived ? 'received' : 'partial',
    })
    .eq('id', req.params.id)
    .eq('company_id', companyId)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

// DELETE /api/receivables/:id
receivablesRoutes.delete('/:id', async (req, res) => {
  const { companyId } = req as CompanyRequest;
  const { error } = await supabase
    .from('receivables')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .eq('company_id', companyId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data: { message: 'Cancelado' } });
});
```

**Step 3: Commit**

```bash
git add apps/api/src/routes/payables.ts apps/api/src/routes/receivables.ts
git commit -m "feat: add payables and receivables API routes with filters and actions"
```

---

## Task 8: API Routes — Tasks, Dashboard, Imports

**Files:**
- Create: `apps/api/src/routes/tasks.ts`
- Create: `apps/api/src/routes/dashboard.ts`
- Create: `apps/api/src/routes/imports.ts`

**Step 1: Create tasks routes**

`apps/api/src/routes/tasks.ts`:
```ts
import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

export const tasksRoutes = Router();
tasksRoutes.use(requireAuth);

// GET /api/tasks — returns tasks across all user's companies (or filtered by company)
tasksRoutes.get('/', async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { company_id, status, priority, type, page = '1', per_page = '50' } = req.query;

  let query = supabase
    .from('tasks')
    .select('*, company:companies(name)', { count: 'exact' })
    .in('company_id', (
      supabase.from('companies').select('id').eq('org_id', authReq.orgId)
    ) as unknown as string[])
    .order('due_date', { ascending: true, nullsFirst: false });

  // Workaround: filter by org via join
  // Actually, let's query companies first then filter
  const { data: orgCompanies } = await supabase
    .from('companies')
    .select('id')
    .eq('org_id', authReq.orgId);

  const companyIds = orgCompanies?.map(c => c.id) || [];

  query = supabase
    .from('tasks')
    .select('*, company:companies(name)', { count: 'exact' })
    .in('company_id', companyIds)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (company_id) query = query.eq('company_id', company_id);
  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (type) query = query.eq('type', type);

  const pageNum = parseInt(page as string);
  const perPage = parseInt(per_page as string);
  query = query.range((pageNum - 1) * perPage, pageNum * perPage - 1);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data, total: count, page: pageNum, per_page: perPage });
});

// POST /api/tasks
tasksRoutes.post('/', async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...req.body, created_by: authReq.userId, source: 'manual' })
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ data });
});

// PUT /api/tasks/:id
tasksRoutes.put('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('tasks')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

// POST /api/tasks/:id/complete
tasksRoutes.post('/:id/complete', async (req, res) => {
  const { data, error } = await supabase
    .from('tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

// DELETE /api/tasks/:id
tasksRoutes.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data: { message: 'Cancelada' } });
});
```

**Step 2: Create dashboard routes**

`apps/api/src/routes/dashboard.ts`:
```ts
import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCompany, type CompanyRequest } from '../middleware/company.js';

export const dashboardRoutes = Router();
dashboardRoutes.use(requireAuth, requireCompany);

// GET /api/dashboard/kpis
dashboardRoutes.get('/kpis', async (req, res) => {
  const { companyId } = req as CompanyRequest;
  const today = new Date().toISOString().split('T')[0];

  const [payables, receivables, overdue, pendingApprovals, tasksToday] = await Promise.all([
    supabase.from('payables').select('amount').eq('company_id', companyId).in('status', ['open', 'scheduled', 'awaiting_approval', 'approved']),
    supabase.from('receivables').select('amount, received_amount').eq('company_id', companyId).in('status', ['pending', 'partial']),
    supabase.from('payables').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'open').lt('due_date', today),
    supabase.from('payables').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'awaiting_approval'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pending').lte('due_date', today),
  ]);

  const totalPayable = payables.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const totalReceivable = receivables.data?.reduce((sum, r) => sum + (Number(r.amount) - Number(r.received_amount)), 0) || 0;

  res.json({
    data: {
      total_receivable: totalReceivable,
      total_payable: totalPayable,
      current_balance: totalReceivable - totalPayable,
      overdue_count: overdue.count || 0,
      pending_approvals: pendingApprovals.count || 0,
      tasks_today: tasksToday.count || 0,
    },
  });
});

// GET /api/dashboard/cashflow?days=30
dashboardRoutes.get('/cashflow', async (req, res) => {
  const { companyId } = req as CompanyRequest;
  const days = parseInt(req.query.days as string) || 30;
  const today = new Date();
  const from = today.toISOString().split('T')[0];
  const to = new Date(today.getTime() + days * 86400000).toISOString().split('T')[0];

  const [payables, receivables] = await Promise.all([
    supabase.from('payables').select('amount, due_date, status, paid_date').eq('company_id', companyId).gte('due_date', from).lte('due_date', to),
    supabase.from('receivables').select('amount, due_date, status, received_date, received_amount').eq('company_id', companyId).gte('due_date', from).lte('due_date', to),
  ]);

  // Build daily entries
  const entries: Record<string, { income: number; expense: number }> = {};
  for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
    entries[d.toISOString().split('T')[0]] = { income: 0, expense: 0 };
  }

  payables.data?.forEach(p => {
    const date = p.paid_date || p.due_date;
    if (entries[date]) entries[date].expense += Number(p.amount);
  });

  receivables.data?.forEach(r => {
    const date = r.received_date || r.due_date;
    if (entries[date]) entries[date].income += Number(r.amount);
  });

  let balance = 0;
  const cashflow = Object.entries(entries).map(([date, { income, expense }]) => {
    balance += income - expense;
    return {
      date,
      income,
      expense,
      balance,
      projected: new Date(date) > today,
    };
  });

  res.json({ data: cashflow });
});

// GET /api/dashboard/recent
dashboardRoutes.get('/recent', async (req, res) => {
  const { companyId } = req as CompanyRequest;

  const [recentPayables, recentReceivables] = await Promise.all([
    supabase.from('payables').select('id, description, amount, status, due_date, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
    supabase.from('receivables').select('id, description, amount, status, due_date, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
  ]);

  res.json({
    data: {
      payables: recentPayables.data || [],
      receivables: recentReceivables.data || [],
    },
  });
});
```

**Step 3: Create imports routes (OFX/CSV upload & processing)**

`apps/api/src/routes/imports.ts`:
```ts
import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { requireCompany, type CompanyRequest } from '../middleware/company.js';

export const importsRoutes = Router();
importsRoutes.use(requireAuth, requireCompany);

// GET /api/imports — history
importsRoutes.get('/', async (req, res) => {
  const { companyId } = req as CompanyRequest;
  const { data, error } = await supabase
    .from('imports')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

// POST /api/imports/preview — parse OFX/CSV without saving
importsRoutes.post('/preview', async (req, res) => {
  const { content, file_type } = req.body;
  // OFX/CSV parsing will be implemented when frontend sends file content
  // For now, return parsed transactions structure
  try {
    const transactions = file_type === 'ofx' ? parseOFX(content) : parseCSV(content);
    res.json({ data: transactions });
  } catch {
    res.status(400).json({ error: 'Erro ao processar arquivo' });
  }
});

// POST /api/imports/confirm — save parsed transactions
importsRoutes.post('/confirm', async (req, res) => {
  const { companyId, userId } = req as CompanyRequest & AuthenticatedRequest;
  const { file_name, file_type, transactions } = req.body;

  // Create import record
  const { data: importRecord, error: importError } = await supabase
    .from('imports')
    .insert({
      company_id: companyId,
      file_name,
      file_type,
      status: 'processing',
      records_count: transactions.length,
      imported_by: userId,
    })
    .select()
    .single();

  if (importError) { res.status(500).json({ error: importError.message }); return; }

  // Insert transactions as payables or receivables
  for (const tx of transactions) {
    const table = tx.amount < 0 ? 'payables' : 'receivables';
    const record = {
      company_id: companyId,
      description: tx.description,
      amount: Math.abs(tx.amount),
      due_date: tx.date,
      status: table === 'payables' ? 'open' : 'pending',
      created_by: userId,
      ...(table === 'receivables' ? { received_amount: 0 } : {}),
      category_id: tx.category_id || null,
    };
    await supabase.from(table).insert(record);
  }

  // Update import status
  await supabase.from('imports').update({ status: 'completed' }).eq('id', importRecord.id);

  res.json({ data: { import_id: importRecord.id, records_count: transactions.length } });
});

// ── Simple OFX parser ──
interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  category_id?: string;
}

function parseOFX(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = txRegex.exec(content)) !== null) {
    const block = match[1];
    const amount = parseFloat(block.match(/<TRNAMT>([\-\d.]+)/)?.[1] || '0');
    const dateStr = block.match(/<DTPOSTED>(\d{8})/)?.[1] || '';
    const desc = block.match(/<MEMO>(.*)/)?.[1]?.trim() || block.match(/<NAME>(.*)/)?.[1]?.trim() || 'Sem descrição';

    if (dateStr) {
      transactions.push({
        date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
        description: desc,
        amount,
      });
    }
  }

  return transactions;
}

// ── Simple CSV parser (expects: date,description,amount) ──
function parseCSV(content: string): ParsedTransaction[] {
  const lines = content.trim().split('\n');
  // Skip header if present
  const start = lines[0].toLowerCase().includes('data') || lines[0].toLowerCase().includes('date') ? 1 : 0;

  return lines.slice(start).map(line => {
    const parts = line.split(/[;,]/);
    return {
      date: parts[0].trim(),
      description: parts[1]?.trim() || 'Sem descrição',
      amount: parseFloat(parts[2]?.trim().replace(',', '.') || '0'),
    };
  }).filter(tx => tx.amount !== 0);
}
```

**Step 4: Commit**

```bash
git add apps/api/src/routes/
git commit -m "feat: add tasks, dashboard, and imports API routes"
```

---

## Task 9: Frontend Setup

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/vite-env.d.ts`

**Step 1: Create web package.json** (same deps as SuperGerente web)

```json
{
  "name": "@gfin/web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@gfin/shared": "*",
    "axios": "^1.6.7",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.344.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^7.13.1",
    "recharts": "^3.7.0",
    "tailwind-merge": "^3.5.0",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.1",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "tailwindcss": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.2.0"
  }
}
```

**Step 2: Create index.html**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0f172a" />
  <title>Gfin Fácil</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@600;700;800&family=Mulish:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</head>
<body class="bg-background text-foreground antialiased">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Step 3: Create vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
```

**Step 4: Create index.css with Tailwind v4 + design tokens**

`apps/web/src/index.css`:
```css
@import "tailwindcss";

@theme {
  /* ── Colors ── */
  --color-background: #0f172a;
  --color-foreground: #e2e8f0;
  --color-surface: #1e293b;
  --color-surface-secondary: #334155;
  --color-muted: #64748b;
  --color-border: #334155;
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-accent: #8b5cf6;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #06b6d4;

  /* ── Typography ── */
  --font-heading: 'Libre Franklin', sans-serif;
  --font-body: 'Mulish', sans-serif;

  /* ── Border Radius ── */
  --radius-card: 12px;
  --radius-button: 8px;
  --radius-input: 8px;
}

body {
  font-family: var(--font-body);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}
```

**Step 5: Create main.tsx, vite-env.d.ts, tsconfig.json**

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`apps/web/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "outDir": "dist",
    "noEmit": true
  },
  "include": ["src"]
}
```

**Step 6: Commit**

```bash
git add apps/web/
git commit -m "feat: setup frontend with Vite, React, Tailwind v4 and design tokens"
```

---

## Task 10: Frontend — Shared UI Components

**Files:**
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/ui/Button.tsx`
- Create: `apps/web/src/components/ui/Input.tsx`
- Create: `apps/web/src/components/ui/Card.tsx`
- Create: `apps/web/src/components/ui/Badge.tsx`
- Create: `apps/web/src/components/ui/Select.tsx`
- Create: `apps/web/src/components/ui/Table.tsx`
- Create: `apps/web/src/components/ui/Spinner.tsx`
- Create: `apps/web/src/components/ui/EmptyState.tsx`
- Create: `apps/web/src/components/ui/index.ts`

**Step 1: Create utils and API client**

Copy patterns from SuperGerente's `web/src/lib/utils.ts` and `web/src/lib/api.ts`. Use `@gfin/shared` for `STORAGE_KEYS`. Same `cn()` helper, same Axios interceptor pattern.

**Step 2: Create UI components**

Follow same CVA pattern as SuperGerente's `Button.tsx`. Create: Button (primary/secondary/ghost/danger/success variants), Input (with label, error props), Card (with header/footer slots), Badge (status colors), Select (native), Table (with sticky header), Spinner, EmptyState.

**Step 3: Commit**

```bash
git add apps/web/src/lib/ apps/web/src/components/ui/
git commit -m "feat: add shared UI components (Button, Input, Card, Badge, Table, etc.)"
```

---

## Task 11: Frontend — Layout (AppShell, Sidebar, TopBar)

**Files:**
- Create: `apps/web/src/stores/authStore.ts`
- Create: `apps/web/src/stores/companyStore.ts`
- Create: `apps/web/src/components/layout/AppShell.tsx`
- Create: `apps/web/src/components/layout/AuthLayout.tsx`
- Create: `apps/web/src/components/layout/Sidebar.tsx`
- Create: `apps/web/src/components/layout/TopBar.tsx`

**Step 1: Create authStore** (same pattern as SuperGerente, add `org_id`)

**Step 2: Create companyStore** — stores list of companies + active company. Persists `activeCompanyId` in localStorage. All API calls use `X-Company-Id` header from this store.

```ts
// companyStore.ts
import { create } from 'zustand';
import { STORAGE_KEYS } from '@gfin/shared';
import type { Company } from '@gfin/shared';

interface CompanyState {
  companies: Company[];
  activeCompanyId: string | null;
  setCompanies: (companies: Company[]) => void;
  setActiveCompany: (id: string) => void;
  activeCompany: () => Company | undefined;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: [],
  activeCompanyId: localStorage.getItem(STORAGE_KEYS.activeCompany),
  setCompanies: (companies) => {
    set({ companies });
    // Auto-select first if none active
    if (!get().activeCompanyId && companies.length > 0) {
      set({ activeCompanyId: companies[0].id });
      localStorage.setItem(STORAGE_KEYS.activeCompany, companies[0].id);
    }
  },
  setActiveCompany: (id) => {
    set({ activeCompanyId: id });
    localStorage.setItem(STORAGE_KEYS.activeCompany, id);
  },
  activeCompany: () => get().companies.find(c => c.id === get().activeCompanyId),
}));
```

**Step 3: Create Sidebar** with company dropdown at top, navigation links (Dashboard, Contas Pagar, Contas Receber, Fluxo Caixa, Tarefas, Cadastros, Importar). Admin-only items (Empresas, Usuários, Config) shown based on role. Use lucide-react icons.

**Step 4: Create TopBar** with page title, user avatar/name, logout button.

**Step 5: Create AppShell** — same pattern as SuperGerente. Checks auth, wraps Sidebar + TopBar + Outlet.

**Step 6: Create AuthLayout** — centered card for login/register forms.

**Step 7: Commit**

```bash
git add apps/web/src/stores/ apps/web/src/components/layout/
git commit -m "feat: add layout shell with sidebar, company selector, and auth protection"
```

---

## Task 12: Frontend — App Router & Login Page

**Files:**
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/pages/LoginPage.tsx`

**Step 1: Create App.tsx with all routes**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ContasPagarPage } from '@/pages/ContasPagarPage';
import { ContasReceberPage } from '@/pages/ContasReceberPage';
import { FluxoCaixaPage } from '@/pages/FluxoCaixaPage';
import { TarefasPage } from '@/pages/TarefasPage';
import { CadastrosPage } from '@/pages/CadastrosPage';
import { ImportarPage } from '@/pages/ImportarPage';
import { EmpresasPage } from '@/pages/EmpresasPage';
import { AprovacoesPage } from '@/pages/AprovacoesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/contas-pagar" element={<ContasPagarPage />} />
          <Route path="/contas-receber" element={<ContasReceberPage />} />
          <Route path="/fluxo-caixa" element={<FluxoCaixaPage />} />
          <Route path="/tarefas" element={<TarefasPage />} />
          <Route path="/cadastros/*" element={<CadastrosPage />} />
          <Route path="/importar" element={<ImportarPage />} />
          <Route path="/empresas" element={<EmpresasPage />} />
          <Route path="/aprovacoes" element={<AprovacoesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 2: Create LoginPage** with email/password form, calls POST `/api/auth/login`, stores token via authStore.

**Step 3: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/pages/LoginPage.tsx
git commit -m "feat: add router with all MVP routes and login page"
```

---

## Task 13: Frontend — Dashboard Page

**Files:**
- Create: `apps/web/src/pages/DashboardPage.tsx`
- Create: `apps/web/src/components/features/dashboard/KPICards.tsx`
- Create: `apps/web/src/components/features/dashboard/CashFlowChart.tsx`
- Create: `apps/web/src/components/features/dashboard/RecentMovements.tsx`
- Create: `apps/web/src/components/features/dashboard/TasksWidget.tsx`

**Step 1: Create KPICards** — 6 cards in a grid: Total a Receber (green), Total a Pagar (red), Saldo (blue), Vencidos (yellow), Aprovações Pendentes (purple), Tarefas Hoje (cyan). Use lucide-react icons.

**Step 2: Create CashFlowChart** — Recharts BarChart with income (green bars) vs expense (red bars). X-axis: dates. Toggle: 7d / 30d / 90d.

**Step 3: Create RecentMovements** — two-column layout showing latest 5 payables and 5 receivables with status badges.

**Step 4: Create TasksWidget** — compact list of today's urgent/pending tasks with company name and priority badge. "Ver todas" link to /tarefas.

**Step 5: Create DashboardPage** — fetches from `/api/dashboard/kpis`, `/api/dashboard/cashflow`, `/api/dashboard/recent`, `/api/tasks?status=pending`. Composes KPICards + CashFlowChart + RecentMovements + TasksWidget.

**Step 6: Commit**

```bash
git add apps/web/src/pages/DashboardPage.tsx apps/web/src/components/features/dashboard/
git commit -m "feat: add dashboard with KPIs, cashflow chart, recent movements, and tasks widget"
```

---

## Task 14: Frontend — Contas a Pagar Page

**Files:**
- Create: `apps/web/src/pages/ContasPagarPage.tsx`
- Create: `apps/web/src/components/features/contas/PayableTable.tsx`
- Create: `apps/web/src/components/features/contas/PayableForm.tsx`
- Create: `apps/web/src/components/features/contas/PayableFilters.tsx`

**Step 1: Create PayableFilters** — row of filter controls: status dropdown, date range (from/to), supplier dropdown, category dropdown.

**Step 2: Create PayableTable** — table with columns: Descrição, Fornecedor, Valor, Vencimento, Status (Badge), Ações (dropdown: editar, enviar p/ aprovação, marcar pago, cancelar). Sticky header, sort by column.

**Step 3: Create PayableForm** — modal/slide-over form for create/edit. Fields: descrição, valor (currency mask), vencimento (date), fornecedor (select), categoria (select), centro de custo (select), observações (textarea).

**Step 4: Create ContasPagarPage** — fetches from GET `/api/payables` with filters. "Nova Conta" button opens PayableForm. Status badges color-coded.

**Step 5: Commit**

```bash
git add apps/web/src/pages/ContasPagarPage.tsx apps/web/src/components/features/contas/Payable*
git commit -m "feat: add Contas a Pagar page with table, filters, and form"
```

---

## Task 15: Frontend — Contas a Receber Page

**Files:**
- Create: `apps/web/src/pages/ContasReceberPage.tsx`
- Create: `apps/web/src/components/features/contas/ReceivableTable.tsx`
- Create: `apps/web/src/components/features/contas/ReceivableForm.tsx`

**Step 1: Create ReceivableTable** — same pattern as PayableTable. Columns: Descrição, Cliente, Valor, Recebido, Vencimento, Status, Ações (editar, registrar recebimento, cancelar). "Registrar Recebimento" opens a small modal with amount input (supports partial).

**Step 2: Create ReceivableForm** — modal form: descrição, valor, vencimento, cliente (select), categoria (select), observações.

**Step 3: Create ContasReceberPage** — fetches from GET `/api/receivables` with filters. Reuses PayableFilters pattern (swapping supplier for customer).

**Step 4: Commit**

```bash
git add apps/web/src/pages/ContasReceberPage.tsx apps/web/src/components/features/contas/Receivable*
git commit -m "feat: add Contas a Receber page with partial receipt support"
```

---

## Task 16: Frontend — Fluxo de Caixa Page

**Files:**
- Create: `apps/web/src/pages/FluxoCaixaPage.tsx`
- Create: `apps/web/src/components/features/cashflow/CashFlowFullChart.tsx`
- Create: `apps/web/src/components/features/cashflow/CashFlowTable.tsx`

**Step 1: Create CashFlowFullChart** — larger Recharts chart with: stacked bars (income green, expense red), line for cumulative balance (blue). Period selector: 7d/30d/60d/90d. Projected entries in lighter opacity.

**Step 2: Create CashFlowTable** — detailed table below chart. Columns: Data, Tipo (Entrada/Saída), Descrição, Valor, Saldo Acumulado. Color-coded rows.

**Step 3: Create FluxoCaixaPage** — fetches from `/api/dashboard/cashflow`. Composes chart + table. Summary cards at top: Total Entradas, Total Saídas, Saldo Período.

**Step 4: Commit**

```bash
git add apps/web/src/pages/FluxoCaixaPage.tsx apps/web/src/components/features/cashflow/
git commit -m "feat: add Fluxo de Caixa page with chart, table, and period selector"
```

---

## Task 17: Frontend — Tarefas Page

**Files:**
- Create: `apps/web/src/pages/TarefasPage.tsx`
- Create: `apps/web/src/components/features/tasks/TaskList.tsx`
- Create: `apps/web/src/components/features/tasks/TaskCard.tsx`
- Create: `apps/web/src/components/features/tasks/TaskForm.tsx`
- Create: `apps/web/src/components/features/tasks/TaskFilters.tsx`

**Step 1: Create TaskCard** — card with: title, company name badge, priority badge (color-coded), due date, type icon, checkbox to complete. Click navigates to source (e.g., /contas-pagar if type=payment).

**Step 2: Create TaskList** — vertical list of TaskCards. Grouped by: "Atrasadas", "Hoje", "Esta Semana", "Futuras". Collapsible groups.

**Step 3: Create TaskFilters** — filter bar: empresa (dropdown, or "Todas"), prioridade, tipo, status.

**Step 4: Create TaskForm** — modal: título, empresa (select), tipo, prioridade, vencimento, descrição, atribuir para (select).

**Step 5: Create TarefasPage** — fetches from GET `/api/tasks` (cross-company). "Nova Tarefa" button. Toggle: "Por empresa" vs "Por data" grouping.

**Step 6: Commit**

```bash
git add apps/web/src/pages/TarefasPage.tsx apps/web/src/components/features/tasks/
git commit -m "feat: add Tarefas page with grouped list, filters, and task creation"
```

---

## Task 18: Frontend — Cadastros & Importar Pages

**Files:**
- Create: `apps/web/src/pages/CadastrosPage.tsx`
- Create: `apps/web/src/pages/ImportarPage.tsx`
- Create: `apps/web/src/components/features/imports/FileUpload.tsx`
- Create: `apps/web/src/components/features/imports/TransactionPreview.tsx`

**Step 1: Create CadastrosPage** — sub-route tabs: Fornecedores, Clientes, Categorias, Centros de Custo. Each tab shows a table with CRUD. Uses generic form pattern. Routes: `/cadastros/fornecedores`, `/cadastros/clientes`, `/cadastros/categorias`, `/cadastros/centros-custo`.

**Step 2: Create FileUpload** — drag-and-drop zone accepting .ofx and .csv files. Reads file content client-side, sends to POST `/api/imports/preview`.

**Step 3: Create TransactionPreview** — table showing parsed transactions with: data, descrição, valor, tipo (entrada/saída auto-detected). Category dropdown per row for manual matching. "Confirmar Importação" button calls POST `/api/imports/confirm`.

**Step 4: Create ImportarPage** — FileUpload → TransactionPreview flow. Also shows import history table at the bottom (GET `/api/imports`).

**Step 5: Commit**

```bash
git add apps/web/src/pages/CadastrosPage.tsx apps/web/src/pages/ImportarPage.tsx apps/web/src/components/features/imports/
git commit -m "feat: add Cadastros (CRUD) and Importar (OFX/CSV) pages"
```

---

## Task 19: Frontend — Empresas & Aprovações Pages

**Files:**
- Create: `apps/web/src/pages/EmpresasPage.tsx`
- Create: `apps/web/src/pages/AprovacoesPage.tsx`

**Step 1: Create EmpresasPage** (admin only) — table of companies in the organization. CRUD: nome, CNPJ, regime tributário, status. "Nova Empresa" button.

**Step 2: Create AprovacoesPage** (owner view) — list of payables with `status=awaiting_approval` for the owner's company. Each row shows: descrição, fornecedor, valor, vencimento, botões Aprovar / Recusar. Calls POST `/api/payables/:id/approve` or `/reject`.

**Step 3: Commit**

```bash
git add apps/web/src/pages/EmpresasPage.tsx apps/web/src/pages/AprovacoesPage.tsx
git commit -m "feat: add Empresas (admin) and Aprovações (owner) pages"
```

---

## Task 20: Install Dependencies & Verify Build

**Step 1: Install all dependencies**

```bash
cd ~/antigravity-gui/gfin-facil
npm install
```

**Step 2: Verify API compiles**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Verify frontend builds**

```bash
cd apps/web && npm run build
```

Expected: Vite build succeeds.

**Step 4: Run both in dev mode**

```bash
cd ~/antigravity-gui/gfin-facil
npm run dev
```

Expected: API on port 3001, Web on port 5173.

**Step 5: Commit build fixes if needed**

```bash
git add -A
git commit -m "fix: resolve build issues and verify all modules compile"
```

---

## Task 21: Final Commit & Docs

**Step 1: Copy design doc to new repo**

```bash
cp docs/plans/2026-03-02-gfin-facil-design.md ~/antigravity-gui/gfin-facil/docs/
```

**Step 2: Create README.md**

Minimal readme with: project name, description, stack, setup instructions (`npm install`, `npm run dev`), env vars needed.

**Step 3: Final commit**

```bash
git add -A
git commit -m "docs: add design document and README"
```

---

## Summary

| Task | What | Est. Steps |
|------|------|------------|
| 1 | Monorepo init | 6 |
| 2 | Shared types & constants | 3 |
| 3 | Database migrations + RLS | 3 |
| 4 | API setup (Express + middleware) | 7 |
| 5 | Auth routes | 2 |
| 6 | Companies + cadastros routes | 3 |
| 7 | Payables + receivables routes | 3 |
| 8 | Tasks + dashboard + imports routes | 4 |
| 9 | Frontend setup (Vite + Tailwind) | 6 |
| 10 | UI components (Button, Table, etc) | 3 |
| 11 | Layout (Shell, Sidebar, TopBar) | 7 |
| 12 | Router + Login page | 3 |
| 13 | Dashboard page | 6 |
| 14 | Contas a Pagar page | 5 |
| 15 | Contas a Receber page | 4 |
| 16 | Fluxo de Caixa page | 4 |
| 17 | Tarefas page | 6 |
| 18 | Cadastros + Importar pages | 5 |
| 19 | Empresas + Aprovações pages | 3 |
| 20 | Install deps + verify build | 5 |
| 21 | Docs + final commit | 3 |

**Total: 21 tasks, ~90 steps**
