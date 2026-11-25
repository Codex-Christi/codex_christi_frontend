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
