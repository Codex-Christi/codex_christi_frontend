import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductRadioOptions, getProductOptionLayout } from './productOptionLayout';
import type { ProductVariantOptions, ProductVariantsInterface } from './productTypes';

function variant(options: ProductVariantOptions): ProductVariantsInterface['data'][number] {
  return {
    _id: 'variant',
    image_uris: [],
    retail_price: 20,
    is_default: false,
    title: 'Test',
    options,
    sku: 'sku',
    product: 'product',
  };
}

test('layout hints preserve selector order, deduplicate values, and omit empty groups', () => {
  const variants = [
    variant([
      { name: 'XL', value: 'XL', slug: 'xl', attribute: { name: 'Size', value_type: 'size' } },
      { name: 'White', value: '#ffffff', attribute: { name: 'Color', value_type: 'color' } },
    ]),
    variant([
      { name: 'S', value: 'S', slug: 's', attribute: { name: 'Size', value_type: 'size' } },
      { name: 'Black', value: '#000000', attribute: { name: 'Color', value_type: 'color' } },
    ]),
    variant([
      { name: 'M', value: 'M', slug: 'm', attribute: { name: 'Size', value_type: 'size' } },
      { name: 'Black', value: '#000000', attribute: { name: 'Color', value_type: 'color' } },
    ]),
  ];
  const layout = getProductOptionLayout(variants);
  assert.deepEqual(
    layout.map((group) => group.attribute),
    ['size', 'color'],
  );
  assert.deepEqual(
    layout[0].options.map((option) => option.label),
    ['S', 'M', 'XL'],
  );
  assert.deepEqual(
    layout[1].options.map((option) => option.label),
    ['Black', 'White'],
  );
  assert.deepEqual(
    layout[0].options,
    buildProductRadioOptions(
      variants.map((entry) => entry.options[0]),
      'size',
    ),
  );
});

test('layout serialization contains geometry labels only, not sellability or money', () => {
  const layout = getProductOptionLayout([
    variant([
      {
        name: 'Printed label',
        value: 'printed',
        attribute: { name: 'label', value_type: 'label' },
      },
    ]),
  ]);
  assert.deepEqual(layout, [
    {
      attribute: 'label',
      title: 'Label:',
      options: [{ label: 'Printed label', value: 'printed', key: 'printed-label' }],
    },
  ]);
  assert.doesNotMatch(JSON.stringify(layout), /retail_price|is_default|sku|image_uris|is_active/);
});

test('a missing variant snapshot does not invent product options', () => {
  assert.deepEqual(getProductOptionLayout([]), []);
});
