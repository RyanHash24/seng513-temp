const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const jwt = require('jsonwebtoken');
const express = require('express');
const { rateLimit } = require('express-rate-limit');

const deriveKey = promisify(scrypt);
const COOKIE = 'finclear_auth';
const JWT_OPTIONS = { issuer: 'finclear', audience: 'finclear-web' };
const USER_FIELDS = 'id, first_name, last_name, email, access_role, trial_ends_at, premium_ends_at';
// missing email still perfrms the same password derivation as a registered user.
const DUMMY_HASH = `scrypt$16384$8$1$${'00'.repeat(16)}$${'00'.repeat(64)}`;
const SIGNUP_POLICY_VERSION = 'prototype-2026-11-24';

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  if (typeof encoded !== 'string') return false;
  const [algorithm, n, r, p, salt, hash, extra] = encoded.split('$');
  if (algorithm !== 'scrypt' || n !== '16384' || r !== '8' || p !== '1' || extra !== undefined ||
      !/^[a-f0-9]{32}$/i.test(salt || '') || !/^[a-f0-9]{128}$/i.test(hash || '')) return false;
  const derived = await deriveKey(password, Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(derived, Buffer.from(hash, 'hex'));
}

function publicUser(row) {
  let role = row.access_role;
  if (role === 'trial' && new Date(row.trial_ends_at) <= new Date()) role = 'free';
  if (role === 'premium' && row.premium_ends_at && new Date(row.premium_ends_at) <= new Date()) role = 'free';
  return { id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email, role, trialEndsAt: row.trial_ends_at ?? null };
}

function getJwtSecret() {
  if (process.env.JWT_SECRET && Buffer.byteLength(process.env.JWT_SECRET) >= 32) return process.env.JWT_SECRET;
  if (process.env.JWT_SECRET || process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must contain at least 32 bytes.');
  }
  console.warn('JWT_SECRET is unset: using a temporary development key. Restarting the backend signs users out.');
  return randomBytes(48).toString('hex');
}

function createAuth(pool, { secret, production = false, trialDays = 14, origins = ['http://localhost:5173', 'http://127.0.0.1:5173'] } = {}) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('A JWT secret of at least 32 bytes is required.');
  if (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 90) throw new Error('TRIAL_DAYS must be an integer between 1 and 90.');
  const router = express.Router();
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'strict', path: '/api' };
  function issueSession(res, row) {
    const token = jwt.sign({}, secret, { ...JWT_OPTIONS, algorithm: 'HS256', subject: row.id, expiresIn: '15m' });
    res.cookie(COOKIE, token, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  }
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use((req, res, next) => {
    if (req.method !== 'GET' && (!origins.includes(req.get('Origin')) || !req.is('application/json'))) {
      return res.status(403).json({ error: 'Request origin or content type is not allowed.' });
    }
    next();
  });

  router.post('/signup', rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many signup attempts. Please try again in an hour.' } }), async (req, res) => {
    const { fullName, email, password, confirmPassword, acceptedTerms } = req.body || {};
    if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 200 || /[\x00-\x1f\x7f]/.test(fullName)) {
      return res.status(400).json({ error: 'Enter your full name (up to 200 characters).' });
    }
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || /[\x00-\x1f\x7f]/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < 7 || password.length > 128 || !/[\p{P}\p{S}]/u.test(password)) {
      return res.status(400).json({ error: 'Use 7–128 characters, including at least one special character.' });
    }
    if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });
    if (acceptedTerms !== true) return res.status(400).json({ error: 'Please acknowledge the Terms of Service and Privacy Policy.' });

    const [firstName, ...surname] = fullName.trim().split(/\s+/);
    let client;
    try {
      const passwordHash = await hashPassword(password);
      client = await pool.connect();
      await client.query('BEGIN');
      const { rows } = await client.query(`INSERT INTO users
        (first_name, last_name, email, password_hash, access_role, trial_ends_at)
        VALUES ($1, $2, $3, $4, 'trial', now() + $5::int * INTERVAL '1 day')
        RETURNING ${USER_FIELDS}`, [firstName, surname.join(' '), email.trim().toLowerCase(), passwordHash, trialDays]);
      const user = rows[0];
      await client.query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);
      await client.query(`INSERT INTO notification_preferences (user_id, event_type)
        SELECT $1, unnest(ARRAY['budget_warning','budget_exceeded','goal_progress','bank_connection','weekly_summary','trial_expiring'])`, [user.id]);
      await client.query(`INSERT INTO user_registration_consents (user_id, policy_version) VALUES ($1, $2)`, [user.id, SIGNUP_POLICY_VERSION]);
      await client.query('COMMIT');
      issueSession(res, user);
      return res.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') return res.status(409).json({ error: 'An account could not be created with these details. Try logging in or use another email.' });
      return res.status(503).json({ error: 'Unable to create your account right now. Please try again shortly.' });
    } finally { client?.release(); }
  });

  async function requireAuth(req, res, next) {
    const cookie = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`));
    try {
      const token = cookie ? cookie.slice(COOKIE.length + 1) : '';
      const claims = jwt.verify(token, secret, { ...JWT_OPTIONS, algorithms: ['HS256'], maxAge: '15m' });
      if (typeof claims.sub !== 'string' || !/^[a-f0-9-]{36}$/i.test(claims.sub)) throw new Error('Invalid subject');
      const { rows } = await pool.query(`SELECT ${USER_FIELDS} FROM users WHERE id = $1`, [claims.sub]);
      if (!rows[0] || rows[0].access_role === 'guest') return res.status(401).json({ error: 'Please log in again.' });
      req.user = publicUser(rows[0]);
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error.message === 'Invalid subject') {
        return res.status(401).json({ error: 'Please log in again.' });
      }
      return res.status(503).json({ error: 'Authentication is temporarily unavailable.' });
    }
  }

  router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' } }), async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || email.length > 254 || !password || password.length > 1024) {
      return res.status(400).json({ error: 'Enter your email and password.' });
    }
    try {
      const { rows } = await pool.query(`SELECT ${USER_FIELDS}, password_hash FROM users WHERE email = $1`, [email.trim().toLowerCase()]);
      const row = rows[0];
      const matches = await verifyPassword(password, row?.password_hash || DUMMY_HASH);
      if (!row || row.access_role === 'guest' || !matches) return res.status(401).json({ error: 'Email or password is incorrect.' });
      issueSession(res, row);
      return res.json({ user: publicUser(row) });
    } catch {
      return res.status(503).json({ error: 'Unable to log in right now. Please try again shortly.' });
    }
  });
  router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
  router.post('/logout', (req, res) => { res.clearCookie(COOKIE, cookieOptions); res.sendStatus(204); });
  return { router, requireAuth };
}

module.exports = { createAuth, getJwtSecret, verifyPassword, hashPassword };
