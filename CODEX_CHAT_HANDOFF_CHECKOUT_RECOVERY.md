# Codex Chat Handoff: PayPal Ledger, Django Intent, Checkout Recovery OTP

Date: 2026-05-31

This file summarizes the working context from the Codex chat so the thread can be resumed on another machine without relying on the original conversation.

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

## Recovery OTP Helper Files

Suggested helper files:

```txt
src/lib/shop/checkoutRecovery/recoveryOtpUtils.ts
src/lib/shop/checkoutRecovery/recoveryOtpEmailTemplate.ts
src/lib/shop/checkoutRecovery/findUnresolvedPaidCheckouts.ts
src/lib/shop/checkoutRecovery/mapRecoveryCheckoutSummary.ts
```

Route files:

```txt
src/app/api/checkout/recovery/start/route.ts
src/app/api/checkout/recovery/verify/route.ts
```

Client route paths should follow the current app convention:

```txt
/next-api/checkout/recovery/start
/next-api/checkout/recovery/verify
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
src/lib/paypal/txLedger/runPostProcessing.ts
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
- Clear expired checkout recovery OTPs as a maintenance action.

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
