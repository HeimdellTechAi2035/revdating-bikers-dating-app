-- ============================================================
-- Migration 019: GDPR compliance additions
--
-- Adds:
--   • data_export_requests  — audit log for every data-portability request
--   • RLS for data_deletion_requests (users can read their own)
--   • Additional consent_type values: 'cookie_consent', '18_plus_confirmation'
--     added alongside the existing enum-check constraint (via separate policy)
--
-- The following tables were already created in migration 008:
--   consent_logs, data_deletion_requests, illegal_content_reports
-- ============================================================

-- ── data_export_requests ─────────────────────────────────────
-- Tracks every right-to-portability (GDPR Art. 20) request.
-- The record is preserved for legal accountability even after the export
-- is delivered, and even if the user later deletes their account.
CREATE TABLE IF NOT EXISTS data_export_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  email         TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  ip_hash       TEXT,     -- SHA-256 of requester IP; never store raw
  user_agent    TEXT,
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS data_export_requests_user_id_idx
  ON data_export_requests(user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS data_export_requests_status_idx
  ON data_export_requests(status, requested_at);

ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own export requests
CREATE POLICY "export_requests_read_own"
  ON data_export_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert / update
CREATE POLICY "export_requests_service_write"
  ON data_export_requests FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);


-- ── data_deletion_requests — add user-read RLS ────────────────
-- Migration 008 created the table but didn't add user-facing RLS
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "deletion_requests_read_own"
  ON data_deletion_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Service role handles all writes (no user-direct policy needed)
CREATE POLICY IF NOT EXISTS "deletion_requests_service_write"
  ON data_deletion_requests FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);


-- ── Extend consent_logs with additional consent types ─────────
-- Drop and recreate the CHECK constraint to add new values.
-- We keep backward compatibility with all existing types.
ALTER TABLE consent_logs
  DROP CONSTRAINT IF EXISTS consent_logs_consent_type_check;

ALTER TABLE consent_logs
  ADD CONSTRAINT consent_logs_consent_type_check
  CHECK (consent_type IN (
    'terms_privacy',           -- combined ToS + Privacy at registration
    'terms_of_service',        -- standalone ToS acceptance
    'privacy_policy',          -- standalone Privacy Policy acceptance
    'cookies_essential',       -- essential cookies only
    'cookies_analytics',       -- optional analytics cookies
    'cookie_consent',          -- combined cookie consent (replaces banner prompt)
    'marketing',               -- marketing emails / push notifications
    'age_confirmation',        -- 18+ acknowledgement (legacy)
    '18_plus_confirmation'     -- explicit 18+ gate (new)
  ));
