\set ON_ERROR_STOP on
-- acceptance checks run in a rollback-only transaction after schema and seed.
BEGIN;
DO $$
DECLARE
    david uuid := '10000000-0000-0000-0000-000000000001';
    morgan uuid := '10000000-0000-0000-0000-000000000002';
    actual numeric;
BEGIN
    IF (SELECT count(DISTINCT access_role) FROM users) <> 4 THEN
        RAISE EXCEPTION 'Expected guest, free, trial and premium users';
    END IF;
    SELECT sum(allocated_amount) INTO actual FROM budget_allocations WHERE user_id = david;
    IF actual IS DISTINCT FROM 3600.00 THEN RAISE EXCEPTION 'David allocation total %', actual; END IF;
    SELECT sum(actual_spending) INTO actual FROM budget_category_spending WHERE user_id = david;
    IF actual IS DISTINCT FROM 2040.00 THEN RAISE EXCEPTION 'David spending total %', actual; END IF;
    SELECT money_in - money_out INTO actual FROM monthly_cash_flow
      WHERE user_id = morgan AND scope = 'business' AND month = DATE '2026-10-01';
    IF actual IS DISTINCT FROM 3250.00 THEN RAISE EXCEPTION 'Morgan cash flow %', actual; END IF;

    BEGIN
        UPDATE transactions SET user_id = morgan WHERE user_id = david;
        RAISE EXCEPTION 'Cross-user account link accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE transactions SET currency = 'USD' WHERE user_id = david;
        RAISE EXCEPTION 'Cross-currency account link accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE transactions SET category_id = (SELECT id FROM categories WHERE user_id = morgan LIMIT 1)
          WHERE user_id = david;
        RAISE EXCEPTION 'Cross-user category accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE transactions SET amount = 'NaN' WHERE user_id = david;
        RAISE EXCEPTION 'NaN accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE transactions SET amount = 0 WHERE user_id = david;
        RAISE EXCEPTION 'Zero transaction accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO transactions (user_id, account_id, amount, kind, description, booked_on, currency, provider_transaction_id)
        SELECT user_id, account_id, amount, kind, description, booked_on, currency, provider_transaction_id
          FROM transactions WHERE provider_transaction_id IS NOT NULL LIMIT 1;
        RAISE EXCEPTION 'Duplicate provider transaction accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- a refund reduces spending
    -- pending purchases and transfers do not.
    INSERT INTO transactions (user_id, account_id, category_id, amount, kind, description, booked_on, currency, status)
    SELECT user_id, account_id, category_id, 10, 'refund', 'Verification refund', booked_on, currency, 'posted'
      FROM transactions WHERE user_id = david AND kind = 'expense'
        AND booked_on >= DATE '2026-10-01' AND booked_on < DATE '2026-11-01' LIMIT 1;
    INSERT INTO transactions (user_id, account_id, category_id, amount, kind, description, booked_on, currency, status)
    SELECT user_id, account_id, category_id, -500, 'expense', 'Verification pending', booked_on, currency, 'pending'
      FROM transactions WHERE user_id = david AND kind = 'expense'
        AND booked_on >= DATE '2026-10-01' AND booked_on < DATE '2026-11-01' LIMIT 1;
    INSERT INTO transactions (user_id, account_id, category_id, amount, kind, description, booked_on, currency)
    SELECT user_id, account_id, category_id, -100, 'transfer', 'Verification transfer', booked_on, currency
      FROM transactions WHERE user_id = david AND kind = 'expense'
        AND booked_on >= DATE '2026-10-01' AND booked_on < DATE '2026-11-01' LIMIT 1;
    SELECT sum(actual_spending) INTO actual FROM budget_category_spending WHERE user_id = david;
    IF actual IS DISTINCT FROM 2030.00 THEN RAISE EXCEPTION 'Refund/pending/transfer calculation %', actual; END IF;
    SELECT money_out INTO actual FROM monthly_cash_flow
      WHERE user_id = david AND scope = 'personal' AND month = DATE '2026-10-01';
    IF actual IS DISTINCT FROM 2030.00 THEN RAISE EXCEPTION 'Cash-flow refund/pending/transfer calculation %', actual; END IF;

    BEGIN
        UPDATE budget_allocations SET user_id = morgan WHERE user_id = david;
        RAISE EXCEPTION 'Cross-user budget allocation accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE savings_contributions SET currency = 'USD' WHERE user_id = david;
        RAISE EXCEPTION 'Cross-currency savings contribution accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    SELECT saved_amount INTO actual FROM savings_goal_progress WHERE user_id = david;
    IF actual IS DISTINCT FROM 1800.00 THEN RAISE EXCEPTION 'Goal contribution total %', actual; END IF;

    UPDATE bank_connections SET status = 'disconnected' WHERE user_id = david;
    IF NOT EXISTS (SELECT FROM transactions WHERE user_id = david) THEN
        RAISE EXCEPTION 'Disconnect lost history';
    END IF;
    DELETE FROM budgets WHERE user_id = david;
    IF NOT EXISTS (SELECT FROM transactions WHERE user_id = david) THEN
        RAISE EXCEPTION 'Budget deletion lost history';
    END IF;
    RAISE NOTICE 'All schema acceptance checks passed';
END $$;
ROLLBACK;
