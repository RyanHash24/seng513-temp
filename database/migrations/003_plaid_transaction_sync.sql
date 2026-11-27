\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(513009);
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS transactions_synced_at timestamptz;
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS transactions_update_status text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider_category text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider_synced_at timestamptz;

-- Banks can report zero-value authorizations. Manual entries must remain nonzero.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_amount_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_amount_check CHECK (
    amount <> 'NaN'::numeric AND (amount <> 0 OR
    (provider_synced_at IS NOT NULL AND provider_transaction_id IS NOT NULL))
);
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_check CHECK (
    (kind = 'expense' AND (amount < 0 OR (amount = 0 AND provider_synced_at IS NOT NULL))) OR
    (kind IN ('income', 'refund') AND amount > 0) OR kind = 'transfer'
);
CREATE INDEX IF NOT EXISTS transactions_bank_history_idx
    ON transactions (user_id, booked_on DESC, id DESC) WHERE provider_synced_at IS NOT NULL AND status <> 'removed';
COMMIT;
