-- Migration 009: Multi-Tenant Architecture
-- Cria tabela tenants, adiciona tenant_id em tabelas existentes, indexes.

-- 1. Tabela de tenants
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#9566F2',
  kommo_base_url TEXT,
  kommo_access_token TEXT,
  kommo_refresh_token TEXT,
  kommo_token_expires_at TIMESTAMPTZ,
  webhook_secret TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Adicionar tenant_id nas tabelas existentes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE token_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE user_funnel_permissions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 3. Indexes para performance
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant ON push_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_tenant ON settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_token_logs_tenant ON token_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_funnel_permissions_tenant ON user_funnel_permissions(tenant_id);

-- 4. Settings key passa a ser unique por tenant (não globalmente)
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;
ALTER TABLE settings ADD CONSTRAINT settings_tenant_key_unique UNIQUE (tenant_id, key);

-- 5. RLS habilitado como defesa em profundidade
-- (backend usa service key que bypassa RLS, isolamento é feito no middleware)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_funnel_permissions ENABLE ROW LEVEL SECURITY;

-- 6. Policy para service key (bypass total)
-- Supabase service key já bypassa RLS por padrão, mas adicionamos
-- policies permissivas para queries com role = 'service_role'
CREATE POLICY IF NOT EXISTS "service_role_all" ON tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON token_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON user_funnel_permissions FOR ALL USING (true) WITH CHECK (true);
