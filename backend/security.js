const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { verifyPassword, hashPassword, validNewPassword } = require('./auth');

function createSecurity(pool, requireAuth, { origins = ['http://localhost:5173', 'http://127.0.0.1:5173'], issueSession, clearSession } = {}) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' && (!origins.includes(req.get('Origin')) || !req.is('application/json'))) {
      return res.status(403).json({ error: 'Request origin or content type is not allowed.' });
    }
    next();
  });
  router.use(requireAuth);
  router.get('/', async (req, res) => {
    try {
      const { rows: [row] } = await pool.query('SELECT email, password_changed_at FROM users WHERE id=$1', [req.user.id]);
      if (!row) return res.status(401).json({ error: 'Please log in again.' });
      return res.json({ email: row.email, signInMethod: 'password', passwordChangedAt: row.password_changed_at ?? null, sessionLifetimeMinutes: 15 });
    } catch { return res.status(503).json({ error: 'Unable to load your security details. Please try again.' }); }
  });
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, keyGenerator: req => req.user.id,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many security attempts. Please try again in 15 minutes.' } }));

  async function updateSecurity(req, res, changingPassword) {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024) {
      return res.status(400).json({ error: 'Enter your current password.' });
    }
    if (changingPassword && !validNewPassword(newPassword)) return res.status(400).json({ error: 'Use 7–128 characters, including at least one special character.' });
    if (changingPassword && newPassword !== confirmPassword) return res.status(400).json({ error: 'New passwords do not match.' });
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '2s'");
      const { rows: [row] } = await client.query('SELECT id, password_hash, session_version FROM users WHERE id=$1 FOR UPDATE NOWAIT', [req.user.id]);
      if (!row || (row.session_version ?? 0) !== req.sessionVersion) {
        await client.query('ROLLBACK');
        return res.status(401).json({ error: 'Your session changed. Please log in again.' });
      }
      if (!await verifyPassword(currentPassword, row.password_hash)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Current password is incorrect.' });
      }
      if (changingPassword && currentPassword === newPassword) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Choose a password different from your current password.' });
      }
      const result = changingPassword
        ? await client.query(`UPDATE users SET password_hash=$1, session_version=session_version+1, password_changed_at=now()
            WHERE id=$2 RETURNING id, session_version, password_changed_at`, [await hashPassword(newPassword), req.user.id])
        : await client.query('UPDATE users SET session_version=session_version+1 WHERE id=$1 RETURNING id, session_version', [req.user.id]);
      if (result.rowCount !== 1) throw new Error('Security update was not confirmed');
      await client.query('COMMIT');
      if (changingPassword) {
        // Rotate this browser's cookie; all older tokens now fail requireAuth.
        issueSession(res, result.rows[0]);
        return res.json({ passwordChangedAt: result.rows[0].password_changed_at, otherSessionsSignedOut: true });
      }
      clearSession(res);
      return res.sendStatus(204);
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {});
      if (error.code === '55P03' || error.code === '40P01') return res.status(409).json({ error: 'Your account is busy with another operation. Please try again shortly.' });
      return res.status(503).json({ error: changingPassword
        ? 'The password change could not be confirmed. If you are signed out, try signing in with your new password before retrying.'
        : 'Sign-out could not be confirmed. Please try signing in again to check your session.' });
    } finally { client?.release(); }
  }
  router.post('/password', (req, res) => updateSecurity(req, res, true));
  router.post('/signout-all', (req, res) => updateSecurity(req, res, false));
  return router;
}

module.exports = { createSecurity };
