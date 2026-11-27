\set ON_ERROR_STOP on
-- FinClear initial schema
BEGIN;
-- serialize schema/seed runs so concurrent initialization cannot interleave.
SELECT pg_advisory_xact_lock(513008);

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name text NOT NULL CHECK (length(trim(first_name)) > 0),
    last_name text NOT NULL DEFAULT '',
    email text,
    password_hash text,
    phone text,
    avatar_url text,
    email_verified_at timestamptz,
    access_role text NOT NULL DEFAULT 'trial' CHECK (access_role IN ('guest', 'free', 'trial', 'premium')),
    trial_ends_at timestamptz,
    premium_ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (access_role = 'guest' OR (email IS NOT NULL AND password_hash IS NOT NULL)),
    CHECK (email IS NULL OR email = lower(trim(email)) AND email LIKE '%_@_%._%'),
    CHECK (password_hash IS NULL OR length(password_hash) >= 32),
    CHECK (access_role <> 'trial' OR trial_ends_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_settings (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    currency text NOT NULL DEFAULT 'CAD' CHECK (currency ~ '^[A-Z]{3}$'),
    timezone text NOT NULL DEFAULT 'America/Edmonton',
    theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    automatic_sync boolean NOT NULL DEFAULT true,
    budget_alert_threshold numeric(5,2) NOT NULL DEFAULT 80 CHECK (budget_alert_threshold BETWEEN 0 AND 100),
    weekly_summary boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type text NOT NULL CHECK (event_type IN ('budget_warning', 'budget_exceeded', 'goal_progress', 'bank_connection', 'weekly_summary', 'trial_expiring')),
    email_enabled boolean NOT NULL DEFAULT true,
    push_enabled boolean NOT NULL DEFAULT true,
    PRIMARY KEY (user_id, event_type)
);

CREATE TABLE IF NOT EXISTS bank_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    institution_name text NOT NULL,
    provider text NOT NULL DEFAULT 'plaid' CHECK (provider IN ('plaid', 'sample')),
    provider_item_id text,
    -- Reference to an external secret store, never a plaintext access token.
    access_token_secret_ref text,
    sync_cursor text,
    status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'reconnect_required', 'disconnected')),
    last_synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    UNIQUE (provider, provider_item_id)
);

CREATE TABLE IF NOT EXISTS accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    connection_id uuid,
    name text NOT NULL CHECK (length(trim(name)) > 0),
    account_type text NOT NULL CHECK (account_type IN ('cash', 'chequing', 'savings', 'credit_card', 'investment', 'loan', 'property', 'other')),
    source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'plaid', 'sample')),
    scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'business')),
    provider_account_id text,
    mask text CHECK (mask ~ '^[0-9]{4}$'),
    currency text NOT NULL DEFAULT 'CAD' CHECK (currency ~ '^[A-Z]{3}$'),
    current_balance numeric(18,2) CHECK (current_balance <> 'NaN'::numeric),
    available_balance numeric(18,2) CHECK (available_balance <> 'NaN'::numeric),
    balance_updated_at timestamptz,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id, currency),
    UNIQUE (connection_id, provider_account_id),
    FOREIGN KEY (connection_id, user_id) REFERENCES bank_connections(id, user_id),
    CHECK (source <> 'plaid' OR (connection_id IS NOT NULL AND provider_account_id IS NOT NULL)),
    CHECK (source <> 'manual' OR (connection_id IS NULL AND provider_account_id IS NULL))
);

CREATE TABLE IF NOT EXISTS category_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    name text NOT NULL CHECK (length(trim(name)) > 0),
    scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'business')),
    display_order integer NOT NULL DEFAULT 0,
    UNIQUE (id, user_id),
    UNIQUE (user_id, scope, name)
);

CREATE TABLE IF NOT EXISTS categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    group_id uuid NOT NULL,
    name text NOT NULL CHECK (length(trim(name)) > 0),
    color text CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    archived_at timestamptz,
    UNIQUE (id, user_id),
    UNIQUE (group_id, name),
    FOREIGN KEY (group_id, user_id) REFERENCES category_groups(id, user_id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    account_id uuid NOT NULL,
    category_id uuid,
    original_category_id uuid,
    category_overridden boolean NOT NULL DEFAULT false,
    provider_transaction_id text,
    pending_provider_transaction_id text,
    amount numeric(18,2) NOT NULL CHECK (amount <> 'NaN'::numeric AND amount <> 0),
    currency text NOT NULL DEFAULT 'CAD',
    kind text NOT NULL CHECK (kind IN ('income', 'expense', 'refund', 'transfer')),
    status text NOT NULL DEFAULT 'posted' CHECK (status IN ('pending', 'posted', 'removed')),
    scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'business')),
    description text NOT NULL,
    merchant_name text,
    notes text,
    booked_on date NOT NULL,
    authorized_on date,
    imported_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (account_id, provider_transaction_id),
    FOREIGN KEY (account_id, user_id, currency) REFERENCES accounts(id, user_id, currency),
    FOREIGN KEY (category_id, user_id) REFERENCES categories(id, user_id),
    FOREIGN KEY (original_category_id, user_id) REFERENCES categories(id, user_id),
    CHECK ((kind = 'expense' AND amount < 0) OR (kind IN ('income', 'refund') AND amount > 0) OR kind = 'transfer')
);
CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions (user_id, booked_on DESC);
CREATE INDEX IF NOT EXISTS transactions_category_date_idx ON transactions (user_id, category_id, booked_on);
CREATE INDEX IF NOT EXISTS transactions_account_idx ON transactions (account_id);

CREATE TABLE IF NOT EXISTS budgets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    month date NOT NULL CHECK (extract(day FROM month) = 1),
    scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'business')),
    currency text NOT NULL DEFAULT 'CAD' CHECK (currency ~ '^[A-Z]{3}$'),
    expected_income numeric(18,2) NOT NULL CHECK (expected_income >= 0 AND expected_income <> 'NaN'::numeric),
    reserved_savings numeric(18,2) NOT NULL DEFAULT 0 CHECK (reserved_savings >= 0 AND reserved_savings <> 'NaN'::numeric),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    UNIQUE (user_id, month, scope, currency)
);

CREATE TABLE IF NOT EXISTS budget_allocations (
    budget_id uuid NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid NOT NULL,
    allocated_amount numeric(18,2) NOT NULL CHECK (allocated_amount >= 0 AND allocated_amount <> 'NaN'::numeric),
    PRIMARY KEY (budget_id, category_id),
    FOREIGN KEY (budget_id, user_id) REFERENCES budgets(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id, user_id) REFERENCES categories(id, user_id)
);

CREATE TABLE IF NOT EXISTS savings_goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    name text NOT NULL CHECK (length(trim(name)) > 0),
    currency text NOT NULL DEFAULT 'CAD' CHECK (currency ~ '^[A-Z]{3}$'),
    target_amount numeric(18,2) NOT NULL CHECK (target_amount > 0 AND target_amount <> 'NaN'::numeric),
    target_date date,
    monthly_contribution numeric(18,2) NOT NULL DEFAULT 0 CHECK (monthly_contribution >= 0 AND monthly_contribution <> 'NaN'::numeric),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id, currency)
);

CREATE TABLE IF NOT EXISTS savings_contributions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id uuid NOT NULL,
    user_id uuid NOT NULL,
    currency text NOT NULL DEFAULT 'CAD',
    amount numeric(18,2) NOT NULL CHECK (amount > 0 AND amount <> 'NaN'::numeric),
    contributed_on date NOT NULL DEFAULT CURRENT_DATE,
    notes text,
    FOREIGN KEY (goal_id, user_id, currency) REFERENCES savings_goals(id, user_id, currency)
);
CREATE INDEX IF NOT EXISTS savings_contributions_goal_idx ON savings_contributions (goal_id);

CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    budget_id uuid,
    category_id uuid,
    event_type text NOT NULL CHECK (event_type IN ('budget_warning', 'budget_exceeded', 'goal_progress', 'bank_connection', 'weekly_summary', 'trial_expiring')),
    title text NOT NULL,
    message text NOT NULL,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (budget_id, user_id) REFERENCES budgets(id, user_id) ON DELETE SET NULL (budget_id),
    FOREIGN KEY (category_id, user_id) REFERENCES categories(id, user_id)
);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS accounts_user_idx ON accounts (user_id);
CREATE INDEX IF NOT EXISTS bank_connections_user_idx ON bank_connections (user_id);

-- Compute actuals from transactions, independently of editable plan allocations.
CREATE OR REPLACE VIEW budget_category_spending AS
SELECT b.id AS budget_id, b.user_id, b.month, b.scope, b.currency,
       c.id AS category_id, c.name AS category_name, c.group_id,
       a.allocated_amount,
       coalesce(sum(CASE WHEN t.kind IN ('expense', 'refund') THEN -t.amount ELSE 0 END), 0) AS actual_spending,
       a.allocated_amount - coalesce(sum(CASE WHEN t.kind IN ('expense', 'refund') THEN -t.amount ELSE 0 END), 0) AS remaining
FROM budgets b
JOIN budget_allocations a ON a.budget_id = b.id
JOIN categories c ON c.id = a.category_id
LEFT JOIN transactions t ON t.user_id = b.user_id AND t.category_id = c.id
    AND t.currency = b.currency AND t.scope = b.scope AND t.status = 'posted'
    AND t.booked_on >= b.month AND t.booked_on < (b.month + INTERVAL '1 month')
GROUP BY b.id, c.id, a.allocated_amount;

CREATE OR REPLACE VIEW budget_group_spending AS
SELECT s.budget_id, s.user_id, s.month, s.scope, s.currency, s.group_id,
       g.name AS group_name, sum(s.allocated_amount) AS allocated_amount,
       sum(s.actual_spending) AS actual_spending, sum(s.remaining) AS remaining
FROM budget_category_spending s JOIN category_groups g ON g.id = s.group_id
GROUP BY s.budget_id, s.user_id, s.month, s.scope, s.currency, s.group_id, g.name;

CREATE OR REPLACE VIEW monthly_cash_flow AS
SELECT user_id, date_trunc('month', booked_on)::date AS month, scope, currency,
       sum(CASE WHEN kind = 'income' THEN amount ELSE 0 END) AS money_in,
       sum(CASE WHEN kind IN ('expense', 'refund') THEN -amount ELSE 0 END) AS money_out
FROM transactions WHERE status = 'posted' AND kind <> 'transfer'
GROUP BY user_id, date_trunc('month', booked_on)::date, scope, currency;

CREATE OR REPLACE VIEW savings_goal_progress AS
SELECT g.id AS goal_id, g.user_id, g.name, g.currency, g.target_amount,
       coalesce(sum(c.amount), 0) AS saved_amount,
       greatest(g.target_amount - coalesce(sum(c.amount), 0), 0) AS remaining
FROM savings_goals g LEFT JOIN savings_contributions c ON c.goal_id = g.id
GROUP BY g.id;

COMMIT;
