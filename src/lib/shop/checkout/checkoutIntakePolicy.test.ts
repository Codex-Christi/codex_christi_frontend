import assert from 'node:assert/strict';
import test from 'node:test';
import { isNewCheckoutPaused } from './checkoutIntakePolicy';

test('checkout intake defaults to open and a malformed nonblank setting pauses it', (t) => {
  const previous = process.env.SHOP_CHECKOUT_PAUSED;
  delete process.env.SHOP_CHECKOUT_PAUSED;
  t.after(() => {
    if (previous !== undefined) process.env.SHOP_CHECKOUT_PAUSED = previous;
  });

  for (const value of [undefined, '', '  ', ' false ']) assert.equal(isNewCheckoutPaused(value), false);
  for (const value of ['true', ' TRUE ', 'flase', '1']) assert.equal(isNewCheckoutPaused(value), true);
});
