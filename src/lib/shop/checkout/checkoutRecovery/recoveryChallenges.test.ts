import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { consumeRecoveryChallenge, reserveRecoveryChallenge } from './recoveryChallenges';
import { hashRecoveryOtp } from './recoveryOtpUtils';
import type { PrismaClient } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';

type Challenge = {
  id: string;
  email: string;
  otpHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
  createdAt: Date;
};
type ChallengeWhere = {
  email?: string;
  consumedAt?: null;
  otpHash?: { startsWith?: string; not?: { startsWith: string } };
};

function database(t: TestContext, initial: Challenge[] = []) {
  const previous = global.__paypalTxLedger__;
  const oldSecret = process.env.CHECKOUT_RECOVERY_OTP_SECRET;
  process.env.CHECKOUT_RECOVERY_OTP_SECRET = 'recovery-test-secret';
  const rows = initial;
  let pending = Promise.resolve();
  let locks = 0;
  const matching = (where: ChallengeWhere = {}) =>
    rows
      .filter(
        (row) =>
          (!where.email || row.email === where.email) &&
          (where.consumedAt !== null || (!row.consumedAt && row.expiresAt > new Date())) &&
          (!where.otpHash?.startsWith || row.otpHash.startsWith(where.otpHash.startsWith)) &&
          (!where.otpHash?.not || !row.otpHash.startsWith(where.otpHash.not.startsWith)),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const tx = {
    $executeRaw: async (strings: TemplateStringsArray, key: string) => {
      assert.match(strings.join('?'), /pg_advisory_xact_lock\(hashtextextended/u);
      assert.match(key, /^checkout-recovery:/u);
      locks += 1;
      return 1;
    },
    checkoutRecoveryOtpChallenge: {
      findMany: async ({ where }: { where: ChallengeWhere }) => matching(where).slice(0, 3),
      findFirst: async ({ where }: { where: ChallengeWhere }) => matching(where)[0] ?? null,
      create: async ({ data }: { data: Pick<Challenge, 'email' | 'otpHash' | 'expiresAt'> }) => {
        const row = {
          ...data,
          id: String(rows.length),
          attemptCount: 0,
          consumedAt: null,
          createdAt: new Date(),
        };
        rows.push(row);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; attemptCount: number };
        data: { consumedAt?: Date };
      }) => {
        const row = rows.find(
          (item) =>
            item.id === where.id &&
            item.attemptCount === where.attemptCount &&
            !item.consumedAt &&
            item.expiresAt > new Date(),
        );
        if (!row) return { count: 0 };
        row.attemptCount += 1;
        if (data.consumedAt) row.consumedAt = data.consumedAt;
        return { count: 1 };
      },
    },
  };
  const fake = {
    $transaction: async <T>(run: (client: typeof tx) => Promise<T>) => {
      const before = pending;
      let release!: () => void;
      pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      await before;
      try {
        return await run(tx);
      } finally {
        release();
      }
    },
  };
  global.__paypalTxLedger__ = fake as unknown as PrismaClient;
  t.after(() => {
    global.__paypalTxLedger__ = previous;
    if (oldSecret === undefined) delete process.env.CHECKOUT_RECOVERY_OTP_SECRET;
    else process.env.CHECKOUT_RECOVERY_OTP_SECRET = oldSecret;
  });
  return { rows, locks: () => locks };
}

test('parallel issuance reserves one challenge and reuses its cooldown', async (t) => {
  const db = database(t);
  const results = await Promise.all(
    Array.from({ length: 12 }, () => reserveRecoveryChallenge('customer@example.com')),
  );
  assert.equal(results.filter((result) => result.otp).length, 1);
  assert.equal(db.rows.length, 1);
  assert.equal(db.locks(), 12);
});

test('parallel wrong guesses cannot exceed the five-attempt budget', async (t) => {
  const db = database(t);
  await reserveRecoveryChallenge('customer@example.com');
  db.rows[0].otpHash = hashRecoveryOtp('123456');
  const results = await Promise.all(
    Array.from({ length: 20 }, () => consumeRecoveryChallenge('customer@example.com', '000000')),
  );
  assert.equal(db.rows[0].attemptCount, 5);
  assert.ok(db.rows[0].consumedAt);
  assert.equal(results.includes('verified'), false);
  assert.equal((await reserveRecoveryChallenge('customer@example.com')).otp, null);
});

test('a correct recovery code is consumed once across parallel verification requests', async (t) => {
  const db = database(t);
  const challenge = await reserveRecoveryChallenge('customer@example.com');
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      consumeRecoveryChallenge('customer@example.com', challenge.otp!),
    ),
  );
  assert.equal(results.filter((result) => result === 'verified').length, 1);
  assert.equal(db.rows[0].attemptCount, 1);
});

test('checkout email codes cannot verify recovery or another checkout context', async (t) => {
  const db = database(t);
  const challenge = await reserveRecoveryChallenge(
    'customer@example.com',
    'browser/intent/address',
  );
  assert.ok(challenge.otp);
  assert.match(db.rows[0].otpHash, /^checkout-email:[a-f0-9]{64}:[a-f0-9]{64}$/u);
  assert.equal(await consumeRecoveryChallenge('customer@example.com', challenge.otp!), 'invalid');
  assert.equal(
    await consumeRecoveryChallenge(
      'customer@example.com',
      challenge.otp!,
      'different-browser/intent/address',
    ),
    'invalid',
  );
  assert.equal(db.rows[0].attemptCount, 0);
  assert.equal(
    await consumeRecoveryChallenge(
      'customer@example.com',
      challenge.otp!,
      'browser/intent/address',
    ),
    'verified',
  );
  assert.equal(
    await consumeRecoveryChallenge(
      'customer@example.com',
      challenge.otp!,
      'browser/intent/address',
    ),
    'invalid',
  );
});

test('checkout codes keep the email-wide resend cooldown and per-code guess budget', async (t) => {
  const db = database(t);
  const challenge = await reserveRecoveryChallenge('customer@example.com', 'checkout-one');
  const blocked = await reserveRecoveryChallenge('customer@example.com', 'checkout-two');
  assert.equal(blocked.otp, null);
  assert.equal(blocked.hasActiveChallenge, false);
  assert.equal(db.rows.length, 1);
  const results = await Promise.all(
    Array.from({ length: 12 }, () =>
      consumeRecoveryChallenge('customer@example.com', 'invalid', 'checkout-one'),
    ),
  );
  assert.equal(results.includes('verified'), false);
  assert.equal(db.rows[0].attemptCount, 5);
  assert.ok(challenge.otp);
  assert.equal(
    await consumeRecoveryChallenge('customer@example.com', challenge.otp!, 'checkout-one'),
    'invalid',
  );
});
