import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMerchizeBuyerAddressExpectationFromLedger,
  getMerchizeBuyerAddressMismatchFields,
} from './addressCorrectionVerification';

const expected = {
  address: '100 Test Avenue',
  address2: 'Suite 20',
  city: 'Example City',
  state: 'CA',
  postal_code: '90210-1234',
  country_code: 'US',
};

test('verifies a nested Merchize shipping address without exposing address values', () => {
  const mismatches = getMerchizeBuyerAddressMismatchFields(
    {
      success: true,
      data: {
        shipping_address: {
          address: ' 100 TEST Avenue ',
          address2: 'Suite 20',
          city: 'Example City',
          state: 'ca',
          postal_code: '90210 1234',
          country_code: 'us',
        },
      },
    },
    expected,
  );

  assert.deepEqual(mismatches, []);
});

test('reports only semantic field names when provider persistence differs', () => {
  const mismatches = getMerchizeBuyerAddressMismatchFields(
    {
      success: true,
      data: {
        shipping_address: {
          address: 'Different value',
          address2: 'Suite 20',
          city: 'Different city',
          state: 'CA',
          postal_code: '00000',
          country_code: 'US',
        },
      },
    },
    expected,
  );

  assert.deepEqual(mismatches, ['line1', 'city', 'postalCode']);
  assert.equal(JSON.stringify(mismatches).includes('Different'), false);
});

test('treats an omitted provider line two as equivalent to an empty correction line two', () => {
  const mismatches = getMerchizeBuyerAddressMismatchFields(
    {
      data: {
        shipping_address_model: {
          address: expected.address,
          city: expected.city,
          state: expected.state,
          postal_code: expected.postal_code,
          country_code: expected.country_code,
        },
      },
    },
    { ...expected, address2: '' },
  );

  assert.deepEqual(mismatches, []);
});

test('fails closed when the buyer-address shape is absent', () => {
  assert.deepEqual(getMerchizeBuyerAddressMismatchFields({ success: true }, expected), [
    'line1',
    'line2',
    'city',
    'state',
    'postalCode',
    'countryCode',
  ]);
});

test('maps a saved ledger correction to a provider address expectation', () => {
  assert.deepEqual(
    getMerchizeBuyerAddressExpectationFromLedger({
      shipping_address_line_1: '100 Test Avenue',
      shipping_address_line_2: 'Suite 20',
      shipping_city: 'Example City',
      shipping_state: 'CA',
      zip_code: '90210-1234',
      shipping_country: 'USA',
    }),
    expected,
  );
});

test('refuses an incomplete saved address expectation', () => {
  assert.equal(
    getMerchizeBuyerAddressExpectationFromLedger({
      shipping_address_line_1: '100 Test Avenue',
      shipping_city: 'Example City',
      shipping_state: 'CA',
      shipping_country: 'USA',
    }),
    null,
  );
});
