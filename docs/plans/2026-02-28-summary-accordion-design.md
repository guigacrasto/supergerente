# Summary Screen + Sidebar Accordion — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan.

**Goal:** Add a "Resumo Geral" tab showing new leads today/month + actives per funnel across all teams, and make the sidebar funnel groups collapsible (accordion).

**Architecture:** Backend adds one new endpoint reusing the existing CRM cache. Frontend adds one new tab and converts static sidebar groups to accordion using React state.

**Tech Stack:** Express (backend), React + TypeScript (frontend), existing `getCrmMetrics` cache.

---

## Feature 1: Resumo Geral Tab

### Backend
- New route: `GET /api/reports/summary`
- Lives in `src/api/routes/reports.ts` alongside `/agents`
- Calls `getCrmMetrics(team, service)` for each authorized team (same pattern as `/agents`)
- Returns array of funnel objects:
  ```json
  [
    { "nome": "Funil de Vendas", "team": "azul", "novosHoje": 12, "novosMes": 87, "ativos": 243 },
    ...
  ]
  ```
- Respects `userTeams` from auth middleware — users only see their authorized teams
- Registered in `src/api/server.ts` under `/api/reports`

### Frontend
- New button "Resumo Geral" in sidebar, above "Relatório Agentes"
- New tab key: `'summary'`
- `loadTabData('summary')` calls `GET /api/reports/summary`
- Content area renders cards grouped by team (Azul section, Amarela section)
- Each card shows:
  - Funnel name (bold)
  - `novosHoje` — "hoje"
  - `novosMes` — "este mês"
  - `ativos` — "ativos"
  - Left border colored by team (blue for azul, yellow for amarela)
- Title in header: "Resumo Geral"
- No date filter (uses cache data, today = last 24h)

---

## Feature 2: Accordion Sidebar

### Frontend only
- New state: `const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())`
- Default: empty set (all groups collapsed on load)
- Clicking the team label (`Equipe Azul` / `Equipe Amarela`) toggles the team in/out of `expandedTeams`
- Team label renders a `ChevronRight` (collapsed) or `ChevronDown` (expanded) icon
- The list of pipeline buttons is only rendered when `expandedTeams.has(team)` is true
- CSS: label becomes clickable (cursor pointer), slight hover effect
- No backend changes
