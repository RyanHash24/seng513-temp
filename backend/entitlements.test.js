const test = require('node:test');
const assert = require('node:assert/strict');
const {effectiveRole, permissions, checkQuota} = require('./entitlements');
const now = new Date('2026-11-25T00:00:00Z');
test('Free, active trial, expired trial, and premium roles',()=>{
  assert.equal(effectiveRole({access_role:'free'},now),'free');
  assert.equal(effectiveRole({access_role:'trial',trial_ends_at:'2026-11-26T00:00:00Z'},now),'trial');
  assert.equal(effectiveRole({access_role:'trial',trial_ends_at:now},now),'free');
  assert.equal(effectiveRole({access_role:'premium'},now),'premium');
  assert.equal(effectiveRole({access_role:'premium',premium_ends_at:now},now),'free');
  assert.equal(permissions('free').monthlyReports,false);
  assert.equal(permissions('trial').monthlyReports,true);
  assert.equal(permissions('premium').maxBankConnections,null);
});
test('quota checks enforce free limits and require verification', async()=>{
  let row={access_role:'free',email_verified_at:now}; let count=0;
  const client={query:async sql=>({rows:[sql.includes('FOR UPDATE')?row:{count}]})};
  assert.equal(await checkQuota(client,'user','bankConnections'),true);
  count=1; assert.equal(await checkQuota(client,'user','bankConnections'),false);
  assert.equal(await checkQuota(client,'user','bankConnections','business'),false);
  row={access_role:'premium',email_verified_at:now};
  assert.equal(await checkQuota(client,'user','bankConnections'),true);
  row.email_verified_at=null; assert.equal(await checkQuota(client,'user','bankConnections'),false);
});
