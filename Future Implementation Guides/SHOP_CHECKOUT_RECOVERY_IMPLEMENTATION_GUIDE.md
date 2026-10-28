# Shop Checkout Recovery Implementation Guide

Last updated: 2026-10-27

This guide summarizes the customer-side checkout recovery architecture around Django order-intent OTP, Next.js-owned paid checkout recovery OTP, and the PayPal transaction ledger.

It replaces the older chat-handoff naming and should be treated as the portable implementation reference for continuing this work in another thread or by another engineer.

Release sequencing:

- `SHOP_ALPHA_ORDER_FLOW_RELEASE_GUIDE.md` is canonical for public-alpha priority, secure
  confirmation access, customer milestones, policy acknowledgement, and E2E release gates.
- This guide remains the detailed reference for Django order-intent OTP and paid-checkout recovery
  OTP.
- The older "Next Recommended Implementation Step" near the end is historical domain context and
  does not override the canonical release plan.

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

## Imminent Checkout Address And Contact Recovery Work

The authoritative implementation order is documented in
`MERCHIZE_FULFILLMENT_OPS_GUIDE.md`, under **Imminent Next Implementation: Address Intervention And
Lifecycle Hardening**.

Checkout/recovery ownership in that phase:

- Move the address-responsibility notice before PayPal controls and require explicit confirmation of
  the rendered delivery address before payment can begin.
- Persist the policy version, acceptance timestamp, checkout surface, and a PII-safe fingerprint of
  the acknowledged address on the server-owned paid-order record.
- Add an OTP-protected customer action path for an explicit Merchize invalid-address result or a
  verified provider/ledger address mismatch.
- Do not expose raw provider messages or promise that an address is deliverable. Merchize automated
  validation is US-only; non-US `other` / `others` means not provider-validated.
- Keep the original verified checkout/payment email immutable. A later
  `fulfillmentContactEmailOverride` is a separately verified operational contact for future
  fulfillment messages.
- A customer-submitted correction may resume automatically only after provider read-back matches and
  Merchize returns `valid`. A still-invalid address that the customer confirms requires
  master-admin `mark-valid-address` and release.
- Never replay PayPal capture, receipt upload, Django payment save, or accepted Django catalog import
  from the customer correction path.

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

This initial plan describes explicit recovery of a protected order. It is not a prerequisite for every new purchase; the current flow below takes precedence.

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

## Explicit Protected-Order Recovery

When a customer cannot open a protected confirmation, they can request a recovery code for the
checkout email. The start route sends the same response whether an order exists or not. After
successful verification, the server returns safe order summaries and grants read-only status
access. This flow does not require or authorize another payment.

For earlier-order review during a new checkout, the ledger lookup scans unresolved payment and
fulfillment states, verifies completed capture evidence, and returns at most three paid orders.
Pagination prevents newer unsuccessful attempts from hiding an older paid purchase. Access policy
is applied before any summary is returned.

## Current Checkout Verification And Earlier-Order Review

Django endpoints remain unchanged. Next.js owns the trusted browser proof and customer recovery decisions.

- Contact submission calls recovery `start` with `mode: "review"`. This does not send email or disclose whether an unverified email has orders. The server returns summaries only for the signed-in owner, a valid read-only checkout grant, or a verified browser/account-bound email proof.
- An authorized customer sees the earlier paid order's amount, date, items, and reference immediately. **View earlier order** opens `/shop/checkout/confirmation/{orderToken}?view=details`; this view never claims a checkout, consumes cart items, or clears the current draft.
- **Start a separate purchase** is an explicit acknowledgement of another purchase/payment, scoped to the current account, cart, contact details, and reviewed paid-order set. Only a matching reviewed paid attempt can be cleared; uncertain or unrelated attempts remain protected.
- Guests continue normal checkout email verification. After verification, the same trusted proof authorizes earlier-order review without a second recovery OTP. Local cached recovery summaries are not an authorization source.
- Obsolete recovery-summary and email-only verification stores have been removed. Session and purchase cleanup delete their legacy browser records while preserving current checkout state as appropriate.
- Django supplies the current intent UUID, order ID, and address. A create response reporting `verified` is reusable only with matching current HttpOnly proof. Otherwise Next.js sends its own checkout verification code; it does not treat knowledge of an email address as verification.
- Next-owned checkout codes use scoped HMAC hashes in the existing `CheckoutRecoveryOtpChallenge` table. The scope includes browser, account context, intent UUID, order ID, email, and address. Recovery codes and checkout codes cannot verify each other. Email send limits, five-attempt budgets, single-use consumption, and transaction locks remain enforced; no migration is required.
- Verify/resend requests to the Next.js proxy include `intentUuid`. Only the existing supported fields are forwarded to Django. Both Django and Next-owned verification must match the sealed pending proof before a trusted verified proof is issued.
- Guest proof can follow sign-in and then binds to that account. Account-issued proof cannot be reused after logout or by a different account. Reusing an already bound verified proof does not slide its expiry.
- Review and OTP callbacks are fenced against closing, unmounting, account changes, changed drafts, and replaced requests. A failed continuation stays recoverable rather than silently advancing to payment.
- Email entry uses an accessible single code field and an explicit Verify button. The glass matches the cart, and the verification drawer tracks visual viewport height for mobile keyboards.
- PayPal attempt identity, immutable order snapshots, authorization/capture reconciliation, and idempotent purchase consumption remain independent of this UX review.

Primary files:

```txt
src/components/UI/Shop/Checkout/UserCheckoutSummary/BasicCheckoutInfo.tsx
src/components/UI/Shop/Checkout/UserCheckoutSummary/PaidCheckoutRecoveryModal.tsx
src/lib/shop/checkout/checkoutRecovery/reviewPolicy.ts
src/lib/shop/checkout/djangoOrderIntent/djangoOrderIntentServer.ts
src/lib/shop/checkout/djangoOrderIntent/checkoutEmailVerification.ts
src/lib/shop/checkout/checkoutProof.ts
src/lib/shop/checkout/serverEmailProofCookies.ts
```

### Known Django Backend Contract Gap

Observed behavior:

- A Django order intent can remain persistent after OTP verification.
- Later attempts for the same email/order-intent family can return invalid or expired OTP even when the newly delivered OTP appears to still be within its validity window.
- Waiting for the apparent OTP window may not reliably create a clean customer-facing retry path.

Next.js adaptation:

- Reuse only a matching trusted server proof, never a local verification flag alone.
- For a reused Django intent already marked verified, establish fresh email ownership through a scoped Next-owned code when no current proof exists.
- Pending/expired Django intents still use their existing verification and resend endpoints. Upstream errors remain visible and do not authorize payment.

Backend behavior that should eventually be implemented by Django:

- Provide a deterministic current-intent lookup for an email/order-intent checkout session.
- Return a machine-readable reason when a code is rejected, for example `otp_expired`, `otp_consumed`, `intent_completed`, `intent_locked`, or `intent_not_found`.
- Make resend attach to the exact active intent returned to the frontend, not only to the email.
- If a completed intent can be reused for payment, expose that explicitly with a stable `otp_status: "verified"` response and the correct `order_id`.
- If a completed intent cannot be reused, provide a backend-supported reset/supersede endpoint instead of leaving the frontend to wait for an implicit timeout.
- Include the OTP validity and resend cooldown in every create/resend/verify response so the UI can show accurate state.

Django still owns its pending-intent OTP lifecycle. Next.js now separates explicit protected-order recovery from normal checkout verification, and can safely verify ownership of an already-verified reused intent without changing Django.

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

P0.2 supersedes the earlier general cart fallback direction:

- New rows generate receipt lines and merchandise/shipping totals only from the validated canonical
  order snapshot.
- Admin receipt regeneration first requires completed PayPal capture evidence and an exact
  authorization-plus-capture match to that snapshot.
- Use `cartSnapshot` only for a pre-P0.2 row whose canonical snapshot/version/hash fields are all
  null. Partial, corrupt, or mismatched canonical metadata must fail closed.
- A display labeled paid amount uses the actual completed PayPal capture. The canonical total is the
  expected order value and must not be shown as paid when the two differ.

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
  - paid amount from actual completed PayPal capture evidence; canonical data supplies expected
    items/destination, and a mismatch shows review-safe copy and blocks fulfillment/retry
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

Historical checkout-recovery sequence, retained for reference. For current work, start with
`SHOP_ALPHA_ORDER_FLOW_RELEASE_GUIDE.md`.

If maintaining the existing recovery implementation:

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
