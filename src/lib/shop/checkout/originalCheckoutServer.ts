import 'server-only';
import { createHash } from 'node:crypto';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import type { Prisma } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import {
  moneyToMinor,
  parseCanonicalOrderSnapshotFromLedger,
} from '@/lib/paypal/orderSnapshot/canonicalize';
import type { CanonicalMoney } from '@/lib/paypal/orderSnapshot/types';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import {
  normalizeCountryToIso2,
  normalizeCountryToIso3,
} from '@/lib/utils/shop/checkout/normalizeCountryToIso3';
import { checkoutAddressHash } from './checkoutProof';
import { currencyExponent } from './orderMoney';
import type { OriginalCheckout } from './originalCheckout';
import { requireCheckoutAccess } from './serverAccess';
import { checkoutEmail, checkoutString, CheckoutRequestError, record } from './serverRequest';

const originalCheckoutSelect = {
  orderToken: true,
  userId: true,
  paypalOrderId: true,
  paypalAuthorizationId: true,
  djangoOrderIntentUuid: true,
  djangoOrderIntentOrderId: true,
  djangoOrderIntentPayload: true,
  customerName: true,
  customerEmail: true,
  countryIso2: true,
  countryIso3: true,
  shippingSnapshot: true,
  canonicalOrderSnapshot: true,
  canonicalOrderSnapshotVersion: true,
  canonicalOrderSnapshotHash: true,
  status: true,
  authorizePayload: true,
  capturePayload: true,
  lastEventType: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  receiptLink: true,
  receiptFile: true,
  djangoPaymentSaveCustomId: true,
  djangoPaymentSaveResponsePayload: true,
  merchizeFulfillmentRequestPayload: true,
  merchizeFulfillmentResponsePayload: true,
  merchizeFulfillmentProcessingId: true,
  merchizeProviderOrderId: true,
  merchizeProviderOrderCode: true,
  fulfillmentAddressOverride: true,
  fulfillmentAddressOverrideReason: true,
  fulfillmentAddressOverriddenBy: true,
  fulfillmentAddressOverriddenAt: true,
  retryCount: true,
  processingTriggerSource: true,
  processingTriggerDetail: true,
  processingTriggeredAt: true,
  processingCompletedAt: true,
  postProcessingLockId: true,
  postProcessingLockedAt: true,
  postProcessingLockExpiresAt: true,
} satisfies Prisma.PaypalIntentSelect;

export type OriginalCheckoutRow = Prisma.PaypalIntentGetPayload<{
  select: typeof originalCheckoutSelect;
}>;

const progressedFields = [
  'paypalAuthorizationId',
  'authorizePayload',
  'capturePayload',
  'lastErrorCode',
  'lastErrorMessage',
  'receiptLink',
  'receiptFile',
  'djangoPaymentSaveCustomId',
  'djangoPaymentSaveResponsePayload',
  'merchizeFulfillmentRequestPayload',
  'merchizeFulfillmentResponsePayload',
  'merchizeFulfillmentProcessingId',
  'merchizeProviderOrderId',
  'merchizeProviderOrderCode',
  'fulfillmentAddressOverride',
  'fulfillmentAddressOverrideReason',
  'fulfillmentAddressOverriddenBy',
  'fulfillmentAddressOverriddenAt',
  'processingTriggerSource',
  'processingTriggerDetail',
  'processingTriggeredAt',
  'processingCompletedAt',
  'postProcessingLockId',
  'postProcessingLockedAt',
  'postProcessingLockExpiresAt',
] as const;

function reviewRequired(): never {
  throw new CheckoutRequestError(
    'This checkout needs a payment status check before it can continue.',
    409,
    'ORIGINAL_CHECKOUT_REVIEW_REQUIRED',
  );
}

function amount(value: CanonicalMoney) {
  const minor = moneyToMinor(value);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) reviewRequired();
  const divisor = currencyExponent(value.currency) === 0 ? 1 : 100;
  const number = Number(minor) / divisor;
  if (!Number.isFinite(number) || Math.round(number * divisor) !== Number(minor)) reviewRequired();
  return number;
}

function imageUrl(value: string) {
  try {
    const url = new URL(value, 'https://checkout.invalid');
    if (value.startsWith('/media/') && !/[\\\u0000-\u001f]/u.test(value))
      return url.pathname.startsWith('/media/') ? `${url.pathname}${url.search}` : null;
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      ['d2dytk4tvgwhb4.cloudfront.net', 'mainmedia.codexchristi.org'].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** No catalog fallback: resuming payment uses only the already-created order's sealed truth. */
export function toOriginalCheckout(row: OriginalCheckoutRow): OriginalCheckout {
  try {
    if (
      row.status !== PAYPAL_LEDGER_STATUS.INTENT_CREATED ||
      row.retryCount !== 0 ||
      progressedFields.some((field) => row[field] != null) ||
      (row.lastEventType && row.lastEventType !== 'CHECKOUT.ORDER.CREATED')
    )
      reviewRequired();
    const parsed = parseCanonicalOrderSnapshotFromLedger(row);
    if (!parsed.snapshot) reviewRequired();
    const snapshot = parsed.snapshot;
    const shipping = record(row.shippingSnapshot);
    if (!shipping) reviewRequired();
    const deliveryAddress = {
      shipping_address_line_1: checkoutString(shipping.shipping_address_line_1, 500),
      shipping_address_line_2:
        shipping.shipping_address_line_2 == null || shipping.shipping_address_line_2 === ''
          ? ''
          : checkoutString(shipping.shipping_address_line_2, 500),
      shipping_city: checkoutString(shipping.shipping_city, 500),
      shipping_state: checkoutString(shipping.shipping_state, 500),
      shipping_country: checkoutString(shipping.shipping_country, 500),
      zip_code: checkoutString(shipping.zip_code, 500),
    };
    const countryIso3 = normalizeCountryToIso3(deliveryAddress.shipping_country);
    const countryCode = normalizeCountryToIso2(countryIso3);
    const region = (value: string) => value.trim().replace(/\s+/gu, ' ').toLowerCase();
    if (
      !countryCode ||
      countryIso3 !== snapshot.destination.countryIso3 ||
      (row.countryIso3 && normalizeCountryToIso3(row.countryIso3) !== countryIso3) ||
      (row.countryIso2 && normalizeCountryToIso2(row.countryIso2) !== countryCode) ||
      (snapshot.destination.region &&
        region(snapshot.destination.region) !== region(deliveryAddress.shipping_state))
    )
      reviewRequired();
    const customer = {
      name: checkoutString(row.customerName, 200),
      email: checkoutEmail(row.customerEmail),
    };
    const intentUuid = checkoutString(row.djangoOrderIntentUuid, 128);
    const orderId = checkoutString(row.djangoOrderIntentOrderId, 128);
    const proof = record(record(row.djangoOrderIntentPayload)?.proof);
    if (
      proof?.verified !== true ||
      proof.intentUuid !== intentUuid ||
      proof.orderId !== orderId ||
      proof.email !== customer.email ||
      proof.addressHash !== checkoutAddressHash(deliveryAddress)
    )
      reviewRequired();
    const orderToken = checkoutString(row.orderToken, 128);
    const paypalOrderId = checkoutString(row.paypalOrderId, 128);
    const reviewKey = createHash('sha256')
      .update(
        JSON.stringify({
          orderToken,
          paypalOrderId,
          hash: snapshot.hash,
          customer,
          deliveryAddress,
        }),
      )
      .digest('hex');
    return {
      orderToken,
      paypalOrderId,
      reviewKey,
      customer,
      deliveryAddress,
      countryCode,
      quote: {
        currency: snapshot.currency,
        subtotal: amount(snapshot.subtotal),
        shipping: amount(snapshot.shipping),
        total: amount(snapshot.total),
      },
      lines: snapshot.lines.map((line) => ({
        id: line.lineId,
        title: line.title,
        image: imageUrl(line.imageUrl),
        quantity: line.quantity,
        options: line.selectedOptions.map(({ name, value }) => `${name}: ${value}`).join(', '),
        unitAmount: line.unitAmount.value,
        lineAmount: line.lineAmount.value,
      })),
    };
  } catch {
    return reviewRequired();
  }
}

export async function getOriginalCheckout(orderToken: string) {
  const token = checkoutString(orderToken, 128);
  const row = await paypalTxLedger.paypalIntent.findUnique({
    where: { orderToken: token },
    select: originalCheckoutSelect,
  });
  if (!row)
    throw new CheckoutRequestError('This checkout could not be found.', 404, 'CHECKOUT_NOT_FOUND');
  // A GET must never claim ownership or issue a new payment grant.
  await requireCheckoutAccess(row, true);
  return toOriginalCheckout(row);
}
