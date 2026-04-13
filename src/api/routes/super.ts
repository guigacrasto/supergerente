import { Router } from 'express';
import type { AuthRequest } from '../middleware/requireAuth.js';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js';
import { getAllTenants, createTenant, updateTenant, getTenantById } from '../services/tenant.js';
import { supabase } from '../supabase.js';
import crypto from 'crypto';

const router = Router();

// All routes require superadmin
router.use(requireSuperAdmin as any);

// GET /api/super/tenants — List all tenants with user count
router.get('/tenants', async (_req: AuthRequest, res) => {
  try {
    const tenants = await getAllTenants();

    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const result = tenants.map(t => ({
      ...t,
      userCount: userCount || 0,
    }));

    res.json({ tenants: result });
  } catch (err: any) {
    console.error('[Super] Erro ao listar tenants:', err.message);
    res.status(500).json({ error: 'Erro ao listar tenants' });
  }
});

// GET /api/super/tenants/:id — Get single tenant details
router.get('/tenants/:id', async (req: AuthRequest, res) => {
  try {
    const tenant = await getTenantById(req.params.id as string);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant não encontrado' });
      return;
    }
    res.json({ tenant });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar tenant' });
  }
});

// POST /api/super/tenants — Create new tenant
router.post('/tenants', async (req: AuthRequest, res) => {
  try {
    const { name, slug, kommoBaseUrl, kommoAccessToken, kommoRefreshToken, settings } = req.body;

    if (!name || !slug) {
      res.status(400).json({ error: 'Nome e slug são obrigatórios' });
      return;
    }

    const tenant = await createTenant({
      name,
      slug,
      kommoBaseUrl,
      kommoAccessToken,
      kommoRefreshToken,
      webhookSecret: crypto.randomBytes(32).toString('hex'),
      settings: settings || {},
    });

    res.status(201).json({ tenant });
  } catch (err: any) {
    if (err.message?.includes('duplicate')) {
      res.status(409).json({ error: 'Slug já existe' });
      return;
    }
    console.error('[Super] Erro ao criar tenant:', err.message);
    res.status(500).json({ error: 'Erro ao criar tenant' });
  }
});

// PATCH /api/super/tenants/:id — Update tenant
router.patch('/tenants/:id', async (req: AuthRequest, res) => {
  try {
    const tenant = await updateTenant(req.params.id as string, req.body);
    res.json({ tenant });
  } catch (err: any) {
    console.error('[Super] Erro ao atualizar tenant:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar tenant' });
  }
});

// GET /api/super/pending-users — Users without tenant
router.get('/pending-users', async (_req: AuthRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, status, created_at')
      .is('tenant_id', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ users: data || [] });
  } catch (err: any) {
    console.error('[Super] Erro ao listar pending users:', err.message);
    res.status(500).json({ error: 'Erro ao listar usuários pendentes' });
  }
});

// PATCH /api/super/users/:id/assign-tenant — Assign tenant to user
router.patch('/users/:id/assign-tenant', async (req: AuthRequest, res) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId é obrigatório' });
      return;
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant não encontrado' });
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ tenant_id: tenantId })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Super] Erro ao atribuir tenant:', err.message);
    res.status(500).json({ error: 'Erro ao atribuir tenant' });
  }
});

// GET /api/super/stats — Global stats
router.get('/stats', async (_req: AuthRequest, res) => {
  try {
    const tenants = await getAllTenants();
    const active = tenants.filter(t => t.isActive).length;

    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: pendingCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .is('tenant_id', null);

    res.json({
      totalTenants: tenants.length,
      activeTenants: active,
      totalUsers: userCount || 0,
      pendingUsers: pendingCount || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

export { router as superRouter };
