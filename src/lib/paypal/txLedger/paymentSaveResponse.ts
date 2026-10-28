import { z } from 'zod';
import { DjangoOrderError, djangoReference as reference } from './djangoOrderContract';
import { reconcilePayPalMoney } from './payPalMoneyReconciliation';

const responseSchema = z.looseObject({
  status: z.union([z.literal(200), z.literal(201)]),
  success: z.literal(true),
  message: z.string().optional(),
  data: z.looseObject({
    id: z.uuid(),
    custom_id: reference,
    recipient_email: z.email().max(254),
    user: z.uuid().nullable().optional(),
    order_intent_id: reference.nullable().optional(),
    order_intent_order_id: reference.nullable().optional(),
    payment_auth_id: reference.nullable().optional(),
    captured_order_paypal_id: reference.nullable().optional(),
    amount_received: z.string().max(50).nullable().optional(),
  }),
});

type PaymentSaveResponse = z.infer<typeof responseSchema>;

export class InvalidPaymentSaveResponseError extends DjangoOrderError {
  readonly code = 'INVALID_DJANGO_PAYMENT_SAVE_RESPONSE';

  constructor(responsePayload?: unknown) {
    super({
      code: 'INVALID_DJANGO_PAYMENT_SAVE_RESPONSE',
      message: 'The payment-save response could not be verified. The paid order requires review.',
      outcome: 'uncertain',
      responsePayload,
    });
    this.name = 'InvalidPaymentSaveResponseError';
  }
}

export function parsePaymentSaveResponse(
  value: unknown,
  expected: {
    recipientEmail?: string | null;
    paypalOrderId?: string;
    orderId?: string;
    intentUuid?: string | null;
    userId?: string | null;
    paymentAuthId?: string;
    amountReceived?: string | null;
  } = {},
): PaymentSaveResponse {
  const result = responseSchema.safeParse(value);
  if (!result.success) throw new InvalidPaymentSaveResponseError(value);
  const { data } = result.data;
  if (
    (expected.recipientEmail &&
      data.recipient_email.toLowerCase() !== expected.recipientEmail.trim().toLowerCase()) ||
    (expected.paypalOrderId &&
      data.captured_order_paypal_id &&
      data.captured_order_paypal_id !== expected.paypalOrderId) ||
    (expected.orderId &&
      data.order_intent_order_id &&
      data.order_intent_order_id !== expected.orderId) ||
    (expected.intentUuid && data.order_intent_id && data.order_intent_id !== expected.intentUuid) ||
    (expected.userId !== undefined && data.user != null && data.user !== expected.userId) ||
    (expected.paymentAuthId &&
      data.payment_auth_id &&
      data.payment_auth_id !== expected.paymentAuthId) ||
    !echoedAmountMatches(expected.amountReceived, data.amount_received)
  )
    throw new InvalidPaymentSaveResponseError(value);
  // custom_id belongs to Django's payment namespace; do not assume it equals our orderToken.
  return result.data;
}

function echoedAmountMatches(expected?: string | null, actual?: string | null) {
  if (!expected || actual == null) return true;
  const parse = (value: string) => {
    const match = /^(\d+(?:\.\d+)?)\s+([A-Z]{3})$/u.exec(value.trim());
    return match ? { value: match[1], currency: match[2] } : null;
  };
  const expectedMoney = parse(expected);
  const actualMoney = parse(actual);
  // Django only documents a string. Compare known currency-bearing echoes without
  // inventing a requirement for other formats or treating Django as capture authority.
  return !expectedMoney || !actualMoney || reconcilePayPalMoney(expectedMoney, actualMoney).ok;
}
