import { z } from 'zod';

const reference = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => value === value.trim())
  .regex(/^[^\u0000-\u001f\u007f]+$/u);
const responseSchema = z.looseObject({
  status: z.union([z.literal(200), z.literal(201)]),
  success: z.literal(true),
  message: z.string().optional(),
  data: z.looseObject({
    id: z.uuid(),
    custom_id: reference,
    recipient_email: z.email().max(254),
    user: z.uuid().nullable().optional(),
    order_intent_order_id: reference.nullable().optional(),
    captured_order_paypal_id: reference.nullable().optional(),
  }),
});

type PaymentSaveResponse = z.infer<typeof responseSchema>;

export class InvalidPaymentSaveResponseError extends Error {
  readonly code = 'INVALID_DJANGO_PAYMENT_SAVE_RESPONSE';

  constructor() {
    super('The payment-save response could not be verified. The paid order requires review.');
    this.name = 'InvalidPaymentSaveResponseError';
  }
}

export function parsePaymentSaveResponse(
  value: unknown,
  expected: { recipientEmail?: string | null; paypalOrderId?: string; orderId?: string } = {},
): PaymentSaveResponse {
  const result = responseSchema.safeParse(value);
  if (!result.success) throw new InvalidPaymentSaveResponseError();
  const { data } = result.data;
  if (
    (expected.recipientEmail &&
      data.recipient_email.toLowerCase() !== expected.recipientEmail.trim().toLowerCase()) ||
    (expected.paypalOrderId &&
      data.captured_order_paypal_id &&
      data.captured_order_paypal_id !== expected.paypalOrderId) ||
    (expected.orderId &&
      data.order_intent_order_id &&
      data.order_intent_order_id !== expected.orderId)
  )
    throw new InvalidPaymentSaveResponseError();
  // custom_id belongs to Django's payment namespace; do not assume it equals our orderToken.
  return result.data;
}
