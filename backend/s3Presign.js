// Demo-only AWS Signature Version 4 GET URL signer using Node.js built-in crypto.
// In deployed applications, use the official AWS SDK and role-based temporary credentials.
const { createHash, createHmac } = require('node:crypto');

function encodeAws(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
}
const sha256 = data => createHash('sha256').update(data).digest('hex');
const hmac = (key, msg) => createHmac('sha256', key).update(msg).digest();
function signGetObject({ accessKeyId, secretAccessKey, sessionToken, region, bucket, key, expiresSeconds = 300, attachmentName, now = new Date() }) {
  if (!accessKeyId || !secretAccessKey || !region || !bucket || !key) {
    throw new Error('Missing required AWS S3 signing configuration.');
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || bucket.includes('.')) {
    throw new Error('Use a valid demo bucket name without periods.');
  }
  if (!Number.isInteger(expiresSeconds) || expiresSeconds < 1 || expiresSeconds > 3600) {
    throw new Error('Invalid demo URL lifetime.');
  }
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = timestamp.slice(0, 8);
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const path = '/' + key.split('/').map(encodeAws).join('/');
  const credentialScope = `${day}/${region}/s3/aws4_request`;
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': timestamp,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  if (sessionToken) params['X-Amz-Security-Token'] = sessionToken;
  if (attachmentName) {
    if (!/^[\w.-]+$/.test(attachmentName)) throw new Error('Invalid attachment filename');
    params['response-content-disposition'] = `attachment; filename="${attachmentName}"`;
  }
  const canonicalQuery = Object.entries(params)
    .map(([name, value]) => [encodeAws(name), encodeAws(value)])
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
    .map(([name, value]) => `${name}=${value}`).join('&');
  const canonicalRequest = [
    'GET', path, canonicalQuery, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256', timestamp, credentialScope, sha256(canonicalRequest)
  ].join('\n');
  let signatureKey = hmac('AWS4' + secretAccessKey, day);
  signatureKey = hmac(signatureKey, region);
  signatureKey = hmac(signatureKey, 's3');
  signatureKey = hmac(signatureKey, 'aws4_request');
  const signature = createHmac('sha256', signatureKey).update(stringToSign).digest('hex');
  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
module.exports = { signGetObject };
