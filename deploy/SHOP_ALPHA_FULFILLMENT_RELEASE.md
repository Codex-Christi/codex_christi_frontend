# Shop alpha fulfillment release

This release combines checkout and fulfillment changes with the Leaseweb
frontend deployment. Installing it does not authorize live payments or a
supplier test order.

## Before installing

1. Review the release PR and use the exact revision that passed CI. Stage its
   runtime and datastore-check images together. Keep the prior healthy image,
   runtime settings, and Compose configuration available for rollback.
2. Verify the intended production PayPal ledger and migration history with a
   read-only check. If `20261121000000_add_customer_recovery_request` is
   pending, apply it separately after approval, using the production migration
   connection. The Docker release checks the schema but does not modify it.
3. Use the private VPS runtime settings. Keep `PAYPAL_PAYMENT_MODE=sandbox`
   and leave live payment disabled. If legacy public settings are present,
   they must agree with the server settings. Do not include environment files
   or credentials in artifacts or logs.
4. Verify both public readiness URLs report the intended revision and the
   existing PayPal webhook route reaches the active app. Ensure only one VPS
   runs the authenticated recovery schedule. Check its last successful run.

## Before switching PayPal

- Finish any sandbox payment recovery before switching credentials. Keep the
  signed listener and scheduled recovery working for orders already paid.
- Verify login and order ownership, address correction, confirmation, and
  notification delivery in a controlled environment. Make sure stale
  confirmation links do not send buyers to the wrong ledger.
- Confirm one mixed-item import preserves the selected SKUs, quantities, and
  artwork. The mock tests prove what the app sends to Django, not what
  Merchize saves. Sandbox PayPal and a disabled app push do not prevent an
  import or supplier-side automatic release.
- Configure the live REST app and its own webhook before the switch. Keep
  signature verification required. Fund and approve one controlled live
  checkout before accepting public live payments.

The checkout access wording and any owner-specific changes still under review
are separate from the deployment infrastructure. Do not publish unrelated
local drafts, test-only release overrides, or profile and design work.

## Buyer recovery and development email

- For an eligible paid order still waiting for the Django handoff, the
  verified buyer can request recovery on confirmation. This saves one
  request for the existing recovery job. The button does not take payment
  or call providers. It does not move the order ahead of other retries.
  The job respects the existing retry timing and stops when the saved
  payment or handoff evidence needs review. This change adds no scheduled
  job or migration.
- On the `dev` Shop Ops target, set `SHOP_DEV_ORDER_EMAIL_INBOX` to a
  controlled test inbox and `SHOP_DEV_ORDER_CONFIRMATION_ORIGIN` to the
  app origin that reads the same development ledger, for example
  `http://localhost:3001`. Customer order-update emails go only to that
  inbox and link back to that app. If either setting is missing or invalid,
  the sender records the email as suppressed. Configure both before
  running an email test. These settings do not change production mail,
  admin alerts, or verification codes.

## Pause new orders and check scheduled recovery

- Set the optional server setting `SHOP_CHECKOUT_PAUSED=true` in the
  active app's runtime environment and restart it to pause new orders.
  Set it to `false` or remove it to reopen. A nonblank value other than
  `false` pauses checkout. This does not change PayPal mode or cancel orders.
- While paused, the app does not create a Django checkout intent or a
  new PayPal order. A customer can still continue an existing PayPal order
  or view their order status. Capture and recovery for existing orders,
  webhooks, and the scheduled job are not paused.
- In **Paid Order Recovery**, check **Scheduled recovery** for the selected
  data target. **Latest run** shows the last recorded job result. **Last
  successful run** advances only when all enabled steps report success.
  Dry runs and manual retries do not change these times. Check the scheduler
  logs if the latest timestamp stops moving or shows **Needs attention**.
- The existing scheduled endpoint adds one small result to the admin audit
  log per completed call. No new job, database table, or migration is needed.
  Audit-log retention and manual clears can remove run history.
