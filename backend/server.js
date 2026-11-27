const { Pool } = require('pg');
const express = require('express');
const { createAuth, getJwtSecret } = require('./auth');
const { configuredMailer } = require('./account-flows');
const PORT = 3000;

function createApp(pool, authOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '8kb' }));
  const auth = createAuth(pool, authOptions);
  app.use('/api/auth', auth.router);
  app.get('/api/account/permissions', auth.requireAuth, auth.requireVerified, (req,res)=>res.json(req.user.permissions));
  app.get('/api/account/report-access', auth.requireAuth, auth.requireVerified, auth.requirePermission('monthlyReports'), (req,res)=>res.sendStatus(204));
  app.get(
    '/api/account/data',
    auth.requireAuth,
    auth.requireVerified,
    async (req, res) => {
        const userId = req.user.id;

        res.set('Cache-Control', 'no-store');

        try {
            const [
                connections,
                accounts,
                transactions,
                budgets
            ] = await Promise.all([
                pool.query(
                    `SELECT id, user_id, institution_name,
                            provider, status
                     FROM bank_connections
                     WHERE user_id = $1`,
                    [userId]
                ),

                pool.query(
                    `SELECT id, user_id, name,
                            account_type, scope,
                            current_balance, currency
                     FROM accounts
                     WHERE user_id = $1
                     AND ($2::boolean OR scope = 'personal')`,
                    [
                        userId,
                        req.user.permissions.businessAccounts
                    ]
                ),

                pool.query(
                    `SELECT id, user_id, account_id,
                            description, amount, kind,
                            booked_on, scope, currency
                     FROM transactions
                     WHERE user_id = $1
                     AND ($2::boolean OR scope = 'personal')`,
                    [
                        userId,
                        req.user.permissions.businessAccounts
                    ]
                ),

                pool.query(
                    `SELECT id, user_id, month,
                            expected_income, reserved_savings,
                            scope, currency
                     FROM budgets
                     WHERE user_id = $1
                     AND ($2::boolean OR scope = 'personal')`,
                    [
                        userId,
                        req.user.permissions.businessAccounts
                    ]
                )
            ]);

            return res.json({
                userId,
                connections: connections.rows,
                accounts: accounts.rows,
                transactions: transactions.rows,
                budgets: budgets.rows
            });

        } catch (error) {
            console.error(
                'Account data query failed:',
                error.message
            );

            return res.status(503).json({
                error: 'Unable to retrieve account data.'
            });
        }
    }
);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/db-health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ database: 'connected' });
    } catch (error) {
      console.error('Database connection failed:', error);
      res.status(503).json({ database: 'unavailable' });
    }
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid request body.' });
  });
  return app;
}

if (require.main === module) {
  const production = process.env.NODE_ENV === 'production';
  if (production && !process.env.FRONTEND_ORIGIN) throw new Error('FRONTEND_ORIGIN is required in production.');
  const app = createApp(new Pool(), {
    secret: getJwtSecret(), production, trialDays: Number(process.env.TRIAL_DAYS || 14),
    origins: process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : undefined,
    mailer: configuredMailer({production,apiKey:process.env.RESEND_API_KEY,from:process.env.MAIL_FROM,devLinks:process.env.DEV_AUTH_LINKS==='true'}),
    google: {clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,redirectUri:process.env.GOOGLE_REDIRECT_URI},
  });
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
module.exports = { createApp };

