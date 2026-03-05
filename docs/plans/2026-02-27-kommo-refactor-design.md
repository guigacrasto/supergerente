# SuperGerente — Design do Refactor

**Data:** 2026-02-27
**Status:** Aprovado

---

## Problema

O projeto atual mistura responsabilidades, tem código duplicado e configurações inseguras:

- 9 scripts avulsos com lógica repetida
- MCP server e Express server no mesmo arquivo raiz
- Valores hardcoded espalhados (IDs de pipeline, status codes, timezone)
- `.env` com credenciais reais potencialmente exposto
- `/build/` e `/web/dist/` commitados desnecessariamente
- Pasta `/src/tools/` vazia (planejada mas nunca usada)

---

## Decisões

| Decisão | Escolha |
|---|---|
| Foco principal | Web App (Dashboard + Chat) |
| AI do chat | Manter Google Gemini |
| Scripts avulsos | Integrar como endpoints da API |
| MCP server | Refatorar e manter, isolado em `src/mcp/` |
| Estrutura | Um único projeto, reorganização interna |

---

## Arquitetura

### Estrutura de pastas

```
supergerente/
├── src/
│   ├── config.ts                  # constantes globais (IDs, status, timezone)
│   ├── types/
│   │   └── index.ts               # interfaces TypeScript
│   ├── services/
│   │   └── kommo.ts               # KommoService — cliente da API Kommo
│   ├── mcp/
│   │   └── index.ts               # MCP server (entry: npm run mcp)
│   └── api/
│       ├── index.ts               # entry point web (npm run web)
│       ├── server.ts              # Express app + middleware
│       └── routes/
│           ├── leads.ts           # GET /api/leads, GET /api/leads/:id
│           ├── pipelines.ts       # GET /api/pipelines
│           ├── reports.ts         # GET /api/reports/agents, /reports/brand
│           └── chat.ts            # POST /api/chat (Gemini)
├── web/                           # React frontend (sem mudança estrutural)
│   └── src/
│       └── App.tsx
├── docs/
│   └── plans/
├── .env.example
├── .gitignore                     # inclui .env, build/, web/dist/
├── package.json
└── tsconfig.json
```

### Fluxo de dados

```
Kommo CRM API
      ↓
  KommoService (src/services/kommo.ts)
      ↓
  ┌───────────────────┬──────────────────┐
  │   Express API     │    MCP Server    │
  │ (src/api/)        │ (src/mcp/)       │
  └───────┬───────────┴──────────────────┘
          ↓
    React Frontend          Claude Desktop
    (web/src/)              (via stdio)
```

---

## Componentes

### `src/config.ts`
Centraliza todos os valores hoje espalhados pelo código:
- IDs dos pipelines (Tryvion, Matriz, Axion)
- Status codes (142 = ganho, 143 = perdido)
- Timezone (GMT-3)
- Porta do servidor

### `src/services/kommo.ts`
Sem mudança funcional. Apenas garantir que recebe configuração via `config.ts`.

### `src/api/routes/`
Cada arquivo de rota é responsável por um recurso:
- `leads.ts` → buscar e detalhar leads
- `pipelines.ts` → listar pipelines e status
- `reports.ts` → todos os relatórios (absorve lógica dos 9 scripts)
- `chat.ts` → chat com Gemini

### `src/mcp/index.ts`
MCP server limpo com os mesmos 5 tools do atual, refatorados para usar `config.ts` e o `KommoService` compartilhado.

---

## O que é removido

- `src/scripts/` — pasta inteira deletada (lógica integrada em `routes/reports.ts`)
- `src/inspect_pipelines.ts` — utilitário avulso, não necessário
- `src/tools/` — pasta vazia, deletada
- `/build/` — adicionado ao `.gitignore`
- `/web/dist/` — adicionado ao `.gitignore`

---

## Segurança

- `.env` adicionado ao `.gitignore` (garantir que não está sendo rastreado)
- `.env.example` mantido como template
- Nenhuma credencial no código

---

## Scripts npm

```json
{
  "scripts": {
    "web": "node build/api/index.js",
    "mcp": "node build/mcp/index.js",
    "build": "tsc",
    "dev:web": "tsx watch src/api/index.ts",
    "dev:mcp": "tsx watch src/mcp/index.ts"
  }
}
```

---

## O que NÃO muda

- Stack tecnológico (TypeScript, Express, React, Vite, Gemini, MCP SDK)
- Funcionalidades do dashboard (chat, relatórios, filtros de data)
- Funcionalidades do MCP (mesmos 5 tools)
- Frontend React (sem mudança visual)
- Versões de dependências
