const { Pool } = require('pg');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { demoFileHandler } = require('./demoFiles');
const express = require('express');
const { createAuth, getJwtSecret } = require('./auth');
const { configuredMailer } = require('./account-flows');
const { createPlaid } = require('./plaid');
const { rateLimit } = require('express-rate-limit');
const { monthlyReportHandler } = require('./monthly-report');
const { createBudgetPlans } = require('./budget-plans');
const { createPrivacy } = require('./privacy');
const { createSecurity } = require('./security');
const PORT = 3000;

const DOWNLOAD_URL_EXPIRATION_SECONDS = 300;
const s3Client = new S3Client({ region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1' });

async function generatePresignedDownloadUrl(bucket, key) {
  if (!bucket || !key) throw new TypeError('Both bucket and key are required');
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: DOWNLOAD_URL_EXPIRATION_SECONDS });
}

function attachDownloads(app, requireAuth, allowedOrigin) {
  app.use('/api/demo-files', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      if (origin !== allowedOrigin) return res.sendStatus(403);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.sendStatus(204);
    }
    if (origin && origin !== allowedOrigin) return res.sendStatus(403);
    next();
  });
  app.get('/api/demo-files/:name', demoFileHandler);
  function handlePresignedDownload(req, res) {
    const bucket = req.query.bucket || process.env.S3_BUCKET;
    const key = req.query.key || process.env.S3_KEY;
    if (!bucket || !key) return res.status(400).json({ error: 'Specify bucket and key, or configure S3_BUCKET and S3_KEY' });
    generatePresignedDownloadUrl(bucket, key)
      .then(url => res.json({ url, bucket, key, expiresInSeconds: DOWNLOAD_URL_EXPIRATION_SECONDS }))
      .catch(error => {
        console.error('Failed to generate presigned download URL:', error);
        res.status(500).json({ error: 'Failed to generate presigned download URL' });
      });
  }
  app.get('/s3/presigned-download', requireAuth, handlePresignedDownload);
  app.get('/presigned-download', requireAuth, handlePresignedDownload);
}


function createApp(pool, authOptions, plaidOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api/budget-plan', express.json({ limit: '256kb' }));
  app.use(express.json({ limit: '8kb' }));
  const auth = createAuth(pool, authOptions);
  app.use('/api/auth', auth.router);
  app.use('/api/security', createSecurity(pool, auth.requireAuth, {
    origins: authOptions?.origins, issueSession: auth.issueSession, clearSession: auth.clearSession,
  }));
  app.use('/api/privacy', createPrivacy(pool, auth.requireAuth, {
    origins: authOptions?.origins, clearSession: auth.clearSession, plaid: plaidOptions,
  }));
  const requireVerifiedAuth = (req, res, next) => auth.requireAuth(req, res, () =>
    auth.requireVerified(req, res, next));
  app.use('/api/budget-plan', createBudgetPlans(pool, requireVerifiedAuth, { origins: authOptions?.origins, environment: plaidOptions?.env }));
  app.get('/api/account/permissions', auth.requireAuth, auth.requireVerified, (req, res) => res.json(req.user.permissions));
  app.get('/api/account/report-access', auth.requireAuth, auth.requireVerified,
    auth.requirePermission('monthlyReports'), (req, res) => res.sendStatus(204));
  app.get('/api/reports/monthly', requireVerifiedAuth, auth.requirePermission('monthlyReports'),
    rateLimit({ windowMs: 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }),
    monthlyReportHandler(pool, plaidOptions?.env ?? 'sandbox'));
  attachDownloads(app, requireVerifiedAuth, authOptions?.origins?.[0] || process.env.FRONTEND_ORIGIN || 'http://localhost:5173');
  app.use('/api/plaid', createPlaid(pool, requireVerifiedAuth, { origins: authOptions?.origins, ...plaidOptions }));

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
    googleSignInLimit: process.env.GOOGLE_SIGN_IN_LIMIT ? Number(process.env.GOOGLE_SIGN_IN_LIMIT) : undefined,
    origins: process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : undefined,
    mailer: configuredMailer({ production, apiKey: process.env.RESEND_API_KEY, from: process.env.MAIL_FROM, devLinks: process.env.DEV_AUTH_LINKS === 'true' }),
    google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, redirectUri: process.env.GOOGLE_REDIRECT_URI },
  }, {
    env: process.env.PLAID_ENV, clientId: process.env.PLAID_CLIENT_ID,
    secret: process.env.PLAID_SECRET, sandboxSecret: process.env.PLAID_SANDBOX_SECRET,
    productionSecret: process.env.PLAID_PRODUCTION_SECRET,
    productionEnabled: process.env.PLAID_PRODUCTION_ENABLED === 'true',
    encryptionKey: process.env.PLAID_TOKEN_ENCRYPTION_KEY,
  });
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
module.exports = { createApp, generatePresignedDownloadUrl };

