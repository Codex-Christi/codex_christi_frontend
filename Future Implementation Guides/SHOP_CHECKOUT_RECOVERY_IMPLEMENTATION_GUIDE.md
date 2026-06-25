# Shop Checkout Recovery Implementation Guide

Last updated: 2026-06-25

This guide summarizes the customer-side checkout recovery architecture around Django order-intent OTP, Next.js-owned paid checkout recovery OTP, and the PayPal transaction ledger.

It replaces the older chat-handoff naming and should be treated as the portable implementation reference for continuing this work in another thread or by another engineer.

## Current Problem Area

The checkout flow uses two different systems:

- Django backend order intent / OTP flow for email and order-intent verification.
- Next.js / Prisma PayPal transaction ledger for PayPal capture, receipt upload, Django payment save, and Merchize fulfillment processing.

A real edge case occurred where PayPal captured payment, but webhook/post-processing failed. The failed ledger row reached `payment_saved`, had `lastEventType = payment.capture.completed`, and stored `lastErrorCode = POST_PROCESSING_FAILED`.

The customer-facing problem:

- Customer payment may already be received.
- Fulfillment may be paused.
- Customer may revisit checkout and accidentally place another order.
- Confirmation page must not spin forever.
- Admin needs tools to recover the transaction.

## Important Naming Decisions

Use Django-specific names for the external Django backend identifiers:

- `djangoOrderIntentUuid`
- `djangoOrderIntentOrderId`
- `djangoOrderIntentPayload`
- `djangoOrderIntentVerifyPayload`
- `djangoPaymentSaveCustomId`
- `djangoPaymentSaveResponsePayload`

Use Merchize-specific names for fulfillment:

- `merchizeFulfillmentRequestPayload`
- `merchizeFulfillmentResponsePayload`
- `merchizeFulfillmentProcessingId`
- `merchizeProviderOrderId`
- `merchizeProviderOrderCode`

## Existing PayPal Ledger Schema

Schema file:

```txt
prisma/shop/paypal/paypalTXLedger.schema.prisma
```

Generated client:

```txt
src/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger
```

Runtime Prisma singleton:

```txt
src/lib/prisma/shop/paypal/paypalTxLedger.ts
```

Note: `paypalTxLedger.ts` imports `server-only`, so standalone `tsx` scripts should not import it directly. Standalone scripts should import the generated Prisma client and create their own adapter.

## Prisma Commands

Dev generate:

```bash
yarn prisma:paypalTxLedger:generate:dev
```

Dev migration:

```bash
yarn prisma:paypalTxLedger:migrate:dev
```

Prod migration deploy:

```bash
yarn prisma:paypalTxLedger:migrate:deploy:prod
```

Manual validation:

```bash
PAYPAL_TX_LEDGER_NEON_BRANCH=dev npx prisma validate --schema prisma/shop/paypal/paypalTXLedger.schema.prisma
```

Format:

```bash
npx prisma format --schema prisma/shop/paypal/paypalTXLedger.schema.prisma
```

## Checkout Recovery OTP Plan

Reason:

Django OTP is tied to Django order intent creation/resumption, so it should not be used to prove ownership of a potentially unresolved paid Prisma ledger row before creating a new Django intent.

Use a separate Next.js-owned recovery OTP.

Recommended model:

```prisma
model CheckoutRecoveryOtpChallenge {
  id           String    @id @default(cuid())
  email        String
  otpHash      String
  expiresAt    DateTime
  consumedAt   DateTime?
  attemptCount Int       @default(0)
  createdAt    DateTime  @default(now())

  @@index([email, expiresAt])
  @@index([consumedAt])
  @@index([createdAt])
}
```

Important lesson:

- The raw OTP is emailed to the customer.
- Only `otpHash` is stored in the DB.
- `expiresAt` is created with `Date.now() + 10 * 60_000`.
- Verification uses `expiresAt: { gt: new Date() }` to accept only unexpired rows.
- `consumedAt` prevents reuse.

## Paid Checkout Recovery OTP Helper Files

Current helper files:

```txt
src/lib/shop/checkout/checkoutRecovery/recoveryOtpUtils.ts
src/lib/shop/checkout/checkoutRecovery/recoveryOtpEmailTemplate.ts
src/lib/shop/checkout/checkoutRecovery/findUnresolvedPaidCheckouts.ts
src/lib/shop/checkout/checkoutRecovery/mapRecoveryCheckoutSummary.ts
```

Route files:

```txt
src/app/api/shop/checkout/recovery/start/route.ts
src/app/api/shop/checkout/recovery/verify/route.ts
```

Client route paths should follow the current app convention:

```txt
/next-api/shop/checkout/recovery/start
/next-api/shop/checkout/recovery/verify
```

## Recovery Flow

1. User enters checkout email.
2. Next server checks Prisma ledger for unresolved paid rows.
3. If none, continue normal Django intent creation.
4. If found, pause Django intent creation.
5. Send Next-owned recovery OTP.
6. Verify OTP.
7. After verification, show safe unresolved checkout summary.
8. Tell customer not to place another order for the same purchase.

Unresolved paid rows are roughly:

```ts
status in ['captured', 'receipt_uploaded', 'payment_saved', 'error']
processingCompletedAt: null
capturePayload exists
```

## Current Django OTP Frontend Guard

The Django order-intent OTP flow is still owned by the Django backend. The frontend cannot force Django to accept a code once Django has marked the matching order intent or OTP state invalid, expired, consumed, or otherwise inconsistent.

Current frontend safeguards:

- `BasicCheckoutInfo` runs the paid checkout recovery scan before creating a Django order intent.
- If unresolved paid ledger rows exist, Django intent creation is paused and the Next.js-owned checkout recovery OTP flow is shown.
- If no paid recovery case exists, the frontend checks for a recent locally persisted verified Django order intent for the same email before calling `/orders/intent` again.
- The local verified Django intent reuse window is intentionally short: 15 minutes.
- The local reuse guard is browser-scoped and encrypted in the existing checkout intent store. It is a UX guard, not a replacement for backend idempotency.
- Stale SWR mutation errors from a previous failed OTP verification no longer block the next verification attempt.
- The Django OTP modal clears the entered digits after submit, close, and failed verification paths so a previous OTP is not preserved visually.
- If Django create returns `otp_status: "expired"`, the UI opens the OTP modal with explicit guidance to use Resend instead of showing a generic success message.

Relevant files:

```txt
src/components/UI/Shop/Checkout/UserCheckoutSummary/BasicCheckoutInfo.tsx
src/components/UI/Shop/Checkout/UserCheckoutSummary/basicCheckoutInfoHelpers.ts
src/components/UI/Shop/Checkout/UserCheckoutSummary/DjangoOrderIntentOtpController.tsx
src/components/UI/Shop/Checkout/UserCheckoutSummary/DjangoOrderIntentOtpModal.tsx
src/lib/hooks/shopHooks/checkout/useDjangoOrderIntentEmailVerification.ts
src/stores/shop_stores/checkoutStore/djangoOrderIntentStore.ts
```

### Known Django Backend Contract Gap

Observed behavior:

- A Django order intent can remain persistent after OTP verification.
- Later attempts for the same email/order-intent family can return invalid or expired OTP even when the newly delivered OTP appears to still be within its validity window.
- Waiting for the apparent OTP window may not reliably create a clean customer-facing retry path.

Frontend workaround:

- Reuse a recent locally verified Django order intent for the same email when available.
- Keep the user in the OTP modal on failed verification and clear the digits.
- Guide the user toward Resend when Django reports an expired state.

Backend behavior that should eventually be implemented by Django:

- Provide a deterministic current-intent lookup for an email/order-intent checkout session.
- Return a machine-readable reason when a code is rejected, for example `otp_expired`, `otp_consumed`, `intent_completed`, `intent_locked`, or `intent_not_found`.
- Make resend attach to the exact active intent returned to the frontend, not only to the email.
- If a completed intent can be reused for payment, expose that explicitly with a stable `otp_status: "verified"` response and the correct `order_id`.
- If a completed intent cannot be reused, provide a backend-supported reset/supersede endpoint instead of leaving the frontend to wait for an implicit timeout.
- Include the OTP validity and resend cooldown in every create/resend/verify response so the UI can show accurate state.

Until that backend contract exists, the frontend must treat Django OTP as a fragile pre-payment dependency and keep the paid checkout recovery OTP separate.

## Zepto Mail Helper

Current file:

```txt
src/lib/zeptomail/sendMailFromPrimaryAgent.ts
```

The helper should stay async and should return the provider response or throw. It should not silently log and swallow errors, because OTP routes must know whether email sending succeeded.

Logo for email template:

```txt
public/media/img/general/logo-glow-tiny.jpg
```

Public URL:

```txt
https://codexchristi.org/media/img/general/logo-glow-tiny.jpg
```

Prefer hosted HTTPS image URLs in email. Base64 inline images are often blocked or stripped by mail clients.

## Confirmation Page Fixes

Confirmation page should not poll forever:

- If ledger status endpoint returns `404`, show terminal "payment status unavailable".
- If status response includes `error.message`, map it to terminal error state.
- Status endpoint should return effective `status: "error"` when `lastErrorMessage` exists, even if stored DB status is still `payment_saved`.

Relevant files:

```txt
src/app/shop/checkout/confirmation/[orderToken]/page.tsx
src/lib/paypal/txLedger/mapLedgerToProcessingState.ts
src/app/api/paypal/tx-ledger/payments/[orderToken]/status/route.ts
```

## Receipt Fix

Receipt generation originally depended only on PayPal authorization payload line items. If PayPal did not echo item-level data, the receipt had totals but no item rows.

Fix direction:

- Pass `cartSnapshot` from ledger into receipt generation.
- Use cart snapshot as fallback line items when PayPal payload lacks items.

Relevant files:

```txt
src/lib/paypal/txLedger/runPaidFulfillmentProcessing.ts
src/actions/shop/paypal/processAndUploadCompletedTx/savePaymentReceiptToCloud.ts
src/actions/shop/paypal/createShopInvoicePDF.ts
```

Already-uploaded bad receipts will not self-repair unless an admin action regenerates them.

## Admin Dashboard Scope

Admin route concept:

```txt
/admin/shop/paypal-merchize-ledger
```

Core capabilities:

- Search ledger by email, order token, PayPal order ID, Django intent identifiers, Django payment save custom ID.
- Filter by statuses: `captured`, `receipt_uploaded`, `payment_saved`, `error`, `completed`, `refunded`.
- Link out from a broader admin dashboard hub alongside other shop tools, including Merchize catalog refresh.
- View transaction detail:
  - cart snapshot
  - shipping snapshot
  - receipt
  - Django response
  - Merchize request/response
  - webhook/error metadata
- Retry post-processing.
- Retry Merchize fulfillment only.
- Regenerate receipt.
- Save fulfillment address override before retry.
- Clear stale post-processing lock.
- Mark manually resolved.
- Send customer update/support email.
- Show related checkout recovery OTP activity for the customer email.
- Clear expired checkout recovery OTP challenges.
- Show the same customer-safe recovery summary shown in checkout:
  - paid amount when capture payload includes it
  - placed date
  - cart item summary
  - shipping region
  - current processing step
  - support reference
- Support a customer acknowledgement/update path for "keep me updated" events, so support can see when a customer chose not to place another order.
- Clear expired checkout recovery OTPs as a maintenance action.
- Optional future UX refinement: compare a compact current-cart fingerprint against unresolved ledger `cartSnapshot` rows after email ownership is verified. Use it to label the case as same cart, different cart, or unknown cart. This is not a blocker; it should change copy/severity only, not hide the warning that a paid checkout is still unresolved.

Maintenance action:

```ts
await paypalTxLedger.checkoutRecoveryOtpChallenge.deleteMany({
  where: {
    expiresAt: {
      lt: new Date(),
    },
  },
});
```

Safer variant keeps recently expired rows for debugging:

```ts
await paypalTxLedger.checkoutRecoveryOtpChallenge.deleteMany({
  where: {
    expiresAt: {
      lt: new Date(Date.now() - 24 * 60 * 60_000),
    },
  },
});
```

## Known Learning Notes

`status: { in: [...UNRESOLVED_PAID_STATUSES] }`

Means SQL-like:

```sql
WHERE status IN (...)
```

`take: 3`

Means return at most three rows, usually paired with:

```ts
orderBy: { createdAt: 'desc' }
```

`expiresAt: { gt: new Date() }`

Means only accept OTP rows whose expiry time is still in the future.

## Next Recommended Implementation Step

If resuming this thread:

1. Ensure `CheckoutRecoveryOtpChallenge` has `createdAt`.
2. Run dev migration and generate.
3. Implement or inspect:
   - `recoveryOtpUtils.ts`
   - `recoveryOtpEmailTemplate.ts`
   - `findUnresolvedPaidCheckouts.ts`
   - `mapRecoveryCheckoutSummary.ts`
4. Implement `start/route.ts`.
5. Implement `verify/route.ts`.
6. Add checkout UI interception before Django intent creation.
7. Build admin ledger dashboard and retry operations.
