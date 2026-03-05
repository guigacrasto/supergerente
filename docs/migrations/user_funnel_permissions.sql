CREATE TABLE IF NOT EXISTS user_funnel_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team TEXT NOT NULL CHECK (team IN ('azul', 'amarela')),
  allowed_funnels JSONB NOT NULL DEFAULT '[]',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, team)
);

-- RLS: only service role can access (admin operations go through backend)
ALTER TABLE user_funnel_permissions ENABLE ROW LEVEL SECURITY;
