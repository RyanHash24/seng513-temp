\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(513008);
CREATE TABLE IF NOT EXISTS plaid_item_secrets (
    connection_id uuid PRIMARY KEY REFERENCES bank_connections(id) ON DELETE CASCADE,
    encrypted_token text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS provider_institution_id text;
CREATE UNIQUE INDEX IF NOT EXISTS bank_connections_user_institution_unique
    ON bank_connections (user_id, provider_institution_id)
    WHERE provider = 'plaid' AND provider_institution_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS plaid_link_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode text NOT NULL CHECK (mode IN ('new', 'update')),
    connection_id uuid REFERENCES bank_connections(id),
    encrypted_link_token text NOT NULL,
    expires_at timestamptz NOT NULL,
    completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS plaid_link_sessions_user_idx ON plaid_link_sessions (user_id);
COMMIT;
