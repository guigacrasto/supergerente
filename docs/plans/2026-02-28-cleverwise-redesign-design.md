# Redesign Frontend — SuperGerente (Cleverwise Style)

**Data:** 2026-02-28
**Abordagem:** B — CSS + JSX Parcial (reescrita CSS completa + edições em sidebar, auth, theme toggle no App.tsx)
**Figma Source:** Cleverwise by Merkulove (`MGgCyByTq02Z9ABCAGGxJM`)

---

## Decisões

- **Nome:** SuperGerente (sigla AK)
- **Tema:** Dark + Light com toggle (`data-theme` no `<html>`)
- **Auth:** Login simples centralizado, sem split-screen/ilustração
- **Sidebar:** Roxo escuro fixo em ambos os temas
- **Fontes:** Libre Franklin (títulos) + Mulish (corpo)
- **Accent:** `#9566F2` (roxo) substituindo `#06b6d4` (ciano)

---

## 1. Design Tokens

```css
:root, [data-theme="dark"] {
  --bg-primary: #12081E;
  --bg-surface: #22182D;
  --bg-elevated: #2F233C;
  --sidebar-bg: #270E5F;
  --accent: #9566F2;
  --accent-secondary: #1F74EC;
  --text-primary: #E0E3E9;
  --text-secondary: #959CA6;
  --glass-border: rgba(255,255,255,0.08);
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
}

[data-theme="light"] {
  --bg-primary: #F4F5F7;
  --bg-surface: #FFFFFF;
  --bg-elevated: #EEF4FE;
  --sidebar-bg: #270E5F;
  --accent: #9566F2;
  --accent-secondary: #1F74EC;
  --text-primary: #23272C;
  --text-secondary: #645B6D;
  --glass-border: rgba(0,0,0,0.08);
}
```

Fonts: `Libre Franklin` (titles), `Mulish` (body) via Google Fonts.

---

## 2. Sidebar

- Fundo: `var(--sidebar-bg)` (#270E5F), fixo em ambos os temas
- Logo: "AK" quadrado gradient `#9566F2 → #1F74EC`, border-radius 8px
- Brand text: "SuperGerente" branco
- Profile: avatar com iniciais + nome + role badge
- Nav items: ícones lucide + labels, ativo = `rgba(149,102,242,0.2)` + border-left 3px `#9566F2`
- Bottom: toggle tema (sol/lua), sair, copyright "© 2026 Antigravity"

---

## 3. Auth Pages

- Login centralizado (sem split-screen), fundo `var(--bg-primary)` + radial gradient roxo sutil
- Logo AK + "SuperGerente" no topo do card
- Inputs: `rgba(149,102,242,0.06)` bg, focus border `#9566F2`
- Submit button: gradient `#9566F2 → #1F74EC`
- Register page: mesma estética

---

## 4. Content Areas

Todas as áreas trocam ciano → roxo, backgrounds mais profundos:

- **Chat:** bubble user = gradient `#9566F2 → #1F74EC`, input bar `var(--bg-surface)`, mentor chips accent roxo
- **Tabela Agentes:** card `var(--bg-surface)`, headers `var(--bg-elevated)`, sticky header bg `var(--bg-surface)`, sort/filter accent roxo
- **Resumo:** cards `var(--bg-surface)`, values `#9566F2`
- **Alertas:** filter chips accent roxo, cores semânticas (vermelho/amarelo/laranja) mantidas
- **Admin:** inputs/forms estilo novo, botões semânticos mantidos

---

## Arquivos Modificados

- `web/index.html` — Google Fonts import (Libre Franklin + Mulish)
- `web/src/index.css` — reescrita completa (~1100 linhas)
- `web/src/App.tsx` — sidebar JSX, branding, auth pages, theme toggle state + handler
