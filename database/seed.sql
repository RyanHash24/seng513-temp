\set ON_ERROR_STOP on
-- DEVELOPMENT DEMO DATA ONLY. No real financial information or API credentials.
-- Stable IDs and ON CONFLICT DO NOTHING preserve existing data on reruns.
BEGIN;
SELECT pg_advisory_xact_lock(513008);

INSERT INTO users (
    id, first_name, last_name,
    email, password_hash, access_role,
    trial_ends_at, created_at
) VALUES (
    '10000000-0000-0000-0000-000000000001', 'David', 'Lee',
    'david@example.com', 'scrypt$16384$8$1$d85c18101fdb5faaafacc9a136fbbf6a$b8dbd490bd79f3817c031f1b200af61684a70771d2e37b3b2d6c79b333dd1fbaaacc3a5d7f209ece5b4ff5d4b64404d700be4056ee02f605179f822dbcd97fbe', 'trial',
    '2026-11-19T23:59:59-07:00', '2026-10-01T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO user_settings (
    user_id, theme, automatic_sync
) VALUES (
    '10000000-0000-0000-0000-000000000001', 'light', true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000001', 'budget_warning', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000001', 'budget_exceeded', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000001', 'goal_progress', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000001', 'bank_connection', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000001', 'weekly_summary', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000001', 'trial_expiring', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO users (
    id, first_name, last_name,
    email, password_hash, access_role,
    trial_ends_at, created_at
) VALUES (
    '10000000-0000-0000-0000-000000000002', 'Morgan', 'Watson',
    'morgan@example.com', 'scrypt$16384$8$1$31ca9a3f4bcf5e368973fc7cf57d9808$2cefcf5d520dabfe9093ff6a2a67c4fb1165d946689d5ad12bc0ea301a2cf329f6d14942352ff5a50e2f4fa06e67e43a504a12b4121fe4cb8115724eb95b3953', 'premium',
    NULL, '2026-10-01T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO user_settings (
    user_id, theme, automatic_sync
) VALUES (
    '10000000-0000-0000-0000-000000000002', 'light', true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000002', 'budget_warning', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000002', 'budget_exceeded', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000002', 'goal_progress', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000002', 'bank_connection', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000002', 'weekly_summary', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000002', 'trial_expiring', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO users (
    id, first_name, last_name,
    email, password_hash, access_role,
    trial_ends_at, created_at
) VALUES (
    '10000000-0000-0000-0000-000000000003', 'Sarah', 'Larson',
    NULL, NULL, 'guest',
    NULL, '2026-10-01T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO user_settings (
    user_id, theme, automatic_sync
) VALUES (
    '10000000-0000-0000-0000-000000000003', 'light', false
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000003', 'budget_warning', false,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000003', 'budget_exceeded', false,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000003', 'goal_progress', false,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000003', 'bank_connection', false,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000003', 'weekly_summary', false,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000003', 'trial_expiring', false,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO users (
    id, first_name, last_name,
    email, password_hash, access_role,
    trial_ends_at, created_at
) VALUES (
    '10000000-0000-0000-0000-000000000004', 'Alex', 'Chen',
    'alex@example.com', 'scrypt$16384$8$1$962630572a6e5828bdc97cccc54e983e$c960491e44eb1e69d2506c9f049d5c2bb6d15457d83e4d48d56c52ab00a946ce15f2f4a312a0f8ca83228269d54a44775dbe5055ea736c82e4d845eb507968a3', 'free',
    NULL, '2026-10-01T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO user_settings (
    user_id, theme, automatic_sync
) VALUES (
    '10000000-0000-0000-0000-000000000004', 'light', true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000004', 'budget_warning', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000004', 'budget_exceeded', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000004', 'goal_progress', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000004', 'bank_connection', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000004', 'weekly_summary', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (
    user_id, event_type, email_enabled,
    push_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000004', 'trial_expiring', true,
    true
) ON CONFLICT DO NOTHING;

INSERT INTO bank_connections (
    id, user_id, institution_name,
    provider, provider_item_id, status,
    last_synced_at
) VALUES (
    '3d9a40bb-94b0-56e8-bc2c-548e196e9529', '10000000-0000-0000-0000-000000000001', 'Demo Bank A',
    'sample', 'sample-david-bank', 'connected',
    '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO bank_connections (
    id, user_id, institution_name,
    provider, provider_item_id, status,
    last_synced_at
) VALUES (
    'b167f928-9f7c-50cb-b4b2-ba370ac98df5', '10000000-0000-0000-0000-000000000002', 'Demo Bank B',
    'sample', 'sample-morgan-bank', 'connected',
    '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO bank_connections (
    id, user_id, institution_name,
    provider, provider_item_id, status,
    last_synced_at
) VALUES (
    'bc373600-f4ad-5b93-9fd2-489ccb5d7c19', '10000000-0000-0000-0000-000000000002', 'Demo Credit Union',
    'sample', 'sample-morgan-reconnect', 'reconnect_required',
    NULL
) ON CONFLICT DO NOTHING;

INSERT INTO accounts (
    id, user_id, connection_id,
    name, account_type, source,
    scope, provider_account_id, mask,
    current_balance, balance_updated_at
) VALUES (
    '32ad68e5-8f0e-5158-980e-c0fd00e54b96', '10000000-0000-0000-0000-000000000001', '3d9a40bb-94b0-56e8-bc2c-548e196e9529',
    'Everyday chequing', 'chequing', 'sample',
    'personal', 'sample-david-chequing', '4821',
    '2480.00', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO accounts (
    id, user_id, connection_id,
    name, account_type, source,
    scope, provider_account_id, mask,
    current_balance, balance_updated_at
) VALUES (
    '2b904f59-aff2-5d32-882f-dc53bd08e061', '10000000-0000-0000-0000-000000000002', 'b167f928-9f7c-50cb-b4b2-ba370ac98df5',
    'Operating account', 'chequing', 'sample',
    'business', 'sample-morgan-operating', '2607',
    '12500.00', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO accounts (
    id, user_id, connection_id,
    name, account_type, source,
    scope, provider_account_id, mask,
    current_balance, balance_updated_at
) VALUES (
    'd15ad315-d42c-5d0d-bcab-c88d6c5960cb', '10000000-0000-0000-0000-000000000002', 'b167f928-9f7c-50cb-b4b2-ba370ac98df5',
    'Personal chequing', 'chequing', 'sample',
    'personal', 'sample-morgan-personal', '4821',
    '2480.00', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO accounts (
    id, user_id, connection_id,
    name, account_type, source,
    scope, provider_account_id, mask,
    current_balance, balance_updated_at
) VALUES (
    '75f94a47-ef1f-5705-8ec3-39b9f74d5db8', '10000000-0000-0000-0000-000000000002', 'bc373600-f4ad-5b93-9fd2-489ccb5d7c19',
    'Business savings', 'savings', 'sample',
    'business', 'sample-morgan-savings', '7302',
    NULL, NULL
) ON CONFLICT DO NOTHING;

INSERT INTO accounts (
    id, user_id, connection_id,
    name, account_type, source,
    scope, provider_account_id, mask,
    current_balance, balance_updated_at
) VALUES (
    'fd35726d-0942-56b3-bc8a-a15867fbb9bb', '10000000-0000-0000-0000-000000000002', 'b167f928-9f7c-50cb-b4b2-ba370ac98df5',
    'Rewards credit card', 'credit_card', 'sample',
    'personal', 'sample-morgan-card', '9164',
    '420.00', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO accounts (
    id, user_id, connection_id,
    name, account_type, source,
    scope, provider_account_id, mask,
    current_balance, balance_updated_at
) VALUES (
    'f1a0e732-1cd3-5b73-a9a7-511e619c31db', '10000000-0000-0000-0000-000000000003', NULL,
    'Guest sample cash', 'cash', 'manual',
    'personal', NULL, '4821',
    '800.00', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO accounts (
    id, user_id, connection_id,
    name, account_type, source,
    scope, provider_account_id, mask,
    current_balance, balance_updated_at
) VALUES (
    '89ca3d78-ff6f-5875-b810-fb2d6862c501', '10000000-0000-0000-0000-000000000004', NULL,
    'Manual chequing', 'chequing', 'manual',
    'personal', NULL, '4821',
    '1500.00', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    'be7a8277-b019-5028-85c9-68bab50864e7', '10000000-0000-0000-0000-000000000001', 'Home & bills',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    'e52276ef-1421-59f1-b6c3-47f3e65c9a67', '10000000-0000-0000-0000-000000000001', 'be7a8277-b019-5028-85c9-68bab50864e7',
    'Rent', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    'be7a8277-b019-5028-85c9-68bab50864e7', '10000000-0000-0000-0000-000000000001', 'Home & bills',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '5a0ee6f8-3fa0-5a58-acb9-ea9829d2f768', '10000000-0000-0000-0000-000000000001', 'be7a8277-b019-5028-85c9-68bab50864e7',
    'Phone', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    'be7a8277-b019-5028-85c9-68bab50864e7', '10000000-0000-0000-0000-000000000001', 'Home & bills',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '7415db48-fd70-54c6-9539-3487d9911784', '10000000-0000-0000-0000-000000000001', 'be7a8277-b019-5028-85c9-68bab50864e7',
    'Wi-Fi', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    '53ec1af3-10b4-5837-82db-e512be588d67', '10000000-0000-0000-0000-000000000001', 'Food & drink',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '44c6748d-d345-5435-a031-0438ef549643', '10000000-0000-0000-0000-000000000001', '53ec1af3-10b4-5837-82db-e512be588d67',
    'Groceries', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    '53ec1af3-10b4-5837-82db-e512be588d67', '10000000-0000-0000-0000-000000000001', 'Food & drink',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '8937f110-a724-5435-a0a6-dea9ec1a643c', '10000000-0000-0000-0000-000000000001', '53ec1af3-10b4-5837-82db-e512be588d67',
    'Dining out', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    '37a3d2dc-71aa-57ac-88af-60c101554baa', '10000000-0000-0000-0000-000000000001', 'Transportation',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '68721cd9-1484-505f-bc5b-01c25709bb5a', '10000000-0000-0000-0000-000000000001', '37a3d2dc-71aa-57ac-88af-60c101554baa',
    'Transportation', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    '9230e279-3f4e-5cfe-be26-c55cf88ada5c', '10000000-0000-0000-0000-000000000001', 'Shopping',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '2e5eb3b3-18fa-5755-b141-44b0bf487a7b', '10000000-0000-0000-0000-000000000001', '9230e279-3f4e-5cfe-be26-c55cf88ada5c',
    'Shopping', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    '92ae7f66-e70f-5dcb-83a7-c31515c91633', '10000000-0000-0000-0000-000000000001', 'Subscriptions',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    'e18cb792-6363-5c6e-8abf-41cdb3d609ec', '10000000-0000-0000-0000-000000000001', '92ae7f66-e70f-5dcb-83a7-c31515c91633',
    'Subscriptions', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    '33c259ea-8c5f-5410-924a-1881ade0d783', '10000000-0000-0000-0000-000000000001', 'Income',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '92b0547c-a26b-57fe-875b-97f97f985e29', '10000000-0000-0000-0000-000000000001', '33c259ea-8c5f-5410-924a-1881ade0d783',
    'Payroll', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    'd60b260c-f687-5f7c-a7d9-7822397cb67f', '10000000-0000-0000-0000-000000000002', 'Business',
    'business'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '576b1022-2b2d-5136-a6e5-1300e06de983', '10000000-0000-0000-0000-000000000002', 'd60b260c-f687-5f7c-a7d9-7822397cb67f',
    'Supplies', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    'd60b260c-f687-5f7c-a7d9-7822397cb67f', '10000000-0000-0000-0000-000000000002', 'Business',
    'business'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '2e2d6a8c-5676-5d73-a7cd-b761b37a84ef', '10000000-0000-0000-0000-000000000002', 'd60b260c-f687-5f7c-a7d9-7822397cb67f',
    'Software', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    'd60b260c-f687-5f7c-a7d9-7822397cb67f', '10000000-0000-0000-0000-000000000002', 'Business',
    'business'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '093b3645-81ce-5f97-90f2-f335ffe9cac5', '10000000-0000-0000-0000-000000000002', 'd60b260c-f687-5f7c-a7d9-7822397cb67f',
    'Travel', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    'd60b260c-f687-5f7c-a7d9-7822397cb67f', '10000000-0000-0000-0000-000000000002', 'Business',
    'business'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '3267180d-b2e5-5feb-bbc3-76fcd8259761', '10000000-0000-0000-0000-000000000002', 'd60b260c-f687-5f7c-a7d9-7822397cb67f',
    'Other', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    'd60b260c-f687-5f7c-a7d9-7822397cb67f', '10000000-0000-0000-0000-000000000002', 'Business',
    'business'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '73bcb0eb-c9ea-5d82-9256-2983a015f269', '10000000-0000-0000-0000-000000000002', 'd60b260c-f687-5f7c-a7d9-7822397cb67f',
    'Revenue', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    '48411cea-05fa-5f65-b83e-dd90eb41bb20', '10000000-0000-0000-0000-000000000002', 'Personal',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '5a5ba9a2-340e-5a7a-a5a9-d11dfcd30cdd', '10000000-0000-0000-0000-000000000002', '48411cea-05fa-5f65-b83e-dd90eb41bb20',
    'Groceries', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    'e21d3e0e-0ed2-5914-ab35-48b8f002effe', '10000000-0000-0000-0000-000000000003', 'Food & drink',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '82daaf2f-b50e-5988-a263-b49bb79e3133', '10000000-0000-0000-0000-000000000003', 'e21d3e0e-0ed2-5914-ab35-48b8f002effe',
    'Groceries', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    '4b55ddaa-1298-5611-95c5-62a6e15e30ec', '10000000-0000-0000-0000-000000000003', 'Income',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    'b458cfc5-51fa-55e6-9925-d804707fa1cf', '10000000-0000-0000-0000-000000000003', '4b55ddaa-1298-5611-95c5-62a6e15e30ec',
    'Sample income', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO category_groups (
    id, user_id, name,
    scope
) VALUES (
    '50e08915-76ea-5f1e-9f1b-3741408d7423', '10000000-0000-0000-0000-000000000004', 'Food & drink',
    'personal'
) ON CONFLICT DO NOTHING;

INSERT INTO categories (
    id, user_id, group_id,
    name, color
) VALUES (
    '3329d1b9-255f-5883-a45c-1ba3a41ab521', '10000000-0000-0000-0000-000000000004', '50e08915-76ea-5f1e-9f1b-3741408d7423',
    'Groceries', '#52796F'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'fd0d71b7-3fb1-5033-a6d9-6aca639cf9be', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    'e52276ef-1421-59f1-b6c3-47f3e65c9a67', 'e52276ef-1421-59f1-b6c3-47f3e65c9a67', '-1100.00',
    'expense', 'October rent', 'October rent',
    '2026-10-01', 'personal', 'posted',
    'sample-david-tx-rent', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'ee10ffdc-3bbd-589a-83ac-e8371cc41ec8', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '5a0ee6f8-3fa0-5a58-acb9-ea9829d2f768', '5a0ee6f8-3fa0-5a58-acb9-ea9829d2f768', '-60.00',
    'expense', 'Phone bill', 'Phone bill',
    '2026-10-03', 'personal', 'posted',
    'sample-david-tx-phone', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'ad773780-c05c-584f-a3b4-706fa24094e9', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '7415db48-fd70-54c6-9539-3487d9911784', '7415db48-fd70-54c6-9539-3487d9911784', '-40.00',
    'expense', 'Internet bill', 'Internet bill',
    '2026-10-03', 'personal', 'posted',
    'sample-david-tx-wifi', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '0facce30-4b08-5618-a292-3a5ff42b78c8', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '44c6748d-d345-5435-a031-0438ef549643', '44c6748d-d345-5435-a031-0438ef549643', '-445.80',
    'expense', 'Earlier grocery purchases', 'Earlier grocery purchases',
    '2026-10-08', 'personal', 'posted',
    'sample-david-tx-grocery-earlier', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'bc740e8d-2756-5b99-93d7-dbca1ab4b485', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '44c6748d-d345-5435-a031-0438ef549643', '44c6748d-d345-5435-a031-0438ef549643', '-64.20',
    'expense', 'Fresh Market', 'Fresh Market',
    '2026-10-15', 'personal', 'posted',
    'sample-david-tx-grocery-today', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '58eeafc3-ad00-5adc-be4c-1a3da91294e2', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '8937f110-a724-5435-a0a6-dea9ec1a643c', '8937f110-a724-5435-a0a6-dea9ec1a643c', '-111.50',
    'expense', 'Earlier dining purchases', 'Earlier dining purchases',
    '2026-10-10', 'personal', 'posted',
    'sample-david-tx-dining-earlier', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '44303e2a-89e3-554c-8a53-e887a6aca492', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '8937f110-a724-5435-a0a6-dea9ec1a643c', '8937f110-a724-5435-a0a6-dea9ec1a643c', '-8.50',
    'expense', 'Corner Cafe', 'Corner Cafe',
    '2026-10-14', 'personal', 'posted',
    'sample-david-tx-cafe', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '5931f0b0-b0d2-57ca-af83-e97b9a79eb49', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '68721cd9-1484-505f-bc5b-01c25709bb5a', '68721cd9-1484-505f-bc5b-01c25709bb5a', '-78.00',
    'expense', 'Transit pass', 'Transit pass',
    '2026-10-05', 'personal', 'posted',
    'sample-david-tx-transit-earlier', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '823a479e-b2c4-5c61-a459-96bb3514b46e', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '68721cd9-1484-505f-bc5b-01c25709bb5a', '68721cd9-1484-505f-bc5b-01c25709bb5a', '-12.00',
    'expense', 'City Transit', 'City Transit',
    '2026-10-15', 'personal', 'posted',
    'sample-david-tx-transit-today', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '095be2bc-0b44-55c1-9ace-cad67ee6b5f0', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '2e5eb3b3-18fa-5755-b141-44b0bf487a7b', '2e5eb3b3-18fa-5755-b141-44b0bf487a7b', '-60.00',
    'expense', 'Local shop', 'Local shop',
    '2026-10-11', 'personal', 'posted',
    'sample-david-tx-shopping', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'dd7bdcd0-d62e-5e61-845f-541e0d12701e', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    'e18cb792-6363-5c6e-8abf-41cdb3d609ec', 'e18cb792-6363-5c6e-8abf-41cdb3d609ec', '-60.00',
    'expense', 'Monthly subscriptions', 'Monthly subscriptions',
    '2026-10-02', 'personal', 'posted',
    'sample-david-tx-subscriptions', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '341fa0a6-a6ab-5d7d-a179-88001ea234ea', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '92b0547c-a26b-57fe-875b-97f97f985e29', '92b0547c-a26b-57fe-875b-97f97f985e29', '4200.00',
    'income', 'Monthly payroll', NULL,
    '2026-10-14', 'personal', 'posted',
    'sample-david-payroll', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'edd40499-4a07-563f-9469-947a9924f927', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '2e5eb3b3-18fa-5755-b141-44b0bf487a7b', '2e5eb3b3-18fa-5755-b141-44b0bf487a7b', '-25.00',
    'expense', 'Pending purchase', 'Pending purchase',
    '2026-10-15', 'personal', 'pending',
    'sample-david-pending', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '12a5b7a8-94e4-59ac-9cd1-2d297ce2555a', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    NULL, NULL, '-600.00',
    'transfer', 'Savings transfer', NULL,
    '2026-10-15', 'personal', 'posted',
    'sample-david-transfer', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'f8f9f9fc-40e6-592d-9d72-5cba242d1e20', '10000000-0000-0000-0000-000000000002', '2b904f59-aff2-5d32-882f-dc53bd08e061',
    '576b1022-2b2d-5136-a6e5-1300e06de983', '576b1022-2b2d-5136-a6e5-1300e06de983', '-2400.00',
    'expense', 'Office supplies', 'Office supplies',
    '2026-10-15', 'business', 'posted',
    'sample-morgan-tx-supplies', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '2c06908b-6041-5eb2-a1f1-8429fa6dc22f', '10000000-0000-0000-0000-000000000002', '2b904f59-aff2-5d32-882f-dc53bd08e061',
    '2e2d6a8c-5676-5d73-a7cd-b761b37a84ef', '2e2d6a8c-5676-5d73-a7cd-b761b37a84ef', '-1250.00',
    'expense', 'Business software', 'Business software',
    '2026-10-15', 'business', 'posted',
    'sample-morgan-tx-software', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '8934b47f-8768-51a9-952a-2ea3b80bf67e', '10000000-0000-0000-0000-000000000002', '2b904f59-aff2-5d32-882f-dc53bd08e061',
    '093b3645-81ce-5f97-90f2-f335ffe9cac5', '093b3645-81ce-5f97-90f2-f335ffe9cac5', '-900.00',
    'expense', 'Business travel', 'Business travel',
    '2026-10-15', 'business', 'posted',
    'sample-morgan-tx-travel', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'd7c3c7c8-a124-5789-8e80-2d0aea4a919a', '10000000-0000-0000-0000-000000000002', '2b904f59-aff2-5d32-882f-dc53bd08e061',
    '3267180d-b2e5-5feb-bbc3-76fcd8259761', '3267180d-b2e5-5feb-bbc3-76fcd8259761', '-600.00',
    'expense', 'Other business costs', 'Other business costs',
    '2026-10-15', 'business', 'posted',
    'sample-morgan-tx-other', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '83dff98d-9aa7-54dc-8e1d-78d3ba097e3a', '10000000-0000-0000-0000-000000000002', '2b904f59-aff2-5d32-882f-dc53bd08e061',
    '73bcb0eb-c9ea-5d82-9256-2983a015f269', '73bcb0eb-c9ea-5d82-9256-2983a015f269', '8400.00',
    'income', 'Client invoices', NULL,
    '2026-10-15', 'business', 'posted',
    'sample-morgan-tx-revenue', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '9dbd8622-c6a0-5b12-9884-f7e3b099d1dc', '10000000-0000-0000-0000-000000000002', 'd15ad315-d42c-5d0d-bcab-c88d6c5960cb',
    '5a5ba9a2-340e-5a7a-a5a9-d11dfcd30cdd', '5a5ba9a2-340e-5a7a-a5a9-d11dfcd30cdd', '-90.00',
    'expense', 'Personal groceries', 'Personal groceries',
    '2026-10-15', 'personal', 'posted',
    'sample-morgan-personal-food', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '041e9a16-4a96-5bbd-8ea2-30ffc46ac334', '10000000-0000-0000-0000-000000000003', 'f1a0e732-1cd3-5b73-a9a7-511e619c31db',
    '82daaf2f-b50e-5988-a263-b49bb79e3133', NULL, '-80.00',
    'expense', 'Sample groceries', 'Sample groceries',
    '2026-10-15', 'personal', 'posted',
    NULL, NULL
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'b458cfc5-51fa-55e6-9925-d804707fa1cf', '10000000-0000-0000-0000-000000000003', 'f1a0e732-1cd3-5b73-a9a7-511e619c31db',
    'b458cfc5-51fa-55e6-9925-d804707fa1cf', NULL, '1000.00',
    'income', 'Sample income', NULL,
    '2026-10-15', 'personal', 'posted',
    NULL, NULL
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'e792cccb-42da-5b7f-a6c1-0d8c79562677', '10000000-0000-0000-0000-000000000004', '89ca3d78-ff6f-5875-b810-fb2d6862c501',
    '3329d1b9-255f-5883-a45c-1ba3a41ab521', NULL, '-50.00',
    'expense', 'Manual groceries', 'Manual groceries',
    '2026-10-15', 'personal', 'posted',
    NULL, NULL
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'f3cc69f7-1cae-59b2-b472-ba3c62cb8bfc', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '44c6748d-d345-5435-a031-0438ef549643', '44c6748d-d345-5435-a031-0438ef549643', '-1800.00',
    'expense', 'Historical demo spending', 'Historical demo spending',
    '2026-08-15', 'personal', 'posted',
    'sample-david-history-08', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'b761bee9-83f7-5bd8-8f10-21241f92d049', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '92b0547c-a26b-57fe-875b-97f97f985e29', '92b0547c-a26b-57fe-875b-97f97f985e29', '4200.00',
    'income', 'Historical payroll', NULL,
    '2026-08-14', 'personal', 'posted',
    'sample-david-history-income-08', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    '618814aa-f9ba-5af9-ae60-c97908550000', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '44c6748d-d345-5435-a031-0438ef549643', '44c6748d-d345-5435-a031-0438ef549643', '-1950.00',
    'expense', 'Historical demo spending', 'Historical demo spending',
    '2026-09-15', 'personal', 'posted',
    'sample-david-history-09', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO transactions (
    id, user_id, account_id,
    category_id, original_category_id, amount,
    kind, description, merchant_name,
    booked_on, scope, status,
    provider_transaction_id, imported_at
) VALUES (
    'c0d09476-55b9-5766-aca9-d559ecce9c02', '10000000-0000-0000-0000-000000000001', '32ad68e5-8f0e-5158-980e-c0fd00e54b96',
    '92b0547c-a26b-57fe-875b-97f97f985e29', '92b0547c-a26b-57fe-875b-97f97f985e29', '4200.00',
    'income', 'Historical payroll', NULL,
    '2026-09-14', 'personal', 'posted',
    'sample-david-history-income-09', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO budgets (
    id, user_id, month,
    expected_income, reserved_savings
) VALUES (
    'd6681dc2-8fc5-5d9c-864d-42f29698e1ab', '10000000-0000-0000-0000-000000000001', '2026-10-01',
    '4200.00', '600.00'
) ON CONFLICT DO NOTHING;

INSERT INTO budget_allocations (
    budget_id, user_id, category_id,
    allocated_amount
) VALUES (
    'd6681dc2-8fc5-5d9c-864d-42f29698e1ab', '10000000-0000-0000-0000-000000000001', 'e52276ef-1421-59f1-b6c3-47f3e65c9a67',
    '1500.00'
) ON CONFLICT DO NOTHING;

INSERT INTO budget_allocations (
    budget_id, user_id, category_id,
    allocated_amount
) VALUES (
    'd6681dc2-8fc5-5d9c-864d-42f29698e1ab', '10000000-0000-0000-0000-000000000001', '5a0ee6f8-3fa0-5a58-acb9-ea9829d2f768',
    '80.00'
) ON CONFLICT DO NOTHING;

INSERT INTO budget_allocations (
    budget_id, user_id, category_id,
    allocated_amount
) VALUES (
    'd6681dc2-8fc5-5d9c-864d-42f29698e1ab', '10000000-0000-0000-0000-000000000001', '7415db48-fd70-54c6-9539-3487d9911784',
    '70.00'
) ON CONFLICT DO NOTHING;

INSERT INTO budget_allocations (
    budget_id, user_id, category_id,
    allocated_amount
) VALUES (
    'd6681dc2-8fc5-5d9c-864d-42f29698e1ab', '10000000-0000-0000-0000-000000000001', '44c6748d-d345-5435-a031-0438ef549643',
    '600.00'
) ON CONFLICT DO NOTHING;

INSERT INTO budget_allocations (
    budget_id, user_id, category_id,
    allocated_amount
) VALUES (
    'd6681dc2-8fc5-5d9c-864d-42f29698e1ab', '10000000-0000-0000-0000-000000000001', '8937f110-a724-5435-a0a6-dea9ec1a643c',
    '350.00'
) ON CONFLICT DO NOTHING;

INSERT INTO budget_allocations (
    budget_id, user_id, category_id,
    allocated_amount
) VALUES (
    'd6681dc2-8fc5-5d9c-864d-42f29698e1ab', '10000000-0000-0000-0000-000000000001', '68721cd9-1484-505f-bc5b-01c25709bb5a',
    '200.00'
) ON CONFLICT DO NOTHING;

INSERT INTO budget_allocations (
    budget_id, user_id, category_id,
    allocated_amount
) VALUES (
    'd6681dc2-8fc5-5d9c-864d-42f29698e1ab', '10000000-0000-0000-0000-000000000001', '2e5eb3b3-18fa-5755-b141-44b0bf487a7b',
    '500.00'
) ON CONFLICT DO NOTHING;

INSERT INTO budget_allocations (
    budget_id, user_id, category_id,
    allocated_amount
) VALUES (
    'd6681dc2-8fc5-5d9c-864d-42f29698e1ab', '10000000-0000-0000-0000-000000000001', 'e18cb792-6363-5c6e-8abf-41cdb3d609ec',
    '300.00'
) ON CONFLICT DO NOTHING;

INSERT INTO budgets (
    id, user_id, month,
    expected_income, reserved_savings
) VALUES (
    '901f3a34-fe73-5854-b236-4bdc785cbf28', '10000000-0000-0000-0000-000000000003', '2026-10-01',
    '1000.00', '100.00'
) ON CONFLICT DO NOTHING;

INSERT INTO budget_allocations (
    budget_id, user_id, category_id,
    allocated_amount
) VALUES (
    '901f3a34-fe73-5854-b236-4bdc785cbf28', '10000000-0000-0000-0000-000000000003', '82daaf2f-b50e-5988-a263-b49bb79e3133',
    '300.00'
) ON CONFLICT DO NOTHING;

INSERT INTO savings_goals (
    id, user_id, name,
    target_amount, target_date, monthly_contribution
) VALUES (
    '1983fe67-56ab-5009-bd78-d4b7ef995a42', '10000000-0000-0000-0000-000000000001', 'Emergency fund',
    '5000.00', '2027-06-01', '600.00'
) ON CONFLICT DO NOTHING;

INSERT INTO savings_contributions (
    id, goal_id, user_id,
    amount, contributed_on, notes
) VALUES (
    '558eab57-d2db-5c43-b1e4-4e609a0f1b20', '1983fe67-56ab-5009-bd78-d4b7ef995a42', '10000000-0000-0000-0000-000000000001',
    '600.00', '2026-08-15', 'Fictional manual allocation, not an executed bank transfer'
) ON CONFLICT DO NOTHING;

INSERT INTO savings_contributions (
    id, goal_id, user_id,
    amount, contributed_on, notes
) VALUES (
    '0e530e88-0ea5-5996-8bb1-91328276e090', '1983fe67-56ab-5009-bd78-d4b7ef995a42', '10000000-0000-0000-0000-000000000001',
    '600.00', '2026-09-15', 'Fictional manual allocation, not an executed bank transfer'
) ON CONFLICT DO NOTHING;

INSERT INTO savings_contributions (
    id, goal_id, user_id,
    amount, contributed_on, notes
) VALUES (
    '56dbb6d3-5c71-5d81-99ee-54764881d88a', '1983fe67-56ab-5009-bd78-d4b7ef995a42', '10000000-0000-0000-0000-000000000001',
    '600.00', '2026-10-15', 'Fictional manual allocation, not an executed bank transfer'
) ON CONFLICT DO NOTHING;

INSERT INTO notifications (
    id, user_id, budget_id,
    category_id, event_type, title,
    message, created_at
) VALUES (
    '49d4bde8-d69c-5663-8346-0581b115efc8', '10000000-0000-0000-0000-000000000001', 'd6681dc2-8fc5-5d9c-864d-42f29698e1ab',
    '44c6748d-d345-5435-a031-0438ef549643', 'budget_warning', 'Groceries is at 85% of its budget',
    '$510 spent of $600. You have $90 remaining.', '2026-10-15T12:00:00-06:00'
) ON CONFLICT DO NOTHING;

INSERT INTO notifications (
    id, user_id, event_type,
    title, message
) VALUES (
    '19a34938-2e37-54e5-b6b9-7cefec9166df', '10000000-0000-0000-0000-000000000002', 'bank_connection',
    'Reconnect Business savings', 'Reconnect your demo bank to refresh its balance.'
) ON CONFLICT DO NOTHING;


COMMIT;
