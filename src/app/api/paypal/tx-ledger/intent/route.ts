import { randomUUID } from 'crypto';
import {
  checkoutInputFingerprint,
  readReviewedCheckoutQuote,
  requireMatchingReview,
} from '@/lib/shop/checkout/checkoutReview';
import { cookies } from 'next/headers';
import {
  checkoutAttemptToken,
  emailProofCookieName,
  matchesCheckoutProof,
  openCheckoutValue,
  type CheckoutEmailProof,
  CHECKOUT_BROWSER_COOKIE,
  checkoutGrantCookieName,
} from '@/lib/shop/checkout/checkoutProof';
import { grantCheckoutAccess, requireCheckoutAccess } from '@/lib/shop/checkout/serverAccess';
import {
  checkoutEmail,
  checkoutString,
  CheckoutRequestError,
  checkoutRequestFailure,
  readCheckoutBody,
} from '@/lib/shop/checkout/serverRequest';
import { parseCanonicalOrderSnapshotFromLedger } from '@/lib/paypal/orderSnapshot/canonicalize';
import type { Order } from '@paypal/paypal-server-sdk';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { createPayPalOrder } from '@/lib/paypal/createPayPalOrder';
import { paypalRouteError, paypalRouteSuccess } from '@/lib/paypal/txLedger/routeResponses';
import { getServerSessionState } from '@/lib/session/server-session';
import { refreshPaidOrderRecoveryProjectionSafely } from '@/lib/paypal/txLedger/paidOrderRecoveryProjection';
import { getCheckoutSurfaceProvenance } from '@/lib/paypal/txLedger/checkoutSurfaceProvenance';
import { CanonicalOrderResolutionError } from '@/lib/paypal/orderSnapshot/resolver';
import type { CanonicalOrderResolutionInput } from '@/lib/paypal/orderSnapshot/types';
import { resolveCanonicalOrderSnapshotFromMerchize } from '@/lib/paypal/orderSnapshot/merchizeResolver';
import { getCountrySupport } from '@/lib/datasetSearchers/shippingSupportMerchize';
import { normalizeCountryToIso3 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';
import type { ShopCheckoutStoreInterface } from '@/stores/shop_stores/checkoutStore';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasRequiredDeliveryAddress(
  value: unknown,
): value is ShopCheckoutStoreInterface['delivery_address'] {
  const address = asRecord(value);
  return Boolean(
    address &&
    nonEmptyString(address.shipping_address_line_1) &&
    nonEmptyString(address.shipping_city) &&
    nonEmptyString(address.shipping_state) &&
    nonEmptyString(address.shipping_country) &&
    nonEmptyString(address.zip_code),
  );
}

function toLedgerJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export async function POST(req: Request) {
  const requestId = randomUUID();
  let orderToken: string | undefined;
  let creationVersion: Date | undefined;
  const validationError = (code: string, message: string) =>
    paypalRouteError({
      status: 400,
      code,
      stage: 'validate_request',
      message,
      requestId,
    });

  const logRouteError = (stage: string, code: string, err: unknown) => {
    console.error(`[paypal.intent.${stage}]`, {
      requestId,
      orderToken,
      code,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  };

  const fail = async ({
    code,
    stage,
    message,
    err,
    status = 500,
    persistToLedger = true,
  }: {
    code: string;
    stage: string;
    message: string;
    err: unknown;
    status?: number;
    persistToLedger?: boolean;
  }) => {
    logRouteError(stage, code, err);

    if (persistToLedger && orderToken && creationVersion) {
      try {
        await paypalTxLedger.paypalIntent.updateMany({
          where: {
            orderToken,
            status: PAYPAL_LEDGER_STATUS.INTENT_CREATING,
            paypalOrderId: null,
            updatedAt: creationVersion,
          },
          data: {
            status: PAYPAL_LEDGER_STATUS.ERROR,
            lastErrorCode: code,
            lastErrorMessage: err instanceof Error ? err.message : String(err),
          },
        });
        await refreshPaidOrderRecoveryProjectionSafely(orderToken);
      } catch (ledgerError) {
        console.error('[paypal.intent.persist_error_failed]', {
          requestId,
          orderToken,
          code,
          error: ledgerError instanceof Error ? ledgerError.message : String(ledgerError),
        });
      }
    }

    return paypalRouteError({
      status,
      code,
      stage,
      message,
      requestId,
      orderToken,
    });
  };

  try {
    const body = await readCheckoutBody(req);
    const checkoutSurface = getCheckoutSurfaceProvenance(req);
    const { selections, customer, delivery_address, djangoOrderIntentUuid, attemptId, review } =
      body;
    const customerRecord = asRecord(customer);
    const sessionState = await getServerSessionState();
    const authenticatedUserId = sessionState.isAuthenticated ? sessionState.userID : null;

    if (!Array.isArray(selections) || selections.length === 0) {
      return validationError('INVALID_CART', 'Cart required');
    }
    if (!nonEmptyString(customerRecord?.name) || !nonEmptyString(customerRecord?.email)) {
      return validationError('INVALID_CUSTOMER', 'Customer required');
    }
    if (!hasRequiredDeliveryAddress(delivery_address)) {
      return validationError('INVALID_DELIVERY_ADDRESS', 'Delivery address required');
    }

    const email = checkoutEmail(customerRecord.email);
    const name = checkoutString(customerRecord.name, 200);
    const selector = checkoutString(djangoOrderIntentUuid, 128);
    const proof = openCheckoutValue<CheckoutEmailProof>(
      (await cookies()).get(emailProofCookieName(selector))?.value,
      'email-proof',
    );
    const browserId = openCheckoutValue<string>(
      (await cookies()).get(CHECKOUT_BROWSER_COOKIE)?.value,
      'browser',
    );
    if (
      !proof ||
      !browserId ||
      proof.browserId !== browserId ||
      !matchesCheckoutProof(proof, email, delivery_address)
    )
      throw new CheckoutRequestError(
        'Verify your email for this delivery address before paying.',
        403,
        'CHECKOUT_EMAIL_VERIFICATION_REQUIRED',
      );
    const quote = readReviewedCheckoutQuote(review);
    const requestFingerprint = checkoutInputFingerprint({
      selections,
      email,
      name,
      address: delivery_address,
      quote,
    });
    orderToken = checkoutAttemptToken(attemptId, proof);
    let existing = await paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } });
    const respond = (paypalOrderId: string) =>
      grantCheckoutAccess(
        paypalRouteSuccess({ requestId, data: { orderToken: orderToken!, paypalOrderId } }),
        req,
        {
          orderToken: orderToken!,
          userId: existing ? existing.userId : (authenticatedUserId ?? null),
        },
      );
    if (existing) {
      const savedInput = asRecord(existing.djangoOrderIntentPayload);
      if (
        savedInput?.requestFingerprint !== requestFingerprint ||
        existing.customerEmail !== email ||
        (existing.userId && existing.userId !== authenticatedUserId)
      )
        throw new CheckoutRequestError(
          'This checkout attempt belongs to different order details. Review the order again.',
          409,
          'CHECKOUT_ATTEMPT_CHANGED',
        );
      if (authenticatedUserId && (await cookies()).has(checkoutGrantCookieName(orderToken)))
        await requireCheckoutAccess(existing, true, req);
      if (existing.paypalOrderId) return respond(existing.paypalOrderId);
      if (
        existing.status === PAYPAL_LEDGER_STATUS.INTENT_CREATING &&
        existing.updatedAt.getTime() > Date.now() - 90_000
      )
        throw new CheckoutRequestError(
          'This checkout is still being prepared. Please try again shortly.',
          409,
          'CHECKOUT_ATTEMPT_PENDING',
        );
      if (
        ![PAYPAL_LEDGER_STATUS.INTENT_CREATING, PAYPAL_LEDGER_STATUS.ERROR].includes(
          existing.status as typeof PAYPAL_LEDGER_STATUS.ERROR,
        )
      )
        throw new CheckoutRequestError(
          'This checkout requires recovery. Please reopen your order.',
          409,
          'CHECKOUT_ATTEMPT_PENDING',
        );
      const claimVersion = new Date();
      const claim = await paypalTxLedger.paypalIntent.updateMany({
        where: {
          orderToken,
          updatedAt: existing.updatedAt,
          status: existing.status,
          paypalOrderId: null,
        },
        data: { status: PAYPAL_LEDGER_STATUS.INTENT_CREATING, updatedAt: claimVersion },
      });
      if (claim.count !== 1)
        throw new CheckoutRequestError(
          'This checkout is being updated. Please try again shortly.',
          409,
          'CHECKOUT_ATTEMPT_PENDING',
        );
      creationVersion = claimVersion;
    }

    const countryIso3 = normalizeCountryToIso3(delivery_address.shipping_country);
    if (!countryIso3) {
      return validationError(
        'INVALID_DESTINATION',
        'The selected shipping country could not be resolved.',
      );
    }

    // Resolve the ISO-2 address code from the same server country catalog used by checkout. This
    // validates consistency without introducing a new destination-eligibility policy (P0.3).
    const countrySupport = await getCountrySupport(countryIso3, 'merchize');
    if (!countrySupport.country?.country_iso2) {
      return validationError(
        'INVALID_DESTINATION',
        'The selected shipping country could not be resolved.',
      );
    }

    let canonicalOrderSnapshot;
    try {
      canonicalOrderSnapshot = existing
        ? parseCanonicalOrderSnapshotFromLedger(existing).snapshot
        : await resolveCanonicalOrderSnapshotFromMerchize({
            selections: selections as CanonicalOrderResolutionInput['selections'],
            destination: {
              countryIso3,
              region: delivery_address.shipping_state,
            },
          });
    } catch (resolutionError) {
      if (resolutionError instanceof CanonicalOrderResolutionError) {
        return fail({
          code: resolutionError.code,
          stage: 'resolve_canonical_order_snapshot',
          message: resolutionError.message,
          err: resolutionError,
          status: resolutionError.status,
          persistToLedger: false,
        });
      }

      return fail({
        code: 'ORDER_SNAPSHOT_RESOLUTION_FAILED',
        stage: 'resolve_canonical_order_snapshot',
        message: 'Checkout pricing or shipping could not be verified. Please try again.',
        err: resolutionError,
        status: 503,
        persistToLedger: false,
      });
    }

    if (!canonicalOrderSnapshot)
      throw new CheckoutRequestError('This checkout requires review before payment.', 409);
    requireMatchingReview(canonicalOrderSnapshot, quote);
    if (!existing)
      try {
        existing = await paypalTxLedger.paypalIntent.create({
          data: {
            orderToken,
            status: PAYPAL_LEDGER_STATUS.INTENT_CREATING,
            customerName: name,
            customerEmail: email,
            userId: authenticatedUserId,
            djangoOrderIntentUuid: proof.intentUuid,
            djangoOrderIntentOrderId: proof.orderId,
            djangoOrderIntentPayload: toLedgerJson({ proof, requestFingerprint }),
            djangoOrderIntentVerifyPayload: toLedgerJson({
              verified: true,
              intentUuid: proof.intentUuid,
              email: proof.email,
              review: {
                version: 'checkout-review-v1',
                acknowledgedAt: new Date().toISOString(),
                quote,
                requestFingerprint,
              },
            }),
            countryIso2: countrySupport.country.country_iso2,
            countryIso3,
            initialCurrency: canonicalOrderSnapshot.currency,
            // Required legacy column; new consumers use the sealed canonical snapshot instead.
            cartSnapshot: toLedgerJson(selections),
            shippingSnapshot: delivery_address,
            canonicalOrderSnapshot: toLedgerJson(canonicalOrderSnapshot),
            canonicalOrderSnapshotVersion: canonicalOrderSnapshot.version,
            canonicalOrderSnapshotHash: canonicalOrderSnapshot.hash,
            ...checkoutSurface,
          },
        });
        creationVersion = existing.updatedAt;
      } catch (createError) {
        if (
          createError &&
          typeof createError === 'object' &&
          'code' in createError &&
          createError.code === 'P2002'
        )
          throw new CheckoutRequestError(
            'This checkout is already being prepared. Please try again shortly.',
            409,
            'CHECKOUT_ATTEMPT_PENDING',
          );
        throw createError;
      }
    await refreshPaidOrderRecoveryProjectionSafely(orderToken);

    let paypalOrder: Order;
    try {
      paypalOrder = await createPayPalOrder({
        orderToken,
        canonicalOrderSnapshot,
        customer: {
          name: existing?.customerName ?? name,
          email: existing?.customerEmail ?? email,
        },
        country: existing?.countryIso2 ?? countrySupport.country.country_iso2,
        delivery_address:
          existing?.shippingSnapshot as ShopCheckoutStoreInterface['delivery_address'],
      });
    } catch (createErr) {
      return fail({
        code: 'CREATE_ORDER_FAILED',
        stage: 'create_paypal_order',
        message: 'Failed to create PayPal order',
        err: createErr,
      });
    }

    if (!paypalOrder?.id) {
      return fail({
        code: 'MISSING_PAYPAL_ORDER_ID',
        stage: 'persist_paypal_order_id',
        message: 'Missing PayPal order ID',
        err: new Error('createPayPalOrder returned no id'),
      });
    }

    try {
      const persisted = await paypalTxLedger.paypalIntent.updateMany({
        where: {
          orderToken,
          status: PAYPAL_LEDGER_STATUS.INTENT_CREATING,
          paypalOrderId: null,
          updatedAt: creationVersion,
        },
        data: {
          paypalOrderId: paypalOrder.id,
          status: PAYPAL_LEDGER_STATUS.INTENT_CREATED,
        },
      });
      if (persisted.count !== 1) {
        const latest = await paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } });
        if (latest?.paypalOrderId !== paypalOrder.id)
          throw new CheckoutRequestError(
            'This checkout is still being updated. Please try again shortly.',
            409,
            'CHECKOUT_ATTEMPT_PENDING',
          );
        existing = latest;
      }
      await refreshPaidOrderRecoveryProjectionSafely(orderToken);
    } catch (persistErr) {
      if (persistErr instanceof CheckoutRequestError) return checkoutRequestFailure(persistErr);
      return fail({
        code: 'LEDGER_UPDATE_FAILED',
        stage: 'persist_paypal_order_id',
        message: 'Failed to persist PayPal order details',
        err: persistErr,
      });
    }

    return respond(paypalOrder.id);
  } catch (err) {
    if (err instanceof CheckoutRequestError) return checkoutRequestFailure(err);
    return fail({
      code: 'INTENT_FAILED',
      stage: 'intent_route',
      message: 'Failed to create PayPal intent',
      err,
    });
  }
}
