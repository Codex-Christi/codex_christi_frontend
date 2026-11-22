import assert from 'node:assert/strict';
import test from 'node:test';
import { shippingAddressSchema } from './shipping-address-schema';
import { shippingAddressPayload } from '@/lib/auth/account-validation';

const address = {
  shipping_address: '12 Example Street',
  shipping_city: 'Los Angeles',
  shipping_state: 'California',
  shipping_country: 'US',
};

test('saved US addresses accept legacy state names and codes but always send postal codes', () => {
  for (const country of ['US', 'USA', 'United States']) {
    for (const state of ['California', 'CA', ' ca ']) {
      const input = { ...address, shipping_country: country, shipping_state: state };
      assert.equal(shippingAddressSchema.safeParse(input).success, true);
      assert.equal(shippingAddressPayload(input).shipping_state, 'CA');
      assert.equal(shippingAddressPayload(input).shipping_country, 'United States');
    }
  }
});

test('unknown US states cannot be submitted as saved address updates', () => {
  for (const state of ['Lagos', 'Californa', 'ZZ', '']) {
    const input = { ...address, shipping_state: state };
    assert.equal(shippingAddressSchema.safeParse(input).success, false);
    assert.throws(() => shippingAddressPayload(input));
  }
});

test('non-US states and provinces remain free text and keep their names', () => {
  for (const input of [
    { ...address, shipping_country: 'NG', shipping_state: 'Lagos' },
    { ...address, shipping_country: 'Canada', shipping_state: 'Ontario' },
  ]) {
    assert.equal(shippingAddressSchema.safeParse(input).success, true);
    assert.equal(shippingAddressPayload(input).shipping_state, input.shipping_state);
  }
});
