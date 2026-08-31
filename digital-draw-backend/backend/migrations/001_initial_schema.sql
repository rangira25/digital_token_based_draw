
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


CREATE TYPE user_role AS ENUM ('participant', 'organizer', 'admin');
CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'banned');
CREATE TYPE draw_status AS ENUM ('draft', 'open', 'closed', 'completed', 'cancelled');
CREATE TYPE token_status AS ENUM ('issued', 'used', 'expired', 'revoked');
CREATE TYPE entry_status AS ENUM ('active', 'disqualified', 'withdrawn');
CREATE TYPE winner_status AS ENUM ('selected', 'notified', 'claimed', 'forfeited');
CREATE TYPE notification_type AS ENUM ('win', 'draw_open', 'draw_closing', 'announcement', 'verification', 'claim', 'system');
CREATE TYPE audit_action AS ENUM (
  'user_registered', 'user_login', 'user_logout', 'user_suspended',
  'draw_created', 'draw_opened', 'draw_closed', 'draw_executed', 'draw_cancelled',
  'token_issued', 'token_used', 'token_revoked',
  'entry_submitted', 'entry_disqualified',
  'winner_selected', 'prize_claimed',
  'admin_action', '2fa_enabled', '2fa_disabled',
  'password_reset', 'email_verified'
);
CREATE TYPE prize_type AS ENUM ('cash', 'product', 'voucher', 'service', 'other');

 

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  role              user_role NOT NULL DEFAULT 'participant',
  status            user_status NOT NULL DEFAULT 'pending',

 
  full_name         VARCHAR(255) NOT NULL,
  phone             VARCHAR(50),
  national_id       VARCHAR(100),
  profile_image_url TEXT,

 
  company_name      VARCHAR(255),
  organizer_license VARCHAR(100),

  
  email_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,
  phone_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  identity_verified BOOLEAN NOT NULL DEFAULT FALSE,

   
  totp_secret       VARCHAR(255),
  totp_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  backup_codes      TEXT[],  

 
  login_attempts    INTEGER NOT NULL DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  last_login_at     TIMESTAMPTZ,
  last_login_ip     VARCHAR(50),
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMPTZ,
  email_verify_token VARCHAR(255),

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_national_id ON users(national_id);

 

CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(512) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

 

CREATE TABLE draws (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title               VARCHAR(255) NOT NULL,
  description         TEXT,
  status              draw_status NOT NULL DEFAULT 'draft',

 
  registration_start  TIMESTAMPTZ NOT NULL,
  registration_end    TIMESTAMPTZ NOT NULL,
  draw_date           TIMESTAMPTZ NOT NULL,
 
  max_participants    INTEGER,
  max_entries_per_user INTEGER NOT NULL DEFAULT 1,
  min_age             INTEGER,
  eligibility_notes   TEXT,

 
  tokens_per_entry    INTEGER NOT NULL DEFAULT 1,
  total_token_pool    INTEGER NOT NULL DEFAULT 0,

 
  winners_count       INTEGER NOT NULL DEFAULT 1,
  draw_algorithm      VARCHAR(50) NOT NULL DEFAULT 'weighted_random',
  draw_seed           VARCHAR(255), -- for reproducibility/audit
  draw_executed_at    TIMESTAMPTZ,
  draw_executed_by    UUID REFERENCES users(id),

  -- Meta
  image_url           TEXT,
  terms_url           TEXT,
  is_public           BOOLEAN NOT NULL DEFAULT TRUE,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_draws_organizer_id ON draws(organizer_id);
CREATE INDEX idx_draws_status ON draws(status);
CREATE INDEX idx_draws_draw_date ON draws(draw_date);

 

CREATE TABLE prizes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id     UUID NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  rank        INTEGER NOT NULL DEFAULT 1,  
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  prize_type  prize_type NOT NULL DEFAULT 'other',
  value       NUMERIC(12,2),
  currency    VARCHAR(10) DEFAULT 'USD',
  quantity    INTEGER NOT NULL DEFAULT 1,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prizes_draw_id ON prizes(draw_id);

 

CREATE TABLE tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id       UUID NOT NULL REFERENCES draws(id) ON DELETE RESTRICT,
  participant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_code    VARCHAR(64) UNIQUE NOT NULL,
  status        token_status NOT NULL DEFAULT 'issued',
  issued_by     UUID NOT NULL REFERENCES users(id),
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at       TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  weight        INTEGER NOT NULL DEFAULT 1,  
  metadata      JSONB DEFAULT '{}'
);

CREATE INDEX idx_tokens_draw_id ON tokens(draw_id);
CREATE INDEX idx_tokens_participant_id ON tokens(participant_id);
CREATE INDEX idx_tokens_token_code ON tokens(token_code);
CREATE INDEX idx_tokens_status ON tokens(status);

 

CREATE TABLE draw_entries (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id        UUID NOT NULL REFERENCES draws(id) ON DELETE RESTRICT,
  participant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_id       UUID NOT NULL REFERENCES tokens(id) ON DELETE RESTRICT,
  status         entry_status NOT NULL DEFAULT 'active',
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disqualified_at TIMESTAMPTZ,
  disqualified_reason TEXT,
  ip_address     VARCHAR(50),
  user_agent     TEXT,

  UNIQUE(draw_id, token_id)
);

CREATE INDEX idx_draw_entries_draw_id ON draw_entries(draw_id);
CREATE INDEX idx_draw_entries_participant_id ON draw_entries(participant_id);
CREATE INDEX idx_draw_entries_token_id ON draw_entries(token_id);

 

CREATE TABLE winners (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id        UUID NOT NULL REFERENCES draws(id) ON DELETE RESTRICT,
  participant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entry_id       UUID NOT NULL REFERENCES draw_entries(id) ON DELETE RESTRICT,
  prize_id       UUID REFERENCES prizes(id),
  rank           INTEGER NOT NULL DEFAULT 1,
  status         winner_status NOT NULL DEFAULT 'selected',
  selected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at    TIMESTAMPTZ,
  claimed_at     TIMESTAMPTZ,
  claim_deadline TIMESTAMPTZ,
  claim_notes    TEXT,
  verification_code VARCHAR(100),
  announcement_sent BOOLEAN NOT NULL DEFAULT FALSE,

  UNIQUE(draw_id, participant_id)
);

CREATE INDEX idx_winners_draw_id ON winners(draw_id);
CREATE INDEX idx_winners_participant_id ON winners(participant_id);

 

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  read_at    TIMESTAMPTZ,
  data       JSONB DEFAULT '{}', -- extra payload (draw_id, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_type ON notifications(type);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      audit_action NOT NULL,
  entity_type VARCHAR(50),  -- 'user', 'draw', 'token', etc.
  entity_id   UUID,
  description TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  ip_address  VARCHAR(50),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- TRIGGERS - auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_draws_updated_at
  BEFORE UPDATE ON draws
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
