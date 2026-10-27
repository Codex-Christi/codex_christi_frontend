import assert from 'node:assert/strict';
import test from 'node:test';
import serialize from 'serialize-javascript';
import type { BasicProductInterface } from './productTypes';
import { getProductStructuredData } from './productStructuredData';

const product: BasicProductInterface['data'] = {
  _id: 'product-1',
  slug: 'product-1',
  title: 'Actual product',
  description: '',
  image: '',
  retail_price: '35.00',
  is_active: true,
  is_deleted: false,
  is_private: false,
  is_taken_down: false,
  approval_status: 'approved',
  status: 'active',
};
const details = {
  description: 'Actual supplier description',
  url: 'https://shop.example/product/1',
};

test('published display data describes the listed price without inventing stock or reviews', () => {
  const data = getProductStructuredData({
    product,
    ...details,
    image: 'https://images.example/model.jpg',
  });
  assert.equal(data.name, product.title);
  assert.equal(data.image, 'https://images.example/model.jpg');
  assert.deepEqual(data.offers, {
    '@type': 'Offer',
    url: details.url,
    price: '35',
    priceCurrency: 'USD',
  });
  for (const field of ['availability', 'itemCondition', 'shippingDetails', 'priceValidUntil'])
    assert.ok(!(field in data.offers!));
  assert.ok(!('review' in data));
  assert.ok(!('aggregateRating' in data));
});

test('missing or explicitly unavailable publication data never describes an active offer', () => {
  for (const patch of [
    { is_active: undefined },
    { is_deleted: undefined },
    { is_private: undefined },
    { is_taken_down: undefined },
    { approval_status: undefined },
    { is_active: false },
    { is_deleted: true },
    { is_private: true },
    { is_taken_down: true },
    { approval_status: 'pending' },
    { status: 'retired' },
  ]) {
    const data = getProductStructuredData({ product: { ...product, ...patch }, ...details });
    assert.ok(!('offers' in data), JSON.stringify(patch));
    assert.equal(data.name, product.title);
    assert.ok(!('availability' in data));
  }
});

test('unknown, zero, negative and non-finite display prices are not advertised as offers', () => {
  for (const retail_price of ['', ' ', '0', '-1', 'NaN', 'Infinity', 'not a price']) {
    const data = getProductStructuredData({ product: { ...product, retail_price }, ...details });
    assert.ok(!('offers' in data), retail_price);
  }
});

test('structured data keeps the existing safe script serialization', () => {
  const title = '</script><script>alert("not executable")</script>';
  const data = getProductStructuredData({ product: { ...product, title }, ...details });
  const json = serialize(data);
  assert.doesNotMatch(json, /<\/script/i);
  assert.equal(JSON.parse(json).name, title);
});
