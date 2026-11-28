\set ON_ERROR_STOP on
BEGIN;

-- A monthly plan can start on any day and recur. Each successful change
-- preserves the previous allocation and selected accounts for that owner.
CREATE TABLE IF NOT EXISTS monthly_budget_plans (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
    revision integer NOT NULL CHECK (revision > 0),
    starts_on date NOT NULL,
    limit_cents bigint NOT NULL CHECK (limit_cents BETWEEN 1 AND 9007199254740991),
    categories jsonb NOT NULL CHECK (jsonb_typeof(categories) = 'array'),
    account_ids uuid[] NOT NULL,
    saved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, environment, revision)
);

COMMIT;
