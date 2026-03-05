# iPhoneAgent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a WhatsApp bot that monitors iPhone price groups, extracts pricing data with Gemini AI, calculates margins against supplier costs + fees, and proactively alerts on buying opportunities.

**Architecture:** Monolito TypeScript + Express receiving Evolution API webhooks. Gemini 2.5 Flash handles message classification, data extraction (including image OCR), natural language consultation, and proactive strategy. Supabase stores all pricing data, suppliers, and configuration.

**Tech Stack:** TypeScript, Express, @google/generative-ai, @supabase/supabase-js, axios, node-cron, zod, winston, vitest

**Design Doc:** `docs/plans/2026-02-28-iphone-agent-design.md`

**Project Location:** `~/antigravity-gui/iphone-agent/` (separate repo from supergerente)

---

## Task 1: Project Scaffold

**Files:**
- Create: `iphone-agent/package.json`
- Create: `iphone-agent/tsconfig.json`
- Create: `iphone-agent/.gitignore`
- Create: `iphone-agent/.env.example`
- Create: `iphone-agent/railway.toml`

**Step 1: Create project directory and init**

```bash
mkdir -p ~/antigravity-gui/iphone-agent
cd ~/antigravity-gui/iphone-agent
git init
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install express @google/generative-ai @supabase/supabase-js axios node-cron zod winston
npm install -D typescript @types/express @types/node @types/node-cron vitest tsx
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 4: Create .env.example**

```env
# Server
PORT=3000
NODE_ENV=development

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=your_api_key
EVOLUTION_INSTANCE=iphone-agent
OWNER_PHONE=5511999999999

# Google Gemini
GEMINI_API_KEY=your_gemini_key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# Bot Config
MARGIN_THRESHOLD=15
DAILY_SUMMARY_HOUR=8
STRATEGY_INTERVAL_HOURS=6
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.env
*.log
```

**Step 6: Create railway.toml**

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

**Step 7: Update package.json scripts**

Add to package.json:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: project scaffold with deps and config"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

**Step 1: Create types file**

```typescript
// src/types/index.ts

// === iPhone Models ===

export type iPhoneCondition = 'new' | 'used' | 'refurbished';

export interface ExtractedItem {
  model: string;        // e.g. "iPhone 16 Pro"
  storage: string;      // e.g. "256GB"
  color: string | null; // e.g. "Natural Titanium"
  price: number;        // numeric value
  currency: string;     // "USD" | "BRL"
  condition: iPhoneCondition;
}

export interface ExtractionResult {
  type: 'supplier_price' | 'market_price' | 'irrelevant';
  items: ExtractedItem[];
  raw_text: string;
}

// === Database Entities ===

export interface Supplier {
  id: string;
  name: string;
  whatsapp_group_id: string;
  default_fees: Record<string, number> | null;
  created_at: string;
}

export interface SupplierPrice {
  id: string;
  supplier_id: string;
  model: string;
  storage: string;
  color: string | null;
  price: number;
  currency: string;
  condition: iPhoneCondition;
  captured_at: string;
  message_id: string | null;
}

export interface MarketPrice {
  id: string;
  model: string;
  storage: string;
  color: string | null;
  sale_price: number;
  currency: string;
  condition: iPhoneCondition;
  source_group_id: string;
  captured_at: string;
  message_id: string | null;
}

export interface FeeConfig {
  id: string;
  label: string;
  type: 'flat' | 'percent';
  value: number;
  currency: string;
  supplier_id: string | null; // null = global
}

export interface Opportunity {
  id: string;
  supplier_price_id: string;
  market_price_id: string;
  buy_cost: number;      // preco fornecedor + taxas em BRL
  sell_price: number;     // preco de venda mercado em BRL
  margin_pct: number;     // porcentagem de margem
  status: 'active' | 'expired' | 'taken';
  created_at: string;
}

export interface PriceHistory {
  id: string;
  model: string;
  storage: string;
  avg_supplier_price: number;
  avg_market_price: number;
  date: string;
}

export interface ExchangeRate {
  id: string;
  date: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
}

export interface Setting {
  key: string;
  value: string;
}

// === Evolution API ===

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName: string;
    message: {
      conversation?: string;
      extendedTextMessage?: { text: string };
      imageMessage?: {
        caption?: string;
        mimetype: string;
        url?: string;
      };
    };
    messageType: string;
    messageTimestamp: number;
  };
}

export interface ParsedMessage {
  id: string;
  from: string;          // remoteJid
  sender: string;        // pushName
  text: string | null;
  imageUrl: string | null;
  isGroup: boolean;
  isFromMe: boolean;
  timestamp: number;
}

// === Analyzer ===

export interface MarginAnalysis {
  model: string;
  storage: string;
  supplier: string;
  buy_price_usd: number;
  buy_price_brl: number;
  fees_total_brl: number;
  total_cost_brl: number;
  sell_price_brl: number;
  margin_brl: number;
  margin_pct: number;
}

// === Bot Commands ===

export interface BotCommand {
  name: string;
  args: string[];
  raw: string;
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript type definitions"
```

---

## Task 3: Config and Logger

**Files:**
- Create: `src/config.ts`
- Create: `src/utils/logger.ts`

**Step 1: Create config.ts**

```typescript
// src/config.ts
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production']).default('development'),

  EVOLUTION_API_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),
  EVOLUTION_INSTANCE: z.string().min(1),
  OWNER_PHONE: z.string().min(10),

  GEMINI_API_KEY: z.string().min(1),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),

  MARGIN_THRESHOLD: z.coerce.number().default(15),
  DAILY_SUMMARY_HOUR: z.coerce.number().default(8),
  STRATEGY_INTERVAL_HOURS: z.coerce.number().default(6),
});

export type Env = z.infer<typeof envSchema>;

let _config: Env | null = null;

export function getConfig(): Env {
  if (!_config) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
      process.exit(1);
    }
    _config = result.data;
  }
  return _config;
}
```

**Step 2: Create logger.ts**

```typescript
// src/utils/logger.ts
import winston from 'winston';
import { getConfig } from '../config';

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'iphone-agent' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});
```

**Step 3: Write test for config validation**

Create `src/config.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('getConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should fail with missing required env vars', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.stubEnv('EVOLUTION_API_URL', '');

    const { getConfig } = await import('./config');
    getConfig();

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
```

**Step 4: Run test**

```bash
npx vitest run src/config.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/config.ts src/utils/logger.ts src/config.test.ts
git commit -m "feat: add config validation and logger"
```

---

## Task 4: Supabase Client and Migrations

**Files:**
- Create: `src/database/supabase.ts`
- Create: `src/database/migrations/001_initial.sql`

**Step 1: Create Supabase client**

```typescript
// src/database/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../config';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const config = getConfig();
    _client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
  }
  return _client;
}
```

**Step 2: Create initial migration**

```sql
-- src/database/migrations/001_initial.sql

-- Fornecedores
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  whatsapp_group_id TEXT NOT NULL UNIQUE,
  default_fees JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Precos de fornecedores
CREATE TABLE IF NOT EXISTS supplier_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id),
  model TEXT NOT NULL,
  storage TEXT NOT NULL,
  color TEXT,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  condition TEXT NOT NULL DEFAULT 'new',
  captured_at TIMESTAMPTZ DEFAULT now(),
  message_id TEXT
);

CREATE INDEX idx_supplier_prices_model ON supplier_prices(model, storage);
CREATE INDEX idx_supplier_prices_captured ON supplier_prices(captured_at DESC);

-- Precos de mercado (venda)
CREATE TABLE IF NOT EXISTS market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL,
  storage TEXT NOT NULL,
  color TEXT,
  sale_price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  condition TEXT NOT NULL DEFAULT 'new',
  source_group_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT now(),
  message_id TEXT
);

CREATE INDEX idx_market_prices_model ON market_prices(model, storage);
CREATE INDEX idx_market_prices_captured ON market_prices(captured_at DESC);

-- Taxas configuraveis
CREATE TABLE IF NOT EXISTS fees_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('flat', 'percent')),
  value NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  supplier_id UUID REFERENCES suppliers(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Oportunidades
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_price_id UUID REFERENCES supplier_prices(id),
  market_price_id UUID REFERENCES market_prices(id),
  buy_cost NUMERIC(10,2) NOT NULL,
  sell_price NUMERIC(10,2) NOT NULL,
  margin_pct NUMERIC(5,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'taken')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_margin ON opportunities(margin_pct DESC);

-- Historico de precos (snapshot diario)
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL,
  storage TEXT NOT NULL,
  avg_supplier_price NUMERIC(10,2) NOT NULL,
  avg_market_price NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  UNIQUE(model, storage, date)
);

-- Cotacao de cambio
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  from_currency TEXT NOT NULL DEFAULT 'USD',
  to_currency TEXT NOT NULL DEFAULT 'BRL',
  rate NUMERIC(10,4) NOT NULL,
  source TEXT NOT NULL DEFAULT 'awesomeapi',
  UNIQUE(date, from_currency, to_currency)
);

-- Configuracoes do bot
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed de taxas padrao
INSERT INTO fees_config (label, type, value, currency) VALUES
  ('Frete', 'flat', 100, 'BRL'),
  ('Imposto', 'percent', 60, 'BRL')
ON CONFLICT DO NOTHING;

-- Seed de configuracoes padrao
INSERT INTO settings (key, value) VALUES
  ('margin_threshold', '15'),
  ('daily_summary_hour', '8'),
  ('strategy_interval_hours', '6')
ON CONFLICT (key) DO NOTHING;
```

**Step 3: Commit**

```bash
git add src/database/
git commit -m "feat: add Supabase client and initial migration"
```

---

## Task 5: Database Queries

**Files:**
- Create: `src/database/queries/suppliers.ts`
- Create: `src/database/queries/prices.ts`
- Create: `src/database/queries/opportunities.ts`
- Create: `src/database/queries/settings.ts`
- Create: `src/database/queries/exchange.ts`

**Step 1: Create supplier queries**

```typescript
// src/database/queries/suppliers.ts
import { getSupabase } from '../supabase';
import type { Supplier } from '../../types';

export async function findSupplierByGroupId(groupId: string): Promise<Supplier | null> {
  const { data } = await getSupabase()
    .from('suppliers')
    .select('*')
    .eq('whatsapp_group_id', groupId)
    .single();
  return data;
}

export async function listSuppliers(): Promise<Supplier[]> {
  const { data } = await getSupabase()
    .from('suppliers')
    .select('*')
    .order('name');
  return data ?? [];
}

export async function upsertSupplier(name: string, groupId: string): Promise<Supplier> {
  const { data, error } = await getSupabase()
    .from('suppliers')
    .upsert({ name, whatsapp_group_id: groupId }, { onConflict: 'whatsapp_group_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

**Step 2: Create price queries**

```typescript
// src/database/queries/prices.ts
import { getSupabase } from '../supabase';
import type { SupplierPrice, MarketPrice, ExtractedItem } from '../../types';

export async function insertSupplierPrice(
  supplierId: string,
  item: ExtractedItem,
  messageId: string | null
): Promise<SupplierPrice> {
  const { data, error } = await getSupabase()
    .from('supplier_prices')
    .insert({
      supplier_id: supplierId,
      model: item.model,
      storage: item.storage,
      color: item.color,
      price: item.price,
      currency: item.currency,
      condition: item.condition,
      message_id: messageId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertMarketPrice(
  item: ExtractedItem,
  sourceGroupId: string,
  messageId: string | null
): Promise<MarketPrice> {
  const { data, error } = await getSupabase()
    .from('market_prices')
    .insert({
      model: item.model,
      storage: item.storage,
      color: item.color,
      sale_price: item.price,
      currency: item.currency,
      condition: item.condition,
      source_group_id: sourceGroupId,
      message_id: messageId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLatestSupplierPrices(
  model?: string,
  storage?: string
): Promise<SupplierPrice[]> {
  let query = getSupabase()
    .from('supplier_prices')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(50);

  if (model) query = query.ilike('model', `%${model}%`);
  if (storage) query = query.eq('storage', storage);

  const { data } = await query;
  return data ?? [];
}

export async function getLatestMarketPrices(
  model?: string,
  storage?: string
): Promise<MarketPrice[]> {
  let query = getSupabase()
    .from('market_prices')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(50);

  if (model) query = query.ilike('model', `%${model}%`);
  if (storage) query = query.eq('storage', storage);

  const { data } = await query;
  return data ?? [];
}

export async function getAveragePrices(model: string, storage: string, days: number = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [supplierResult, marketResult] = await Promise.all([
    getSupabase()
      .from('supplier_prices')
      .select('price, currency')
      .ilike('model', `%${model}%`)
      .eq('storage', storage)
      .gte('captured_at', since.toISOString()),
    getSupabase()
      .from('market_prices')
      .select('sale_price, currency')
      .ilike('model', `%${model}%`)
      .eq('storage', storage)
      .gte('captured_at', since.toISOString()),
  ]);

  const supplierPrices = supplierResult.data ?? [];
  const marketPrices = marketResult.data ?? [];

  const avgSupplier = supplierPrices.length > 0
    ? supplierPrices.reduce((sum, p) => sum + Number(p.price), 0) / supplierPrices.length
    : null;

  const avgMarket = marketPrices.length > 0
    ? marketPrices.reduce((sum, p) => sum + Number(p.sale_price), 0) / marketPrices.length
    : null;

  return { avgSupplier, avgMarket, supplierCount: supplierPrices.length, marketCount: marketPrices.length };
}
```

**Step 3: Create exchange queries**

```typescript
// src/database/queries/exchange.ts
import { getSupabase } from '../supabase';
import type { ExchangeRate } from '../../types';

export async function getLatestRate(from: string = 'USD', to: string = 'BRL'): Promise<number | null> {
  const { data } = await getSupabase()
    .from('exchange_rates')
    .select('rate')
    .eq('from_currency', from)
    .eq('to_currency', to)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  return data ? Number(data.rate) : null;
}

export async function upsertRate(date: string, rate: number, from: string = 'USD', to: string = 'BRL'): Promise<void> {
  await getSupabase()
    .from('exchange_rates')
    .upsert({
      date,
      from_currency: from,
      to_currency: to,
      rate,
      source: 'awesomeapi',
    }, { onConflict: 'date,from_currency,to_currency' });
}
```

**Step 4: Create opportunity queries**

```typescript
// src/database/queries/opportunities.ts
import { getSupabase } from '../supabase';
import type { Opportunity } from '../../types';

export async function insertOpportunity(data: {
  supplier_price_id: string;
  market_price_id: string;
  buy_cost: number;
  sell_price: number;
  margin_pct: number;
}): Promise<Opportunity> {
  const { data: result, error } = await getSupabase()
    .from('opportunities')
    .insert({ ...data, status: 'active' })
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getActiveOpportunities(limit: number = 10): Promise<Opportunity[]> {
  const { data } = await getSupabase()
    .from('opportunities')
    .select('*')
    .eq('status', 'active')
    .order('margin_pct', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function expireOldOpportunities(hoursOld: number = 24): Promise<number> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursOld);

  const { count } = await getSupabase()
    .from('opportunities')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('created_at', cutoff.toISOString())
    .select('id', { count: 'exact', head: true });

  return count ?? 0;
}
```

**Step 5: Create settings queries**

```typescript
// src/database/queries/settings.ts
import { getSupabase } from '../supabase';

export async function getSetting(key: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getSupabase()
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

export async function getNumericSetting(key: string, fallback: number): Promise<number> {
  const val = await getSetting(key);
  return val !== null ? Number(val) : fallback;
}
```

**Step 6: Commit**

```bash
git add src/database/queries/
git commit -m "feat: add database query modules for all entities"
```

---

## Task 6: Exchange Rate Service

**Files:**
- Create: `src/services/exchange.ts`
- Create: `src/services/exchange.test.ts`

**Step 1: Write the test**

```typescript
// src/services/exchange.test.ts
import { describe, it, expect, vi } from 'vitest';
import { parseAwesomeApiResponse } from './exchange';

describe('parseAwesomeApiResponse', () => {
  it('should extract USD-BRL rate from API response', () => {
    const response = {
      USDBRL: {
        code: 'USD',
        codein: 'BRL',
        name: 'Dolar Americano/Real Brasileiro',
        high: '5.98',
        low: '5.90',
        bid: '5.95',
        ask: '5.96',
        timestamp: '1709164800',
        create_date: '2026-02-28 12:00:00',
      },
    };

    const rate = parseAwesomeApiResponse(response);
    expect(rate).toBe(5.95);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/exchange.test.ts
```

Expected: FAIL — module not found

**Step 3: Implement exchange service**

```typescript
// src/services/exchange.ts
import axios from 'axios';
import { upsertRate, getLatestRate } from '../database/queries/exchange';
import { logger } from '../utils/logger';

const AWESOME_API_URL = 'https://economia.awesomeapi.com.br/last/USD-BRL';

interface AwesomeApiResponse {
  USDBRL: {
    bid: string;
    ask: string;
    high: string;
    low: string;
    create_date: string;
  };
}

export function parseAwesomeApiResponse(response: AwesomeApiResponse): number {
  return parseFloat(response.USDBRL.bid);
}

export async function fetchAndSaveExchangeRate(): Promise<number> {
  try {
    const { data } = await axios.get<AwesomeApiResponse>(AWESOME_API_URL);
    const rate = parseAwesomeApiResponse(data);
    const today = new Date().toISOString().split('T')[0];

    await upsertRate(today, rate);
    logger.info(`Exchange rate updated: USD/BRL = ${rate}`);

    return rate;
  } catch (error) {
    logger.error('Failed to fetch exchange rate', { error });
    const cached = await getLatestRate();
    if (cached) {
      logger.warn(`Using cached rate: ${cached}`);
      return cached;
    }
    throw new Error('No exchange rate available');
  }
}

export async function getCurrentRate(): Promise<number> {
  const cached = await getLatestRate();
  if (cached) return cached;
  return fetchAndSaveExchangeRate();
}
```

**Step 4: Run test**

```bash
npx vitest run src/services/exchange.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/exchange.ts src/services/exchange.test.ts
git commit -m "feat: add exchange rate service with awesomeapi integration"
```

---

## Task 7: WhatsApp Service (Evolution API)

**Files:**
- Create: `src/services/whatsapp.ts`
- Create: `src/utils/parser.ts`

**Step 1: Create message parser utility**

```typescript
// src/utils/parser.ts
import type { EvolutionWebhookPayload, ParsedMessage, BotCommand } from '../types';

export function parseWebhookMessage(payload: EvolutionWebhookPayload): ParsedMessage {
  const { data } = payload;
  const text =
    data.message.conversation ??
    data.message.extendedTextMessage?.text ??
    data.message.imageMessage?.caption ??
    null;

  const imageUrl = data.message.imageMessage?.url ?? null;
  const isGroup = data.key.remoteJid.endsWith('@g.us');

  return {
    id: data.key.id,
    from: data.key.remoteJid,
    sender: data.pushName,
    text,
    imageUrl,
    isGroup,
    isFromMe: data.key.fromMe,
    timestamp: data.messageTimestamp,
  };
}

export function parseCommand(text: string): BotCommand | null {
  if (!text.startsWith('/')) return null;

  const parts = text.trim().split(/\s+/);
  const name = parts[0].substring(1).toLowerCase();
  const args = parts.slice(1);

  return { name, args, raw: text };
}
```

**Step 2: Create WhatsApp service**

```typescript
// src/services/whatsapp.ts
import axios from 'axios';
import { getConfig } from '../config';
import { logger } from '../utils/logger';

export async function sendMessage(to: string, text: string): Promise<void> {
  const config = getConfig();
  try {
    await axios.post(
      `${config.EVOLUTION_API_URL}/message/sendText/${config.EVOLUTION_INSTANCE}`,
      {
        number: to,
        text,
      },
      {
        headers: { apikey: config.EVOLUTION_API_KEY },
      }
    );
    logger.debug(`Message sent to ${to}`);
  } catch (error) {
    logger.error(`Failed to send message to ${to}`, { error });
    throw error;
  }
}

export async function sendMessageToOwner(text: string): Promise<void> {
  const config = getConfig();
  await sendMessage(config.OWNER_PHONE, text);
}

export async function getBase64FromUrl(url: string): Promise<string> {
  const { data } = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(data).toString('base64');
}
```

**Step 3: Write parser test**

```typescript
// src/utils/parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseCommand } from './parser';

describe('parseCommand', () => {
  it('should parse /precos iPhone 16 Pro 256GB', () => {
    const cmd = parseCommand('/precos iPhone 16 Pro 256GB');
    expect(cmd).toEqual({
      name: 'precos',
      args: ['iPhone', '16', 'Pro', '256GB'],
      raw: '/precos iPhone 16 Pro 256GB',
    });
  });

  it('should parse /cotacao with no args', () => {
    const cmd = parseCommand('/cotacao');
    expect(cmd).toEqual({
      name: 'cotacao',
      args: [],
      raw: '/cotacao',
    });
  });

  it('should return null for non-command text', () => {
    const cmd = parseCommand('hello world');
    expect(cmd).toBeNull();
  });

  it('should parse /taxas frete 150', () => {
    const cmd = parseCommand('/taxas frete 150');
    expect(cmd).toEqual({
      name: 'taxas',
      args: ['frete', '150'],
      raw: '/taxas frete 150',
    });
  });
});
```

**Step 4: Run tests**

```bash
npx vitest run src/utils/parser.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/whatsapp.ts src/utils/parser.ts src/utils/parser.test.ts
git commit -m "feat: add WhatsApp service and message parser"
```

---

## Task 8: Gemini Extractor (Camada 1)

**Files:**
- Create: `src/services/gemini/extractor.ts`

**Step 1: Implement the extractor**

```typescript
// src/services/gemini/extractor.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { getConfig } from '../../config';
import { logger } from '../../utils/logger';
import type { ExtractionResult } from '../../types';

const extractionSchema = z.object({
  type: z.enum(['supplier_price', 'market_price', 'irrelevant']),
  items: z.array(z.object({
    model: z.string(),
    storage: z.string(),
    color: z.string().nullable(),
    price: z.number(),
    currency: z.string(),
    condition: z.enum(['new', 'used', 'refurbished']),
  })),
});

const SYSTEM_PROMPT = `Voce e um assistente especializado em extrair dados de precos de iPhones de mensagens de WhatsApp.

Analise a mensagem e retorne um JSON com a estrutura:
{
  "type": "supplier_price" | "market_price" | "irrelevant",
  "items": [
    {
      "model": "iPhone 16 Pro",
      "storage": "256GB",
      "color": "Natural Titanium" ou null,
      "price": 899.00,
      "currency": "USD" ou "BRL",
      "condition": "new" | "used" | "refurbished"
    }
  ]
}

Regras:
- "supplier_price": quando a mensagem parece ser de um fornecedor/distribuidor oferecendo iPhones para revenda (precos de compra, normalmente em USD)
- "market_price": quando a mensagem parece ser de alguem vendendo iPhone para consumidor final (precos de venda, normalmente em BRL)
- "irrelevant": quando a mensagem nao contem precos de iPhone
- Extraia TODOS os modelos/precos da mensagem
- Normalize o modelo (ex: "ip16p" -> "iPhone 16 Pro", "16pm" -> "iPhone 16 Pro Max")
- Normalize o storage (ex: "256" -> "256GB")
- Se a moeda nao estiver explicita, assuma USD para fornecedor e BRL para mercado
- Se a condicao nao estiver explicita, assuma "new"
- Retorne APENAS o JSON, sem texto adicional`;

function getGemini() {
  const config = getConfig();
  return new GoogleGenerativeAI(config.GEMINI_API_KEY);
}

export async function extractPriceData(text: string): Promise<ExtractionResult> {
  const genAI = getGemini();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  try {
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nMensagem:\n${text}` }] },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);
    const validated = extractionSchema.parse(parsed);

    return { ...validated, raw_text: text };
  } catch (error) {
    logger.error('Gemini extraction failed', { error, text: text.substring(0, 200) });
    return { type: 'irrelevant', items: [], raw_text: text };
  }
}

export async function extractPriceDataFromImage(base64Image: string, caption: string | null): Promise<ExtractionResult> {
  const genAI = getGemini();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  try {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: `${SYSTEM_PROMPT}\n\nAnalise a imagem abaixo que contem uma tabela de precos de iPhones.${caption ? `\nLegenda: ${caption}` : ''}` },
      { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
    ];

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);
    const validated = extractionSchema.parse(parsed);

    return { ...validated, raw_text: caption ?? '[image]' };
  } catch (error) {
    logger.error('Gemini image extraction failed', { error });
    return { type: 'irrelevant', items: [], raw_text: caption ?? '[image]' };
  }
}
```

**Step 2: Commit**

```bash
git add src/services/gemini/extractor.ts
git commit -m "feat: add Gemini extractor service (Camada 1)"
```

---

## Task 9: Analyzer Engine

**Files:**
- Create: `src/services/analyzer.ts`
- Create: `src/services/analyzer.test.ts`

**Step 1: Write tests**

```typescript
// src/services/analyzer.test.ts
import { describe, it, expect } from 'vitest';
import { calculateMargin, applyFees } from './analyzer';

describe('applyFees', () => {
  it('should apply flat fee in BRL', () => {
    const result = applyFees(5000, [
      { label: 'Frete', type: 'flat', value: 100 },
    ]);
    expect(result).toBe(5100);
  });

  it('should apply percent fee', () => {
    const result = applyFees(5000, [
      { label: 'Imposto', type: 'percent', value: 60 },
    ]);
    expect(result).toBe(8000); // 5000 + 60% = 8000
  });

  it('should apply multiple fees sequentially', () => {
    const result = applyFees(5000, [
      { label: 'Imposto', type: 'percent', value: 60 },
      { label: 'Frete', type: 'flat', value: 150 },
    ]);
    expect(result).toBe(8150); // 5000 + 3000 + 150
  });
});

describe('calculateMargin', () => {
  it('should calculate margin percentage', () => {
    const margin = calculateMargin(6000, 8000);
    expect(margin.margin_brl).toBe(2000);
    expect(margin.margin_pct).toBeCloseTo(33.33, 1);
  });

  it('should return negative margin when cost > sell', () => {
    const margin = calculateMargin(8000, 6000);
    expect(margin.margin_brl).toBe(-2000);
    expect(margin.margin_pct).toBeCloseTo(-25, 1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/analyzer.test.ts
```

Expected: FAIL

**Step 3: Implement analyzer**

```typescript
// src/services/analyzer.ts
import { getCurrentRate } from './exchange';
import { getLatestSupplierPrices, getLatestMarketPrices } from '../database/queries/prices';
import { getActiveOpportunities, insertOpportunity } from '../database/queries/opportunities';
import { logger } from '../utils/logger';
import type { MarginAnalysis, FeeConfig } from '../types';

interface SimpleFee {
  label: string;
  type: 'flat' | 'percent';
  value: number;
}

export function applyFees(basePriceBrl: number, fees: SimpleFee[]): number {
  let total = basePriceBrl;
  for (const fee of fees) {
    if (fee.type === 'flat') {
      total += fee.value;
    } else if (fee.type === 'percent') {
      total += basePriceBrl * (fee.value / 100);
    }
  }
  return total;
}

export function calculateMargin(totalCost: number, sellPrice: number) {
  const margin_brl = sellPrice - totalCost;
  const margin_pct = (margin_brl / sellPrice) * 100;
  return { margin_brl, margin_pct };
}

export async function analyzeOpportunities(
  fees: SimpleFee[],
  thresholdPct: number
): Promise<MarginAnalysis[]> {
  const rate = await getCurrentRate();
  const supplierPrices = await getLatestSupplierPrices();
  const marketPrices = await getLatestMarketPrices();

  const opportunities: MarginAnalysis[] = [];

  for (const sp of supplierPrices) {
    const buyPriceUsd = Number(sp.price);
    const buyPriceBrl = sp.currency === 'USD' ? buyPriceUsd * rate : buyPriceUsd;
    const totalCostBrl = applyFees(buyPriceBrl, fees);

    // Find matching market prices
    const matching = marketPrices.filter(
      (mp) =>
        mp.model.toLowerCase() === sp.model.toLowerCase() &&
        mp.storage === sp.storage
    );

    for (const mp of matching) {
      const sellPriceBrl = mp.currency === 'BRL' ? Number(mp.sale_price) : Number(mp.sale_price) * rate;
      const { margin_brl, margin_pct } = calculateMargin(totalCostBrl, sellPriceBrl);

      if (margin_pct >= thresholdPct) {
        opportunities.push({
          model: sp.model,
          storage: sp.storage,
          supplier: sp.supplier_id,
          buy_price_usd: buyPriceUsd,
          buy_price_brl: buyPriceBrl,
          fees_total_brl: totalCostBrl - buyPriceBrl,
          total_cost_brl: totalCostBrl,
          sell_price_brl: sellPriceBrl,
          margin_brl,
          margin_pct,
        });
      }
    }
  }

  // Sort by highest margin
  opportunities.sort((a, b) => b.margin_pct - a.margin_pct);

  return opportunities;
}

export function formatMarginAnalysis(analysis: MarginAnalysis): string {
  return [
    `*${analysis.model} ${analysis.storage}*`,
    `Compra: US$ ${analysis.buy_price_usd.toFixed(2)} (R$ ${analysis.buy_price_brl.toFixed(2)})`,
    `Taxas: R$ ${analysis.fees_total_brl.toFixed(2)}`,
    `Custo total: R$ ${analysis.total_cost_brl.toFixed(2)}`,
    `Venda mercado: R$ ${analysis.sell_price_brl.toFixed(2)}`,
    `*Margem: R$ ${analysis.margin_brl.toFixed(2)} (${analysis.margin_pct.toFixed(1)}%)*`,
  ].join('\n');
}
```

**Step 4: Run tests**

```bash
npx vitest run src/services/analyzer.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/analyzer.ts src/services/analyzer.test.ts
git commit -m "feat: add analyzer engine for margin calculation"
```

---

## Task 10: Gemini Consultant (Camada 2)

**Files:**
- Create: `src/services/gemini/consultant.ts`

**Step 1: Implement consultant**

```typescript
// src/services/gemini/consultant.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig } from '../../config';
import { getLatestSupplierPrices, getLatestMarketPrices, getAveragePrices } from '../../database/queries/prices';
import { getCurrentRate } from '../exchange';
import { logger } from '../../utils/logger';
import { getSupabase } from '../../database/supabase';

const CONSULTANT_PROMPT = `Voce e um consultor especialista em compra e revenda de iPhones no Brasil.

Voce tem acesso aos dados de precos de fornecedores (compra) e precos de mercado (venda).
Responda em portugues brasileiro, de forma direta e pratica.
Use dados reais para fundamentar suas recomendacoes.
Formate a resposta para WhatsApp (use *negrito* e _italico_).
Seja objetivo — o usuario quer saber se vale a pena comprar ou nao.`;

function getGemini() {
  return new GoogleGenerativeAI(getConfig().GEMINI_API_KEY);
}

export async function consultGemini(question: string): Promise<string> {
  const genAI = getGemini();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Gather context data
  const rate = await getCurrentRate();
  const supplierPrices = await getLatestSupplierPrices();
  const marketPrices = await getLatestMarketPrices();

  const { data: fees } = await getSupabase().from('fees_config').select('*');

  const context = [
    `Cotacao USD/BRL hoje: R$ ${rate.toFixed(2)}`,
    '',
    `Ultimos precos de fornecedores (${supplierPrices.length} registros):`,
    ...supplierPrices.slice(0, 20).map(
      (p) => `- ${p.model} ${p.storage}: ${p.currency} ${Number(p.price).toFixed(2)} (${new Date(p.captured_at).toLocaleDateString('pt-BR')})`
    ),
    '',
    `Ultimos precos de mercado (${marketPrices.length} registros):`,
    ...marketPrices.slice(0, 20).map(
      (p) => `- ${p.model} ${p.storage}: R$ ${Number(p.sale_price).toFixed(2)} (${new Date(p.captured_at).toLocaleDateString('pt-BR')})`
    ),
    '',
    `Taxas configuradas:`,
    ...(fees ?? []).map((f) => `- ${f.label}: ${f.type === 'flat' ? `R$ ${f.value}` : `${f.value}%`}`),
  ].join('\n');

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${CONSULTANT_PROMPT}\n\nDados atuais:\n${context}\n\nPergunta do usuario:\n${question}` }],
        },
      ],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
    });

    return result.response.text();
  } catch (error) {
    logger.error('Consultant query failed', { error });
    return 'Desculpe, nao consegui processar sua pergunta agora. Tente novamente.';
  }
}
```

**Step 2: Commit**

```bash
git add src/services/gemini/consultant.ts
git commit -m "feat: add Gemini consultant service (Camada 2)"
```

---

## Task 11: Gemini Strategist (Camada 3)

**Files:**
- Create: `src/services/gemini/strategist.ts`

**Step 1: Implement strategist**

```typescript
// src/services/gemini/strategist.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig } from '../../config';
import { getSupabase } from '../../database/supabase';
import { getCurrentRate } from '../exchange';
import { sendMessageToOwner } from '../whatsapp';
import { logger } from '../../utils/logger';

const STRATEGIST_PROMPT = `Voce e um estrategista de compra de iPhones. Analise os dados de precos e tendencias abaixo e gere recomendacoes proativas.

Seu objetivo:
1. Identificar tendencias (precos subindo ou descendo)
2. Detectar oportunidades (margem acima do threshold)
3. Alertar sobre eventos relevantes (queda brusca, promocao)

Formate para WhatsApp.
Seja direto: diga o que comprar, quanto, e por que.
Se nao houver nada relevante, diga "Sem oportunidades relevantes no momento."`;

function getGemini() {
  return new GoogleGenerativeAI(getConfig().GEMINI_API_KEY);
}

export async function runStrategicAnalysis(): Promise<string> {
  const genAI = getGemini();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const rate = await getCurrentRate();
  const config = getConfig();

  // Get recent prices (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [supplierResult, marketResult, historyResult, feesResult] = await Promise.all([
    getSupabase()
      .from('supplier_prices')
      .select('*')
      .gte('captured_at', sevenDaysAgo.toISOString())
      .order('captured_at', { ascending: false }),
    getSupabase()
      .from('market_prices')
      .select('*')
      .gte('captured_at', sevenDaysAgo.toISOString())
      .order('captured_at', { ascending: false }),
    getSupabase()
      .from('price_history')
      .select('*')
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false }),
    getSupabase()
      .from('fees_config')
      .select('*'),
  ]);

  const context = [
    `Cotacao USD/BRL: R$ ${rate.toFixed(2)}`,
    `Threshold de margem: ${config.MARGIN_THRESHOLD}%`,
    '',
    `Precos fornecedores (7 dias, ${supplierResult.data?.length ?? 0} registros):`,
    ...(supplierResult.data ?? []).slice(0, 30).map(
      (p) => `${p.model} ${p.storage}: ${p.currency} ${p.price} em ${new Date(p.captured_at).toLocaleDateString('pt-BR')}`
    ),
    '',
    `Precos mercado (7 dias, ${marketResult.data?.length ?? 0} registros):`,
    ...(marketResult.data ?? []).slice(0, 30).map(
      (p) => `${p.model} ${p.storage}: R$ ${p.sale_price} em ${new Date(p.captured_at).toLocaleDateString('pt-BR')}`
    ),
    '',
    `Historico diario:`,
    ...(historyResult.data ?? []).map(
      (h) => `${h.model} ${h.storage}: compra R$ ${h.avg_supplier_price} / venda R$ ${h.avg_market_price} em ${h.date}`
    ),
    '',
    `Taxas:`,
    ...(feesResult.data ?? []).map(
      (f) => `${f.label}: ${f.type === 'flat' ? `R$ ${f.value}` : `${f.value}%`}`
    ),
  ].join('\n');

  try {
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${STRATEGIST_PROMPT}\n\nDados:\n${context}` }] },
      ],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1500 },
    });

    return result.response.text();
  } catch (error) {
    logger.error('Strategic analysis failed', { error });
    return 'Erro ao processar analise estrategica.';
  }
}

export async function runAndNotify(): Promise<void> {
  logger.info('Running strategic analysis...');
  const analysis = await runStrategicAnalysis();

  if (!analysis.includes('Sem oportunidades relevantes')) {
    await sendMessageToOwner(`*Analise Estrategica*\n\n${analysis}`);
    logger.info('Strategic alert sent to owner');
  } else {
    logger.info('No relevant opportunities found');
  }
}
```

**Step 2: Commit**

```bash
git add src/services/gemini/strategist.ts
git commit -m "feat: add Gemini strategist service (Camada 3)"
```

---

## Task 12: Message Handlers

**Files:**
- Create: `src/handlers/message-handler.ts`
- Create: `src/handlers/group-handler.ts`
- Create: `src/handlers/command-handler.ts`

**Step 1: Create group handler**

```typescript
// src/handlers/group-handler.ts
import { extractPriceData, extractPriceDataFromImage } from '../services/gemini/extractor';
import { findSupplierByGroupId } from '../database/queries/suppliers';
import { insertSupplierPrice, insertMarketPrice } from '../database/queries/prices';
import { getBase64FromUrl } from '../services/whatsapp';
import { logger } from '../utils/logger';
import type { ParsedMessage } from '../types';

export async function handleGroupMessage(msg: ParsedMessage): Promise<void> {
  // Skip if no content to analyze
  if (!msg.text && !msg.imageUrl) return;

  let extraction;

  if (msg.imageUrl) {
    const base64 = await getBase64FromUrl(msg.imageUrl);
    extraction = await extractPriceDataFromImage(base64, msg.text);
  } else if (msg.text) {
    extraction = await extractPriceData(msg.text);
  } else {
    return;
  }

  if (extraction.type === 'irrelevant' || extraction.items.length === 0) {
    return;
  }

  const supplier = await findSupplierByGroupId(msg.from);

  if (extraction.type === 'supplier_price' && supplier) {
    for (const item of extraction.items) {
      await insertSupplierPrice(supplier.id, item, msg.id);
    }
    logger.info(`Extracted ${extraction.items.length} supplier prices from ${supplier.name}`);
  } else if (extraction.type === 'market_price') {
    for (const item of extraction.items) {
      await insertMarketPrice(item, msg.from, msg.id);
    }
    logger.info(`Extracted ${extraction.items.length} market prices from group ${msg.from}`);
  }
}
```

**Step 2: Create command handler**

```typescript
// src/handlers/command-handler.ts
import { parseCommand } from '../utils/parser';
import { sendMessageToOwner } from '../services/whatsapp';
import { consultGemini } from '../services/gemini/consultant';
import { getCurrentRate } from '../services/exchange';
import { getLatestSupplierPrices, getLatestMarketPrices, getAveragePrices } from '../database/queries/prices';
import { listSuppliers } from '../database/queries/suppliers';
import { getActiveOpportunities } from '../database/queries/opportunities';
import { getSetting, setSetting } from '../database/queries/settings';
import { analyzeOpportunities, formatMarginAnalysis } from '../services/analyzer';
import { getSupabase } from '../database/supabase';
import { logger } from '../utils/logger';
import type { ParsedMessage } from '../types';

export async function handlePrivateMessage(msg: ParsedMessage): Promise<void> {
  if (!msg.text) return;

  const command = parseCommand(msg.text);

  if (command) {
    await handleCommand(command.name, command.args);
  } else {
    // Natural language — send to consultant
    const response = await consultGemini(msg.text);
    await sendMessageToOwner(response);
  }
}

async function handleCommand(name: string, args: string[]): Promise<void> {
  switch (name) {
    case 'precos':
      await cmdPrecos(args);
      break;
    case 'fornecedores':
      await cmdFornecedores();
      break;
    case 'oportunidades':
      await cmdOportunidades();
      break;
    case 'tendencia':
      await cmdTendencia(args);
      break;
    case 'cotacao':
      await cmdCotacao();
      break;
    case 'taxas':
      await cmdTaxas(args);
      break;
    case 'margem':
      await cmdMargem(args);
      break;
    case 'grupos':
      await cmdGrupos();
      break;
    case 'ajuda':
      await cmdAjuda();
      break;
    default:
      await sendMessageToOwner(`Comando desconhecido: /${name}\nDigite /ajuda para ver os comandos.`);
  }
}

async function cmdPrecos(args: string[]): Promise<void> {
  const query = args.join(' ');
  if (!query) {
    await sendMessageToOwner('Use: /precos iPhone 16 Pro 256GB');
    return;
  }

  // Parse model and storage from args
  const storageMatch = query.match(/(\d+)\s*GB/i);
  const storage = storageMatch ? `${storageMatch[1]}GB` : undefined;
  const model = query.replace(/\d+\s*GB/i, '').trim();

  const avg = await getAveragePrices(model, storage ?? '256GB');
  const rate = await getCurrentRate();

  if (!avg.avgSupplier && !avg.avgMarket) {
    await sendMessageToOwner(`Sem dados de preco para "${query}" nos ultimos 7 dias.`);
    return;
  }

  const lines = [`*Precos: ${query}*`, ''];
  if (avg.avgSupplier !== null) {
    const brl = avg.avgSupplier * rate;
    lines.push(`Compra (fornecedor): US$ ${avg.avgSupplier.toFixed(2)} (R$ ${brl.toFixed(2)})`);
    lines.push(`Baseado em ${avg.supplierCount} registro(s)`);
  }
  if (avg.avgMarket !== null) {
    lines.push(`Venda (mercado): R$ ${avg.avgMarket.toFixed(2)}`);
    lines.push(`Baseado em ${avg.marketCount} registro(s)`);
  }
  if (avg.avgSupplier !== null && avg.avgMarket !== null) {
    const cost = avg.avgSupplier * rate;
    const margin = ((avg.avgMarket - cost) / avg.avgMarket) * 100;
    lines.push('');
    lines.push(`*Margem bruta (sem taxas): ${margin.toFixed(1)}%*`);
  }

  await sendMessageToOwner(lines.join('\n'));
}

async function cmdFornecedores(): Promise<void> {
  const suppliers = await listSuppliers();
  if (suppliers.length === 0) {
    await sendMessageToOwner('Nenhum fornecedor cadastrado.');
    return;
  }

  const lines = ['*Fornecedores*', ''];
  for (const s of suppliers) {
    lines.push(`- ${s.name}`);
  }
  await sendMessageToOwner(lines.join('\n'));
}

async function cmdOportunidades(): Promise<void> {
  const { data: fees } = await getSupabase().from('fees_config').select('*');
  const threshold = await getSetting('margin_threshold');

  const opps = await analyzeOpportunities(
    (fees ?? []).map((f) => ({ label: f.label, type: f.type, value: Number(f.value) })),
    Number(threshold ?? 15)
  );

  if (opps.length === 0) {
    await sendMessageToOwner('Sem oportunidades acima do threshold configurado.');
    return;
  }

  const lines = [`*Top ${Math.min(opps.length, 5)} Oportunidades*`, ''];
  for (const opp of opps.slice(0, 5)) {
    lines.push(formatMarginAnalysis(opp));
    lines.push('');
  }
  await sendMessageToOwner(lines.join('\n'));
}

async function cmdTendencia(args: string[]): Promise<void> {
  const query = args.join(' ');
  if (!query) {
    await sendMessageToOwner('Use: /tendencia iPhone 16 Pro 256GB');
    return;
  }

  const storageMatch = query.match(/(\d+)\s*GB/i);
  const storage = storageMatch ? `${storageMatch[1]}GB` : '256GB';
  const model = query.replace(/\d+\s*GB/i, '').trim();

  const { data: history } = await getSupabase()
    .from('price_history')
    .select('*')
    .ilike('model', `%${model}%`)
    .eq('storage', storage)
    .order('date', { ascending: true })
    .limit(30);

  if (!history || history.length === 0) {
    await sendMessageToOwner(`Sem historico de precos para "${query}".`);
    return;
  }

  const lines = [`*Tendencia: ${query}*`, `Ultimos ${history.length} dias`, ''];
  for (const h of history) {
    lines.push(`${h.date}: Compra R$ ${Number(h.avg_supplier_price).toFixed(0)} | Venda R$ ${Number(h.avg_market_price).toFixed(0)}`);
  }
  await sendMessageToOwner(lines.join('\n'));
}

async function cmdCotacao(): Promise<void> {
  const rate = await getCurrentRate();
  await sendMessageToOwner(`*Cotacao USD/BRL*\nR$ ${rate.toFixed(4)}`);
}

async function cmdTaxas(args: string[]): Promise<void> {
  if (args.length >= 2) {
    // Update fee: /taxas frete 150
    const label = args[0];
    const value = Number(args[1]);
    if (isNaN(value)) {
      await sendMessageToOwner('Valor invalido. Use: /taxas frete 150');
      return;
    }
    await getSupabase()
      .from('fees_config')
      .update({ value })
      .ilike('label', label);
    await sendMessageToOwner(`Taxa "${label}" atualizada para ${value}.`);
    return;
  }

  const { data: fees } = await getSupabase().from('fees_config').select('*');
  if (!fees || fees.length === 0) {
    await sendMessageToOwner('Nenhuma taxa configurada.');
    return;
  }

  const lines = ['*Taxas Configuradas*', ''];
  for (const f of fees) {
    const display = f.type === 'flat' ? `R$ ${Number(f.value).toFixed(2)}` : `${f.value}%`;
    lines.push(`- ${f.label}: ${display} (${f.supplier_id ? 'por fornecedor' : 'global'})`);
  }
  await sendMessageToOwner(lines.join('\n'));
}

async function cmdMargem(args: string[]): Promise<void> {
  if (args.length === 0) {
    const current = await getSetting('margin_threshold');
    await sendMessageToOwner(`Threshold de margem atual: ${current ?? 15}%`);
    return;
  }
  const value = args[0];
  await setSetting('margin_threshold', value);
  await sendMessageToOwner(`Threshold de margem atualizado para ${value}%.`);
}

async function cmdGrupos(): Promise<void> {
  const suppliers = await listSuppliers();
  const lines = ['*Grupos Monitorados*', ''];
  for (const s of suppliers) {
    lines.push(`- ${s.name}: ${s.whatsapp_group_id}`);
  }
  if (suppliers.length === 0) lines.push('Nenhum grupo monitorado.');
  await sendMessageToOwner(lines.join('\n'));
}

async function cmdAjuda(): Promise<void> {
  const help = [
    '*Comandos do iPhoneAgent*',
    '',
    '/precos iPhone 16 Pro 256GB — Preco medio compra vs venda',
    '/fornecedores — Lista fornecedores ativos',
    '/oportunidades — Melhores margens agora',
    '/tendencia iPhone 15 128GB — Evolucao de preco',
    '/cotacao — Cotacao USD/BRL do dia',
    '/taxas — Ver taxas configuradas',
    '/taxas frete 150 — Atualizar taxa',
    '/margem 15 — Configurar threshold de alerta',
    '/grupos — Grupos monitorados',
    '/ajuda — Esta mensagem',
    '',
    'Ou mande uma pergunta em linguagem natural!',
  ];
  await sendMessageToOwner(help.join('\n'));
}
```

**Step 3: Create message router**

```typescript
// src/handlers/message-handler.ts
import { handleGroupMessage } from './group-handler';
import { handlePrivateMessage } from './command-handler';
import { parseWebhookMessage } from '../utils/parser';
import { getConfig } from '../config';
import { logger } from '../utils/logger';
import type { EvolutionWebhookPayload } from '../types';

export async function handleIncomingMessage(payload: EvolutionWebhookPayload): Promise<void> {
  const msg = parseWebhookMessage(payload);

  // Skip own messages
  if (msg.isFromMe) return;

  logger.debug(`Message from ${msg.from}: ${msg.text?.substring(0, 100) ?? '[media]'}`);

  if (msg.isGroup) {
    await handleGroupMessage(msg);
  } else {
    // Only respond to owner's private messages
    const config = getConfig();
    if (msg.from.includes(config.OWNER_PHONE)) {
      await handlePrivateMessage(msg);
    }
  }
}
```

**Step 4: Commit**

```bash
git add src/handlers/
git commit -m "feat: add message handlers (group, command, router)"
```

---

## Task 13: Scheduler (Cron Jobs)

**Files:**
- Create: `src/services/scheduler.ts`

**Step 1: Implement scheduler**

```typescript
// src/services/scheduler.ts
import cron from 'node-cron';
import { getConfig } from '../config';
import { fetchAndSaveExchangeRate } from './exchange';
import { runAndNotify } from './gemini/strategist';
import { expireOldOpportunities } from '../database/queries/opportunities';
import { getSupabase } from '../database/supabase';
import { sendMessageToOwner } from './whatsapp';
import { analyzeOpportunities, formatMarginAnalysis } from './analyzer';
import { getNumericSetting } from '../database/queries/settings';
import { logger } from '../utils/logger';

export function startScheduler(): void {
  const config = getConfig();

  // Update exchange rate every day at 6am
  cron.schedule('0 6 * * *', async () => {
    logger.info('Cron: updating exchange rate');
    await fetchAndSaveExchangeRate();
  });

  // Daily summary at configured hour
  cron.schedule(`0 ${config.DAILY_SUMMARY_HOUR} * * *`, async () => {
    logger.info('Cron: sending daily summary');
    await sendDailySummary();
  });

  // Strategic analysis at configured interval
  cron.schedule(`0 */${config.STRATEGY_INTERVAL_HOURS} * * *`, async () => {
    logger.info('Cron: running strategic analysis');
    await runAndNotify();
  });

  // Expire old opportunities daily at midnight
  cron.schedule('0 0 * * *', async () => {
    const count = await expireOldOpportunities(48);
    logger.info(`Cron: expired ${count} old opportunities`);
  });

  // Save daily price history at 23:55
  cron.schedule('55 23 * * *', async () => {
    logger.info('Cron: saving daily price history');
    await saveDailyHistory();
  });

  logger.info('Scheduler started');
}

async function sendDailySummary(): Promise<void> {
  try {
    const { data: fees } = await getSupabase().from('fees_config').select('*');
    const threshold = await getNumericSetting('margin_threshold', 15);

    const opps = await analyzeOpportunities(
      (fees ?? []).map((f) => ({ label: f.label, type: f.type, value: Number(f.value) })),
      threshold
    );

    if (opps.length === 0) {
      await sendMessageToOwner('*Resumo Diario*\n\nSem oportunidades acima do threshold hoje.');
      return;
    }

    const lines = [
      '*Resumo Diario — iPhoneAgent*',
      `${opps.length} oportunidade(s) encontrada(s)`,
      '',
    ];

    for (const opp of opps.slice(0, 5)) {
      lines.push(formatMarginAnalysis(opp));
      lines.push('');
    }

    await sendMessageToOwner(lines.join('\n'));
  } catch (error) {
    logger.error('Failed to send daily summary', { error });
  }
}

async function saveDailyHistory(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Aggregate today's supplier prices
  const { data: supplierAgg } = await getSupabase().rpc('aggregate_daily_prices', {
    target_date: today,
  });

  // Fallback: manual aggregation if RPC not available
  if (!supplierAgg) {
    const { data: suppliers } = await getSupabase()
      .from('supplier_prices')
      .select('model, storage, price')
      .gte('captured_at', `${today}T00:00:00`)
      .lte('captured_at', `${today}T23:59:59`);

    const { data: market } = await getSupabase()
      .from('market_prices')
      .select('model, storage, sale_price')
      .gte('captured_at', `${today}T00:00:00`)
      .lte('captured_at', `${today}T23:59:59`);

    // Group by model+storage
    const groups = new Map<string, { supplierPrices: number[]; marketPrices: number[] }>();

    for (const s of suppliers ?? []) {
      const key = `${s.model}|${s.storage}`;
      if (!groups.has(key)) groups.set(key, { supplierPrices: [], marketPrices: [] });
      groups.get(key)!.supplierPrices.push(Number(s.price));
    }

    for (const m of market ?? []) {
      const key = `${m.model}|${m.storage}`;
      if (!groups.has(key)) groups.set(key, { supplierPrices: [], marketPrices: [] });
      groups.get(key)!.marketPrices.push(Number(m.sale_price));
    }

    for (const [key, data] of groups) {
      const [model, storage] = key.split('|');
      const avgSupplier = data.supplierPrices.length > 0
        ? data.supplierPrices.reduce((a, b) => a + b, 0) / data.supplierPrices.length
        : 0;
      const avgMarket = data.marketPrices.length > 0
        ? data.marketPrices.reduce((a, b) => a + b, 0) / data.marketPrices.length
        : 0;

      await getSupabase().from('price_history').upsert({
        model,
        storage,
        avg_supplier_price: avgSupplier,
        avg_market_price: avgMarket,
        date: today,
      }, { onConflict: 'model,storage,date' });
    }
  }

  logger.info('Daily price history saved');
}
```

**Step 2: Commit**

```bash
git add src/services/scheduler.ts
git commit -m "feat: add scheduler with cron jobs for exchange, summary, strategy"
```

---

## Task 14: Express Server and Webhook Route

**Files:**
- Create: `src/routes/webhook.ts`
- Create: `src/routes/health.ts`
- Create: `src/index.ts`

**Step 1: Create health route**

```typescript
// src/routes/health.ts
import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
```

**Step 2: Create webhook route**

```typescript
// src/routes/webhook.ts
import { Router } from 'express';
import { handleIncomingMessage } from '../handlers/message-handler';
import { logger } from '../utils/logger';
import type { EvolutionWebhookPayload } from '../types';

const router = Router();

router.post('/webhook', async (req, res) => {
  const payload = req.body as EvolutionWebhookPayload;

  // Only handle message events
  if (payload.event !== 'messages.upsert') {
    res.sendStatus(200);
    return;
  }

  // Respond immediately, process async
  res.sendStatus(200);

  try {
    await handleIncomingMessage(payload);
  } catch (error) {
    logger.error('Webhook processing error', { error });
  }
});

export default router;
```

**Step 3: Create main server**

```typescript
// src/index.ts
import express from 'express';
import { getConfig } from './config';
import { fetchAndSaveExchangeRate } from './services/exchange';
import { startScheduler } from './services/scheduler';
import { logger } from './utils/logger';
import healthRouter from './routes/health';
import webhookRouter from './routes/webhook';

async function main() {
  const config = getConfig();
  const app = express();

  app.use(express.json());

  // Routes
  app.use(healthRouter);
  app.use(webhookRouter);

  // Bootstrap
  logger.info('Fetching initial exchange rate...');
  await fetchAndSaveExchangeRate().catch((err) => {
    logger.warn('Could not fetch initial exchange rate', { error: err });
  });

  // Start scheduler
  startScheduler();

  // Start server
  app.listen(config.PORT, () => {
    logger.info(`iPhoneAgent running on port ${config.PORT}`);
  });
}

main().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
```

**Step 4: Build and verify**

```bash
npm run build
```

Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/index.ts src/routes/
git commit -m "feat: add Express server with webhook and health routes"
```

---

## Task 15: Integration Test and First Run

**Step 1: Create .env from .env.example**

```bash
cp .env.example .env
# Edit with real credentials
```

**Step 2: Run the migration in Supabase**

Copy contents of `src/database/migrations/001_initial.sql` and run in Supabase SQL Editor.

**Step 3: Test locally**

```bash
npm run dev
```

In another terminal:
```bash
# Health check
curl http://localhost:3000/health

# Simulate a webhook message
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "iphone-agent",
    "data": {
      "key": { "remoteJid": "5511999999999@s.whatsapp.net", "fromMe": false, "id": "test123" },
      "pushName": "Test User",
      "message": { "conversation": "/ajuda" },
      "messageType": "conversation",
      "messageTimestamp": 1709164800
    }
  }'
```

**Step 4: Configure Evolution API webhook**

Point Evolution API webhook to `https://your-railway-url.com/webhook` for events `messages.upsert`.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: iPhoneAgent v1 — WhatsApp bot for iPhone price analysis"
```

---

## Summary

| Task | Description | Est. Commits |
|------|-------------|-------------|
| 1 | Project scaffold | 1 |
| 2 | TypeScript types | 1 |
| 3 | Config + logger | 1 |
| 4 | Supabase + migrations | 1 |
| 5 | Database queries | 1 |
| 6 | Exchange rate service | 1 |
| 7 | WhatsApp service + parser | 1 |
| 8 | Gemini extractor (Camada 1) | 1 |
| 9 | Analyzer engine | 1 |
| 10 | Gemini consultant (Camada 2) | 1 |
| 11 | Gemini strategist (Camada 3) | 1 |
| 12 | Message handlers | 1 |
| 13 | Scheduler | 1 |
| 14 | Express server + routes | 1 |
| 15 | Integration test + deploy | 1 |
| **Total** | | **15 commits** |
