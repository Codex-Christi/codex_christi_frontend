import assert from 'node:assert/strict';
import test from 'node:test';
import { isMerchizeFulfillmentPushEnabled } from './pushPolicy';

test('production release requires an explicit enabled setting', (t) => {
  const previous = process.env.MERCHIZE_FULFILLMENT_PUSH_ENABLED;
  t.after(() => {
    if (previous === undefined) delete process.env.MERCHIZE_FULFILLMENT_PUSH_ENABLED;
    else process.env.MERCHIZE_FULFILLMENT_PUSH_ENABLED = previous;
  });
  delete process.env.MERCHIZE_FULFILLMENT_PUSH_ENABLED;
  assert.equal(isMerchizeFulfillmentPushEnabled(), false);
  for (const value of ['', ' ', 'false']) {
    process.env.MERCHIZE_FULFILLMENT_PUSH_ENABLED = value;
    assert.equal(isMerchizeFulfillmentPushEnabled(), false);
  }
  process.env.MERCHIZE_FULFILLMENT_PUSH_ENABLED = 'true';
  assert.equal(isMerchizeFulfillmentPushEnabled(), true);
  process.env.MERCHIZE_FULFILLMENT_PUSH_ENABLED = 'maybe';
  assert.throws(isMerchizeFulfillmentPushEnabled);
});
