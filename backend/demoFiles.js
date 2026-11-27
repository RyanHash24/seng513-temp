// Only fictional, explicitly allowlisted objects. No list, write or delete operations.
const { signGetObject } = require('./s3Presign');
const FILES = Object.freeze({
  image: { key: 'demo/finclear-demo.jpg', download: 'finclear-demo.jpg' },
  budget: { key: 'demo/FinClear_October_2026_Monthly_Budget.pdf', download: 'FinClear_October_2026_Monthly_Budget.pdf' },
});
function demoFileHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Demonstration endpoints are disabled in production.' });
  }
  const file = FILES[req.params.name];
  const mode = req.query.mode || 'preview';
  if (!file || !['preview', 'download'].includes(mode)) {
    return res.status(404).json({ error: 'Demo file or operation not available.' });
  }
  const { AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN } = process.env;
  if (![AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY].every(Boolean)) {
    return res.status(503).json({ error: 'S3 demonstration is not configured. Follow S3_SETUP.md.' });
  }
  try {
    const url = signGetObject({
      bucket: AWS_S3_BUCKET, region: AWS_REGION,
      accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY,
      sessionToken: AWS_SESSION_TOKEN, key: file.key, expiresSeconds: 300,
      attachmentName: mode === 'download' ? file.download : undefined,
    });
    res.json({ url, expiresSeconds: 300, objectKey: file.key });
  } catch (err) {
    console.error('Demo S3 URL signing failed:', err.message);
    res.status(503).json({ error: 'Could not prepare demo file link.' });
  }
}
module.exports = { demoFileHandler };
