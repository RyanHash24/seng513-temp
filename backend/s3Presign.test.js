const assert = require('node:assert/strict');
const test = require('node:test');
const { signGetObject } = require('./s3Presign');
test('produces signed, finite-lifetime GET URL for allowlisted S3 object', () => {
  const url = new URL(signGetObject({
    accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'not-a-real-secret',
    region: 'ca-central-1', bucket: 'finclear-seng513-demo-test',
    key: 'demo/finclear-demo.jpg', expiresSeconds: 300,
    now: new Date('2026-11-18T23:00:00Z'),
  }));
  assert.equal(url.hostname, 'finclear-seng513-demo-test.s3.ca-central-1.amazonaws.com');
  assert.equal(url.pathname, '/demo/finclear-demo.jpg');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '300');
  assert.match(url.searchParams.get('X-Amz-Signature'), /^[a-f0-9]{64}$/);
});
test('download signs attachment response override', () => {
  const url = new URL(signGetObject({
    accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'fake', region: 'ca-central-1',
    bucket: 'finclear-seng513-demo-test', key: 'demo/finclear-demo.jpg',
    attachmentName: 'finclear-demo.jpg',
  }));
  assert.equal(url.searchParams.get('response-content-disposition'), 'attachment; filename="finclear-demo.jpg"');
});
