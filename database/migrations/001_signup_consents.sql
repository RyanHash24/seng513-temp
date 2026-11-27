\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(513008);

CREATE TABLE IF NOT EXISTS user_registration_consents (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    policy_version text NOT NULL,
    accepted_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
