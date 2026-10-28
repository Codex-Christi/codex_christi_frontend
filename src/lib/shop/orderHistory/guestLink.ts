import 'server-only';
import { createHash } from 'node:crypto';
import { isFreshServerSession, type AuthSessionState } from '@/lib/auth/session-snapshot';
import { getServerAuthSnapshot } from '@/lib/session/server-session';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import {
  reserveRecoveryChallenge,
  consumeRecoveryChallenge,
} from '@/lib/shop/checkout/checkoutRecovery/recoveryChallenges';
import {
  checkoutEmail,
  checkoutString,
  CheckoutRequestError,
} from '@/lib/shop/checkout/serverRequest';
import { getPayPalCaptureCompletion } from '@/lib/paypal/txLedger/captureCompletion';
import { allowAuthAttempt } from '@/lib/auth/rate-limit';
import { buildRecoveryOtpEmailHtml } from '@/lib/shop/checkout/checkoutRecovery/recoveryOtpEmailTemplate';
import { assertShopOpsMutationAllowed } from '@/lib/prisma/shop/shopOpsDataTarget';

type GuestRow = {
  orderToken: string;
  userId: string | null;
  customerEmail: string;
  capturePayload: unknown;
};
type Dependencies = {
  session: () => Promise<AuthSessionState>;
  reserve: typeof reserveRecoveryChallenge;
  consume: typeof consumeRecoveryChallenge;
  send: (email: string, otp: string) => Promise<void>;
  find: (reference: string, email: string) => Promise<GuestRow[]>;
  claim: (token: string, email: string, owner: string) => Promise<number>;
};

export function createGuestOrderLinker(deps: Dependencies) {
  return async (input: Record<string, unknown>) => {
    const session = await deps.session();
    if (!isFreshServerSession(session))
      throw new CheckoutRequestError('Sign in to link a guest order.', 401);
    const owner = session.user_id!;
    const email = checkoutEmail(input.email);
    const reference = checkoutString(input.reference, 128);
    if (!/^[A-Za-z0-9_-]+$/u.test(reference))
      throw new CheckoutRequestError('Enter the order reference from your confirmation.');
    const scope = `account-order-link:${createHash('sha256')
      .update(JSON.stringify([owner, email, reference]))
      .digest('hex')}`;
    if (input.action === 'start') {
      if (!allowAuthAttempt('account-order-link-send', owner, 5, 10 * 60_000))
        throw new CheckoutRequestError('Please wait before requesting another code.', 429);
      const challenge = await deps.reserve(email, scope);
      if (!challenge.otp && !challenge.hasActiveChallenge)
        throw new CheckoutRequestError(
          'Please wait a minute before requesting a code for these details.',
          429,
        );
      if (challenge.otp) {
        try {
          await deps.send(email, challenge.otp);
        } catch (error) {
          await deps.consume(email, challenge.otp, scope);
          throw error;
        }
      }
      // No order lookup or ownership disclosure before email verification.
      return {
        ok: true,
        message: challenge.otp
          ? 'A verification code was sent to your checkout email.'
          : 'Use your latest verification code or wait before requesting another.',
        retryAfter: Math.max(1, challenge.cooldown),
      };
    }
    if (input.action !== 'verify')
      throw new CheckoutRequestError('Choose a valid order-link action.');
    const code = checkoutString(input.code, 6);
    if (!/^\d{6}$/u.test(code) || (await deps.consume(email, code, scope)) !== 'verified')
      throw new CheckoutRequestError('The code is incorrect or expired. Request a new code.');
    const latest = await deps.session();
    if (!isFreshServerSession(latest) || latest.user_id !== owner)
      throw new CheckoutRequestError('Your account changed. Sign in and request a new code.', 401);
    const rows = await deps.find(reference, email);
    const row = rows.length === 1 ? rows[0] : null;
    if (
      !row ||
      row.customerEmail.trim().toLowerCase() !== email ||
      !getPayPalCaptureCompletion(row.capturePayload).ok ||
      (row.userId !== null && row.userId !== owner)
    ) {
      throw new CheckoutRequestError(
        'A linkable paid guest order could not be verified with those details. Check your reference or contact support.',
      );
    }
    if (row.userId === null && (await deps.claim(row.orderToken, email, owner)) !== 1)
      throw new CheckoutRequestError(
        'This order could not be linked. Refresh your orders or contact support.',
        409,
      );
    // Ownership only: no checkout grants, cart cleanup, payment, or fulfillment side effects.
    return { ok: true, orderToken: row.orderToken, message: 'Guest order linked to your account.' };
  };
}

export const linkGuestOrder = createGuestOrderLinker({
  session: getServerAuthSnapshot,
  reserve: (...args) => {
    assertShopOpsMutationAllowed();
    return reserveRecoveryChallenge(...args);
  },
  consume: (...args) => {
    assertShopOpsMutationAllowed();
    return consumeRecoveryChallenge(...args);
  },
  send: async (email, otp) => {
    const { sendMailFromPrimaryAgent } = await import('@/lib/zeptomail/sendMailFromPrimaryAgent');
    await sendMailFromPrimaryAgent({
      emailReceipents: [{ email_address: { address: email, name: 'Customer' } }],
      subject: 'Link your Codex Christi guest order',
      htmlbody: buildRecoveryOtpEmailHtml({ otp, purpose: 'order-link' }),
    });
  },
  find: (reference, email) =>
    paypalTxLedger.paypalIntent.findMany({
      where: {
        customerEmail: { equals: email, mode: 'insensitive' },
        OR: [{ orderToken: reference }, { djangoOrderIntentOrderId: reference }],
      },
      take: 2,
      select: { orderToken: true, userId: true, customerEmail: true, capturePayload: true },
    }),
  claim: async (orderToken, email, userId) => {
    assertShopOpsMutationAllowed();
    return (
      await paypalTxLedger.paypalIntent.updateMany({
        where: { orderToken, userId: null, customerEmail: { equals: email, mode: 'insensitive' } },
        data: { userId },
      })
    ).count;
  },
});
