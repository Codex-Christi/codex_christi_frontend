# Shop Alpha Order Flow Transfer Prompt

Use this prompt to continue the pre-alpha implementation in a new Codex task.

---

We are continuing Codex Christi public-alpha shop order-flow work.

First read:

1. `Future Implementation Guides/SHOP_ALPHA_ORDER_FLOW_RELEASE_GUIDE.md`
2. `Future Implementation Guides/PAYPAL_TX_LEDGER_GUIDE.md`
3. `Future Implementation Guides/PAYPAL_WEBHOOK_REGISTRATION_AND_RECOVERY_GUIDE.md`
4. `Future Implementation Guides/MERCHIZE_FULFILLMENT_OPS_GUIDE.md`
5. `Future Implementation Guides/ADMIN_RECOVERY_TOOLING_GUIDE.md`
6. `Future Implementation Guides/SHOP_CHECKOUT_RECOVERY_IMPLEMENTATION_GUIDE.md`

The release guide is canonical for priority and resolved product decisions. The other guides remain
domain references. If an older guide says a different item is "next" or contains an unresolved
decision already resolved by the release guide, follow the release guide.

Current checkpoint: 2026-10-27, source through `eb9794b0` (including checkout commit `85160428`).
P0.3's static destination/shipping trace is complete; **P0.2 deployed E2E remains pending**.
Orders and migrations remain off-limits. The release guide owns the
[current code and verification record](SHOP_ALPHA_ORDER_FLOW_RELEASE_GUIDE.md#3-current-codebase-checkpoint)
and [P0.3 findings](SHOP_ALPHA_ORDER_FLOW_RELEASE_GUIDE.md#p03-document-current-destination-behavior-without-changing-it).
Prior tests and builds apply only to their recorded source checkpoints.

## Product target

Deliver a public alpha. It is not invite-only. Every completed ordinary Codex Christi account signup
is implicitly treated as joining the alpha waitlist. This is a rollout assumption, not a separate
persisted participation state. Small informational notices on the signup page and shop homepage make
alpha status visible while preserving the core registration → OTP → login structure. Incremental
auth enhancements may be scoped separately when they preserve that contract and support the
customer-order path.

The alpha must support a smooth real-customer flow:

- trusted server pricing and order snapshot;
- PayPal capture and reconciliation;
- receipt;
- Django payment save and accepted fulfillment handoff;
- Merchize registration, lookup, readiness, push, and verification;
- secure order confirmation across devices;
- customer/admin notifications;
- state-aware progress/tracking/delivery reconciliation;
- safe admin recovery without payment replay.

## Non-negotiable contracts

- `runPaidFulfillmentProcessing(orderToken)` is the canonical parent orchestrator.
- Never replay PayPal authorization/capture, receipt generation, Django payment save, or an accepted
  Django handoff from fulfillment-only retry.
- A Django `200`/`201`, `success = true`, `data.processing_status = "completed"` response with
  `error_message = "Order created but details not available"` is accepted.
- `orderToken` is the local support/customer reference.
- `djangoPaymentSaveCustomId` is the Django `/orders/process/{custom_id}` path value.
- `merchizeExternalOrderNumber` is the `ORD-...` external number.
- `merchizeOrderId` is `resp.data._id` from external-number lookup.
- Never use Django wrapped `response_data.data._id` as the actionable Merchize id.
- Keep Merchize Ops separate from PayPal payment retry.
- Confirmation status reads must stay side-effect free.
- Use `X-API-KEY` only from the server for Merchize routes proven to support it.
- Do not expose or log secrets, raw PII, provider payloads, customer addresses, or Postman fixtures.

## Resolved alpha decisions

- Preserve the core Django-backed signup, OTP verification, and login flow. Independently justified
  auth improvements or migrations are allowed, but do not couple them to alpha participation or
  mistake them for the current release priority.
- Treat every successful ordinary signup as implicit alpha-waitlist participation. Do not create an
  enrollment table, participation API, acknowledgement record, duplicate reconciliation, or
  email/user linking flow.
- Keep alpha disclosure non-blocking: one small notice on signup and one on the shop homepage. Do
  not add a checkbox, modal, versioned dismissal, or waitlist query-state pipeline.
- No arbitrary small SKU allowlist. `all-variants` membership is storefront identity only. Any
  offered variant can sell only after exact current product-line/catalog reconciliation, price, and
  shipping resolve from trusted server data. Storefront and supplier SKU namespaces remain
  separate. This is an order-integrity check, not a new destination or tax policy.
- Preserve the existing multi-currency checkout and PayPal behavior. The canonical snapshot records
  the exact server-resolved currency and amounts; the alpha is not restricted to USD.
- The current PayPal setup does not provide tax-charging capability. Do not calculate, add, collect,
  or pass a tax amount or tax line to PayPal during the alpha.
- US address `valid` plus exact read-back may auto-push.
- Non-US `other`/`others` plus exact read-back may auto-push, labeled not provider-validated.
- Explicit US invalid or address mismatch pauses before push and notifies customer and admin.
- Customer correction is Next.js-owned. Keep Django at its current intent/payment-save/initial
  fulfillment handoff boundary.
- Require an inline final address/size/variant/quantity acknowledgement before PayPal.
- Codex Christi owns customer emails: payment received, address action, preparing, tracking,
  shipped, and delivered.
- Guest cross-device confirmation uses an emailed, purpose-bound, long-lived viewing capability with
  OTP reissue. Authenticated access uses `userId` ownership.
- Keep capture-route `after(...)` continuation as the explicitly enabled fast trigger; the scanner is
  the durable fallback. PayPal webhooks remain a payment safety net.
- Merchize webhooks are P1. Synchronous API reads plus scheduled polling must make P0 complete.
- Keep the storefront's current destination behavior during canonical-snapshot work. Do not add,
  remove, or redefine destination coverage without separate product direction.
- Refunds, disputes, automated cancellation, arbitrary product/artwork mutations, and full provider
  dashboard parity are out of scope.

## Current state and next action

- P0.1 uses ordinary signup and informational alpha notices; there is no participation subsystem.
- P0.2 seals trusted product, supplier SKU, price, currency, and shipping data in the existing
  `PaypalIntent` ledger. PayPal, payment reconciliation, receipts, and fulfillment use that snapshot.
  Only an all-null snapshot/version/hash triple is legacy. See the
  [ledger checkpoint](PAYPAL_TX_LEDGER_GUIDE.md#p02-canonical-order-ledger-checkpoint) for its contracts.
- Commit `85160428` adds final review, verified email/address binding, stable checkout attempts,
  owner/grant access, recovery controls, and explicit push guards. Their full P0.4/P0.5 and deployed
  acceptance remain open; draft terms/privacy pages are not approved policy.
- Public purchase controls and checkout verify supplier evidence; cart edits can save offline.
  Follow the [cart contract](../src/lib/cart/README.md), not a live-check-on-every-increment assumption.
- The release guide owns [remaining alpha work](SHOP_ALPHA_ORDER_FLOW_RELEASE_GUIDE.md#remaining-alpha-work)
  and [destination/shipping gaps](SHOP_ALPHA_ORDER_FLOW_RELEASE_GUIDE.md#preservation-and-remaining-gaps).
  Do not infer new country restrictions, tax collection, or shipping prices from those observations.
- Full sandbox payment E2E remains stopped: live Django/Merchize downstream processing can create
  a real provider order even with push disabled. Controlled fixtures/staging and renewed direction
  are required before creating any PayPal/Django intent or order, authorizing/capturing, or invoking
  fulfillment/recovery. Historical sandbox evidence is retained in the release checkpoint.

## Required first implementation order

1. Keep P0.2 marked **implementation/offline verification passed; deployed E2E pending**. The
   rounding/cancellation corrections are already committed and verified; do not repeat that work as
   a pending implementation task. No orders or migrations are authorized.
2. Use P0.3's completed [static trace and remaining gaps](SHOP_ALPHA_ORDER_FLOW_RELEASE_GUIDE.md#p03-document-current-destination-behavior-without-changing-it).
   It reconciles current country selection, per-option shipping proof, currency fallback, address
   normalization, verified-address binding, and review/attempt reuse. It changes no eligibility,
   datasets, provider settings, tax behavior, or customer-facing policy. Recheck only affected
   findings when later code changes; do not repeat the completed trace as pending work.
3. Preserve the user's order-creation stop until renewed direction. Establish controlled
   Django/Merchize fixtures or staging before resuming the full deployed sandbox P0.2
   payment/receipt/handoff/recovery acceptance cases. Recheck production migration status read-only
   before any later rollout; deploy only genuinely pending reviewed changes through the normal
   approval flow. Keep release gates unchecked until their deployed evidence exists.
4. Assess current final-review/acknowledgement code against P0.4's full acceptance contract before
   implementing missing pieces; presence is not deployed acceptance.
5. Assess current owner/grant/OTP confirmation and recovery code against P0.5's full contract,
   including the emailed capability and customer-safe lifecycle projection.
6. Centralize readiness disposition, US/non-US address policy, and address correction/read-back.
7. Assess current push-configuration guards against their acceptance contract and complete only
   remaining gaps; unset/blank already disables push in the recorded source checkpoint.
8. Implement all six customer milestone outbox events and complete admin escalation.
9. Add state-aware/batched lifecycle polling, global outbox dispatch, and scheduler heartbeat.
10. Replace policy placeholders and execute the staged E2E acceptance program.

Temporary recovery-demo seeding files/commands have been removed. Keep genuine regression tests
and their required support modules. The ordinary `test:storefront` command excludes the
database-provisioning `*.integration.test.ts` fixture; do not run schema tools or delete existing
demo database rows as part of source cleanup.

Do not jump to Merchize webhook implementation until the P0 gates in the release guide pass.

## Scope guard for alpha participation

- Do not interpret "waitlist" as a new account-domain or Next.js-owned data model.
- A "Join waitlist" marketing CTA links to ordinary signup; it does not create a separate query-state
  or registration branch.
- Do not propagate `waitlist`, source, notice-version, or acknowledgement state through signup, OTP,
  or login.
- Do not make alpha disclosure a condition of account creation or authentication.
- Do not add participation persistence, APIs, user linking, deduplication, announcement preferences,
  or associated migrations.
- Keep any future auth hardening or account migration as its own scoped change with its own
  acceptance criteria; it must preserve the core signup → OTP → login contract.
- Keep engineering effort on the minimum viable customer order path: signup, trusted checkout,
  payment, confirmation, production handoff, lifecycle communication, delivery, and safe recovery.

## Scope guard for the canonical order snapshot

- P0.2 changes which data is authoritative; it does not redesign checkout policy.
- Preserve all currently supported checkout and PayPal currencies. Do not impose an alpha-wide
  USD-only rule.
- Preserve current destination coverage during P0.2.
- The current PayPal setup cannot charge tax. Do not calculate, add, collect, or pass a tax amount
  or tax line to PayPal. The canonical monetary snapshot, PayPal purchase unit, and receipt use
  merchandise plus shipping only.
- Rejecting a missing SKU or unsafe fabricated shipping fallback is an order-integrity check, not a
  new destination allowlist.
- Treat storefront `all-variants` rows as identity only. For variants with a `Product` option,
  require one exact current product-line name plus complete option-map match, then require its
  supplier product ID, supplier variant ID, and SKU to match fresh product-scoped catalog evidence.
  For variants without one, require exact current SKU membership from a complete scoped response.
- Keep storefront and supplier IDs/SKUs in separate namespaces. Never substitute, assume equality,
  accept a fuzzy/nearest option, or treat partial provider data as positive sellability evidence.
- Bound each compatibility provider read to 15 seconds. Public purchase controls and authoritative
  checkout/intent verification fail closed. Preserve the [offline cart contract](../src/lib/cart/README.md):
  known selections and quantities can be saved without a live supplier check, confirmed-unavailable
  cart increments are disabled, and unavailable/unverified rows cannot be purchased. Record a per-variant
  incident only for confirmed drift; keep provider outages/timeouts and incomplete/unverified reads
  aggregate. Use the persistent Storefront Data Health queue for admin action; do not add catalog
  email or PayPal-outbox coupling in P0.2.
- Pre-P0.2 compatibility applies only when canonical snapshot, version, and hash are all null.
  Partial, invalid, or mismatched metadata is corruption and must not fall back to cart data.
- Treat any future destination-policy change as separate work requiring explicit product direction,
  acceptance criteria, and rollout planning. Tax support is outside this guide and must not be
  implemented without explicit new direction after the required PayPal capability exists.

## How to begin

1. Run `git status --short` and inspect recent commits.
2. Re-scan the current implementations before editing because other agents may have changed files.
3. Compare the code against the release guide's "Current Codebase Checkpoint."
4. Use the dated release checkpoint and completed P0.3 trace; preserve unrelated working-tree
   changes. Do not run orders or migrations. Controlled downstream fixtures/staging and renewed
   direction are required before full sandbox payment E2E. Scope any remaining implementation
   separately; neither the trace nor implemented controls waive P0.2 deployed acceptance.
5. Before editing, state the exact files and behavior being changed.
6. Use existing patterns, preserve unrelated dirty changes, add risk-proportionate tests, and verify
   migrations against both dev and production branches when schema changes are involved.

Do not broaden scope into refunds, disputes, product changes, cancellation automation, or full
Merchize dashboard parity without asking.
