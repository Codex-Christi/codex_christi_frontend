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

function database(t: TestContext, initial: Challenge[] = []) {
  const previous = global.__paypalTxLedger__;
  const oldSecret = process.env.CHECKOUT_RECOVERY_OTP_SECRET;
  process.env.CHECKOUT_RECOVERY_OTP_SECRET = 'recovery-test-secret';
  const rows = initial;
  let pending = Promise.resolve();
  let locks = 0;
  const tx = {
    $executeRaw: async (strings: TemplateStringsArray, key: string) => {
      assert.match(strings.join('?'), /pg_advisory_xact_lock\(hashtextextended/u);
      assert.match(key, /^checkout-recovery:/u);
      locks += 1;
      return 1;
    },
    checkoutRecoveryOtpChallenge: {
      findMany: async () =>
        rows
          .filter((row) => !row.consumedAt && row.expiresAt > new Date())
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 3),
      findFirst: async ({ where }: { where: { consumedAt?: null } }) =>
        (where.consumedAt === null
          ? await tx.checkoutRecoveryOtpChallenge.findMany()
          : [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))[0] ?? null,
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
