\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(513011);
ALTER TABLE plaid_link_sessions ADD COLUMN IF NOT EXISTS requested_product text
    CHECK (requested_product IN ('transactions', 'investments'));
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS investments_synced_at timestamptz;
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS investments_status text
    CHECK (investments_status IN ('consent_required', 'authorized', 'not_ready', 'available', 'unsupported'));
CREATE UNIQUE INDEX IF NOT EXISTS accounts_id_user_unique ON accounts (id, user_id);

-- investment cash movements are not household income or spending. Keep them out
-- of the transactions table used by budgets and preserve their native currency.
CREATE TABLE IF NOT EXISTS investment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    account_id uuid NOT NULL,
    provider_transaction_id text NOT NULL,
    booked_on date NOT NULL,
    description text NOT NULL,
    activity_type text NOT NULL,
    activity_subtype text,
    security_id text,
    security_name text,
    ticker_symbol text,
    quantity numeric,
    price numeric,
    fees numeric,
    -- signed cash change: positive cash received, negative cash paid.
    amount numeric,
    currency text CHECK (currency ~ '^[A-Z]{3}$'),
    unofficial_currency text,
    cancel_transaction_id text,
    provider_synced_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (account_id, provider_transaction_id),
    FOREIGN KEY (account_id, user_id) REFERENCES accounts(id, user_id),
    CHECK (amount IS NULL OR amount <> 'NaN'::numeric),
    CHECK (quantity IS NULL OR quantity <> 'NaN'::numeric),
    CHECK (price IS NULL OR price <> 'NaN'::numeric),
    CHECK (fees IS NULL OR fees <> 'NaN'::numeric)
);
CREATE INDEX IF NOT EXISTS investment_transactions_user_date_idx
    ON investment_transactions (user_id, booked_on DESC, id DESC);
COMMIT;
