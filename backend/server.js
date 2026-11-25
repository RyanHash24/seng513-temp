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

