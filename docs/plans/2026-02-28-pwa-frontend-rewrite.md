# PWA Frontend Rewrite — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the SuperGerente frontend from a monolithic single-file React app into a componentized, Tailwind-powered PWA with React Router and Zustand.

**Architecture:** Multi-file React app with pages/, components/ui/, components/layout/, components/features/ structure. Zustand stores replace useState. React Router v6 replaces in-memory navigation. Tailwind CSS v4 replaces 1200 lines of custom CSS. vite-plugin-pwa adds installability.

**Tech Stack:** React 18, Vite 5, TypeScript, Tailwind CSS v4, React Router v6, Zustand, Axios, CVA, lucide-react, vite-plugin-pwa

**Design Doc:** `docs/plans/2026-02-28-pwa-frontend-rewrite-design.md`

**Figma Source:** Cleverwise (`MGgCyByTq02Z9ABCAGGxJM`), frame 02-Dashboard-2

---

## Task 1: Project Setup — Dependencies & Config

**Files:**
- Modify: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/tsconfig.node.json`
- Modify: `web/vite.config.ts`
- Create: `web/tailwind.config.ts`
- Rewrite: `web/src/index.css`
- Modify: `web/index.html`

**Step 1: Install new dependencies**

```bash
cd web
npm install react-router-dom zustand class-variance-authority clsx tailwind-merge
npm install -D tailwindcss @tailwindcss/vite
```

**Step 2: Create web/tsconfig.json (browser-specific)**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 3: Create web/tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts", "tailwind.config.ts"]
}
```

**Step 4: Create web/tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#9566F2',
          50: '#F3EEFE',
          100: '#E8DDFB',
          500: '#9566F2',
          600: '#7A4AD9',
          700: '#4E1BD9',
          900: '#12081E',
        },
        'accent-blue': {
          DEFAULT: '#1F74EC',
          500: '#1F74EC',
          600: '#125CCA',
          light: '#ADCFFF',
          bg: '#EEF4FE',
        },
        surface: {
          DEFAULT: '#22182D',
          light: '#FFFFFF',
          secondary: '#2F233C',
          'light-secondary': '#F4F5F7',
        },
        sidebar: '#270E5F',
        glass: {
          border: 'rgba(255,255,255,0.08)',
          'border-light': 'rgba(0,0,0,0.08)',
        },
        success: { DEFAULT: '#0EB01D', bg: '#DDFCE0' },
        warning: { DEFAULT: '#F9AA3C', bg: '#FEEFDB' },
        danger: { DEFAULT: '#EF4444' },
        muted: { DEFAULT: '#959CA6', dark: '#5C6574', light: '#BCC5D0' },
      },
      fontFamily: {
        heading: ['"Libre Franklin"', 'system-ui', 'sans-serif'],
        body: ['Mulish', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'heading-xl': ['2rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        'heading-lg': ['1.375rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'heading-md': ['1.25rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        'heading-sm': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        'body-lg': ['1rem', { lineHeight: '1.5rem' }],
        'body-md': ['0.875rem', { lineHeight: '1.25rem' }],
        'body-sm': ['0.75rem', { lineHeight: '1rem' }],
        'label': ['0.8125rem', { lineHeight: '1rem', fontWeight: '500' }],
      },
      borderRadius: {
        card: '0.75rem',
        button: '0.5rem',
        input: '0.5rem',
        badge: '9999px',
      },
      backdropBlur: {
        glass: '5.4px',
      },
      boxShadow: {
        glass: '0 0 0 1px rgba(255,255,255,0.08)',
        'glass-light': '0 0 0 1px rgba(0,0,0,0.08)',
      },
      animation: {
        'spin-slow': 'spin 1.5s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

**Step 5: Update web/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

**Step 6: Replace web/src/index.css**

```css
@import 'tailwindcss';
@config '../tailwind.config.ts';

/* Google Fonts are loaded via index.html */

/* Base styles */
@layer base {
  body {
    @apply font-body text-body-md bg-primary-900 text-[#E0E3E9] overflow-hidden;
  }

  .dark body,
  body {
    @apply bg-primary-900 text-[#E0E3E9];
  }

  :root.light body,
  .light body {
    @apply bg-surface-light-secondary text-[#23272C];
  }
}

/* Scrollbar styling */
@layer base {
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(149, 102, 242, 0.3);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(149, 102, 242, 0.5);
  }
}

/* Markdown content in chat */
@layer components {
  .markdown-content h1,
  .markdown-content h2,
  .markdown-content h3 {
    @apply font-heading font-semibold mt-4 mb-2;
  }
  .markdown-content h1 { @apply text-heading-lg; }
  .markdown-content h2 { @apply text-heading-md; }
  .markdown-content h3 { @apply text-heading-sm; }
  .markdown-content p { @apply mb-2; }
  .markdown-content ul, .markdown-content ol { @apply ml-4 mb-2; }
  .markdown-content li { @apply mb-1; }
  .markdown-content code {
    @apply bg-surface-secondary px-1.5 py-0.5 rounded text-body-sm font-mono;
  }
  .markdown-content pre {
    @apply bg-surface-secondary p-3 rounded-card overflow-x-auto mb-2;
  }
  .markdown-content pre code {
    @apply bg-transparent p-0;
  }
  .markdown-content table {
    @apply w-full border-collapse mb-2;
  }
  .markdown-content th {
    @apply text-left p-2 border-b border-glass-border font-heading font-semibold text-body-sm;
  }
  .markdown-content td {
    @apply p-2 border-b border-glass-border text-body-sm;
  }
}
```

**Step 7: Update web/index.html — add PWA meta tags**

```html
<!doctype html>
<html lang="pt-BR" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#9566F2" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="description" content="SuperGerente — Painel de gestão comercial com IA" />
    <title>SuperGerente</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Mulish:wght@400;500;600&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 8: Remove dead dependencies**

```bash
cd web
npm uninstall lodash @types/lodash
```

**Step 9: Verify build**

```bash
cd web && npx tsc --noEmit && npx vite build
```

Expected: Build succeeds (the old App.tsx will still exist and compile).

**Step 10: Commit**

```bash
git add web/
git commit -m "chore: setup Tailwind CSS v4, React Router, Zustand, tsconfig for web"
```

---

## Task 2: Foundation — Types, Utils, API Client

**Files:**
- Create: `web/src/types/index.ts`
- Create: `web/src/lib/utils.ts`
- Create: `web/src/lib/api.ts`
- Create: `web/src/lib/constants.ts`

**Step 1: Create web/src/types/index.ts**

All TypeScript interfaces extracted from the current `any`-typed code:

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  teams?: string[];
}

export interface Pipeline {
  id: number;
  name: string;
  team: 'azul' | 'amarela';
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: Record<string, unknown>;
}

export interface Mentor {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  methodology_text?: string;
  is_active: boolean;
}

export interface MentorFormData {
  id?: string;
  name: string;
  description: string;
  system_prompt: string;
  methodology_text: string;
  is_active: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'approved' | 'denied';
  teams?: string[];
}

export interface TokenUsage {
  userId: string;
  name: string;
  email: string;
  messages: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
}

export interface TokenStatus {
  hasRefreshToken: boolean;
  expiresAt: string | null;
}

export interface SummaryPipeline {
  pipelineId: number;
  pipelineName: string;
  team: string;
  novosHoje: number;
  novosMes: number;
  ativos: number;
}

export interface AgentReport {
  agente: string;
  totalLeads: number;
  vendaGanha: number;
  vendaPerdida: number;
  conversao: number;
  ticketMedio?: number;
  [funnel: string]: string | number | undefined;
}

export interface AlertTeamData {
  team: string;
  leadsAbandonados48h: AlertItem[];
  leadsEmRisco7d: AlertItem[];
  tarefasVencidas: AlertItem[];
}

export interface AlertItem {
  leadId: number;
  leadName: string;
  vendedor: string;
  dias: number;
  kommoUrl: string;
}

export interface BrandTabData {
  created: number;
  remaining: number;
  period: string;
  fetchedAt: string;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  data?: Record<string, unknown>;
}

export type Team = 'azul' | 'amarela';
export type AlertFilter = 'todos' | 'risco48h' | 'risco7d' | 'tarefas';
export type AlertEquipeFilter = 'todas' | 'azul' | 'amarela';
```

**Step 2: Create web/src/lib/utils.ts**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(typeof date === 'string' ? new Date(date) : date);
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(typeof date === 'string' ? new Date(date) : date);
}

export function dateToUnix(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00-03:00');
  return Math.floor(d.getTime() / 1000);
}

export function stripFunilPrefix(name: string): string {
  return name.replace(/^FUNIL\s+/i, '');
}
```

**Step 3: Create web/src/lib/api.ts**

```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kommo_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('kommo_token');
      localStorage.removeItem('kommo_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

**Step 4: Create web/src/lib/constants.ts**

```typescript
export const TEAMS = ['azul', 'amarela'] as const;

export const TEAM_LABELS: Record<string, string> = {
  azul: 'Equipe Azul',
  amarela: 'Equipe Amarela',
};

export const ALERT_TYPE_LABELS: Record<string, string> = {
  todos: 'Todos',
  risco48h: '+48h',
  risco7d: '+7 dias',
  tarefas: 'Tarefas',
};

export const STORAGE_KEYS = {
  token: 'kommo_token',
  user: 'kommo_user',
  theme: 'ak_theme',
} as const;
```

**Step 5: Verify build**

```bash
cd web && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add web/src/types/ web/src/lib/
git commit -m "feat: add TypeScript types, utils, API client, and constants"
```

---

## Task 3: Zustand Stores

**Files:**
- Create: `web/src/stores/authStore.ts`
- Create: `web/src/stores/chatStore.ts`
- Create: `web/src/stores/filterStore.ts`

**Step 1: Create web/src/stores/authStore.ts**

```typescript
import { create } from 'zustand';
import type { User } from '@/types';
import { STORAGE_KEYS } from '@/lib/constants';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  restore: () => boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  login: (token, user) => {
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    set({ token: null, user: null, isAuthenticated: false });
  },

  restore: () => {
    const token = localStorage.getItem(STORAGE_KEYS.token);
    const userStr = localStorage.getItem(STORAGE_KEYS.user);
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ token, user, isAuthenticated: true });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },
}));
```

**Step 2: Create web/src/stores/chatStore.ts**

```typescript
import { create } from 'zustand';
import type { Message, Mentor } from '@/types';

interface ChatState {
  messages: Message[];
  sessionId: string | null;
  loading: boolean;
  availableMentors: Mentor[];
  selectedMentorIds: string[];
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setSessionId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setMentors: (mentors: Mentor[]) => void;
  setSelectedMentorIds: (ids: string[]) => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  sessionId: null,
  loading: false,
  availableMentors: [],
  selectedMentorIds: [],

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  setSessionId: (sessionId) => set({ sessionId }),

  setLoading: (loading) => set({ loading }),

  setMentors: (mentors) => set({ availableMentors: mentors }),

  setSelectedMentorIds: (selectedMentorIds) =>
    set({ selectedMentorIds, messages: [], sessionId: null }),

  resetChat: () =>
    set({ messages: [], sessionId: null, selectedMentorIds: [] }),
}));
```

**Step 3: Create web/src/stores/filterStore.ts**

```typescript
import { create } from 'zustand';
import type { AlertFilter, AlertEquipeFilter } from '@/types';

interface FilterState {
  // Agent filters
  filterAgente: string;
  filterFunil: string;
  filterEquipe: string;
  sortCol: string | null;
  sortDir: 'asc' | 'desc';

  // Date range
  fromDate: string;
  toDate: string;

  // Alert filters
  alertFilter: AlertFilter;
  alertEquipeFilter: AlertEquipeFilter;

  // Actions
  setAgentFilter: (key: 'filterAgente' | 'filterFunil' | 'filterEquipe', value: string) => void;
  setSort: (col: string) => void;
  setDateRange: (from: string, to: string) => void;
  setAlertFilter: (filter: AlertFilter) => void;
  setAlertEquipeFilter: (filter: AlertEquipeFilter) => void;
  clearAgentFilters: () => void;
  clearDateRange: () => void;
}

function getDefaultDates() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: now.toISOString().slice(0, 10),
  };
}

export const useFilterStore = create<FilterState>((set) => ({
  filterAgente: '',
  filterFunil: '',
  filterEquipe: '',
  sortCol: null,
  sortDir: 'asc',
  ...getDefaultDates(),
  alertFilter: 'todos',
  alertEquipeFilter: 'todas',

  setAgentFilter: (key, value) => set({ [key]: value }),

  setSort: (col) =>
    set((state) => ({
      sortCol: col,
      sortDir: state.sortCol === col && state.sortDir === 'asc' ? 'desc' : 'asc',
    })),

  setDateRange: (fromDate, toDate) => set({ fromDate, toDate }),

  setAlertFilter: (alertFilter) => set({ alertFilter }),

  setAlertEquipeFilter: (alertEquipeFilter) => set({ alertEquipeFilter }),

  clearAgentFilters: () =>
    set({ filterAgente: '', filterFunil: '', filterEquipe: '' }),

  clearDateRange: () => set(getDefaultDates()),
}));
```

**Step 4: Verify build**

```bash
cd web && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add web/src/stores/
git commit -m "feat: add Zustand stores for auth, chat, and filters"
```

---

## Task 4: UI Components

**Files:**
- Create: `web/src/components/ui/Button.tsx`
- Create: `web/src/components/ui/Input.tsx`
- Create: `web/src/components/ui/Card.tsx`
- Create: `web/src/components/ui/Badge.tsx`
- Create: `web/src/components/ui/Chip.tsx`
- Create: `web/src/components/ui/Select.tsx`
- Create: `web/src/components/ui/Spinner.tsx`
- Create: `web/src/components/ui/EmptyState.tsx`
- Create: `web/src/components/ui/index.ts`

**Context:** All components follow the Cleverwise design system. Use CVA for variant-based styling. All support dark mode via Tailwind `dark:` classes. Since the app defaults to dark mode with class-based toggling, the dark variant styles are written as the base and light overrides use the `.light` parent class or `dark:` Tailwind modifiers.

**Step 1: Create Button.tsx**

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-heading font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-to-br from-primary to-accent-blue text-white hover:opacity-90 active:opacity-80',
        secondary: 'bg-surface border border-glass-border text-[#E0E3E9] hover:bg-surface-secondary',
        ghost: 'text-muted hover:text-[#E0E3E9] hover:bg-surface-secondary',
        danger: 'bg-danger text-white hover:opacity-90',
        success: 'bg-success text-white hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-body-sm rounded-button',
        md: 'h-10 px-4 text-body-md rounded-button',
        lg: 'h-12 px-6 text-body-lg rounded-button',
        icon: 'h-10 w-10 rounded-button',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

export { buttonVariants };
```

**Step 2: Create Input.tsx**

```typescript
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-label text-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 w-full rounded-input bg-surface-secondary border border-glass-border px-3 text-body-md text-[#E0E3E9] placeholder:text-muted',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'transition-all duration-150',
            error && 'border-danger focus:ring-danger',
            className
          )}
          {...props}
        />
        {error && <span className="text-body-sm text-danger">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
```

**Step 3: Create Card.tsx**

```typescript
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export function Card({ className, glass = true, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card p-6',
        glass
          ? 'bg-surface border border-glass-border backdrop-blur-glass'
          : 'bg-surface',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-heading-sm font-heading', className)} {...props}>
      {children}
    </h3>
  );
}
```

**Step 4: Create Badge.tsx**

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-badge px-2.5 py-0.5 text-body-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-surface-secondary text-muted',
        success: 'bg-success-bg text-success',
        warning: 'bg-warning-bg text-warning',
        danger: 'bg-red-500/10 text-danger',
        info: 'bg-accent-blue-bg text-accent-blue',
        accent: 'bg-primary-50 text-primary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
```

**Step 5: Create Chip.tsx**

```typescript
import { cn } from '@/lib/utils';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  count?: number;
}

export function Chip({ className, active, count, children, ...props }: ChipProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 rounded-badge px-3 py-1.5 text-body-sm font-medium transition-all duration-150 cursor-pointer',
        active
          ? 'bg-primary text-white'
          : 'bg-surface-secondary text-muted hover:text-[#E0E3E9] border border-glass-border',
        className
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className={cn(
          'inline-flex items-center justify-center h-5 min-w-[20px] rounded-badge text-body-sm',
          active ? 'bg-white/20' : 'bg-primary/20 text-primary'
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
```

**Step 6: Create Select.tsx**

```typescript
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, placeholder, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-label text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'h-10 w-full appearance-none rounded-input bg-surface-secondary border border-glass-border pl-3 pr-8 text-body-md text-[#E0E3E9]',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
              'transition-all duration-150',
              className
            )}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
        </div>
      </div>
    );
  }
);
Select.displayName = 'Select';
```

**Step 7: Create Spinner.tsx**

```typescript
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };

export function Spinner({ className, size = 'md' }: SpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Loader2 className={cn('animate-spin text-primary', sizeMap[size])} />
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
```

**Step 8: Create EmptyState.tsx**

```typescript
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <Icon className="h-12 w-12 text-muted mb-4" />
      <h3 className="text-heading-sm font-heading mb-2">{title}</h3>
      {description && <p className="text-body-md text-muted max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

**Step 9: Create index.ts barrel export**

```typescript
export { Button, buttonVariants } from './Button';
export { Input } from './Input';
export { Card, CardHeader, CardTitle } from './Card';
export { Badge } from './Badge';
export { Chip } from './Chip';
export { Select } from './Select';
export { Spinner, PageSpinner } from './Spinner';
export { EmptyState } from './EmptyState';
```

**Step 10: Verify build**

```bash
cd web && npx tsc --noEmit
```

**Step 11: Commit**

```bash
git add web/src/components/ui/
git commit -m "feat: add UI component library (Button, Input, Card, Badge, Chip, Select, Spinner, EmptyState)"
```

---

## Task 5: Layout Components (AppShell, Sidebar, TopBar, AuthLayout)

**Files:**
- Create: `web/src/hooks/useTheme.ts`
- Create: `web/src/hooks/usePipelines.ts`
- Create: `web/src/components/layout/Sidebar.tsx`
- Create: `web/src/components/layout/TopBar.tsx`
- Create: `web/src/components/layout/AppShell.tsx`
- Create: `web/src/components/layout/AuthLayout.tsx`

**Step 1: Create useTheme hook**

```typescript
import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';

export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(STORAGE_KEYS.theme) as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return { theme, toggle };
}
```

**Step 2: Create usePipelines hook**

```typescript
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Pipeline, Mentor } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';

export function usePipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setMentors = useChatStore((s) => s.setMentors);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetch() {
      try {
        const [pipRes, mentorRes] = await Promise.all([
          api.get<Pipeline[]>('/pipelines'),
          api.get<Mentor[]>('/chat/mentors'),
        ]);
        setPipelines(pipRes.data);
        setMentors(mentorRes.data.filter((m) => m.is_active));
      } catch (err) {
        console.error('Failed to fetch pipelines/mentors', err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [isAuthenticated, setMentors]);

  const byTeam = (team: string) => pipelines.filter((p) => p.team === team);

  return { pipelines, byTeam, loading };
}
```

**Step 3: Create Sidebar.tsx**

Sidebar is always dark (`#270E5F`), regardless of theme. It has nav items, team accordion with pipeline sub-tabs, and a footer with admin + logout.

```typescript
import { NavLink, useNavigate } from 'react-router-dom';
import {
  MessageSquare, BarChart3, PieChart, AlertTriangle,
  Settings, LogOut, ChevronRight, ChevronDown, Sun, Moon,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import { usePipelines } from '@/hooks/usePipelines';
import { TEAM_LABELS } from '@/lib/constants';
import { stripFunilPrefix } from '@/lib/utils';

const navItems = [
  { to: '/', icon: PieChart, label: 'Dashboard' },
  { to: '/chat', icon: MessageSquare, label: 'Chat IA' },
  { to: '/agents', icon: BarChart3, label: 'Agentes' },
  { to: '/alerts', icon: AlertTriangle, label: 'Alertas' },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { theme, toggle } = useTheme();
  const { byTeam } = usePipelines();
  const navigate = useNavigate();
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const toggleTeam = (team: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      next.has(team) ? next.delete(team) : next.add(team);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="flex flex-col w-[260px] bg-sidebar text-white h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="w-9 h-9 rounded-button bg-gradient-to-br from-primary to-accent-blue flex items-center justify-center text-white font-heading font-bold text-body-md">
          AK
        </div>
        <span className="font-heading font-semibold text-heading-sm">SuperGerente</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-button text-body-md transition-all duration-150',
                isActive
                  ? 'bg-primary/20 text-white border-l-2 border-primary'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </NavLink>
        ))}

        {/* Team accordions */}
        <div className="mt-4 pt-4 border-t border-white/10">
          {['azul', 'amarela'].map((team) => {
            const pipes = byTeam(team);
            if (pipes.length === 0) return null;
            const expanded = expandedTeams.has(team);
            return (
              <div key={team}>
                <button
                  onClick={() => toggleTeam(team)}
                  className="flex items-center justify-between w-full px-3 py-2 text-body-sm text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="font-heading font-medium">{TEAM_LABELS[team]}</span>
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {expanded && (
                  <div className="ml-3 space-y-0.5">
                    {pipes.map((p) => (
                      <NavLink
                        key={p.id}
                        to={`/?pipeline=${p.id}`}
                        className="flex items-center gap-2 px-3 py-1.5 text-body-sm text-white/60 hover:text-white rounded-button transition-colors"
                      >
                        <ChevronRight className="h-3 w-3" />
                        {stripFunilPrefix(p.name)}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <button
          onClick={toggle}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-button text-body-md text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
        </button>

        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-button text-body-md transition-colors',
                isActive ? 'bg-primary/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/5'
              )
            }
          >
            <Settings className="h-5 w-5" />
            Admin
          </NavLink>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-button text-body-md text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
```

**Step 4: Create TopBar.tsx**

```typescript
import { useAuthStore } from '@/stores/authStore';

export function TopBar() {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-glass-border bg-surface">
      <div>
        <span className="text-body-md text-muted">Olá,</span>{' '}
        <span className="text-body-md font-medium">{user?.name || 'Usuário'}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent-blue flex items-center justify-center text-white text-body-sm font-bold">
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  );
}
```

**Step 5: Create AppShell.tsx**

```typescript
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

**Step 6: Create AuthLayout.tsx**

```typescript
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-primary-900 flex items-center justify-center p-4">
      <Outlet />
    </div>
  );
}
```

**Step 7: Verify build**

```bash
cd web && npx tsc --noEmit
```

**Step 8: Commit**

```bash
git add web/src/hooks/ web/src/components/layout/
git commit -m "feat: add layout components (AppShell, Sidebar, TopBar, AuthLayout) and hooks"
```

---

## Task 6: Auth Pages (Login + Register)

**Files:**
- Create: `web/src/pages/LoginPage.tsx`
- Create: `web/src/pages/RegisterPage.tsx`

**Step 1: Create LoginPage.tsx**

```typescript
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Button, Input, Card } from '@/components/ui';
import type { User } from '@/types';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
      login(data.token, data.user);
    } catch {
      setError('Email ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm p-8">
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-card bg-gradient-to-br from-primary to-accent-blue flex items-center justify-center text-white font-heading font-bold text-heading-lg mb-3">
          AK
        </div>
        <h1 className="text-heading-lg font-heading">SuperGerente</h1>
        <p className="text-body-md text-muted mt-1">Painel de gestão comercial</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
        />
        <Input
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        {error && (
          <p className="text-body-sm text-danger text-center">{error}</p>
        )}
        <Button type="submit" className="w-full" loading={loading}>
          Entrar
        </Button>
      </form>

      <p className="text-body-sm text-muted text-center mt-6">
        Não tem conta?{' '}
        <Link to="/register" className="text-primary hover:underline">
          Cadastre-se
        </Link>
      </p>
    </Card>
  );
}
```

**Step 2: Create RegisterPage.tsx**

```typescript
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button, Input, Card } from '@/components/ui';
import { CheckCircle2 } from 'lucide-react';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', { name, email, password });
      setSuccess(true);
    } catch {
      setError('Erro ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="w-full max-w-sm p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
        <h2 className="text-heading-md font-heading mb-2">Cadastro realizado</h2>
        <p className="text-body-md text-muted mb-6">
          Aguarde a aprovação de um administrador para acessar o sistema.
        </p>
        <Link to="/login">
          <Button variant="secondary" className="w-full">Voltar ao login</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm p-8">
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-card bg-gradient-to-br from-primary to-accent-blue flex items-center justify-center text-white font-heading font-bold text-heading-lg mb-3">
          AK
        </div>
        <h1 className="text-heading-lg font-heading">Criar conta</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
        <Input label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        {error && <p className="text-body-sm text-danger text-center">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>Cadastrar</Button>
      </form>

      <p className="text-body-sm text-muted text-center mt-6">
        Já tem conta?{' '}
        <Link to="/login" className="text-primary hover:underline">Entrar</Link>
      </p>
    </Card>
  );
}
```

**Step 3: Verify build & commit**

```bash
cd web && npx tsc --noEmit
git add web/src/pages/LoginPage.tsx web/src/pages/RegisterPage.tsx
git commit -m "feat: add Login and Register pages with Tailwind + Cleverwise design"
```

---

## Task 7: Dashboard Page

**Files:**
- Create: `web/src/components/features/dashboard/KPICard.tsx`
- Create: `web/src/components/features/dashboard/RecentAlerts.tsx`
- Create: `web/src/pages/DashboardPage.tsx`

**Context:** The dashboard replaces the old "Resumo" tab. It pulls data from `/api/reports/summary` and `/api/reports/activity`. Shows KPI cards in a grid and summary by team with recent alerts.

**Step 1: Create KPICard.tsx**

```typescript
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

const accentColors = {
  primary: 'text-primary border-l-primary',
  success: 'text-success border-l-success',
  warning: 'text-warning border-l-warning',
  danger: 'text-danger border-l-danger',
  info: 'text-accent-blue border-l-accent-blue',
};

export function KPICard({ label, value, icon: Icon, accent = 'primary' }: KPICardProps) {
  return (
    <Card className={cn('border-l-4 flex items-center gap-4', accentColors[accent])}>
      <div className={cn('p-3 rounded-card bg-surface-secondary', accentColors[accent])}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-body-sm text-muted">{label}</p>
        <p className="text-heading-lg font-heading">{value}</p>
      </div>
    </Card>
  );
}
```

**Step 2: Create RecentAlerts.tsx**

```typescript
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Clock, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, Badge } from '@/components/ui';
import type { AlertItem } from '@/types';

interface RecentAlertsProps {
  alerts48h: AlertItem[];
  alerts7d: AlertItem[];
  tarefas: AlertItem[];
}

export function RecentAlerts({ alerts48h, alerts7d, tarefas }: RecentAlertsProps) {
  const allAlerts = [
    ...alerts48h.map((a) => ({ ...a, type: 'danger' as const, icon: AlertTriangle })),
    ...alerts7d.map((a) => ({ ...a, type: 'warning' as const, icon: Clock })),
    ...tarefas.map((a) => ({ ...a, type: 'danger' as const, icon: XCircle })),
  ].slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Alertas Recentes</CardTitle>
        <Link to="/alerts" className="flex items-center gap-1 text-body-sm text-primary hover:underline">
          Ver todos <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      {allAlerts.length === 0 ? (
        <p className="text-body-md text-muted py-4 text-center">Nenhum alerta ativo</p>
      ) : (
        <div className="space-y-2">
          {allAlerts.map((alert, i) => (
            <a
              key={`${alert.leadId}-${i}`}
              href={alert.kommoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-button bg-surface-secondary hover:bg-[#2F233C] transition-colors"
            >
              <div className="flex items-center gap-3">
                <alert.icon className={`h-4 w-4 ${alert.type === 'danger' ? 'text-danger' : 'text-warning'}`} />
                <div>
                  <p className="text-body-md">{alert.leadName}</p>
                  <p className="text-body-sm text-muted">{alert.vendedor}</p>
                </div>
              </div>
              <Badge variant={alert.type}>{alert.dias}d</Badge>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
```

**Step 3: Create DashboardPage.tsx**

```typescript
import { useState, useEffect } from 'react';
import { TrendingUp, Users, Target, DollarSign } from 'lucide-react';
import { api } from '@/lib/api';
import { PageSpinner, Card, CardTitle } from '@/components/ui';
import { KPICard } from '@/components/features/dashboard/KPICard';
import { RecentAlerts } from '@/components/features/dashboard/RecentAlerts';
import { stripFunilPrefix } from '@/lib/utils';
import type { SummaryPipeline, AlertTeamData } from '@/types';

export function DashboardPage() {
  const [summary, setSummary] = useState<SummaryPipeline[]>([]);
  const [alerts, setAlerts] = useState<AlertTeamData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [sumRes, alertRes] = await Promise.all([
          api.get('/reports/summary'),
          api.get('/reports/activity'),
        ]);
        setSummary(sumRes.data);
        setAlerts(alertRes.data);
      } catch (err) {
        console.error('Dashboard fetch error', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <PageSpinner />;

  const totalNovosHoje = summary.reduce((acc, p) => acc + p.novosHoje, 0);
  const totalAtivos = summary.reduce((acc, p) => acc + p.ativos, 0);
  const totalNovosMes = summary.reduce((acc, p) => acc + p.novosMes, 0);

  const allAlerts48h = alerts.flatMap((t) => t.leadsAbandonados48h || []);
  const allAlerts7d = alerts.flatMap((t) => t.leadsEmRisco7d || []);
  const allTarefas = alerts.flatMap((t) => t.tarefasVencidas || []);

  const byTeam = (team: string) => summary.filter((p) => p.team === team);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Leads Novos Hoje" value={totalNovosHoje} icon={TrendingUp} accent="primary" />
        <KPICard label="Leads Ativos" value={totalAtivos} icon={Users} accent="info" />
        <KPICard label="Novos no Mês" value={totalNovosMes} icon={Target} accent="success" />
        <KPICard label="Alertas Ativos" value={allAlerts48h.length + allAlerts7d.length + allTarefas.length} icon={DollarSign} accent="warning" />
      </div>

      {/* Summary by team */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {['azul', 'amarela'].map((team) => {
          const pipes = byTeam(team);
          if (pipes.length === 0) return null;
          return (
            <Card key={team}>
              <CardTitle className="mb-4">
                Equipe {team === 'azul' ? 'Azul' : 'Amarela'}
              </CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pipes.map((p) => (
                  <div key={p.pipelineId} className="p-3 rounded-button bg-surface-secondary">
                    <p className="text-body-sm text-muted mb-1">{stripFunilPrefix(p.pipelineName)}</p>
                    <div className="flex gap-4 text-body-md">
                      <span className="text-primary font-medium">{p.novosHoje} hoje</span>
                      <span>{p.novosMes} mês</span>
                      <span className="text-muted">{p.ativos} ativos</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent alerts */}
      <RecentAlerts alerts48h={allAlerts48h} alerts7d={allAlerts7d} tarefas={allTarefas} />
    </div>
  );
}
```

**Step 4: Verify build & commit**

```bash
cd web && npx tsc --noEmit
git add web/src/components/features/dashboard/ web/src/pages/DashboardPage.tsx
git commit -m "feat: add Dashboard page with KPI cards, team summary, and recent alerts"
```

---

## Task 8: Chat Page

**Files:**
- Create: `web/src/components/features/chat/MentorSelector.tsx`
- Create: `web/src/components/features/chat/MessageBubble.tsx`
- Create: `web/src/components/features/chat/ChatInput.tsx`
- Create: `web/src/components/features/chat/ChatPanel.tsx`
- Create: `web/src/pages/ChatPage.tsx`

**Context:** Full chat implementation. Uses `useChatStore` for messages/mentors. Calls `POST /api/chat`. Messages rendered with ReactMarkdown. Mentor selector with chips. Same logic as current App.tsx chat tab.

**Step 1-4: Create each chat component following the existing patterns in App.tsx (lines 600-800 approximately). Each component:**
- `MentorSelector` — Chip bar with "Padrão", "Conselho Completo", and individual mentor chips
- `MessageBubble` — User bubble (gradient bg) vs assistant bubble (surface bg) with ReactMarkdown
- `ChatInput` — Textarea + Send button, handles Enter key submit
- `ChatPanel` — Composes all three, manages the chat API call logic

**Step 5: Create ChatPage.tsx** — Wrapper that renders `<ChatPanel />` full-height

**Step 6: Verify build & commit**

```bash
git commit -m "feat: add Chat page with mentor selector, message bubbles, and chat input"
```

---

## Task 9: Agents Report Page

**Files:**
- Create: `web/src/components/features/agents/AgentFilters.tsx`
- Create: `web/src/components/features/agents/AgentTable.tsx`
- Create: `web/src/pages/AgentsPage.tsx`

**Context:** Reimplements the agents report tab. Data from `GET /api/reports/agents`. Filter bar with selects + sort by column click. Same logic as current App.tsx.

**Step 1: Create AgentFilters.tsx** — Card with Select dropdowns (agente, funil, equipe) + Button (Filtrar, Limpar). Uses `useFilterStore`.

**Step 2: Create AgentTable.tsx** — Table with sticky thead, sortable columns (click th → toggle sortCol/sortDir), fixed + dynamic columns, Badge for conversion %. Uses `useFilterStore` for sort state.

**Step 3: Create AgentsPage.tsx** — Fetches data, applies client-side filters, renders AgentFilters + AgentTable.

**Step 4: Verify build & commit**

```bash
git commit -m "feat: add Agents report page with filters, sortable table, and badges"
```

---

## Task 10: Alerts Page

**Files:**
- Create: `web/src/components/features/alerts/AlertFilters.tsx`
- Create: `web/src/components/features/alerts/AlertCard.tsx`
- Create: `web/src/components/features/alerts/AlertList.tsx`
- Create: `web/src/pages/AlertsPage.tsx`

**Context:** Reimplements the alerts tab. Data from `GET /api/reports/activity`. Filter chips (type + team). Cards grouped by severity. Link to Kommo.

**Step 1-3: Create alert components** following current App.tsx patterns.

**Step 4: Create AlertsPage.tsx** — Fetches data, applies filters from `useFilterStore`, renders AlertFilters + AlertList.

**Step 5: Verify build & commit**

```bash
git commit -m "feat: add Alerts page with filter chips, severity grouping, and Kommo links"
```

---

## Task 11: Admin Page

**Files:**
- Create: `web/src/components/features/admin/UserTable.tsx`
- Create: `web/src/components/features/admin/MentorForm.tsx`
- Create: `web/src/components/features/admin/MentorList.tsx`
- Create: `web/src/components/features/admin/TokenPanel.tsx`
- Create: `web/src/components/features/admin/TokenUsage.tsx`
- Create: `web/src/pages/AdminPage.tsx`

**Context:** Reimplements the admin panel. Tab-based sub-navigation (Usuários | Mentores | Tokens | Uso IA). Same CRUD endpoints.

**Step 1-5: Create each admin sub-component** following current App.tsx admin patterns.

**Step 6: Create AdminPage.tsx** — Horizontal tab nav switching between the 4 sub-panels. Route guard: redirect to `/` if `user.role !== 'admin'`.

**Step 7: Verify build & commit**

```bash
git commit -m "feat: add Admin page with users, mentors, tokens, and usage sub-panels"
```

---

## Task 12: Router + App.tsx + main.tsx

**Files:**
- Rewrite: `web/src/App.tsx`
- Modify: `web/src/main.tsx`

**Step 1: Rewrite App.tsx**

```typescript
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { AppShell } from '@/components/layout/AppShell';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ChatPage } from '@/pages/ChatPage';
import { AgentsPage } from '@/pages/AgentsPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { AdminPage } from '@/pages/AdminPage';

export default function App() {
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* App routes (protected) */}
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 2: Update main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 3: Delete old index.css** (it's already been replaced in Task 1)

**Step 4: Verify full build**

```bash
cd web && npx tsc --noEmit && npx vite build
```

**Step 5: Commit**

```bash
git add web/src/App.tsx web/src/main.tsx
git commit -m "feat: add React Router with auth guards and page routing"
```

---

## Task 13: PWA Setup

**Files:**
- Modify: `web/package.json` (add vite-plugin-pwa)
- Modify: `web/vite.config.ts` (add PWA plugin)
- Create: `web/public/manifest.webmanifest`

**Step 1: Install vite-plugin-pwa**

```bash
cd web && npm install -D vite-plugin-pwa
```

**Step 2: Update vite.config.ts** — Add `VitePWA` plugin with manifest config, precache, offline fallback.

**Step 3: Create PWA icons** — Generate placeholder icons (192x192, 512x512) or note that real icons need to be provided.

**Step 4: Verify full build**

```bash
cd /Users/guicrasto/antigravity-gui/supergerente && npm run build:all
```

Expected: Both backend and frontend build successfully.

**Step 5: Commit**

```bash
git commit -m "feat: add PWA support with manifest, service worker, and meta tags"
```

---

## Task 14: Final Cleanup & Verification

**Step 1: Remove dead files** if any old CSS or components remain.

**Step 2: Run full build**

```bash
npm run build:all
```

**Step 3: Manual smoke test** — Start dev server, test each route, verify dark/light toggle, test chat, test admin (if admin user).

**Step 4: Final commit**

```bash
git commit -m "chore: cleanup dead code and verify full build"
```

---

## Summary

| Task | Description | Key files |
|---|---|---|
| 1 | Setup: deps, tsconfig, Tailwind, Vite | Config files |
| 2 | Foundation: types, utils, API client | lib/, types/ |
| 3 | Zustand stores | stores/ |
| 4 | UI components (8 components) | components/ui/ |
| 5 | Layout (AppShell, Sidebar, TopBar) | components/layout/ |
| 6 | Auth pages (Login, Register) | pages/ |
| 7 | Dashboard page | pages/, features/dashboard/ |
| 8 | Chat page | pages/, features/chat/ |
| 9 | Agents page | pages/, features/agents/ |
| 10 | Alerts page | pages/, features/alerts/ |
| 11 | Admin page | pages/, features/admin/ |
| 12 | Router + App.tsx rewrite | App.tsx, main.tsx |
| 13 | PWA setup | vite.config, manifest |
| 14 | Cleanup & verification | Full build |
