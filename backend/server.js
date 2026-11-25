const { Pool } = require('pg');
const express = require('express');
const { createAuth, getJwtSecret } = require('./auth');
const PORT = 3000;

function createApp(pool, authOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '8kb' }));
  app.use('/api/auth', createAuth(pool, authOptions).router);

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
  });
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
module.exports = { createApp };

