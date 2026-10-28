import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { NextRequest } from 'next/server';
import { createRequestStoreForAPI } from 'next/dist/server/async-storage/request-store';
import {
  workAsyncStorage,
  type WorkStore,
} from 'next/dist/server/app-render/work-async-storage.external';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import type { PrismaClient } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import { POST } from '@/app/api/shop/checkout/recovery/start/route';
import {
  CHECKOUT_BROWSER_COOKIE,
  emailProofCookieName,
  openCheckoutValue,
  sealCheckoutValue,
  type CheckoutEmailProof,
} from '../checkoutProof';
import { buildAuthSessionCookies } from '@/lib/session/session-cookies';
import { canReviewRecoveryCheckout, recoveryReviewResponse } from './reviewPolicy';
import { findUnresolvedPaidCheckoutsByEmail } from './findUnresolvedPaidCheckouts';
import { findEmailRecoveryCheckouts } from './findEmailRecoveryCheckouts';

const email = 'customer@example.test';
const row = {
  orderToken: 'paid-order',
  userId: null as string | null,
  customerEmail: email,
  status: 'captured',
  cartSnapshot: [{ title: 'Earlier purchase', quantity: 1 }],
  shippingSnapshot: {},
  canonicalOrderSnapshot: null,
  canonicalOrderSnapshotVersion: null,
  canonicalOrderSnapshotHash: null,
  authorizePayload: {},
  capturePayload: {
    id: 'CAPTURE-1',
    status: 'COMPLETED',
    amount: { value: '25.00', currency_code: 'USD' },
  },
  receiptLink: null,
  receiptFile: null,
  djangoPaymentSaveCustomId: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  createdAt: new Date('2026-10-27T12:00:00Z'),
  updatedAt: new Date('2026-10-27T12:00:00Z'),
};
const proof = {
  ownerId: null as string | null | undefined,
  verified: true,
  email,
  intentUuid: 'verified-intent',
  browserId: 'verified-browser',
  orderId: 'DJANGO-ORDER',
  addressHash: 'verified-address',
};
const access = {
  email,
  userId: null,
  grant: null,
  emailProof: null,
  browserId: null,
};

function database(t: TestContext, client: unknown) {
  const previous = global.__paypalTxLedger__;
  global.__paypalTxLedger__ = client as PrismaClient;
  t.after(() => {
    global.__paypalTxLedger__ = previous;
  });
}

function configureSigning(t: TestContext) {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'checkout-recovery-review-test-secret-at-least-32-bytes';
  t.after(() => {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  });
}

async function start(body: unknown, cookie = '') {
  const request = new NextRequest('http://localhost:3000/next-api/shop/checkout/recovery/start', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      cookie,
    },
    body: JSON.stringify(body),
  });
  const store = createRequestStoreForAPI(
    request,
    request.nextUrl,
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined,
    undefined,
  );
  return workAsyncStorage.run({ route: '/test' } as WorkStore, () =>
    workUnitAsyncStorage.run(store, () => POST(request)),
  );
}

async function accountCookie(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const token = (type: string) =>
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ token_type: type, user_id: userId, iat: now - 1, exp: now + 300 })).toString('base64url')}.test`;
  const built = await buildAuthSessionCookies({
    accessToken: token('access'),
    refreshToken: token('refresh'),
  });
  return built.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

test('review accepts the owning account or exact checkout access without another email code', () => {
  assert.equal(
    canReviewRecoveryCheckout({ ...row, userId: 'owner' }, { ...access, userId: 'owner' }),
    true,
  );
  assert.equal(
    canReviewRecoveryCheckout({ ...row, userId: 'owner' }, { ...access, userId: 'other' }),
    false,
  );
  const grant = {
    orderToken: row.orderToken,
    ownerId: null,
    viewerId: null,
    mode: 'status' as const,
  };
  assert.equal(canReviewRecoveryCheckout(row, { ...access, grant }), true);
  assert.equal(
    canReviewRecoveryCheckout(row, { ...access, grant: { ...grant, orderToken: 'another-order' } }),
    false,
  );
});

test('email-proof review requires verified email, exact intent and current browser together', () => {
  const trusted = {
    ...access,
    emailProof: proof,
    browserId: proof.browserId,
    intentUuid: proof.intentUuid,
  };
  assert.equal(canReviewRecoveryCheckout(row, trusted), true);
  for (const changed of [
    { emailProof: { ...proof, verified: false } },
    { emailProof: { ...proof, email: 'someone@example.test' } },
    { intentUuid: 'other-intent' },
    { browserId: 'other-browser' },
    { browserId: null },
  ])
    assert.equal(canReviewRecoveryCheckout(row, { ...trusted, ...changed }), false);
  assert.equal(
    canReviewRecoveryCheckout({ ...row, customerEmail: 'someone@example.test' }, trusted),
    false,
  );
  assert.deepEqual(recoveryReviewResponse([]), { ok: true, recoveryRequired: false });
});

test('account-issued proof stays with its account and legacy proof cannot reveal orders', () => {
  const trusted = {
    ...access,
    emailProof: { ...proof, ownerId: 'alice' },
    browserId: proof.browserId,
    intentUuid: proof.intentUuid,
    userId: 'alice',
  };
  assert.equal(canReviewRecoveryCheckout(row, trusted), true);
  for (const userId of ['bob', null])
    assert.equal(canReviewRecoveryCheckout(row, { ...trusted, userId }), false);
  assert.equal(
    canReviewRecoveryCheckout(row, { ...trusted, emailProof: { ...proof, ownerId: undefined } }),
    false,
  );
  assert.equal(
    canReviewRecoveryCheckout({ ...row, userId: 'alice' }, { ...trusted, emailProof: null }),
    true,
  );
});

test('review binds a guest proof to the first signed-in account without extending it again', async (t) => {
  configureSigning(t);
  database(t, { paypalIntent: { findMany: async () => [row] } });
  const proofName = emailProofCookieName(proof.intentUuid);
  const browserCookie = `${CHECKOUT_BROWSER_COOKIE}=${sealCheckoutValue(proof.browserId, 'browser', 60)}`;
  const guestCookie = `${proofName}=${sealCheckoutValue(proof, 'email-proof', 60)}`;
  const body = { email, mode: 'review', intentUuid: proof.intentUuid };
  const signedIn = await start(
    body,
    `${await accountCookie('alice')}; ${browserCookie}; ${guestCookie}`,
  );
  assert.equal((await signedIn.json()).recoveryVerified, true);
  const updated = signedIn.cookies.get(proofName);
  assert.ok(updated);
  assert.equal(
    openCheckoutValue<CheckoutEmailProof>(updated.value, 'email-proof')?.ownerId,
    'alice',
  );
  const boundCookie = `${proofName}=${updated.value}`;

  const repeated = await start(
    body,
    `${await accountCookie('alice')}; ${browserCookie}; ${boundCookie}`,
  );
  assert.equal(repeated.cookies.has(proofName), false);
  for (const session of [await accountCookie('bob'), '']) {
    const switched = await start(body, `${session}; ${browserCookie}; ${boundCookie}`);
    assert.deepEqual(await switched.json(), { ok: true, recoveryRequired: false });
    assert.equal(switched.cookies.getAll().length, 0);
  }
});

test('review returns the same private empty response for unknown and unauthorized emails without sending mail', async (t) => {
  configureSigning(t);
  let rows = [row];
  database(t, { paypalIntent: { findMany: async () => rows } });
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Review must not send mail');
  });
  for (const existing of [true, false]) {
    rows = existing ? [row] : [];
    const response = await start({ email, mode: 'review' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, recoveryRequired: false });
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('a browser-bound email proof reveals only matching rows and grants read-only order access', async (t) => {
  configureSigning(t);
  database(t, {
    paypalIntent: {
      findMany: async () => [
        row,
        { ...row, orderToken: 'other', customerEmail: 'other@example.test' },
      ],
    },
  });
  const cookie = `${CHECKOUT_BROWSER_COOKIE}=${sealCheckoutValue(proof.browserId, 'browser', 60)}; ${emailProofCookieName(proof.intentUuid)}=${sealCheckoutValue(proof, 'email-proof', 60)}`;
  const response = await start({ email, mode: 'review', intentUuid: proof.intentUuid }, cookie);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.recoveryVerified, true);
  assert.deepEqual(
    payload.checkouts.map((item: { orderToken: string }) => item.orderToken),
    [row.orderToken],
  );
  assert.match(response.headers.get('set-cookie') ?? '', /checkout-access-.*HttpOnly/u);
});

test('expired server email evidence never reveals a paid checkout', async (t) => {
  configureSigning(t);
  database(t, { paypalIntent: { findMany: async () => [row] } });
  const cookie = `${CHECKOUT_BROWSER_COOKIE}=${sealCheckoutValue(proof.browserId, 'browser', 60)}; ${emailProofCookieName(proof.intentUuid)}=${sealCheckoutValue(proof, 'email-proof', -60)}`;
  const response = await start({ email, mode: 'review', intentUuid: proof.intentUuid }, cookie);
  assert.deepEqual(await response.json(), { ok: true, recoveryRequired: false });
});

test('explicit code requests never query paid-order existence and return the same result', async (t) => {
  const latest = {
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 600_000),
    otpHash: 'legacy-recovery-hash',
  };
  database(t, {
    $transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        $executeRaw: async () => 1,
        checkoutRecoveryOtpChallenge: {
          findMany: async () => [latest],
          findFirst: async () => latest,
        },
      }),
  });
  for (const body of [
    { email },
    { email: 'unknown@example.test', mode: 'send-code', orderToken: 'unknown-order' },
  ]) {
    const response = await start(body);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.recoveryRequired, true);
    assert.equal(payload.checkouts, undefined);
  }
});

test('another OTP scope cannot make recovery claim that a usable code was sent', async (t) => {
  const latest = {
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 600_000),
    otpHash: 'checkout-email:another-scope:hash',
  };
  database(t, {
    $transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        $executeRaw: async () => 1,
        checkoutRecoveryOtpChallenge: {
          findMany: async () => [latest],
          findFirst: async () => latest,
        },
      }),
  });
  const response = await start({ email, mode: 'send-code' });
  assert.equal(response.status, 429);
  assert.match((await response.json()).message, /wait/u);
});

test('unresolved lookup uses bounded authoritative ledger evidence regardless of stale projections', async (t) => {
  let query: unknown;
  database(t, {
    paypalIntent: {
      findMany: async (input: unknown) => {
        query = input;
        return [
          row,
          {
            ...row,
            orderToken: 'not-paid',
            capturePayload: { ...row.capturePayload, status: 'PENDING' },
          },
        ];
      },
    },
  });
  const rows = await findUnresolvedPaidCheckoutsByEmail(` ${email.toUpperCase()} `);
  assert.deepEqual(
    rows.map((item) => item.orderToken),
    [row.orderToken],
  );
  const input = query as {
    where: {
      customerEmail: string;
      processingCompletedAt: null;
      status: { in: string[] };
      djangoOrderIntentVerifyPayload: unknown;
    };
    take: number;
    select: { userId: boolean };
  };
  assert.equal(input.where.customerEmail, email);
  assert.equal(input.where.processingCompletedAt, null);
  assert.ok(!input.where.status.in.includes('completed'));
  assert.ok(!input.where.status.in.includes('refunded'));
  assert.ok(input.where.djangoOrderIntentVerifyPayload);
  assert.equal(input.take, 10);
  assert.equal(input.select.userId, true);
});

test('exact recovery normalizes email and requires completed capture evidence', async (t) => {
  let found: typeof row | null = row;
  database(t, { paypalIntent: { findUnique: async () => found } });
  assert.equal(
    (await findEmailRecoveryCheckouts(` ${email.toUpperCase()} `, row.orderToken)).length,
    1,
  );
  assert.deepEqual(await findEmailRecoveryCheckouts('other@example.test', row.orderToken), []);
  found = { ...row, capturePayload: { ...row.capturePayload, status: 'PENDING' } };
  assert.deepEqual(await findEmailRecoveryCheckouts(email, row.orderToken), []);
  found = null;
  assert.deepEqual(await findEmailRecoveryCheckouts(email, row.orderToken), []);
});
