# PayPal TX Ledger Deferred Fixes

Purpose:
This file stores previously found issues so we can fix them in a controlled pass later.

Status:
- `deferred` means identified and accepted for later implementation.

---

## P0 (Fix First)

1. JSON parsing bug in approve flow  
Status: `deferred`  
Files:
- `src/lib/hooks/shopHooks/checkout/usePayPalTXApproveCallback.ts:149`
- `src/lib/hooks/shopHooks/checkout/usePayPalTXApproveCallback.ts:161`  
Issue:
- `JSON.parse(await res.json())` is incorrect because `res.json()` already returns an object.  
Risk:
- Runtime failure during authorize/capture response handling.

2. Processing modal enters "processing" but no completion path runs  
Status: `deferred`  
Files:
- `src/lib/hooks/shopHooks/checkout/usePayPalTXApproveCallback.ts:119`
- `src/lib/hooks/shopHooks/checkout/usePayPalTXApproveCallback.ts:120`
- `src/lib/hooks/shopHooks/checkout/usePayPalTXApproveCallback.ts:121`
- `src/lib/hooks/shopHooks/checkout/usePayPalTXApproveCallback.ts:122`  
Issue:
- UI starts processing state while post-processing call and redirect are commented out.  
Risk:
- User gets stuck in indefinite processing.

3. Create-order API may return success HTTP with error body  
Status: `deferred`  
File:
- `src/app/api/paypal/orders/create-order/route.ts:189`  
Issue:
- `return NextResponse.json(err);` in `catch` defaults to 200 status.  
Risk:
- Client may treat failed order creation as success.

4. Webhook has verification but no fulfillment implementation  
Status: `deferred`  
Files:
- `src/app/api/paypal/webhook/payment-capture/route.ts:163`
- `src/app/api/paypal/webhook/payment-capture/route.ts:177`  
Issue:
- Event switch has placeholder comments; no ledger update, no idempotent post-processing execution.  
Risk:
- Captured payments are not reliably finalized.

---

## P1 (High Priority)

5. No deterministic pre-capture correlation key in PayPal order  
Status: `deferred`  
File:
- `src/app/api/paypal/orders/create-order/route.ts:151`  
Issue:
- `customId` uses random UUID, making resume/reconciliation harder.

6. OTP signing secret exposed in public client env  
Status: `deferred`  
File:
- `src/lib/hooks/shopHooks/checkout/customMutationHooks.ts:64`  
Issue:
- `NEXT_PUBLIC_SHOP_CHECKOUT_OTP_VERIFICATION_API_KEY` is used client-side to sign requests.  
Risk:
- Signature can be forged by any client.

7. Confirmation page clears checkout/order state immediately on mount  
Status: `deferred`  
Files:
- `src/app/shop/checkout/confirmation/[orderId]/page.tsx:157`
- `src/app/shop/checkout/confirmation/[orderId]/page.tsx:158`
- `src/app/shop/checkout/confirmation/[orderId]/page.tsx:159`  
Issue:
- Recovery/resume context can be erased prematurely.

8. `createOrderAction` does not guard missing host before URL build  
Status: `deferred`  
Files:
- `src/actions/shop/paypal/createOrderAction.ts:57`
- `src/actions/shop/paypal/createOrderAction.ts:60`  
Issue:
- Potential malformed URL if `host` is null/undefined.

---

## P2 (Cleanups and Robustness)

9. `createOrder` callback can return non-order string on error path  
Status: `deferred`  
File:
- `src/components/UI/Shop/Checkout/Paypal/PayPalCheckoutChildren.tsx:77`  
Issue:
- Error message path returns string where order ID is expected by PayPal SDK.

10. Error parsing path assumes unstable response shape  
Status: `deferred`  
File:
- `src/components/UI/Shop/Checkout/Paypal/PayPalCheckoutChildren.tsx:66`  
Issue:
- Uses `response.body` assumptions that may not hold for server action return objects.

11. `cache()` wraps mutation-like network operations  
Status: `deferred`  
Files:
- `src/actions/shop/paypal/createOrderAction.ts:26`
- `src/actions/shop/paypal/processAndUploadCompletedTx/savePaymentDataToBackend.ts:59`
- `src/actions/shop/checkout/createMerchizeOrder/sendMerchizeOrderDetailsToBackend.ts:44`  
Issue:
- React cache can cause stale/deduped behavior where repeat writes are expected.

---

## Guide/Architecture Follow-ups

12. Schema/template mismatch in guide post-processing section
Status: `resolved` — all fields in Section 21 (post-processing runner) match the Section 7 schema. Confirmation page integration, server-safe encrypt note, and browser-close recovery added to guide on 2026-03-23.

13. Admin dashboard hub and checkout recovery operations
Status: `deferred`
Scope:
- Add a single admin dashboard hub with CTAs/cards into shop tools first, including Merchize catalog refresh and PayPal/Merchize ledger recovery.
- Add PayPal/Merchize ledger search by email, support reference/order token, PayPal order ID, Django intent identifiers, and Django payment save custom ID.
- Show the customer-safe checkout recovery summary in admin detail views: paid amount, placed date, cart summary, shipping region, current processing step, and support reference.
- Add support actions for retry post-processing, retry fulfillment only, regenerate receipt, save fulfillment address override, clear stale locks, mark manually resolved, send customer update email, and clear expired checkout recovery OTP challenges.
- Track future "keep me updated" customer acknowledgements so support can see that the customer saw the recovered paid checkout and chose not to place another same-order checkout.
- Optional future enhancement: send a compact current-cart fingerprint during checkout recovery so the server can classify unresolved paid rows as `same`, `different`, or `unknown` compared with the shopper's current cart. This should tune the customer-facing copy only; any unresolved paid checkout for the verified email should still be shown.
