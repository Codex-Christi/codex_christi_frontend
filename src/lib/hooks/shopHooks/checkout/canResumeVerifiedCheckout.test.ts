import assert from 'node:assert/strict';
import test from 'node:test';
import { canResumeVerifiedCheckout } from './canResumeVerifiedCheckout';

const now = Date.parse('2026-10-27T12:00:00.000Z');
function fixture() {
  return {
    checkout: {
      email: 'customer@example.test',
      delivery_address: {
        shipping_address_line_1: '10 Main Street',
        shipping_address_line_2: 'Apartment 2',
        shipping_city: 'Boston',
        shipping_state: 'Massachusetts',
        zip_code: '02110',
        shipping_country: 'USA',
      },
    },
    intent: {
      djangoOrderIntentUuid: 'intent-one',
      djangoOrderIntentOrderId: 'order-one',
      djangoOrderIntentVerifiedAt: '2026-10-27T11:30:00.000Z',
      djangoOrderIntentVerifyPayload: {
        success: true,
        data: {
          id: 'intent-one',
          order_id: 'order-one',
          otp_status: 'verified',
          email: 'customer@example.test',
          address: '10 Main Street',
          address_2: 'Apartment 2',
          city: 'Boston',
          state: 'Massachusetts',
          zip_code: '02110',
          country: 'US',
        },
      },
    },
  };
}

test('a reload may resume the payment UI only for its recent verified recipient and delivery details', () => {
  const { checkout, intent } = fixture();
  assert.equal(canResumeVerifiedCheckout(checkout, intent, now), true);
  assert.equal(
    canResumeVerifiedCheckout(
      checkout,
      { ...intent, djangoOrderIntentVerifiedAt: new Date(now).toISOString() },
      now,
    ),
    true,
  );
  assert.equal(
    canResumeVerifiedCheckout(
      checkout,
      { ...intent, djangoOrderIntentVerifiedAt: new Date(now - 3_600_000 + 1).toISOString() },
      now,
    ),
    true,
  );
});

test('email case, address letter case and repeated spaces, country aliases, and empty optional address match server normalization', () => {
  const { checkout, intent } = fixture();
  checkout.email = ' CUSTOMER@EXAMPLE.TEST ';
  checkout.delivery_address.shipping_address_line_1 = ' 10   MAIN street ';
  checkout.delivery_address.shipping_city = ' BOSTON ';
  checkout.delivery_address.shipping_country = ' United  States ';
  // The server collapses country whitespace before alias lookup as it does for other address fields.
  assert.equal(canResumeVerifiedCheckout(checkout, intent, now), true);
  checkout.delivery_address.shipping_address_line_2 = '';
  intent.djangoOrderIntentVerifyPayload.data.address_2 = '';
  assert.equal(canResumeVerifiedCheckout(checkout, intent, now), true);
});

test('changed email, delivery fields, or intent identity requires the contact step again', () => {
  for (const [field, replacement] of [
    ['shipping_address_line_1', '12 Main Street'],
    ['shipping_address_line_2', 'Apartment 3'],
    ['shipping_city', 'Cambridge'],
    ['shipping_state', 'New York'],
    ['zip_code', '02111'],
    ['shipping_country', 'CAN'],
  ] as const) {
    const { checkout, intent } = fixture();
    checkout.delivery_address[field] = replacement;
    assert.equal(canResumeVerifiedCheckout(checkout, intent, now), false, field);
  }
  const { checkout, intent } = fixture();
  assert.equal(
    canResumeVerifiedCheckout({ ...checkout, email: 'another@example.test' }, intent, now),
    false,
  );
  assert.equal(
    canResumeVerifiedCheckout(checkout, { ...intent, djangoOrderIntentUuid: 'intent-two' }, now),
    false,
  );
  assert.equal(
    canResumeVerifiedCheckout(checkout, { ...intent, djangoOrderIntentOrderId: 'order-two' }, now),
    false,
  );
  intent.djangoOrderIntentVerifyPayload.data.id = 'Intent-one';
  assert.equal(canResumeVerifiedCheckout(checkout, intent, now), false);
});

test('pending, expired, failed, and malformed verification cannot resume payment', () => {
  const { checkout, intent } = fixture();
  for (const payload of [
    null,
    [],
    {},
    { success: true },
    { success: true, data: null },
    { success: true, data: [] },
    { ...intent.djangoOrderIntentVerifyPayload, success: false },
    ...['pending', 'expired', 'VERIFIED'].map((otp_status) => ({
      success: true,
      data: { ...intent.djangoOrderIntentVerifyPayload.data, otp_status },
    })),
    { success: true, data: { ...intent.djangoOrderIntentVerifyPayload.data, id: '' } },
    { success: true, data: { ...intent.djangoOrderIntentVerifyPayload.data, order_id: null } },
  ])
    assert.equal(
      canResumeVerifiedCheckout(
        checkout,
        { ...intent, djangoOrderIntentVerifyPayload: payload },
        now,
      ),
      false,
    );
});

test('expiry, future verification, invalid timestamps, and invalid clocks fail closed', () => {
  const { checkout, intent } = fixture();
  for (const timestamp of [
    '',
    'invalid',
    '2026-10-27T11:00:00.000Z',
    '2026-10-27T10:59:59.000Z',
    '2026-10-27T12:00:00.001Z',
  ])
    assert.equal(
      canResumeVerifiedCheckout(
        checkout,
        { ...intent, djangoOrderIntentVerifiedAt: timestamp },
        now,
      ),
      false,
      timestamp,
    );
  assert.equal(
    canResumeVerifiedCheckout(checkout, { ...intent, djangoOrderIntentVerifiedAt: null }, now),
    false,
  );
  for (const clock of [NaN, Infinity, -Infinity])
    assert.equal(canResumeVerifiedCheckout(checkout, intent, clock), false);
});

test('normalization never erases controls, missing required address, invalid countries, or invalid email syntax', () => {
  const { checkout, intent } = fixture();
  for (const address of [
    null,
    {},
    { ...checkout.delivery_address, shipping_country: 'ZZZ' },
    { ...checkout.delivery_address, shipping_city: '   ' },
    { ...checkout.delivery_address, shipping_address_line_1: '10\nMain Street' },
    { ...checkout.delivery_address, shipping_address_line_2: '   ' },
  ])
    assert.equal(
      canResumeVerifiedCheckout({ ...checkout, delivery_address: address }, intent, now),
      false,
    );
  assert.equal(
    canResumeVerifiedCheckout({ ...checkout, email: 'customer @example.test' }, intent, now),
    false,
  );
});
