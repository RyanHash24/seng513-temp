const { randomBytes, createHash } = require('node:crypto');
const digest = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const validToken = value => typeof value === 'string' && /^[\w-]{43}$/.test(value);
const validPassword = value => typeof value === 'string' && value.length >= 7 && value.length <= 128 && /[\p{P}\p{S}]/u.test(value);
async function transaction(pool, action) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await action(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
async function makeLink(pool, userId, purpose, origin) {
  const raw = token();
  await transaction(pool, async client => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    await client.query('DELETE FROM auth_tokens WHERE user_id=$1 AND purpose=$2', [userId, purpose]);
    await client.query('INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+$4::int*interval \'1 minute\')', [digest(raw), userId, purpose, purpose === 'verify' ? 1440 : 30]);
  });
  return `${origin}/#${purpose}=${raw}`;
}
async function consume(pool, raw, purpose, newHash) {
  if (!validToken(raw)) return false;
  return transaction(pool, async client => {
    // Match makeLink lock ordering; one successful consumer per token.
    const { rows: [candidate] } = await client.query('SELECT user_id FROM auth_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now()', [digest(raw), purpose]);
    if (!candidate) return false;
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [candidate.user_id]);
    const { rows: [matched] } = await client.query('DELETE FROM auth_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now() RETURNING user_id', [digest(raw), purpose]);
    if (!matched) return false;
    if (purpose === 'verify') await client.query('UPDATE users SET email_verified_at=coalesce(email_verified_at,now()) WHERE id=$1', [matched.user_id]);
    else {
      await client.query('UPDATE users SET password_hash=$2,session_version=session_version+1 WHERE id=$1', [matched.user_id,newHash]);
      await client.query("DELETE FROM auth_tokens WHERE user_id=$1 AND purpose='reset'", [matched.user_id]);
    }
    return true;
  });
}
function configuredMailer({ production, apiKey, from, devLinks }) {
  return async (to, purpose, link) => {
    if (apiKey && from) {
      const response = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json' }, body:JSON.stringify({ from, to:[to], subject:purpose==='verify'?'Verify your FinClear email':'Reset your FinClear password', text:`Open this one-time link: ${link}\nIf you did not request this, ignore this email.` }), signal:AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Email delivery failed');
    } else if (!production && devLinks) console.log(`[DEVELOPMENT ONLY] ${purpose} link for ${to}: ${link}`);
    else throw new Error('Email delivery is not configured');
  };
}
module.exports = { digest, token, validPassword, transaction, makeLink, consume, configuredMailer };
