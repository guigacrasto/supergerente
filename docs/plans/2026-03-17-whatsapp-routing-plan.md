# WhatsApp Routing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-route leads from personal WhatsApp numbers to the agent who owns that number, correcting Kommo round robin after 5 minutes.

**Architecture:** Webhook-driven with delayed processing (setTimeout + Supabase queue for restart resilience). CRUD API for number registration, WhatsAppRouter service for match + reassignment logic, frontend page for management.

**Tech Stack:** Express 5 + TypeScript + Supabase + Kommo API v4 + React 18 + Tailwind v4

---

### Task 1: SQL — Create 3 Supabase tables

**Files:**
- Run manually in Supabase SQL Editor

**Step 1: Create `whatsapp_numbers` table**

```sql
CREATE TABLE whatsapp_numbers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  team TEXT NOT NULL,
  phone TEXT NOT NULL,
  kommo_source_name TEXT,
  kommo_user_id INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_whatsapp_numbers_unique
  ON whatsapp_numbers (tenant_id, phone);
```

**Step 2: Create `whatsapp_routing_queue` table**

```sql
CREATE TABLE whatsapp_routing_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  team TEXT NOT NULL,
  lead_id INTEGER NOT NULL,
  pipeline_id INTEGER,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_routing_queue_pending
  ON whatsapp_routing_queue (status, scheduled_at)
  WHERE status = 'pending';
```

**Step 3: Create `whatsapp_routing_logs` table**

```sql
CREATE TABLE whatsapp_routing_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  team TEXT NOT NULL,
  lead_id INTEGER NOT NULL,
  lead_name TEXT,
  from_user_id INTEGER,
  to_user_id INTEGER,
  to_user_name TEXT,
  phone_matched TEXT,
  source_name TEXT,
  routed_at TIMESTAMPTZ DEFAULT now()
);
```

**Step 4: Verify tables exist**

Run in Supabase SQL Editor:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'whatsapp_%';
```
Expected: 3 rows (whatsapp_numbers, whatsapp_routing_queue, whatsapp_routing_logs)

---

### Task 2: Backend — Add 3 Kommo methods to KommoService

**Files:**
- Modify: `src/services/kommo.ts` (after `closeLeadAsLost` method at line ~361)

**Step 1: Add `updateLeadResponsible` method**

Add after the `closeLeadAsLost` method (line ~361 in `src/services/kommo.ts`):

```typescript
    public async updateLeadResponsible(leadId: number, kommoUserId: number): Promise<void> {
        await this.client.patch("/leads", [{ id: leadId, responsible_user_id: kommoUserId }]);
    }

    public async updateContactResponsible(contactId: number, kommoUserId: number): Promise<void> {
        await this.client.patch("/contacts", [{ id: contactId, responsible_user_id: kommoUserId }]);
    }

    public async updateCompanyResponsible(companyId: number, kommoUserId: number): Promise<void> {
        await this.client.patch("/companies", [{ id: companyId, responsible_user_id: kommoUserId }]);
    }
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/guicrasto/supergerente && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/services/kommo.ts
git commit -m "feat(kommo): add updateLeadResponsible, updateContactResponsible, updateCompanyResponsible methods"
```

---

### Task 3: Backend — Create WhatsAppRouter service

**Files:**
- Create: `src/services/whatsapp-router.ts`

**Step 1: Create the WhatsAppRouter service**

Create `src/services/whatsapp-router.ts`:

```typescript
import { supabase } from "../api/supabase.js";
import { KommoService } from "./kommo.js";
import { getTeamConfigsFromTenant } from "../config.js";
import type { Tenant } from "../types/index.js";

const ROUTING_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const SOURCE_PATTERN = /fonte|source|canal|origin|channel/i;

interface QueueItem {
  id: string;
  tenant_id: string;
  team: string;
  lead_id: number;
  pipeline_id: number | null;
  scheduled_at: string;
}

export class WhatsAppRouter {
  /**
   * Schedule routing for a new lead. Inserts into queue and sets setTimeout.
   */
  static async schedule(
    leadId: number,
    pipelineId: number | null,
    tenantId: string,
    team: string
  ): Promise<void> {
    // Check if tenant has any whatsapp_numbers registered for this team
    const { count } = await supabase
      .from("whatsapp_numbers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("team", team)
      .eq("active", true);

    if (!count || count === 0) return; // No numbers registered, skip

    const scheduledAt = new Date(Date.now() + ROUTING_DELAY_MS).toISOString();

    // Insert into persistent queue
    const { data: item, error } = await supabase
      .from("whatsapp_routing_queue")
      .insert({
        tenant_id: tenantId,
        team,
        lead_id: leadId,
        pipeline_id: pipelineId,
        scheduled_at: scheduledAt,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[WhatsAppRouter] Failed to insert queue item:", error.message);
      return;
    }

    console.log(`[WhatsAppRouter] Scheduled routing for lead ${leadId} in 5 min (queue: ${item.id})`);

    // In-memory timer (fast path)
    setTimeout(() => {
      WhatsAppRouter.processQueueItem(item.id).catch((err) =>
        console.error(`[WhatsAppRouter] Timer error for ${item.id}:`, err.message)
      );
    }, ROUTING_DELAY_MS);
  }

  /**
   * Process a single queue item by ID.
   */
  static async processQueueItem(queueId: string): Promise<void> {
    // Fetch and lock the item
    const { data: item } = await supabase
      .from("whatsapp_routing_queue")
      .select("*")
      .eq("id", queueId)
      .eq("status", "pending")
      .single();

    if (!item) return; // Already processed or not found

    try {
      await WhatsAppRouter.processRouting(item as QueueItem);
    } catch (err: any) {
      console.error(`[WhatsAppRouter] Error processing ${queueId}:`, err.message);
      await supabase
        .from("whatsapp_routing_queue")
        .update({ status: "failed", result: { error: err.message }, processed_at: new Date().toISOString() })
        .eq("id", queueId);
    }
  }

  /**
   * Core routing logic: fetch lead, match source, reassign.
   */
  static async processRouting(item: QueueItem): Promise<void> {
    const { tenant_id, team, lead_id } = item;

    // 1. Get tenant to build KommoService
    const { data: tenant } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenant_id)
      .single();

    if (!tenant) {
      await WhatsAppRouter.markProcessed(item.id, "skipped", { reason: "tenant_not_found" });
      return;
    }

    const teamConfigs = getTeamConfigsFromTenant(tenant as Tenant);
    const tc = teamConfigs[team];
    if (!tc?.subdomain) {
      await WhatsAppRouter.markProcessed(item.id, "skipped", { reason: "team_config_missing" });
      return;
    }

    const service = new KommoService(tc, team, tenant_id);

    // 2. Fetch full lead with contacts
    let lead: any;
    try {
      lead = await service.getLeadDetails(lead_id);
    } catch (err: any) {
      await WhatsAppRouter.markProcessed(item.id, "failed", { reason: "lead_fetch_failed", error: err.message });
      return;
    }

    // 3. Extract source from custom fields
    const sourceName = WhatsAppRouter.extractSourceName(lead);

    // 4. Get registered numbers
    const { data: numbers } = await supabase
      .from("whatsapp_numbers")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("team", team)
      .eq("active", true);

    if (!numbers || numbers.length === 0) {
      await WhatsAppRouter.markProcessed(item.id, "skipped", { reason: "no_numbers_registered" });
      return;
    }

    // 5. Try to match by source name
    let matchedNumber = sourceName
      ? numbers.find((n: any) => n.kommo_source_name && sourceName.toLowerCase().includes(n.kommo_source_name.toLowerCase()))
      : null;

    // 5b. Fallback: match by phone number from contact
    if (!matchedNumber) {
      const contactPhone = WhatsAppRouter.extractContactPhone(lead);
      if (contactPhone) {
        const normalizedPhone = WhatsAppRouter.normalizePhone(contactPhone);
        matchedNumber = numbers.find((n: any) => WhatsAppRouter.normalizePhone(n.phone) === normalizedPhone);
      }
    }

    if (!matchedNumber) {
      await WhatsAppRouter.markProcessed(item.id, "skipped", {
        reason: "no_match",
        source: sourceName || "unknown",
      });
      return;
    }

    // 6. Check if reassignment is needed
    const targetKommoUserId = matchedNumber.kommo_user_id;
    if (!targetKommoUserId) {
      await WhatsAppRouter.markProcessed(item.id, "skipped", { reason: "no_kommo_user_id" });
      return;
    }

    if (lead.responsible_user_id === targetKommoUserId) {
      await WhatsAppRouter.markProcessed(item.id, "skipped", { reason: "already_assigned" });
      return;
    }

    // 7. Reassign lead
    const fromUserId = lead.responsible_user_id;
    await service.updateLeadResponsible(lead_id, targetKommoUserId);

    // 8. Reassign contacts
    const contacts = lead._embedded?.contacts || [];
    for (const contact of contacts) {
      try {
        await service.updateContactResponsible(contact.id, targetKommoUserId);
      } catch (err: any) {
        console.warn(`[WhatsAppRouter] Failed to update contact ${contact.id}:`, err.message);
      }
    }

    // 9. Reassign companies
    const companies = lead._embedded?.companies || [];
    for (const company of companies) {
      try {
        await service.updateCompanyResponsible(company.id, targetKommoUserId);
      } catch (err: any) {
        console.warn(`[WhatsAppRouter] Failed to update company ${company.id}:`, err.message);
      }
    }

    // 10. Log the routing
    await supabase.from("whatsapp_routing_logs").insert({
      tenant_id,
      team,
      lead_id,
      lead_name: lead.name || `Lead ${lead_id}`,
      from_user_id: fromUserId,
      to_user_id: targetKommoUserId,
      to_user_name: matchedNumber.kommo_source_name || matchedNumber.phone,
      phone_matched: matchedNumber.phone,
      source_name: sourceName || "unknown",
    });

    console.log(`[WhatsAppRouter] Routed lead ${lead_id}: user ${fromUserId} -> ${targetKommoUserId} (phone: ${matchedNumber.phone})`);

    await WhatsAppRouter.markProcessed(item.id, "processed", {
      from: fromUserId,
      to: targetKommoUserId,
      phone: matchedNumber.phone,
    });
  }

  /**
   * Catch-up: process pending queue items that survived a restart.
   */
  static async processPendingQueue(): Promise<void> {
    const { data: pending } = await supabase
      .from("whatsapp_routing_queue")
      .select("id, scheduled_at")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (!pending || pending.length === 0) return;

    console.log(`[WhatsAppRouter] Catch-up: ${pending.length} pending items found`);

    for (const item of pending) {
      await WhatsAppRouter.processQueueItem(item.id);
    }
  }

  // --- Helpers ---

  private static extractSourceName(lead: any): string | null {
    const cfValues = lead.custom_fields_values;
    if (!cfValues || !Array.isArray(cfValues)) return null;

    for (const cf of cfValues) {
      if (SOURCE_PATTERN.test(cf.field_name || "")) {
        return cf.values?.[0]?.value?.toString() || null;
      }
    }
    return null;
  }

  private static extractContactPhone(lead: any): string | null {
    const contacts = lead._embedded?.contacts || [];
    for (const contact of contacts) {
      const cfs = contact.custom_fields_values || [];
      for (const cf of cfs) {
        if (cf.field_code === "PHONE" || /phone|telefone|celular/i.test(cf.field_name || "")) {
          return cf.values?.[0]?.value?.toString() || null;
        }
      }
    }
    return null;
  }

  private static normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "").replace(/^0+/, "");
  }

  private static async markProcessed(
    queueId: string,
    status: string,
    result: Record<string, any>
  ): Promise<void> {
    await supabase
      .from("whatsapp_routing_queue")
      .update({ status, result, processed_at: new Date().toISOString() })
      .eq("id", queueId);
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/guicrasto/supergerente && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/services/whatsapp-router.ts
git commit -m "feat(whatsapp): add WhatsAppRouter service with schedule, routing, and catch-up"
```

---

### Task 4: Backend — Create whatsapp API route

**Files:**
- Create: `src/api/routes/whatsapp.ts`

**Step 1: Create the router**

Create `src/api/routes/whatsapp.ts`:

```typescript
import { Router } from "express";
import { supabase } from "../supabase.js";

interface AuthRequest extends Express.Request {
  tenantId?: string;
  userId?: string;
  userRole?: string;
  [key: string]: any;
}

export function whatsappRouter() {
  const router = Router();

  // GET /api/whatsapp/numbers — List registered numbers
  router.get("/numbers", async (req: any, res) => {
    try {
      const authReq = req as AuthRequest;
      const tenantId = authReq.tenantId;

      let query = supabase
        .from("whatsapp_numbers")
        .select("*, profiles:user_id(name, email)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      // Non-admin users only see their own numbers
      if (authReq.userRole !== "admin" && authReq.userRole !== "superadmin") {
        query = query.eq("user_id", authReq.userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      res.json({ numbers: data || [] });
    } catch (err: any) {
      console.error("[WhatsApp] GET /numbers error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/whatsapp/numbers — Register a number
  router.post("/numbers", async (req: any, res) => {
    try {
      const authReq = req as AuthRequest;
      const { phone, kommo_source_name, kommo_user_id } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "phone is required" });
      }

      const { data, error } = await supabase
        .from("whatsapp_numbers")
        .upsert(
          {
            tenant_id: authReq.tenantId,
            user_id: authReq.userId,
            team: req.body.team || "azul",
            phone: phone.replace(/\D/g, ""),
            kommo_source_name: kommo_source_name || null,
            kommo_user_id: kommo_user_id || null,
            active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,phone" }
        )
        .select()
        .single();

      if (error) throw error;

      res.json({ number: data });
    } catch (err: any) {
      console.error("[WhatsApp] POST /numbers error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/whatsapp/numbers/:id — Remove a number
  router.delete("/numbers/:id", async (req: any, res) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;

      // Build query — admin can delete any, others only their own
      let query = supabase
        .from("whatsapp_numbers")
        .delete()
        .eq("id", id)
        .eq("tenant_id", authReq.tenantId);

      if (authReq.userRole !== "admin" && authReq.userRole !== "superadmin") {
        query = query.eq("user_id", authReq.userId);
      }

      const { error } = await query;
      if (error) throw error;

      res.json({ ok: true });
    } catch (err: any) {
      console.error("[WhatsApp] DELETE /numbers/:id error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/whatsapp/logs — List routing logs
  router.get("/logs", async (req: any, res) => {
    try {
      const authReq = req as AuthRequest;
      const limit = Math.min(Number(req.query.limit) || 50, 100);

      const { data, error } = await supabase
        .from("whatsapp_routing_logs")
        .select("*")
        .eq("tenant_id", authReq.tenantId)
        .order("routed_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      res.json({ logs: data || [] });
    } catch (err: any) {
      console.error("[WhatsApp] GET /logs error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/guicrasto/supergerente && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/api/routes/whatsapp.ts
git commit -m "feat(whatsapp): add CRUD API for whatsapp numbers and routing logs"
```

---

### Task 5: Backend — Register whatsapp route in server.ts

**Files:**
- Modify: `src/api/server.ts:16` (add import)
- Modify: `src/api/server.ts:145` (add app.use)

**Step 1: Add import**

In `src/api/server.ts`, add after line 16 (`import { metricasRouter }...`):

```typescript
import { whatsappRouter } from "./routes/whatsapp.js";
```

**Step 2: Add route**

In `src/api/server.ts`, add after line 145 (`app.use("/api/super"...)`):

```typescript
  app.use("/api/whatsapp", requireAuth as any, whatsappRouter());
```

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/guicrasto/supergerente && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/api/server.ts
git commit -m "feat(whatsapp): register /api/whatsapp route in server"
```

---

### Task 6: Backend — Hook webhook to schedule routing

**Files:**
- Modify: `src/api/routes/webhooks.ts`

The webhook is public (no auth). To identify the tenant, we look up all tenants that have whatsapp_numbers registered and check each. Since GAME is the only tenant using this, this is efficient.

**Step 1: Add import and modify handleLeadCreated**

In `src/api/routes/webhooks.ts`, add import at top (after line 4):

```typescript
import { WhatsAppRouter } from "../../services/whatsapp-router.js";
```

Then replace the `handleLeadCreated` function (lines 88-109) with:

```typescript
async function handleLeadCreated(lead: any): Promise<void> {
  const pipelineId = lead.pipeline_id;
  const leadName = lead.name || `Lead ${lead.id}`;

  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("status", "approved");

  if (admins) {
    for (const admin of admins) {
      await createNotification(
        admin.id,
        "lead_created",
        `Novo Lead: ${leadName}`,
        `Um novo lead "${leadName}" foi criado.`,
        { lead_id: lead.id, pipeline_id: pipelineId }
      );
    }
  }

  // Schedule WhatsApp routing for all tenants that have numbers registered
  try {
    const { data: tenantTeams } = await supabase
      .from("whatsapp_numbers")
      .select("tenant_id, team")
      .eq("active", true);

    if (tenantTeams && tenantTeams.length > 0) {
      // Deduplicate by tenant_id+team
      const seen = new Set<string>();
      for (const row of tenantTeams) {
        const key = `${row.tenant_id}:${row.team}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await WhatsAppRouter.schedule(lead.id, pipelineId, row.tenant_id, row.team);
      }
    }
  } catch (err: any) {
    console.error("[Webhook] WhatsApp schedule error:", err.message);
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/guicrasto/supergerente && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/api/routes/webhooks.ts
git commit -m "feat(whatsapp): hook handleLeadCreated to schedule WhatsApp routing"
```

---

### Task 7: Backend — Add startup catch-up

**Files:**
- Modify: `src/api/server.ts`

**Step 1: Add catch-up import and call**

In `src/api/server.ts`, add import (after the whatsappRouter import):

```typescript
import { WhatsAppRouter } from "../services/whatsapp-router.js";
```

Then, before the `return app;` line (line ~155), add:

```typescript
  // Catch-up: process any pending WhatsApp routing items from before restart
  WhatsAppRouter.processPendingQueue().catch((err) =>
    console.error("[Startup] WhatsApp catch-up error:", err.message)
  );
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/guicrasto/supergerente && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/api/server.ts
git commit -m "feat(whatsapp): add startup catch-up for pending routing queue items"
```

---

### Task 8: Frontend — Create WhatsAppPage

**Files:**
- Create: `web/src/pages/WhatsAppPage.tsx`

**Step 1: Create the page component**

Create `web/src/pages/WhatsAppPage.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react';
import { MessageCircle, Plus, Trash2, ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Card, Badge, Skeleton, EmptyState, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface WhatsAppNumber {
  id: string;
  user_id: string;
  team: string;
  phone: string;
  kommo_source_name: string | null;
  kommo_user_id: number | null;
  active: boolean;
  created_at: string;
  profiles: { name: string; email: string } | null;
}

interface RoutingLog {
  id: string;
  team: string;
  lead_id: number;
  lead_name: string;
  from_user_id: number;
  to_user_id: number;
  to_user_name: string;
  phone_matched: string;
  source_name: string;
  routed_at: string;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function formatDateBR(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function WhatsAppPage() {
  const user = useAuthStore((s) => s.user);
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [logs, setLogs] = useState<RoutingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [phone, setPhone] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [kommoUserId, setKommoUserId] = useState('');
  const [team, setTeam] = useState('azul');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [numRes, logRes] = await Promise.all([
        api.get<{ numbers: WhatsAppNumber[] }>('/whatsapp/numbers'),
        api.get<{ logs: RoutingLog[] }>('/whatsapp/logs'),
      ]);
      setNumbers(numRes.data.numbers);
      setLogs(logRes.data.logs);
    } catch (err) {
      console.error('[WhatsAppPage] Erro:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async () => {
    if (!phone.trim()) return;
    setSaving(true);
    try {
      await api.post('/whatsapp/numbers', {
        phone: phone.trim(),
        team,
        kommo_source_name: sourceName.trim() || null,
        kommo_user_id: kommoUserId ? Number(kommoUserId) : null,
      });
      setPhone('');
      setSourceName('');
      setKommoUserId('');
      fetchData();
    } catch (err) {
      console.error('[WhatsAppPage] Erro ao cadastrar:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/whatsapp/numbers/${id}`);
      fetchData();
    } catch (err) {
      console.error('[WhatsAppPage] Erro ao remover:', err);
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const inputClass = 'rounded-button border border-glass-border bg-surface-secondary px-3 py-2 text-body-sm text-foreground outline-none focus:border-primary placeholder:text-muted/50';

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <MessageCircle className="h-7 w-7 text-success" />
            <h1 className="font-heading text-heading-md">WhatsApp Routing</h1>
          </div>
          <p className="mt-1 text-body-md text-muted">
            Cadastre numeros WhatsApp pessoais para redirecionar leads automaticamente ao agente correto
          </p>
        </div>
        <Button onClick={fetchData} variant="ghost" size="sm" loading={loading}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Atualizar
        </Button>
      </div>

      {/* Add Number Card */}
      <Card className="!p-5">
        <h2 className="font-heading text-heading-sm mb-4">Cadastrar Numero</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-body-sm text-muted">Telefone *</label>
            <input
              type="text"
              placeholder="+5511999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={cn(inputClass, 'w-48')}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-body-sm text-muted">Nome da Fonte (Kommo)</label>
            <input
              type="text"
              placeholder="WhatsApp - Joao"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              className={cn(inputClass, 'w-56')}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-body-sm text-muted">ID Kommo do Agente</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="12345678"
              value={kommoUserId}
              onChange={(e) => setKommoUserId(e.target.value)}
              className={cn(inputClass, 'w-36')}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-body-sm text-muted">Time</label>
            <select value={team} onChange={(e) => setTeam(e.target.value)} className={cn(inputClass, 'w-32')}>
              <option value="azul">Azul</option>
              <option value="amarela">Amarela</option>
            </select>
          </div>
          <Button onClick={handleAdd} loading={saving} disabled={!phone.trim()}>
            <Plus className="h-4 w-4 mr-1.5" />
            Cadastrar
          </Button>
        </div>
      </Card>

      {/* Numbers Table */}
      {loading ? (
        <div className="rounded-card border border-glass-border bg-surface p-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : numbers.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Nenhum numero cadastrado"
          description="Cadastre um numero WhatsApp acima para comecar o roteamento automatico."
        />
      ) : (
        <div className="rounded-card border border-glass-border bg-surface overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-glass-border text-muted">
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Fonte Kommo</th>
                <th className="px-4 py-3 font-medium">ID Kommo</th>
                <th className="px-4 py-3 font-medium">Time</th>
                {isAdmin && <th className="px-4 py-3 font-medium">Usuario</th>}
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((n) => (
                <tr key={n.id} className="border-b border-glass-border/50 hover:bg-surface-secondary/40 transition-colors">
                  <td className="px-4 py-3 text-foreground font-medium">{formatPhone(n.phone)}</td>
                  <td className="px-4 py-3 text-foreground">{n.kommo_source_name || '—'}</td>
                  <td className="px-4 py-3 text-foreground tabular-nums">{n.kommo_user_id || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={n.team === 'azul' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-warning/15 text-warning'}>
                      {n.team}
                    </Badge>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-muted">{n.profiles?.name || n.profiles?.email || '—'}</td>
                  )}
                  <td className="px-4 py-3">
                    <Badge className={n.active ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}>
                      {n.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="inline-flex items-center gap-1 rounded-button px-2 py-1 text-body-sm text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Routing Logs */}
      <div>
        <h2 className="font-heading text-heading-sm mb-3">Ultimos Roteamentos</h2>
        {loading ? (
          <div className="rounded-card border border-glass-border bg-surface p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-body-sm text-muted">Nenhum roteamento realizado ainda.</p>
        ) : (
          <div className="rounded-card border border-glass-border bg-surface overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-glass-border text-muted">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Roteamento</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Fonte</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-glass-border/50 hover:bg-surface-secondary/40 transition-colors">
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">{formatDateBR(log.routed_at)}</td>
                    <td className="px-4 py-3 text-foreground">{log.lead_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <span className="text-muted">#{log.from_user_id}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-success" />
                        <span className="font-medium">{log.to_user_name || `#${log.to_user_id}`}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{formatPhone(log.phone_matched)}</td>
                    <td className="px-4 py-3 text-muted">{log.source_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/guicrasto/supergerente/web && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git -C /Users/guicrasto/supergerente add web/src/pages/WhatsAppPage.tsx
git -C /Users/guicrasto/supergerente commit -m "feat(whatsapp): add WhatsAppPage frontend with number management and routing logs"
```

---

### Task 9: Frontend — Add route and sidebar item

**Files:**
- Modify: `web/src/App.tsx:28` (add import) and `web/src/App.tsx:57` (add Route)
- Modify: `web/src/components/layout/Sidebar.tsx:28` (add import) and `web/src/components/layout/Sidebar.tsx:49` (add nav item)

**Step 1: Add import and route in App.tsx**

In `web/src/App.tsx`, add after line 28 (`import { MetricasPage }...`):

```typescript
import { WhatsAppPage } from '@/pages/WhatsAppPage';
```

Then after line 57 (`<Route path="/metricas"...>`), add:

```tsx
          <Route path="/whatsapp" element={<WhatsAppPage />} />
```

**Step 2: Add import and nav item in Sidebar.tsx**

In `web/src/components/layout/Sidebar.tsx`, add `MessageCircle` to the lucide-react imports (line 3-28). Add `MessageCircle,` in the import block.

Then in the `NAV_ITEMS` array (after line 45, the metricas item), add:

```typescript
  { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
```

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/guicrasto/supergerente/web && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git -C /Users/guicrasto/supergerente add web/src/App.tsx web/src/components/layout/Sidebar.tsx
git -C /Users/guicrasto/supergerente commit -m "feat(whatsapp): add /whatsapp route and sidebar nav item"
```

---

### Task 10: Hide WhatsApp page for Embalaqui tenant

**Files:**
- Run SQL in Supabase

**Step 1: Add /whatsapp to Embalaqui's hiddenPages**

Run in Supabase SQL Editor:

```sql
UPDATE tenants
SET settings = jsonb_set(
  settings,
  '{hiddenPages}',
  (COALESCE(settings->'hiddenPages', '[]'::jsonb) || '"/whatsapp"'::jsonb)
)
WHERE id = 'bf393e84-2151-4d6e-8b90-7a02c534ad9c';
```

**Step 2: Verify**

```sql
SELECT settings->'hiddenPages' FROM tenants WHERE id = 'bf393e84-2151-4d6e-8b90-7a02c534ad9c';
```

Expected: Array containing "/whatsapp" (plus existing "/renda", "/profissao", "/ddd")

---

### Task 11: Verify full build

**Step 1: Backend build check**

Run: `cd /Users/guicrasto/supergerente && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npx tsc --noEmit`
Expected: No errors

**Step 2: Frontend build check**

Run: `cd /Users/guicrasto/supergerente/web && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npx tsc --noEmit`
Expected: No errors

**Step 3: Full production build**

Run: `cd /Users/guicrasto/supergerente && export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && npm run build:all`
Expected: Build succeeds without errors
