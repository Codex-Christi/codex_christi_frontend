import assert from 'node:assert/strict';
import test from 'node:test';
import {
  billingAddressFromDelivery,
  checkoutBillingAddressSchema,
  checkoutDeliveryAddressSchema,
} from './checkoutAddress';

const address = {
  addressLine1: ' 12 Example Street ',
  addressLine2: '  Apt 4 ',
  adminArea1: ' CA ',
  adminArea2: ' Los Angeles ',
  postalCode: ' 90001 ',
};

test('delivery validation trims address text and rejects blank required fields', () => {
  assert.deepEqual(checkoutDeliveryAddressSchema.parse(address), {
    addressLine1: '12 Example Street',
    addressLine2: 'Apt 4',
    adminArea1: 'CA',
    adminArea2: 'Los Angeles',
    postalCode: '90001',
  });
  for (const field of ['addressLine1', 'adminArea1', 'adminArea2', 'postalCode']) {
    const result = checkoutDeliveryAddressSchema.safeParse({ ...address, [field]: '   ' });
    assert.equal(result.success, false, `${field} cannot contain only spaces`);
  }
});

test('same-as-delivery billing uses the current address and a normalized ISO2 country', () => {
  const billing = billingAddressFromDelivery(
    {
      shipping_address_line_1: address.addressLine1,
      shipping_address_line_2: address.addressLine2,
      shipping_city: address.adminArea2,
      shipping_state: address.adminArea1,
      shipping_country: 'USA',
      zip_code: address.postalCode,
    },
    'us',
  );
  const parsed = checkoutBillingAddressSchema.parse(billing);
  assert.equal(parsed.addressLine1, '12 Example Street');
  assert.equal(parsed.countryCode, 'US');
  assert.equal(parsed.postalCode, '90001');
  assert.equal(
    checkoutBillingAddressSchema.safeParse({ ...billing, countryCode: 'USA' }).success,
    false,
  );
});
