import assert from 'node:assert/strict';
import test from 'node:test';
import { productDirectoryHref, readProductDirectoryFilters } from './filters';

test('directory filters bound free text, reject repeated values, and normalize invalid pages', () => {
  const filters = readProductDirectoryFilters({
    q: ' '.repeat(3) + 'a'.repeat(200),
    country: ['USA', 'NGA'],
    page: '-4',
  });
  assert.equal(filters.query.length, 100);
  assert.equal(filters.country, 'USA');
  assert.equal(filters.page, 1);
});
test('directory pagination preserves country, name, and review filters', () => {
  const filters = readProductDirectoryFilters({
    q: 'White & Blue',
    country: 'NG',
    attention: '1',
    page: '2',
  });
  const url = new URL(productDirectoryHref(filters, 3), 'https://example.com');
  assert.equal(url.searchParams.get('q'), 'White & Blue');
  assert.equal(url.searchParams.get('country'), 'NGA');
  assert.equal(url.searchParams.get('attention'), '1');
  assert.equal(url.searchParams.get('page'), '3');
});
test('the profile country supplies the initial default while an explicit destination wins', () => {
  assert.equal(readProductDirectoryFilters({}, 'Nigeria').country, 'NGA');
  assert.equal(readProductDirectoryFilters({ country: 'invalid' }, 'NG').country, 'NGA');
  assert.equal(readProductDirectoryFilters({ country: ['USA', 'CAN'] }, 'NGA').country, 'NGA');
  assert.equal(readProductDirectoryFilters({ country: 'CA' }, 'Nigeria').country, 'CAN');
  assert.equal(readProductDirectoryFilters({}, 'unknown').country, 'USA');
});
