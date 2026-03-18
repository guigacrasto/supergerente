-- 011-whatsapp-health.sql
-- Adds health monitoring fields to whatsapp_numbers

ALTER TABLE whatsapp_numbers
  ADD COLUMN IF NOT EXISTS kommo_source_id INTEGER,
  ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_alert_at TIMESTAMPTZ;

-- Index for health monitor queries (active numbers that need checking)
CREATE INDEX IF NOT EXISTS idx_whatsapp_numbers_health
  ON whatsapp_numbers (tenant_id, active, connection_status);
