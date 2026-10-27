import assert from 'node:assert/strict';
import test from 'node:test';
import { NextResponse } from 'next/server';
import { checkoutCookiesForLogout, clearLogoutCookies } from './logout-cookies';

test('logout expires checkout proofs and grants without clearing unrelated cookies', () => {
  const access = `checkout-access-${'a'.repeat(20)}`;
  const proof = `checkout-proof-${'b'.repeat(20)}`;
  const cookie = `${access}=secret; country=USA; ${proof}=secret; checkout-browser=scope; ${access}=duplicate`;
  assert.deepEqual(checkoutCookiesForLogout(cookie), [access, proof, 'checkout-browser']);
  const response = clearLogoutCookies(
    new NextResponse(),
    new Headers({ cookie, host: 'localhost:3000' }),
  );
  const expired = response.headers.getSetCookie();
  for (const name of [access, proof, 'checkout-browser']) {
    const header = expired.find((value) => value.startsWith(`${name}=`));
    assert.ok(header?.includes('Max-Age=0'));
    assert.ok(header?.includes('Path=/'));
    assert.ok(!header?.includes('Domain='));
  }
  assert.equal(
    expired.some((value) => value.startsWith('country=')),
    false,
  );
});
