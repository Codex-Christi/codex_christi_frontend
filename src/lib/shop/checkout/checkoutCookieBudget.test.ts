import assert from 'node:assert/strict';
import test from 'node:test';
import { NextResponse } from 'next/server';
import { enforceCheckoutCookieBudget } from './checkoutCookieBudget';
import { checkoutGrantCookieName, emailProofCookieName } from './checkoutProof';

function request(names: string[]) {
  return new Request('https://codexchristi.org/next-api/shop/checkout', {
    headers: { cookie: names.map((name) => `${name}=saved`).join('; ') },
  });
}

test('access grants retain the current cookie plus seven others and expire oldest entries only', () => {
  const names = Array.from({ length: 10 }, (_, index) => checkoutGrantCookieName(`order-${index}`));
  const current = names[0];
  const unrelated = [
    'session',
    'refreshToken',
    'checkout-browser',
    emailProofCookieName('intent-a'),
  ];
  const response = NextResponse.json({});
  enforceCheckoutCookieBudget(
    response.cookies,
    request([...unrelated, ...names]),
    current,
    'access',
  );
  const expired = response.cookies.getAll();
  assert.deepEqual(
    expired.map((cookie) => cookie.name),
    names.slice(1, 3),
  );
  assert.equal(
    expired.some((cookie) => cookie.name === current || unrelated.includes(cookie.name)),
    false,
  );
  for (const cookie of expired) {
    assert.equal(cookie.value, '');
    assert.equal(cookie.maxAge, 0);
    assert.equal(cookie.expires instanceof Date ? cookie.expires.getTime() : cookie.expires, 0);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.path, '/');
    assert.equal(cookie.sameSite, 'lax');
    assert.equal(cookie.domain, undefined);
  }
});

test('proofs retain the newly issued proof plus two others without pruning access/browser/auth cookies', () => {
  const names = Array.from({ length: 4 }, (_, index) => emailProofCookieName(`intent-${index}`));
  const current = emailProofCookieName('current');
  const response = NextResponse.json({});
  enforceCheckoutCookieBudget(
    response.cookies,
    request(['session', 'checkout-browser', checkoutGrantCookieName('active-order'), ...names]),
    current,
    'proof',
  );
  assert.deepEqual(
    response.cookies.getAll().map((cookie) => cookie.name),
    names.slice(0, 2),
  );
});

test('several grants issued in one response share one budget and preserve every new grant', () => {
  const old = Array.from({ length: 8 }, (_, index) => checkoutGrantCookieName(`old-${index}`));
  const req = request(old);
  const response = NextResponse.json({});
  const fresh = [checkoutGrantCookieName('new-a'), checkoutGrantCookieName('new-b')];
  for (const name of fresh) {
    enforceCheckoutCookieBudget(response.cookies, req, name, 'access');
    response.cookies.set(name, 'new-grant');
  }
  assert.deepEqual(
    response.cookies
      .getAll()
      .filter((cookie) => cookie.value === '')
      .map((cookie) => cookie.name),
    old.slice(0, 2),
  );
  for (const name of fresh) assert.equal(response.cookies.get(name)?.value, 'new-grant');
});
