-- Migration 007: Audit Logs
-- Tabela para registrar todas as ações dos usuários no sistema

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  method TEXT,
  details JSONB DEFAULT '{}',
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Auto-cleanup: deleta logs com mais de 90 dias
-- Rodar via cron job ou Supabase scheduled function:
-- DELETE FROM audit_logs WHERE created_at < now() - interval '90 days';
