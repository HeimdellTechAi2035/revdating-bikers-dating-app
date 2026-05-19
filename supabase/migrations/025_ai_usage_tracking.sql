-- =============================================================
-- REVdating — Migration 025: AI usage tracking and limits
-- Metadata-only tracking for AI helper usage, quota counters,
-- and plan-based AI feature allowances.
--
-- Privacy guardrails:
--   - Do not store raw prompts, private messages, generated AI output,
--     full report descriptions, full provider payloads, private contact
--     details, or exact GPS data in these tables.
--   - Store only normalized metadata, counters, timings, and coarse risk
--     classifications needed for safety, quota enforcement, and analytics.
-- =============================================================

-- =============================================================
-- AI USAGE EVENTS
-- Append-only metadata log written by trusted server routes.
-- =============================================================

CREATE TABLE ai_usage_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature             TEXT NOT NULL,
  plan_at_time        TEXT,
  outcome             TEXT NOT NULL,
  period_week_start   DATE,
  period_month_start  DATE,
  model               TEXT,
  request_id          UUID,
  provider_request_ms INTEGER,
  input_char_count    INTEGER,
  output_item_count   INTEGER,
  risk_level          TEXT,
  risk_categories     TEXT[],
  related_entity_type TEXT,
  related_entity_id   UUID,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ai_usage_events_feature_check CHECK (
    feature IN (
      'profile_helper',
      'icebreaker',
      'message_safety',
      'ride_planner',
      'admin_moderation_summary'
    )
  ),
  CONSTRAINT ai_usage_events_outcome_check CHECK (
    outcome IN (
      'allowed',
      'completed',
      'limited',
      'provider_error',
      'validation_error',
      'configuration_error',
      'blocked_by_policy'
    )
  ),
  CONSTRAINT ai_usage_events_plan_at_time_check CHECK (
    plan_at_time IS NULL OR plan_at_time IN ('free', 'rider_plus', 'rider_premium', 'admin')
  ),
  CONSTRAINT ai_usage_events_risk_level_check CHECK (
    risk_level IS NULL OR risk_level IN ('low', 'medium', 'high')
  ),
  CONSTRAINT ai_usage_events_related_entity_type_check CHECK (
    related_entity_type IS NULL OR related_entity_type IN ('match', 'report', 'profile')
  ),
  CONSTRAINT ai_usage_events_provider_request_ms_check CHECK (
    provider_request_ms IS NULL OR provider_request_ms >= 0
  ),
  CONSTRAINT ai_usage_events_input_char_count_check CHECK (
    input_char_count IS NULL OR input_char_count >= 0
  ),
  CONSTRAINT ai_usage_events_output_item_count_check CHECK (
    output_item_count IS NULL OR output_item_count >= 0
  ),
  CONSTRAINT ai_usage_events_metadata_object_check CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

-- =============================================================
-- AI USAGE COUNTERS
-- Quota counters written by trusted server routes.
-- =============================================================

CREATE TABLE ai_usage_counters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature         TEXT NOT NULL,
  period_type     TEXT NOT NULL,
  period_start    DATE NOT NULL,
  used_count      INTEGER NOT NULL DEFAULT 0,
  limited_count   INTEGER NOT NULL DEFAULT 0,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ai_usage_counters_feature_check CHECK (
    feature IN (
      'profile_helper',
      'icebreaker',
      'message_safety',
      'ride_planner',
      'admin_moderation_summary'
    )
  ),
  CONSTRAINT ai_usage_counters_period_type_check CHECK (
    period_type IN ('week', 'month')
  ),
  CONSTRAINT ai_usage_counters_used_count_check CHECK (used_count >= 0),
  CONSTRAINT ai_usage_counters_limited_count_check CHECK (limited_count >= 0),
  CONSTRAINT ai_usage_counters_unique_period UNIQUE (user_id, feature, period_type, period_start)
);

-- =============================================================
-- AI FEATURE LIMITS
-- Plan-based feature allowances. NULL limit_count means unlimited.
-- =============================================================

CREATE TABLE ai_feature_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name     TEXT NOT NULL,
  feature       TEXT NOT NULL,
  period_type   TEXT NOT NULL,
  limit_count   INTEGER,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  hard_block    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ai_feature_limits_plan_name_check CHECK (
    plan_name IN ('free', 'rider_plus', 'rider_premium', 'admin')
  ),
  CONSTRAINT ai_feature_limits_feature_check CHECK (
    feature IN (
      'profile_helper',
      'icebreaker',
      'message_safety',
      'ride_planner',
      'admin_moderation_summary'
    )
  ),
  CONSTRAINT ai_feature_limits_period_type_check CHECK (
    period_type IN ('week', 'month')
  ),
  CONSTRAINT ai_feature_limits_limit_count_check CHECK (
    limit_count IS NULL OR limit_count >= 0
  ),
  CONSTRAINT ai_feature_limits_unique_plan_feature_period UNIQUE (plan_name, feature, period_type)
);

-- =============================================================
-- UPDATED_AT TRIGGERS
-- Reuses the existing set_updated_at() helper from prior migrations.
-- =============================================================

CREATE TRIGGER trg_ai_usage_counters_updated_at
  BEFORE UPDATE ON ai_usage_counters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ai_feature_limits_updated_at
  BEFORE UPDATE ON ai_feature_limits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- INDEXES
-- =============================================================

CREATE INDEX idx_ai_usage_events_user_created_at
  ON ai_usage_events (user_id, created_at DESC);

CREATE INDEX idx_ai_usage_events_feature_created_at
  ON ai_usage_events (feature, created_at DESC);

CREATE INDEX idx_ai_usage_events_outcome_created_at
  ON ai_usage_events (outcome, created_at DESC);

CREATE INDEX idx_ai_usage_events_related_entity
  ON ai_usage_events (related_entity_type, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

-- =============================================================
-- SEED AI FEATURE LIMITS
-- NULL limit_count means unlimited. Message safety is intentionally
-- non-hard-blocking so safety checks never become a paid-only feature.
-- =============================================================

INSERT INTO ai_feature_limits (plan_name, feature, period_type, limit_count, enabled, hard_block)
VALUES
  -- Free plan
  ('free', 'profile_helper', 'week', 3, TRUE, TRUE),
  ('free', 'profile_helper', 'month', 10, TRUE, TRUE),
  ('free', 'icebreaker', 'week', 10, TRUE, TRUE),
  ('free', 'icebreaker', 'month', 35, TRUE, TRUE),
  ('free', 'ride_planner', 'week', 3, TRUE, TRUE),
  ('free', 'ride_planner', 'month', 10, TRUE, TRUE),
  ('free', 'message_safety', 'week', NULL, TRUE, FALSE),
  ('free', 'message_safety', 'month', NULL, TRUE, FALSE),
  ('free', 'admin_moderation_summary', 'week', 0, FALSE, TRUE),
  ('free', 'admin_moderation_summary', 'month', 0, FALSE, TRUE),

  -- Rider Plus plan
  ('rider_plus', 'profile_helper', 'week', 15, TRUE, TRUE),
  ('rider_plus', 'profile_helper', 'month', 60, TRUE, TRUE),
  ('rider_plus', 'icebreaker', 'week', 50, TRUE, TRUE),
  ('rider_plus', 'icebreaker', 'month', 200, TRUE, TRUE),
  ('rider_plus', 'ride_planner', 'week', 15, TRUE, TRUE),
  ('rider_plus', 'ride_planner', 'month', 60, TRUE, TRUE),
  ('rider_plus', 'message_safety', 'week', NULL, TRUE, FALSE),
  ('rider_plus', 'message_safety', 'month', NULL, TRUE, FALSE),
  ('rider_plus', 'admin_moderation_summary', 'week', 0, FALSE, TRUE),
  ('rider_plus', 'admin_moderation_summary', 'month', 0, FALSE, TRUE),

  -- Rider Premium plan
  ('rider_premium', 'profile_helper', 'week', 30, TRUE, TRUE),
  ('rider_premium', 'profile_helper', 'month', 120, TRUE, TRUE),
  ('rider_premium', 'icebreaker', 'week', 100, TRUE, TRUE),
  ('rider_premium', 'icebreaker', 'month', 400, TRUE, TRUE),
  ('rider_premium', 'ride_planner', 'week', 40, TRUE, TRUE),
  ('rider_premium', 'ride_planner', 'month', 150, TRUE, TRUE),
  ('rider_premium', 'message_safety', 'week', NULL, TRUE, FALSE),
  ('rider_premium', 'message_safety', 'month', NULL, TRUE, FALSE),
  ('rider_premium', 'admin_moderation_summary', 'week', 0, FALSE, TRUE),
  ('rider_premium', 'admin_moderation_summary', 'month', 0, FALSE, TRUE),

  -- Admin plan
  ('admin', 'admin_moderation_summary', 'week', 100, TRUE, TRUE),
  ('admin', 'admin_moderation_summary', 'month', 300, TRUE, TRUE),
  ('admin', 'message_safety', 'week', NULL, TRUE, FALSE),
  ('admin', 'message_safety', 'month', NULL, TRUE, FALSE);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE ai_usage_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feature_limits ENABLE ROW LEVEL SECURITY;

-- ai_usage_events: admins can read metadata; users cannot directly read,
-- write, update, or delete event logs. Service role/server routes bypass RLS.
CREATE POLICY "ai_usage_events_select_admin"
  ON ai_usage_events FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- ai_usage_counters: users can read only their own counters for allowance UI;
-- admins can read all. Writes are reserved for service role/server routes.
CREATE POLICY "ai_usage_counters_select_own"
  ON ai_usage_counters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ai_usage_counters_select_admin"
  ON ai_usage_counters FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- ai_feature_limits: authenticated users can read enabled limits for UI copy;
-- admins can read all rows, including disabled limits. Writes are reserved for
-- service role/manual SQL to avoid client-side plan/limit manipulation.
CREATE POLICY "ai_feature_limits_select_enabled"
  ON ai_feature_limits FOR SELECT
  TO authenticated
  USING (enabled = TRUE);

CREATE POLICY "ai_feature_limits_select_admin"
  ON ai_feature_limits FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));
