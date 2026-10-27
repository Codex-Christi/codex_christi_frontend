import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductSearch, normalizeSearchQuery } from './productSearch';

const products = [
  'Classic White Logo T-shirt',
  'Classic Black Hoodie',
  'Photographer For Christ Hoodie',
  'Café Cap',
].map((title, id) => ({ id: String(id), title, image: null, price: 30 }));
const search = createProductSearch(products);

test('search supports word prefixes, reordered words, and punctuation', () => {
  assert.deepEqual(
    search('white cla').map((item) => item.id),
    ['0'],
  );
  assert.deepEqual(
    search('t-shirt').map((item) => item.id),
    ['0'],
  );
  assert.deepEqual(
    search('cafe').map((item) => item.id),
    ['3'],
  );
});

test('fuzzy suggestions tolerate a typo but require every query word', () => {
  assert.deepEqual(
    search('hodie').map((item) => item.id),
    ['1', '2'],
  );
  assert.deepEqual(
    search('clasik white').map((item) => item.id),
    ['0'],
  );
  assert.deepEqual(search('hoodie unicorn'), []);
  assert.deepEqual(search('   '), []);
  assert.deepEqual(search('!!!'), []);
  assert.equal(search('classic', 1).length, 1);
});

test('queries are normalized and bounded before matching or supplier lookup', () => {
  assert.equal(normalizeSearchQuery('  Classic\n  White\u0000Logo  '), 'Classic White Logo');
  assert.equal(normalizeSearchQuery('a'.repeat(500)).length, 100);
});
