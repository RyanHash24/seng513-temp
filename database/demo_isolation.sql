\set ON_ERROR_STOP on

BEGIN;

-- Create separate dummy bank connections.
INSERT INTO bank_connections (
    user_id,
    institution_name,
    provider,
    provider_item_id,
    status
)
SELECT
    id,
    first_name || ' Test Bank',
    'sample',
    'isolation-bank-' || id::text,
    'connected'
FROM users
WHERE email IN (
    'alex@example.com',
    'david.active@example.com'
)
ON CONFLICT DO NOTHING;

-- Create a bank account for each dummy connection.
INSERT INTO accounts (
    user_id,
    connection_id,
    name,
    account_type,
    source,
    scope,
    provider_account_id,
    currency,
    current_balance
)
SELECT
    u.id,
    b.id,
    u.first_name || ' Test Chequing',
    'chequing',
    'sample',
    'personal',
    'isolation-account-' || u.id::text,
    'CAD',
    CASE
        WHEN u.email = 'alex@example.com' THEN 1000
        ELSE 2000
    END
FROM users u
JOIN bank_connections b ON b.user_id = u.id
WHERE u.email IN (
    'alex@example.com',
    'david.active@example.com'
)
AND b.provider = 'sample'
AND b.provider_item_id = 'isolation-bank-' || u.id::text
ON CONFLICT DO NOTHING;

COMMIT;