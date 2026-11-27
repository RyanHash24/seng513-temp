\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(513010);
-- Existing Plaid connections and linking sessions were created in Sandbox.
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS plaid_environment text NOT NULL DEFAULT 'sandbox'
    CHECK (plaid_environment IN ('sandbox', 'production'));
ALTER TABLE plaid_link_sessions ADD COLUMN IF NOT EXISTS plaid_environment text NOT NULL DEFAULT 'sandbox'
    CHECK (plaid_environment IN ('sandbox', 'production'));
ALTER TABLE bank_connections DROP CONSTRAINT IF EXISTS bank_connections_status_check;
ALTER TABLE bank_connections ADD CONSTRAINT bank_connections_status_check
    CHECK (status IN ('connected', 'reconnect_required', 'disconnected', 'pending'));

ALTER TABLE bank_connections DROP CONSTRAINT IF EXISTS bank_connections_provider_provider_item_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS bank_connections_provider_environment_item_unique
    ON bank_connections (provider, plaid_environment, provider_item_id);
DROP INDEX IF EXISTS bank_connections_user_institution_unique;
CREATE UNIQUE INDEX bank_connections_user_institution_unique
    ON bank_connections (user_id, plaid_environment, provider_institution_id)
    WHERE provider = 'plaid' AND provider_institution_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bank_connections_id_user_environment_unique
    ON bank_connections (id, user_id, plaid_environment);
ALTER TABLE plaid_link_sessions DROP CONSTRAINT IF EXISTS plaid_link_sessions_connection_environment_fk;
ALTER TABLE plaid_link_sessions ADD CONSTRAINT plaid_link_sessions_connection_environment_fk
    FOREIGN KEY (connection_id, user_id, plaid_environment)
    REFERENCES bank_connections (id, user_id, plaid_environment);
CREATE INDEX IF NOT EXISTS plaid_link_sessions_user_environment_idx
    ON plaid_link_sessions (user_id, plaid_environment);
COMMIT;
