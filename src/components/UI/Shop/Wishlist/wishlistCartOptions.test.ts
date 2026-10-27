import assert from 'node:assert/strict';
import test from 'node:test';
import { isCartVariant, variantLabel } from './wishlistCartOptions';

function variant() {
  return {
    _id: 'variant-m-black',
    product: 'hoodie',
    sku: 'HOODIE-M-BLACK',
    title: 'Hoodie',
    retail_price: 49.99,
    is_default: false,
    image_uris: ['https://mainmedia.codexchristi.org/hoodie.png'],
    options: [
      { name: 'M', value: 'm', attribute: { name: 'Size', value_type: 'size' } },
      { name: 'Black', value: '#000000', attribute: { name: 'Color', value_type: 'color' } },
    ],
  };
}

test('a verified option stays attached to its product and displays its complete combination', () => {
  const option = variant();
  assert.ok(isCartVariant(option, 'hoodie'));
  assert.equal(variantLabel(option), 'Size: M · Color: Black');
  assert.equal(isCartVariant(option, 'different-product'), false);
});

test('malformed options cannot become selectable cart lines', () => {
  const invalidOptions = [
    null,
    [null],
    [{ value: 'm' }],
    [{ name: 'M', value: 42 }],
    [{ name: 'M', value: 'm', attribute: 'Size' }],
    [{ name: 'M', value: 'm', attribute: { name: null, value_type: 'size' } }],
  ];
  for (const options of invalidOptions) {
    assert.equal(isCartVariant({ ...variant(), options }, 'hoodie'), false);
  }
});

test('unknown prices and incomplete cart metadata are rejected instead of creating broken cart lines', () => {
  const invalidFields = [
    { retail_price: '49.99' },
    { retail_price: Number.NaN },
    { retail_price: Number.POSITIVE_INFINITY },
    { retail_price: -1 },
    { sku: ' ' },
    { _id: '' },
    { title: null },
    { is_default: undefined },
    { image_uris: [null] },
  ];
  for (const fields of invalidFields) {
    assert.equal(isCartVariant({ ...variant(), ...fields }, 'hoodie'), false);
  }
});

test('option labels preserve attribute-free choices and readable fallback values', () => {
  const option: unknown = {
    ...variant(),
    retail_price: 0,
    options: [{ name: '', value: 'Standard' }],
  };
  assert.ok(isCartVariant(option, 'hoodie'));
  assert.equal(variantLabel(option), 'Standard');
});

test('products without customization still expose their explicit standard variant', () => {
  const option = { ...variant(), options: [] };
  assert.ok(isCartVariant(option, 'hoodie'));
  assert.equal(variantLabel(option), 'Hoodie');
});
