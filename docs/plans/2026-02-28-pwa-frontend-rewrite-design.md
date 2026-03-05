# PWA Frontend Rewrite — SuperGerente

**Data:** 2026-02-28
**Status:** Aprovado
**Figma Source:** Cleverwise by Merkulove (`MGgCyByTq02Z9ABCAGGxJM`), frame 02-Dashboard-2

---

## Contexto

O frontend atual é um arquivo único (`App.tsx`, 1209 linhas) com CSS puro (`index.css`, 1207 linhas). Sem routing, sem componentização, sem PWA, sem tipagem forte. O projeto precisa de um rewrite completo para escalar, ser instalável como PWA, e seguir o design system Cleverwise extraído do Figma.

### Problemas atuais
- Single-file monolítico (App.tsx com tudo)
- CSS puro sem sistema de utilidades
- Sem URL routing (back button não funciona, sem deep-link)
- State management tudo em useState no componente raiz
- `tabData: any` — tipagem fraca
- `loading` global compartilhado entre views
- Zero PWA (sem manifest, sem service worker, sem ícone)
- `lodash` como dependência morta
- `HelpCircle` como import morto

---

## Stack Final

| Camada | Tecnologia | Motivo |
|---|---|---|
| Framework | React 18 + TypeScript | Mantém (já funciona) |
| Build | Vite 5 | Mantém |
| CSS | Tailwind CSS v4 | Substitui CSS puro |
| Routing | React Router v6 | URLs reais, deep-linking |
| State | Zustand | Substitui useState monolítico |
| HTTP | Axios | Mantém (backend inalterado) |
| Icons | lucide-react | Mantém |
| Markdown | react-markdown + remark-gfm | Mantém (chat) |
| PWA | vite-plugin-pwa | Manifest + service worker |
| Utilities | class-variance-authority + clsx + tailwind-merge | Variantes de componentes |

---

## Design System — Cleverwise (do Figma)

### Cores

**Dark theme (padrão):**
```
primary-bg:     #12081E   — fundo principal
surface:        #22182D   — cards, painéis
elevated:       #2F233C   — headers de tabela, hovers
sidebar:        #270E5F   — sidebar fixa (mesmo em light)
accent:         #9566F2   — roxo primário (botões, links, badges)
accent-blue:    #1F74EC   — secundário (gradientes)
accent-violet:  #4E1BD9   — variação escura
text-primary:   #E0E3E9   — texto principal
text-secondary: #959CA6   — texto auxiliar
text-muted:     #5C6574   — texto desabilitado
glass-border:   rgba(255,255,255,0.08)
```

**Light theme:**
```
primary-bg:     #F4F5F7
surface:        #FFFFFF
elevated:       #EEF4FE
text-primary:   #23272C
text-secondary: #645B6D
text-muted:     #BCC5D0
glass-border:   rgba(0,0,0,0.08)
sidebar:        #270E5F  (mantém)
```

**Semânticas:**
```
success:        #0EB01D
success-bg:     #DDFCE0
warning:        #F9AA3C
warning-bg:     #FEEFDB
danger:         #EF4444
info:           #1F74EC
info-bg:        #EEF4FE
```

### Tipografia

| Uso | Fonte | Peso | Tamanhos |
|---|---|---|---|
| Headings | Libre Franklin | 500-700 | 32, 22, 20, 18, 16, 14, 13px |
| Body | Mulish | 400-600 | 16, 14, 12px |

### Efeitos
- Glassmorphism: `backdrop-blur: 5.4px` + borda sutil
- Gradiente accent: `linear-gradient(135deg, #9566F2, #1F74EC)`
- Border radius: 12px (cards), 8px (botões/inputs), 9999px (badges)
- Sem sombras pesadas — hierarquia por background e bordas

---

## Estrutura de Pastas

```
web/src/
├── components/
│   ├── ui/              # Atômicos reutilizáveis
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Table.tsx
│   │   ├── Avatar.tsx
│   │   ├── Chip.tsx
│   │   ├── Select.tsx
│   │   ├── Spinner.tsx
│   │   └── EmptyState.tsx
│   ├── layout/
│   │   ├── AppShell.tsx     # Sidebar + TopBar + <Outlet>
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── AuthLayout.tsx   # Layout centralizado pra login/register
│   └── features/
│       ├── chat/
│       │   ├── ChatPanel.tsx
│       │   ├── MessageBubble.tsx
│       │   ├── MentorSelector.tsx
│       │   └── ChatInput.tsx
│       ├── dashboard/
│       │   ├── KPICard.tsx
│       │   └── RecentAlerts.tsx
│       ├── agents/
│       │   ├── AgentTable.tsx
│       │   └── AgentFilters.tsx
│       ├── alerts/
│       │   ├── AlertCard.tsx
│       │   ├── AlertFilters.tsx
│       │   └── AlertList.tsx
│       └── admin/
│           ├── UserTable.tsx
│           ├── MentorForm.tsx
│           ├── MentorList.tsx
│           ├── TokenPanel.tsx
│           └── TokenUsage.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── DashboardPage.tsx
│   ├── ChatPage.tsx
│   ├── AgentsPage.tsx
│   ├── AlertsPage.tsx
│   └── AdminPage.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useTheme.ts
│   ├── useApi.ts
│   └── usePipelines.ts
├── stores/
│   ├── authStore.ts        # token, user, login/logout actions
│   ├── chatStore.ts        # messages, sessionId, mentors
│   └── filterStore.ts      # filtros de agentes, alertas, datas
├── lib/
│   ├── api.ts              # axios instance com interceptor de auth
│   ├── utils.ts            # cn(), formatDate(), etc.
│   └── constants.ts        # rotas, equipe mappings
├── types/
│   ├── index.ts            # Pipeline, Message, User, Mentor, etc.
│   └── api.ts              # Response types dos endpoints
└── App.tsx                  # BrowserRouter + Routes
```

---

## Rotas

| Path | Page | Auth | Descrição |
|---|---|---|---|
| `/login` | LoginPage | Público | Login |
| `/register` | RegisterPage | Público | Cadastro |
| `/` | DashboardPage | Protegido | Home com KPIs e alertas recentes |
| `/chat` | ChatPage | Protegido | Chat IA com mentores |
| `/agents` | AgentsPage | Protegido | Relatório de agentes |
| `/alerts` | AlertsPage | Protegido | Central de alertas |
| `/admin` | AdminPage | Admin only | Gestão de usuários, mentores, tokens |

---

## Telas

### 1. Login / Register
- `AuthLayout`: fundo `#12081E`, card centralizado com glassmorphism
- Logo AK com gradiente accent
- Campos com estilo Cleverwise (borda sutil, fundo elevated)
- Botão primário com gradiente
- Register mostra estado "aguardando aprovação" pós-cadastro

### 2. Dashboard (nova home — substitui Resumo + Brand tabs)
- Layout baseado no frame 02-Dashboard-2
- **TopBar:** saudação "Olá, {nome}", avatar, theme toggle (Sun/Moon)
- **KPI Cards (grid 4 col):**
  - Leads Novos Hoje (accent)
  - Leads Ativos (info)
  - Taxa de Conversão (success/warning/danger conforme valor)
  - Ticket Médio (accent)
- **Resumo por Equipe:** cards com métricas por funil (dados do GET /api/reports/summary)
- **Alertas Recentes:** mini lista dos top 5 alertas, link "Ver todos →" pra /alerts
- Dados dos endpoints existentes: `/api/reports/summary` + `/api/reports/activity`

### 3. Chat
- Full-height, sem topbar scroll
- **MentorSelector** no topo: chips com avatar/ícone, "Padrão" + "Conselho Completo" + individuais
- **MessageList:** scroll area, bubbles user (gradiente) vs assistant (surface)
- **ChatInput:** fixed bottom, textarea + send button
- Markdown rendering mantém (react-markdown + remark-gfm)
- Mesmo endpoint: `POST /api/chat`

### 4. Relatório Agentes
- **AgentFilters:** card glass com selects (agente, funil, equipe) + botões filtrar/limpar
- **AgentTable:** sticky header, sort por coluna (click no th), colunas fixas + dinâmicas
- Badge de conversão colorido (>=50% verde, >=30% amarelo, <30% vermelho)
- Highlight no ticket médio
- Endpoint: `GET /api/reports/agents`

### 5. Central de Alertas
- **AlertFilters:** chips de tipo (Todos, +48h, +7d, Tarefas) + chips de equipe
- **AlertList:** cards agrupados por severidade
  - Vermelho: leads sem atividade +48h
  - Amarelo: leads em risco +7d
  - Laranja: tarefas vencidas
- Cada card é link externo pro Kommo
- Badge com contagem no Sidebar nav
- All-clear state: ícone CheckCircle verde + mensagem
- Endpoint: `GET /api/reports/activity`

### 6. Admin
- **Tabs internas** (sub-navigation horizontal): Usuários | Mentores | Tokens | Uso IA
- **Usuários:** tabela com badges de status, ações aprovar/negar, checkboxes de equipe
- **Mentores:** lista de cards + formulário (modal ou inline expandável) com nome, descrição, system prompt, upload de metodologia
- **Tokens Kommo:** status OAuth por equipe, botão autorizar, campo de código
- **Uso IA:** tabela de consumo de tokens por usuário
- Mesmos endpoints CRUD do admin

---

## PWA

### manifest.webmanifest
```json
{
  "name": "SuperGerente",
  "short_name": "AK",
  "description": "Painel de gestão comercial com IA",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#12081E",
  "theme_color": "#9566F2",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Service Worker
- Precache do app shell (HTML, CSS, JS, fontes)
- Runtime cache para fontes Google (cache-first)
- Fallback offline: tela "Sem conexão" com botão "Tentar novamente"
- Gerado automaticamente pelo vite-plugin-pwa

### Meta Tags
```html
<meta name="theme-color" content="#9566F2">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```

---

## Tailwind Config

```typescript
// tailwind.config.ts
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
        danger: '#EF4444',
      },
      fontFamily: {
        heading: ['Libre Franklin', 'system-ui', 'sans-serif'],
        body: ['Mulish', 'system-ui', 'sans-serif'],
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
    },
  },
  plugins: [],
} satisfies Config;
```

---

## Migração

### O que NÃO muda
- Backend (zero alterações)
- Todos os endpoints da API
- Auth JWT
- Lógica de negócio (filtros, sort, team mapping)

### O que muda
- `App.tsx` monolítico → multi-file componentizado
- `index.css` puro → Tailwind utilities
- useState global → Zustand stores
- Navegação in-memory → React Router com URLs
- Sem PWA → instalável com manifest + SW

### Dependências a adicionar
```
tailwindcss @tailwindcss/vite
react-router-dom
zustand
class-variance-authority clsx tailwind-merge
vite-plugin-pwa
```

### Dependências a remover
```
lodash @types/lodash   (não usado)
```

---

## Riscos

| Risco | Mitigação |
|---|---|
| Rewrite grande, pode quebrar funcionalidade | Implementar tela por tela, testar contra o backend real |
| Tailwind v4 tem breaking changes vs v3 | Usar documentação oficial v4, testar early |
| PWA icons não existem ainda | Gerar com ferramenta (pwa-asset-generator ou manual) |
| Dark/Light theme pode ter inconsistências | Tailwind `dark:` prefix facilita, testar ambos |
