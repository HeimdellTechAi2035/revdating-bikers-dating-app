-- ============================================================
-- Migration 008: UK/GDPR compliance tables
-- ============================================================

-- ── Consent logs ─────────────────────────────────────────────
-- Immutable audit trail for every consent event (GDPR Art. 7)
CREATE TABLE IF NOT EXISTS consent_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  session_id     TEXT,                           -- browser session ID for pre-auth events
  consent_type   TEXT        NOT NULL
                   CHECK (consent_type IN (
                     'terms_privacy',             -- ToS + Privacy Policy at registration
                     'cookies_essential',         -- essential cookies only
                     'cookies_analytics',         -- optional analytics cookies
                     'marketing',                 -- marketing emails
                     'age_confirmation'           -- 18+ acknowledgement
                   )),
  version        TEXT        NOT NULL DEFAULT '1.0',  -- policy version at time of consent
  consented      BOOLEAN     NOT NULL,
  ip_hash        TEXT,                           -- SHA-256 of IP — never store raw IP
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS consent_logs_user_id_idx   ON consent_logs(user_id, consent_type);
CREATE INDEX IF NOT EXISTS consent_logs_created_at_idx ON consent_logs(created_at);

ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own consent history
CREATE POLICY "consent_logs_read_own"
  ON consent_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Backend service role inserts (WITH CHECK TRUE accepts all from service role)
CREATE POLICY "consent_logs_service_insert"
  ON consent_logs FOR INSERT
  WITH CHECK (TRUE);


-- ── Data deletion requests ────────────────────────────────────
-- Tracks every deletion request; retained for legal accountability
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,                            -- nullable — cleared after auth user deletion
  email         TEXT        NOT NULL,
  reason        TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS data_deletion_requests_status_idx
  ON data_deletion_requests(status, requested_at);

-- Admin-only access via service role; no RLS (this table stores PII for legal purposes)


-- ── Illegal content reports ───────────────────────────────────
-- Separate from general user reports — these are serious/potentially illegal
-- Must be escalated to law enforcement when appropriate
CREATE TABLE IF NOT EXISTS illegal_content_reports (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  reported_user_id  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  content_type      TEXT        NOT NULL
                      CHECK (content_type IN ('profile', 'photo', 'message', 'chat', 'other')),
  content_id        TEXT,                        -- ID of the specific content item
  description       TEXT        NOT NULL,
  category          TEXT        NOT NULL
                      CHECK (category IN (
                        'csam',                  -- child sexual abuse material — mandatory law enforcement referral
                        'terrorism',
                        'violence',
                        'trafficking',
                        'extremism',
                        'other_illegal'
                      )),
  status            TEXT        NOT NULL DEFAULT 'open'
                      CHECK (status IN (
                        'open',
                        'under_review',
                        'reported_to_authorities',
                        'closed_no_action',
                        'closed_action_taken'
                      )),
  reported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  reviewer_id       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  reviewer_notes    TEXT
);

CREATE INDEX IF NOT EXISTS illegal_reports_status_idx
  ON illegal_content_reports(status, reported_at);
CREATE INDEX IF NOT EXISTS illegal_reports_reporter_idx
  ON illegal_content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS illegal_reports_reported_user_idx
  ON illegal_content_reports(reported_user_id);

ALTER TABLE illegal_content_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can file reports (reporter_id must equal their own ID)
CREATE POLICY "illegal_reports_insert"
  ON illegal_content_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Users can view their own reports (so they can see status updates)
CREATE POLICY "illegal_reports_read_own"
  ON illegal_content_reports FOR SELECT
  USING (auth.uid() = reporter_id);
