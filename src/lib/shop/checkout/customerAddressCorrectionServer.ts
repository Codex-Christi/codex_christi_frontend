import 'server-only';

import { z } from 'zod';
import { normalizeUsState } from '@/lib/shop/address/usStates';
import { getMerchizeBuyerAddressExpectationFromLedger } from '@/lib/merchizeFulfillmentOps/addressCorrectionVerification';
import { getDjangoHandoffReview } from '@/lib/paypal/txLedger/djangoHandoff';
import { isAcceptedDjangoFulfillmentProcessResponse } from '@/lib/paypal/txLedger/fulfillmentProcessResponse';
import { extractMerchizeExternalOrderNumberFromDjangoProcessResponse } from '@/lib/merchizeFulfillmentOps/merchizeMapper';
import { getMerchizeFulfillmentRetryEligibility } from '@/lib/paypal/txLedger/fulfillmentRetryPolicy';
import { getCanonicalPaymentProjectionState } from '@/lib/paypal/txLedger/canonicalPaymentProjectionState';
import { customerAddressCorrectionState } from './customerAddressCorrection';

const addressField = (limit: number) => z.string().trim().max(limit).regex(/^[^\u0000-\u001f\u007f]*$/u);

export const customerUsAddressCorrectionSchema = z.strictObject({
  line1: addressField(200).min(1),
  line2: addressField(200).optional().default(''),
  city: addressField(80).min(1),
  state: addressField(50).transform((value, ctx) => {
    const code = normalizeUsState(value);
    if (code) return code;
    ctx.addIssue({ code: 'custom', message: 'Choose a U.S. state or territory.' });
    return z.NEVER;
  }),
  postalCode: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/u),
  confirmed: z.literal(true),
});

export function getBuyerAddressCorrectionSetup(row: Parameters<typeof getCanonicalPaymentProjectionState>[0] &
  Parameters<typeof getDjangoHandoffReview>[0] &
  Parameters<typeof customerAddressCorrectionState>[0] & {
    processingCompletedAt: Date | null;
    receiptLink: string | null;
    receiptFile: string | null;
    fulfillmentAddressOverride: unknown;
  }, payment = getCanonicalPaymentProjectionState(row)) {
  if (!payment.paymentSafeForPostProcessing || row.processingCompletedAt || getDjangoHandoffReview(row)) return null;
  const state = customerAddressCorrectionState(row);
  if (!state) return null;
  const address = getMerchizeBuyerAddressExpectationFromLedger(
    row.fulfillmentAddressOverride ?? row.shippingSnapshot,
  );
  if (address?.country_code !== 'US') return null;
  const externalNumber = isAcceptedDjangoFulfillmentProcessResponse(row.merchizeFulfillmentResponsePayload)
    ? extractMerchizeExternalOrderNumberFromDjangoProcessResponse(row.merchizeFulfillmentResponsePayload, row.djangoOrderIntentOrderId)
    : null;
  if (!getMerchizeFulfillmentRetryEligibility({
    captureComplete: payment.captureCompletion.ok,
    hasAcceptedDjangoFulfillmentHandoff: Boolean(externalNumber),
    hasDjangoPaymentSaveCustomId: Boolean(row.djangoPaymentSaveCustomId),
    hasMerchizeExternalOrderNumber: Boolean(externalNumber),
    hasPersistedReceipt: Boolean(row.receiptLink && row.receiptFile),
  }).eligible) return null;
  return { state, externalNumber };
}
