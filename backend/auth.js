const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const jwt = require('jsonwebtoken');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { effectiveRole, permissions, requirePermission } = require('./entitlements');
const { digest, token, validPassword, transaction, makeLink, consume } = require('./account-flows');
const { createHash } = require('node:crypto');

const deriveKey = promisify(scrypt);
const COOKIE = 'finclear_auth';
const JWT_OPTIONS = { issuer: 'finclear', audience: 'finclear-web' };
const USER_FIELDS = 'id, first_name, last_name, email, access_role, trial_ends_at, premium_ends_at, email_verified_at, session_version';
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

function validNewPassword(password) {
  return validPassword(password);
}

function publicUser(row) {
  const role = effectiveRole(row);
  return { id: String(row.id), firstName: row.first_name, lastName: row.last_name, email: row.email, role,
    trialEndsAt: row.trial_ends_at ?? null, premiumEndsAt: row.premium_ends_at ?? null,
    emailVerified: Boolean(row.email_verified_at), permissions: permissions(role) };
}

function getJwtSecret() {
  if (process.env.JWT_SECRET && Buffer.byteLength(process.env.JWT_SECRET) >= 32) return process.env.JWT_SECRET;
  if (process.env.JWT_SECRET || process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must contain at least 32 bytes.');
  }
  console.warn('JWT_SECRET is unset: using a temporary development key. Restarting the backend signs users out.');
  return randomBytes(48).toString('hex');
}

function createAuth(pool, { secret, production = false, trialDays = 14, origins = ['http://localhost:5173', 'http://127.0.0.1:5173'], mailer, google, fetcher = fetch } = {}) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('A JWT secret of at least 32 bytes is required.');
  if (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 90) throw new Error('TRIAL_DAYS must be an integer between 1 and 90.');
  const router = express.Router();
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'strict', path: '/api' };
  function issueSession(res, row) {
    const token = jwt.sign({ sv: row.session_version ?? 0 }, secret, { ...JWT_OPTIONS, algorithm: 'HS256', subject: String(row.id), expiresIn: '15m' });
    res.cookie(COOKIE, token, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  }
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy','no-referrer'); next(); });
  const origin = origins[0];
  async function deliver(row, purpose) {
    if (!mailer) return false;
    try { await mailer(row.email, purpose, await makeLink(pool,row.id,purpose,origin)); return true; }
    catch { console.warn('Authentication email delivery failed'); return false; }
  }
  const flowLimit = rateLimit({ windowMs: 15*60*1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: {error:'Too many requests. Try again later.'} });
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
      client.release(); client = undefined;
      issueSession(res, user);
      const verificationSent = await deliver(user, 'verify');
      return res.status(201).json({ user: publicUser(user), verificationSent });
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
      const version = claims.sv === undefined ? 0 : claims.sv;
      if (!Number.isSafeInteger(version) || version < 0) throw new Error('Invalid session version');
      const { rows } = await pool.query(`SELECT ${USER_FIELDS} FROM users WHERE id = $1`, [claims.sub]);
      if (!rows[0] || rows[0].access_role === 'guest' || version !== (rows[0].session_version ?? 0)) return res.status(401).json({ error: 'Please log in again.' });
      req.user = publicUser(rows[0]);
      req.sessionVersion = version;
      await persistExpiration(rows[0]);
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error.message === 'Invalid subject' || error.message === 'Invalid session version') {
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
      await persistExpiration(row);
      issueSession(res, row);
      return res.json({ user: publicUser(row) });
    } catch {
      return res.status(503).json({ error: 'Unable to log in right now. Please try again shortly.' });
    }
  });
  async function persistExpiration(row) {
    if (row.access_role === effectiveRole(row)) return;
    await pool.query(`UPDATE users SET access_role='free' WHERE id=$1 AND
      ((access_role='trial' AND trial_ends_at<=now()) OR
       (access_role='premium' AND premium_ends_at<=now()))`, [row.id]);
  }
  function requireVerified(req,res,next) {
    return req.user?.emailVerified ? next() : res.status(403).json({error:'Verify your email first.'});
  }
  router.post('/resend-verification', requireAuth, flowLimit, async (req,res) => {
    if (req.user.emailVerified) return res.sendStatus(204);
    if (!await deliver(req.user,'verify')) return res.status(503).json({error:'Unable to send verification email. Try again later.'});
    res.sendStatus(204);
  });
  router.post('/verify-email', flowLimit, async (req,res) => {
    if (!await consume(pool,req.body?.token,'verify')) return res.status(400).json({error:'Invalid or expired verification link.'});
    res.sendStatus(204);
  });
  router.post('/forgot-password', flowLimit, async (req,res) => {
    const email = req.body?.email;
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({error:'Enter a valid email.'});
    const { rows:[row] } = await pool.query("SELECT id,email FROM users WHERE email=$1 AND access_role<>'guest'",[email.trim().toLowerCase()]);
    if (row) await deliver(row,'reset');
    res.status(202).json({message:'If an account exists, a reset link will be sent.'});
  });
  router.post('/reset-password', flowLimit, async (req,res) => {
    const { token: raw, password, confirmPassword } = req.body || {};
    if (!validPassword(password) || password !== confirmPassword) return res.status(400).json({error:'Use 7–128 characters, a special character, and matching passwords.'});
    if (!await consume(pool,raw,'reset',await hashPassword(password))) return res.status(400).json({error:'Invalid or expired reset link.'});
    res.clearCookie(COOKIE,cookieOptions); res.sendStatus(204);
  });
  const oauthCookie = 'finclear_google_state';
  const oauthOptions = {httpOnly:true, secure:production, sameSite:'lax', path:'/api/auth/google/callback'};
  router.post('/google/start', flowLimit, (req,res) => {
    if (!google?.clientId || !google?.clientSecret || !google?.redirectUri) return res.status(503).json({error:'Google authentication is not configured.'});
    const mode = req.body?.mode;
    if (!['login','signup'].includes(mode) || (mode==='signup' && req.body?.acceptedTerms!==true)) return res.status(400).json({error:'Accept the terms before signing up.'});
    const state=token(), verifier=token();
    const signed=jwt.sign({state,verifier,mode,origin},secret,{algorithm:'HS256',audience:'finclear-google',expiresIn:'10m'});
    res.cookie(oauthCookie,signed,{...oauthOptions,maxAge:600000});
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search=new URLSearchParams({client_id:google.clientId,redirect_uri:google.redirectUri,response_type:'code',scope:'openid email profile',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString();
    res.json({url:url.href});
  });
  router.get('/google/callback', flowLimit, async (req,res) => {
    const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(oauthCookie+'='));
    res.clearCookie(oauthCookie,oauthOptions);
    const fail=()=>res.redirect(303,`${origin}/#google-error`);
    try {
      if (!google?.clientId || !google?.clientSecret || !google?.redirectUri || !cookie || typeof req.query.code!=='string') return fail();
      const flow=jwt.verify(cookie.slice(oauthCookie.length+1),secret,{algorithms:['HS256'],audience:'finclear-google'});
      if (typeof req.query.state!=='string' || req.query.state!==flow.state) return fail();
      const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({code:req.query.code,client_id:google.clientId,client_secret:google.clientSecret,redirect_uri:google.redirectUri,grant_type:'authorization_code',code_verifier:flow.verifier}),signal:AbortSignal.timeout(10000)});
      if (!response.ok) return fail();
      const {access_token}=await response.json();
      if (typeof access_token!=='string') return fail();
      const info=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${access_token}`},signal:AbortSignal.timeout(10000)});
      if (!info.ok) return fail();
      const profile=await info.json();
      if (profile.email_verified!==true || typeof profile.sub!=='string' || !profile.sub || typeof profile.email!=='string' || profile.email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return fail();
      const email=profile.email.trim().toLowerCase();
      const row=await transaction(pool,async client=>{
        const {rows:[existing]}=await client.query(`SELECT ${USER_FIELDS} FROM users WHERE google_subject=$1 AND access_role<>'guest'`,[profile.sub]);

        if (existing) {
          return {
            kind: 'existing',
            user: existing
          };
        }
        // Do not automatically link password-based accounts.
        const { rows: [collision] } = await client.query(
          'SELECT id FROM users WHERE email=$1',
          [email]
        );
        if (collision) {
          return {
            kind: 'email-conflict'
          };
        }
        // New Google users must complete signup.
        if (flow.mode !== 'signup') {
          return {
            kind: 'signup-required'
          };
        }
        const {rows:[created]}=await client.query(`INSERT INTO users(first_name,last_name,email,password_hash,access_role,trial_ends_at,email_verified_at,google_subject)
          VALUES($1,$2,$3,$4,'trial',now()+$5::int*interval '1 day',now(),$6) RETURNING ${USER_FIELDS}`,[String(profile.given_name||'Google User').slice(0,100).trim()||'Google User',String(profile.family_name||'').slice(0,100),email,await hashPassword(token()),trialDays,profile.sub]);
        await client.query('INSERT INTO user_settings(user_id) VALUES($1)',[created.id]);
        await client.query("INSERT INTO notification_preferences(user_id,event_type) SELECT $1,unnest(ARRAY['budget_warning','budget_exceeded','goal_progress','bank_connection','weekly_summary','trial_expiring'])",[created.id]);
        await client.query('INSERT INTO user_registration_consents(user_id,policy_version) VALUES($1,$2)',[created.id,SIGNUP_POLICY_VERSION]);
        return {
          kind: 'created',
          user: created
        };
      });
      if (!row) {
        return fail();
      }
      if (row.kind === 'signup-required') {
        return res.redirect(303, `${origin}/#google-signup`);
      }
      if (row.kind === 'email-conflict') {
        return res.redirect(303, `${origin}/#google-email-conflict`);
      }
      await persistExpiration(row.user);
      issueSession(res, row.user);
      if (row.kind === 'created') {
        return res.redirect(303, `${origin}/#onboarding`);
      }
      return res.redirect(303, `${origin}/`);
    } catch (error) {
      console.error('Google OAuth callback failed:', {
        name: error?.name,
        code: error?.code
      });
      return fail();
    }
  });
  router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
  function clearSession(res) { res.clearCookie(COOKIE, cookieOptions); }
  router.post('/logout', (req, res) => { clearSession(res); res.sendStatus(204); });
  return { router, requireAuth, requireVerified, requirePermission, clearSession, issueSession };
}

module.exports = { createAuth, getJwtSecret, verifyPassword, hashPassword, validNewPassword };
