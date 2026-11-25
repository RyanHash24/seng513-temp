\set ON_ERROR_STOP on
-- Development only. Keep David expired; create a separate repeatable active trial.
BEGIN;
SELECT pg_advisory_xact_lock(513008);
UPDATE users SET email_verified_at=coalesce(email_verified_at, now())
WHERE (id,email) IN (('10000000-0000-0000-0000-000000000001','david@example.com'),('10000000-0000-0000-0000-000000000002','morgan@example.com'),('10000000-0000-0000-0000-000000000004','alex@example.com'));
INSERT INTO users (id, first_name,last_name,email,password_hash,access_role,trial_ends_at,email_verified_at)
SELECT '10000000-0000-0000-0000-000000000005','David','Active Trial','david.active@example.com',password_hash,'trial',now()+interval '14 days',now()
FROM users WHERE id='10000000-0000-0000-0000-000000000001' AND email='david@example.com'
ON CONFLICT (id) DO NOTHING;
INSERT INTO user_settings(user_id) SELECT id FROM users WHERE email='david.active@example.com' ON CONFLICT DO NOTHING;
INSERT INTO notification_preferences(user_id,event_type) SELECT id,unnest(ARRAY['budget_warning','budget_exceeded','goal_progress','bank_connection','weekly_summary','trial_expiring']) FROM users WHERE email='david.active@example.com' ON CONFLICT DO NOTHING;
COMMIT;
