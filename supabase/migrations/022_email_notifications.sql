-- 022_email_notifications.sql
-- Adds email notification opt-out preference to profiles.
-- Defaults to true (opted in). Users can unsubscribe via the email footer link.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN profiles.email_notifications
  IS 'When false, no transactional re-engagement emails are sent to this user.';
