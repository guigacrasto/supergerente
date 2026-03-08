-- 010-totp.sql — Suporte a 2FA TOTP (autenticacao em dois fatores)

-- Colunas na profiles
ALTER TABLE profiles
  ADD COLUMN totp_secret_encrypted TEXT DEFAULT NULL,
  ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN totp_backup_codes TEXT[] DEFAULT NULL,
  ADD COLUMN totp_verified_at TIMESTAMPTZ DEFAULT NULL;

-- Tabela de challenges temporarios (emitidos apos senha correta quando 2FA ativo)
CREATE TABLE totp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_totp_challenges_token ON totp_challenges(challenge_token);
CREATE INDEX idx_totp_challenges_expires ON totp_challenges(expires_at);
