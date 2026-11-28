\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(513012);

-- Existing sessions without a version remain valid at version zero. Incrementing
-- the version revokes every previously issued token without storing raw tokens.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
-- Migration 006 may already have created this column without a constraint.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='users'::regclass
        AND conname='users_session_version_nonnegative') THEN
        ALTER TABLE users ADD CONSTRAINT users_session_version_nonnegative CHECK (session_version >= 0);
    END IF;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

COMMIT;
