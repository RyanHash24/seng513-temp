\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(513012);

-- Existing sessions without a version remain valid at version zero. Incrementing
-- the version revokes every previously issued token without storing raw tokens.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0
    CHECK (session_version >= 0);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

COMMIT;
