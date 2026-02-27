# Railway Deployment Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the kommo-mcp-agent (Express API + React frontend) to Railway so managers can access it via browser at a custom domain.

**Architecture:**
- Express (port 3000) already serves `web/dist/` as static files → single Railway service
- Railway runs `npm run build:all` (installs web deps + builds Vite + builds TypeScript)
- Custom domain from Hostinger pointed to Railway via CNAME

---

### Task 1: Fix chat sessionId in frontend

**Files:**
- Modify: `web/src/App.tsx`

**Problem:** App.tsx posts to `/api/chat` without `sessionId`, and never saves the returned one. Every message starts a new session → conversation history broken.

**Step 1: Add sessionId state and pass it in requests**

In `web/src/App.tsx`, find the `handleSend` function and update it to:
1. Declare `const [sessionId, setSessionId] = useState<string | null>(null);` at the top of the component (with other state declarations)
2. When posting to `/api/chat`, send `sessionId` (can be null on first message)
3. After receiving response, call `setSessionId(res.data.sessionId)`

**Step 2: Verify the change compiles**

Run: `cd /Users/guicrasto/antigravity-gui/kommo-mcp-agent/web && npx tsc --noEmit`
Expected: zero errors

---

### Task 2: Add SPA fallback route to Express

**Files:**
- Modify: `src/api/server.ts`

**Problem:** Express 5 serves static files from `web/dist/` but has no catch-all for SPA. If a user refreshes or navigates directly, Express returns 404.

**Step 1: Add catch-all after static middleware**

After `app.use(express.static(webPath))`, add:
```typescript
  // SPA fallback — must come after all API routes and static files
  app.get(/(.*)/, (_req, res) => {
    res.sendFile(join(webPath, "index.html"));
  });
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/guicrasto/antigravity-gui/kommo-mcp-agent && npx tsc --noEmit`
Expected: zero errors

---

### Task 3: Update package.json for Railway

**Files:**
- Modify: `package.json`

**Step 1: Add `start` script, `build:all` script, and `engines` field**

Add to `scripts`:
```json
"start": "node build/api/index.js",
"build:all": "npm install --prefix web && npm run build --prefix web && npm run build"
```

Add `engines` field at root level:
```json
"engines": {
  "node": ">=20"
}
```

**Step 2: Verify build works locally**

Run: `cd /Users/guicrasto/antigravity-gui/kommo-mcp-agent && npm run build:all`
Expected: `web/dist/` created + `build/` updated, zero errors

---

### Task 4: Add railway.toml

**Files:**
- Create: `railway.toml`

**Step 1: Create config file**

```toml
[build]
buildCommand = "npm run build:all"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/pipelines"
healthcheckTimeout = 120
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

Note: `healthcheckTimeout = 120` because first-load cache takes ~90s.

---

### Task 5: Update .env.example

**Files:**
- Modify: `.env.example`

**Step 1: Add missing variables**

Replace content with:
```
KOMMO_SUBDOMAIN=your-subdomain
KOMMO_CLIENT_ID=your-client-id
KOMMO_CLIENT_SECRET=your-client-secret
KOMMO_REDIRECT_URI=your-redirect-uri
KOMMO_ACCESS_TOKEN=your-access-token
GEMINI_API_KEY=your-gemini-api-key
PORT=3000
```

---

### Task 6: Initialize git and push to GitHub

**Step 1: Init git repo**

Run: `cd /Users/guicrasto/antigravity-gui/kommo-mcp-agent && git init`

**Step 2: Stage all files**

Run: `git add .`

**Step 3: Verify nothing sensitive is staged**

Run: `git status`
Verify: `.env` is NOT listed (it's in .gitignore)

**Step 4: First commit**

Run:
```bash
git commit -m "Initial commit: Kommo CRM Agent — Express API + React frontend + Gemini chat"
```

**Step 5: Ask user for GitHub repo URL, then push**

Ask the user: "Qual a URL do seu repositório GitHub? (ex: https://github.com/seu-usuario/kommo-agent)"

Then run:
```bash
git remote add origin <URL_DO_USUARIO>
git branch -M main
git push -u origin main
```

---

### Task 7: Railway setup instructions (manual steps for user)

This task is documentation only — provide clear instructions to the user:

**7.1 Create Railway project**
1. Go to railway.app → New Project → Deploy from GitHub repo
2. Select the pushed repository

**7.2 Set environment variables in Railway dashboard**
In the Railway service Variables tab, add all variables from `.env`:
- `KOMMO_SUBDOMAIN`
- `KOMMO_ACCESS_TOKEN`
- `GEMINI_API_KEY`
- `KOMMO_CLIENT_ID`
- `KOMMO_CLIENT_SECRET`
- `KOMMO_REDIRECT_URI`
- `PORT` = `3000`

**7.3 Add custom domain**
1. In Railway service → Settings → Networking → Add Custom Domain
2. Enter your domain (from Hostinger)
3. Railway shows a CNAME target (e.g. `abc123.up.railway.app`)
4. In Hostinger DNS panel: add CNAME record pointing your domain to that target
5. Wait 10-30 min for DNS propagation

**7.4 Verify deployment**
Run: `curl https://YOUR_DOMAIN/api/pipelines`
Expected: JSON array with the 3 funnels
