import assert from 'node:assert/strict';
import test from 'node:test';
import { createGuestOrderLinker } from './guestLink';
import { CheckoutRequestError } from '@/lib/shop/checkout/serverRequest';

let sequence = 0;
function fixture({ sendFails = false, claimLost = false } = {}) {
  const originalOwner = `owner-${++sequence}`;
  let owner: string | null = originalOwner;
  let linked: string | null = null;
  let scope = '';
  let reads = 0;
  let writes = 0;
  let sent = 0;
  let invalidCapture = false;
  let foreign = false;
  let active = false;
  const link = createGuestOrderLinker({
    session: async () => ({
      isAuthenticated: Boolean(owner),
      user_id: owner,
      expiresAt: Date.now() + 60000,
    }),
    reserve: async (_email, value) => {
      active = true;
      scope = value!;
      return { otp: '123456', expiresAt: new Date(), cooldown: 60, hasActiveChallenge: true };
    },
    consume: async (_email, code, value) => {
      if (!active || value !== scope || code !== '123456') return 'invalid';
      active = false;
      return 'verified';
    },
    send: async () => {
      sent++;
      if (sendFails) throw new Error('Mail unavailable');
    },
    find: async () => {
      reads++;
      return [
        {
          orderToken: 'token-1',
          customerEmail: 'guest@example.test',
          userId: foreign ? 'another-owner' : linked,
          capturePayload: {
            id: 'capture',
            status: invalidCapture ? 'PENDING' : 'COMPLETED',
            amount: { value: '35.00', currencyCode: 'USD' },
          },
        },
      ];
    },
    claim: async (_token, _email, user) => {
      writes++;
      if (linked || claimLost) return 0;
      linked = user;
      return 1;
    },
  });
  const input = { email: 'Guest@example.test', reference: 'ORD-1' };
  return {
    link,
    input,
    originalOwner,
    expire: () => {
      active = false;
    },
    setOwner: (value: string | null) => {
      owner = value;
    },
    setForeign: () => {
      foreign = true;
    },
    setUnpaid: () => {
      invalidCapture = true;
    },
    counts: () => ({ reads, writes, sent, linked }),
  };
}

test('guest linking sends a scoped code without looking up purchases, then claims only after proof', async () => {
  const f = fixture();
  await f.link({ ...f.input, action: 'start' });
  assert.deepEqual(f.counts(), { reads: 0, writes: 0, sent: 1, linked: null });
  await assert.rejects(
    () => f.link({ ...f.input, action: 'verify', code: '000000' }),
    CheckoutRequestError,
  );
  assert.equal(f.counts().reads, 0);
  const result = await f.link({ ...f.input, action: 'verify', code: '123456' });
  assert.equal(result.orderToken, 'token-1');
  assert.equal(f.counts().linked, f.originalOwner);
  assert.equal(f.counts().writes, 1);
  await assert.rejects(
    () => f.link({ ...f.input, action: 'verify', code: '123456' }),
    CheckoutRequestError,
  );
  assert.equal(f.counts().writes, 1, 'Consumed proof cannot be replayed');
});

test('expired or undelivered codes never read or claim orders', async () => {
  const expired = fixture();
  await expired.link({ ...expired.input, action: 'start' });
  expired.expire();
  await assert.rejects(
    () => expired.link({ ...expired.input, action: 'verify', code: '123456' }),
    CheckoutRequestError,
  );
  assert.equal(expired.counts().reads, 0);
  const unsent = fixture({ sendFails: true });
  await assert.rejects(
    () => unsent.link({ ...unsent.input, action: 'start' }),
    /Mail unavailable/u,
  );
  await assert.rejects(
    () => unsent.link({ ...unsent.input, action: 'verify', code: '123456' }),
    CheckoutRequestError,
  );
  assert.equal(unsent.counts().reads, 0);
});

test('a competing ownership claim cannot be overwritten', async () => {
  const f = fixture({ claimLost: true });
  await f.link({ ...f.input, action: 'start' });
  await assert.rejects(
    () => f.link({ ...f.input, action: 'verify', code: '123456' }),
    (error: unknown) => error instanceof CheckoutRequestError && error.status === 409,
  );
  assert.equal(f.counts().linked, null);
});

test('codes cannot cross account, email, reference or purpose boundaries', async () => {
  for (const change of ['account', 'email', 'reference', 'anonymous'] as const) {
    const f = fixture();
    await f.link({ ...f.input, action: 'start' });
    if (change === 'account') f.setOwner('owner-b');
    if (change === 'anonymous') f.setOwner(null);
    await assert.rejects(
      () =>
        f.link({
          ...f.input,
          ...(change === 'email' ? { email: 'other@example.test' } : {}),
          ...(change === 'reference' ? { reference: 'ORD-2' } : {}),
          action: 'verify',
          code: '123456',
        }),
      CheckoutRequestError,
    );
    assert.equal(f.counts().writes, 0);
  }
});

test('even a verified email cannot claim foreign or unconfirmed purchases', async () => {
  for (const foreign of [true, false]) {
    const f = fixture();
    if (foreign) f.setForeign();
    else f.setUnpaid();
    // Different owners avoid sharing the normal send throttle between these independent cases.
    f.setOwner(`case-${foreign}`);
    await f.link({ ...f.input, action: 'start' });
    await assert.rejects(
      () => f.link({ ...f.input, action: 'verify', code: '123456' }),
      CheckoutRequestError,
    );
    assert.equal(f.counts().writes, 0);
  }
});
