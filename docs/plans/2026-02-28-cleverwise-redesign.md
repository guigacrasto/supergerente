# SuperGerente Cleverwise Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the SuperGerente frontend using the Cleverwise design system — new palette (purple), fonts (Libre Franklin + Mulish), sidebar with branding "SuperGerente", dark/light theme toggle, and updated auth pages.

**Architecture:** CSS full rewrite (~1100 lines) + targeted JSX edits in App.tsx (sidebar, auth pages, theme toggle, branding). No logic/functionality changes. 3 files total.

**Tech Stack:** React 18, Vite, TypeScript, lucide-react icons, Google Fonts.

---

## Task 1: Google Fonts — index.html

**Files:**
- Modify: `web/index.html` (lines 6-9)

**Step 1: Replace Inter font import with Libre Franklin + Mulish, update title**

Replace lines 6-9:
```html
    <title>SuperGerente | Manager Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```
With:
```html
    <title>SuperGerente</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@500;600;700&family=Mulish:wght@400;500;600&display=swap" rel="stylesheet">
```

**Step 2: Build**

Run: `cd /Users/guicrasto/antigravity-gui/supergerente && npm run build:all`
Expected: zero errors

**Step 3: Commit**

```bash
git add web/index.html
git commit -m "chore: swap fonts to Libre Franklin + Mulish, rename to SuperGerente"
```

---

## Task 2: CSS Full Rewrite — Design Tokens + Global Styles

**Files:**
- Modify: `web/src/index.css` — full rewrite

**Step 1: Rewrite `index.css` entirely**

Replace the entire file contents. The new CSS must include:

**`:root` / `[data-theme="dark"]` tokens:**
```css
:root, [data-theme="dark"] {
  --bg-primary: #12081E;
  --bg-surface: #22182D;
  --bg-elevated: #2F233C;
  --sidebar-bg: #270E5F;
  --accent: #9566F2;
  --accent-glow: rgba(149, 102, 242, 0.1);
  --accent-secondary: #1F74EC;
  --text-primary: #E0E3E9;
  --text-secondary: #959CA6;
  --glass-border: rgba(255,255,255,0.08);
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
}
```

**`[data-theme="light"]` tokens:**
```css
[data-theme="light"] {
  --bg-primary: #F4F5F7;
  --bg-surface: #FFFFFF;
  --bg-elevated: #EEF4FE;
  --sidebar-bg: #270E5F;
  --accent: #9566F2;
  --accent-glow: rgba(149, 102, 242, 0.08);
  --accent-secondary: #1F74EC;
  --text-primary: #23272C;
  --text-secondary: #645B6D;
  --glass-border: rgba(0,0,0,0.08);
}
```

**Body:**
```css
body {
  font-family: 'Mulish', system-ui, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
```

**All headings (h1-h3):**
```css
h1, h2, h3 { font-family: 'Libre Franklin', sans-serif; }
```

**Key mapping from old vars to new (apply throughout):**
- `var(--bg-dark)` → `var(--bg-primary)`
- `var(--glass)` → `var(--bg-surface)`
- `var(--accent-color)` → `var(--accent)`
- `var(--text-primary)` stays same name
- `var(--text-secondary)` stays same name
- `var(--glass-border)` stays same name

**Glass class:** Replace `backdrop-filter: blur(12px)` with solid `background: var(--bg-surface)`:
```css
.glass {
  background: var(--bg-surface);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
}
```

**Sidebar:** Replace old sidebar styles with:
```css
.sidebar {
  width: 260px;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  background: var(--sidebar-bg);
  flex-shrink: 0;
  border-right: none;
}
.sidebar, .sidebar * { color: #E0E3E9; }
```

**Sidebar brand:**
```css
.sidebar .brand { /* existing flex layout */ }
.sidebar .logo {
  width: 36px; height: 36px;
  background: linear-gradient(135deg, #9566F2, #1F74EC);
  border-radius: 8px;
  /* etc */
}
```

**Sidebar nav active state:**
```css
.sidebar button:hover,
.sidebar button.active {
  background: rgba(149,102,242,0.2);
  color: white;
  border-left: 3px solid #9566F2;
}
```

**Auth page:**
```css
.auth-page {
  background: var(--bg-primary);
  background-image: radial-gradient(circle at top right, rgba(149,102,242,0.08), transparent);
}
```

**Auth card inputs:**
```css
.auth-card input {
  background: rgba(149,102,242,0.06);
  border: 1px solid var(--glass-border);
}
.auth-card input:focus { border-color: var(--accent); }
```

**Auth submit button:**
```css
.auth-card button[type="submit"], .auth-card .back-to-login {
  background: linear-gradient(135deg, #9566F2, #1F74EC);
  color: white;
}
```

**Chat user bubble:**
```css
.message-wrapper.user .bubble {
  background: linear-gradient(135deg, #9566F2, #1F74EC);
  color: white;
  border: none;
}
```

**Input bar send button:**
```css
.input-bar button {
  background: var(--accent);
}
```

**Table sticky header:**
```css
.table-responsive thead th {
  position: sticky; top: 0; z-index: 2;
  background: var(--bg-surface);
}
```

**All other sections** (metrics, filter controls, summary, alerts, admin, mentor, markdown) follow the same pattern: replace old color refs (`#06b6d4`, `rgba(6, 182, 212, ...)`, `#0f172a`, `#1e293b`, `#a78bfa`) with new vars. Keep the same class names and structural CSS.

**Content area:**
```css
.content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background: var(--bg-primary);
  background-image: radial-gradient(circle at top right, rgba(149,102,242,0.03), transparent);
}
```

**Theme toggle button (new):**
```css
.theme-toggle {
  background: transparent;
  border: none;
  color: #E0E3E9;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.9rem;
}
.theme-toggle:hover {
  background: rgba(149,102,242,0.2);
}
```

**Mentor chip council gradient (keep):**
```css
.mentor-chip.council {
  background: linear-gradient(135deg, #9566F2, #1F74EC);
  border-color: transparent;
  color: white;
}
```

**Sortable th hover (update):**
```css
.sortable-th:hover { color: var(--accent); }
.sort-indicator { color: var(--accent); }
```

**Alert filter chip active (update):**
```css
.alert-filter-chip.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}
```

**Copyright:**
```css
.sidebar-copyright {
  font-size: 0.7rem;
  color: rgba(224,227,233,0.4);
  text-align: center;
  padding-top: 1rem;
}
```

**IMPORTANT:** The complete CSS must preserve ALL existing class names and structural rules. Only colors, fonts, backgrounds, borders, and gradients change. No class renames, no structural layout changes beyond what's specified.

**Step 2: Build**

Run: `cd /Users/guicrasto/antigravity-gui/supergerente && npm run build:all`
Expected: zero errors

**Step 3: Commit**

```bash
git add web/src/index.css
git commit -m "feat: full CSS rewrite with Cleverwise design system (purple palette, Libre Franklin + Mulish, dark/light tokens)"
```

---

## Task 3: App.tsx — Theme Toggle + Branding + Sidebar + Auth

**Files:**
- Modify: `web/src/App.tsx`

### 3a. Add Sun/Moon icons to lucide imports (line 3-19)

Replace import block:
```tsx
import {
    MessageSquare,
    BarChart3,
    Settings,
    LogOut,
    ChevronRight,
    ChevronDown,
    Send,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Filter,
    RefreshCw,
    PieChart,
    AlertTriangle,
    Clock,
    Sun,
    Moon
} from 'lucide-react';
```

### 3b. Add theme state var (after line 167, after `alertEquipeFilter`)

```tsx
const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('ak_theme') as 'dark' | 'light') || 'dark';
});
```

### 3c. Add theme effect (after the existing useEffect at line 169-179)

```tsx
useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ak_theme', theme);
}, [theme]);
```

### 3d. Update branding in LoginPage (lines 58-61)

Replace:
```tsx
                <div className="brand">
                    <div className="logo">KG</div>
                    <span>SuperGerente</span>
                </div>
```
With:
```tsx
                <div className="brand">
                    <div className="logo">AK</div>
                    <span>SuperGerente</span>
                </div>
```

### 3e. Update branding in RegisterPage success (line 102)

Replace:
```tsx
                    <div className="brand"><div className="logo">KG</div><span>SuperGerente</span></div>
```
With:
```tsx
                    <div className="brand"><div className="logo">AK</div><span>SuperGerente</span></div>
```

### 3f. Update branding in RegisterPage form (line 116)

Replace:
```tsx
                <div className="brand"><div className="logo">KG</div><span>SuperGerente</span></div>
```
With:
```tsx
                <div className="brand"><div className="logo">AK</div><span>SuperGerente</span></div>
```

### 3g. Update sidebar JSX (lines 1089-1180)

Replace the entire `<aside className="sidebar glass">` block with:

```tsx
            <aside className="sidebar">
                <div className="brand">
                    <div className="logo">AK</div>
                    <span>SuperGerente</span>
                </div>

                {currentUser && (
                    <div className="user-info">
                        <div className="user-avatar">{currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}</div>
                        <div>
                            <span className="user-name">{currentUser.name}</span>
                            <span className="user-role">{currentUser.role}</span>
                        </div>
                    </div>
                )}

                <nav>
                    <div className="group">
                        <label>Principal</label>
                        <button
                            className={activeTab === 'chat' && page !== 'admin' ? 'active' : ''}
                            onClick={() => { setPage('app'); setActiveTab('chat'); }}
                        >
                            <MessageSquare size={18} /> Chat
                        </button>
                        <button
                            className={activeTab === 'agents' && page !== 'admin' ? 'active' : ''}
                            onClick={() => { setPage('app'); loadTabData('agents'); }}
                        >
                            <BarChart3 size={18} /> Agentes
                        </button>
                        <button
                            className={activeTab === 'summary' && page !== 'admin' ? 'active' : ''}
                            onClick={() => { setPage('app'); loadTabData('summary'); }}
                        >
                            <PieChart size={18} /> Resumo
                        </button>
                        <button
                            className={activeTab === 'alerts' && page !== 'admin' ? 'active' : ''}
                            onClick={() => { setPage('app'); loadTabData('alerts'); }}
                        >
                            <AlertTriangle size={18} /> Alertas
                        </button>
                    </div>

                    {(['azul', 'amarela'] as const)
                        .filter(team => pipelines.some(p => p.team === team))
                        .map(team => (
                            <div className="group" key={team}>
                                <label
                                    className={`team-label ${team} accordion-label`}
                                    onClick={() => setExpandedTeams(prev => {
                                        const next = new Set(prev);
                                        next.has(team) ? next.delete(team) : next.add(team);
                                        return next;
                                    })}
                                >
                                    {expandedTeams.has(team)
                                        ? <ChevronDown size={14} />
                                        : <ChevronRight size={14} />}
                                    {team === 'azul' ? 'Equipe Azul' : 'Equipe Amarela'}
                                </label>
                                {expandedTeams.has(team) && pipelines.filter(p => p.team === team).map(p => (
                                    <button
                                        key={p.id}
                                        className={activeTab === `brand-${p.id}` && page !== 'admin' ? 'active' : ''}
                                        onClick={() => { setPage('app'); loadTabData(`brand-${p.id}`); }}
                                    >
                                        <ChevronRight size={14} /> {p.name.replace('FUNIL ', '').substring(0, 15)}
                                    </button>
                                ))}
                            </div>
                        ))
                    }
                </nav>

                <div className="user-section">
                    <div className="user-actions">
                        {currentUser?.role === 'admin' && (
                            <button
                                className={page === 'admin' ? 'active' : ''}
                                onClick={() => { setPage('admin'); loadAdminPanel(); }}
                            >
                                <Settings size={18} /> Admin
                            </button>
                        )}
                        {page === 'admin' && (
                            <button onClick={() => setPage('app')}>
                                <MessageSquare size={18} /> Voltar
                            </button>
                        )}
                        <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                            {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                        </button>
                        <button className="logout-btn" onClick={handleLogout}>
                            <LogOut size={18} /> Sair
                        </button>
                    </div>
                </div>
                <div className="sidebar-copyright">© 2026 Antigravity</div>
            </aside>
```

Key changes from original:
- Removed `glass` class from aside (sidebar has its own bg)
- Logo "KG" → "AK", "SuperGerente" → "SuperGerente"
- User profile moved UP from bottom to below brand (with avatar initials)
- Added theme toggle button with Sun/Moon icon
- Added copyright at bottom
- Shortened nav labels: "Chat Atual" → "Chat", "Resumo Geral" → "Resumo", "Painel de Alertas" → "Alertas", "Relatório Agentes" → "Agentes"

### 3h. Add user-avatar CSS class to index.css

This should already be covered in Task 2 CSS rewrite but ensure this exists:
```css
.user-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #9566F2, #1F74EC);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700; color: white;
  flex-shrink: 0;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 0.75rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
```

**Step 2: Build**

Run: `cd /Users/guicrasto/antigravity-gui/supergerente && npm run build:all`
Expected: zero errors

**Step 3: Commit**

```bash
git add web/src/App.tsx web/src/index.css
git commit -m "feat: SuperGerente branding, sidebar redesign, theme toggle dark/light"
```

---

## Task 4: Final Build + Push to Railway

**Step 1: Full build**

Run: `cd /Users/guicrasto/antigravity-gui/supergerente && npm run build:all`
Expected: zero TS errors, vite build success

**Step 2: Visual verification**

Run: `cd /Users/guicrasto/antigravity-gui/supergerente && npm run dev`
Open in browser, verify:
- Login page shows "AK" logo, purple gradient button, "SuperGerente" title
- Sidebar is dark purple (#270E5F), avatar initials circle, theme toggle works
- Dark mode: deep purple backgrounds (#12081E)
- Light mode: light gray/white backgrounds (#F4F5F7), sidebar stays purple
- Chat bubbles: user = purple gradient
- Tables, alerts, admin all use purple accent
- All existing functionality works (no regressions)

**Step 3: Push**

```bash
git push origin main
```

Railway auto-redeploy triggered.
