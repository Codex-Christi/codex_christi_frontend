import { NextResponse } from 'next/server';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { assertShopOpsMutationAllowed } from '@/lib/prisma/shop/shopOpsDataTarget';
import { isRecoveryScannerEnabled } from '@/lib/paypal/txLedger/processingPolicy';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { refreshPaidOrderRecoveryProjectionSafely } from '@/lib/paypal/txLedger/paidOrderRecoveryProjection';
import { requireCheckoutAccess } from '@/lib/shop/checkout/serverAccess';
import {
  CUSTOMER_ADDRESS_CORRECTION_ACTOR,
  CUSTOMER_ADDRESS_CORRECTION_REASON,
  CUSTOMER_ADDRESS_CORRECTION_REQUESTED,
} from '@/lib/shop/checkout/customerAddressCorrection';
import { customerUsAddressCorrectionSchema, getBuyerAddressCorrectionSetup } from '@/lib/shop/checkout/customerAddressCorrectionServer';
import { checkoutPrivateHeaders, checkoutRequestFailure, checkoutString, CheckoutRequestError, readCheckoutBody } from '@/lib/shop/checkout/serverRequest';

export async function POST(request: Request, { params }: { params: Promise<{ orderToken: string }> }) {
  try {
    const body = await readCheckoutBody(request, 2048);
    const orderToken = checkoutString((await params).orderToken, 128);
    const row = await paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } });
    if (!row) throw new CheckoutRequestError('Order not found.', 404);
    await requireCheckoutAccess(row);

    const setup = getBuyerAddressCorrectionSetup(row);
    if (setup?.state === 'checking') {
      return NextResponse.json({ state: 'checking' }, { headers: checkoutPrivateHeaders });
    }
    if (setup?.state !== 'required') {
      throw new CheckoutRequestError('This order cannot accept an address correction now.', 409);
    }
    assertShopOpsMutationAllowed();
    if (!isRecoveryScannerEnabled()) {
      throw new CheckoutRequestError('Online address corrections are unavailable right now. Please contact support.', 503);
    }

    const parsed = customerUsAddressCorrectionSchema.safeParse(body);
    if (!parsed.success) {
      throw new CheckoutRequestError('Enter a complete U.S. delivery address and confirm it before submitting.');
    }
    const address = parsed.data;
    const now = new Date();
    const saved = await paypalTxLedger.paypalIntent.updateMany({
      where: {
        orderToken,
        userId: row.userId,
        status: row.status,
        updatedAt: row.updatedAt,
        lastErrorCode: 'MERCHIZE_ADDRESS_INVALID',
        processingCompletedAt: null,
        fulfillmentAddressOverriddenAt: null,
        OR: [{ postProcessingLockExpiresAt: null }, { postProcessingLockExpiresAt: { lt: now } }],
      },
      data: {
        status: PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
        lastErrorCode: CUSTOMER_ADDRESS_CORRECTION_REQUESTED,
        lastErrorMessage: null,
        fulfillmentAddressOverriddenAt: now,
        fulfillmentAddressOverriddenBy: CUSTOMER_ADDRESS_CORRECTION_ACTOR,
        fulfillmentAddressOverrideReason: CUSTOMER_ADDRESS_CORRECTION_REASON,
        fulfillmentAddressOverride: {
          shipping_address_line_1: address.line1,
          shipping_address_line_2: address.line2,
          shipping_city: address.city,
          shipping_state: address.state,
          zip_code: address.postalCode,
          shipping_country: 'US',
        },
      },
    });
    if (saved.count !== 1) {
      throw new CheckoutRequestError('This order changed. Refresh its status before trying again.', 409);
    }
    await refreshPaidOrderRecoveryProjectionSafely(orderToken);
    return NextResponse.json({ state: 'checking' }, { status: 202, headers: checkoutPrivateHeaders });
  } catch (error) {
    return checkoutRequestFailure(error);
  }
}
