# Cart behavior

All cart surfaces use `useCartStore`. Components issue commands; they do not write to Django or merge cart arrays themselves.

- `model.ts` validates lines, applies local intent, compares server quantities, and consumes checkout snapshots.
- `repository.ts` stores versioned guest/account documents in IndexedDB transactions, migrates the legacy cart once, and keeps its recovery copy. A renewable database lease coordinates tabs without requiring HTTPS-only Web Locks.
- `controller.ts` serializes commands and synchronization. New edits remain over the last confirmed server snapshot. Storage outages retain commands in memory and display a warning; recovery replays those commands against the stored cart.
- `transport.ts`, `protocol.ts`, and the Next cart handler use only the existing Django cart endpoints. Credentials remain on the server and every request checks account ownership.
- `purchase.ts` exposes purchased quantities only after a completed, reconciled payment and a validated canonical snapshot. Local checkout snapshots and line identities protect later additions and re-added products.

## Rules

Guest quantities are added once on sign-in. Logging out selects a separate guest cart; account caches and pending changes remain with their owner. Remote changes are adopted automatically unless this device also has a competing unsaved edit for the same variant. Those competing quantities require a customer choice on the cart page; other variants can keep syncing.

The warning belongs to the device with the competing edit, rather than every device signed into the account. A clean device can display the saved online quantity without a warning. Visible shop pages check on focus, reconnection, and every 30 seconds. This works on a local Wi-Fi HTTP address as well as localhost; each browser origin keeps its own session and device cache.

Additive writes with an unknown outcome are never blindly retried. A confirmed write with an interrupted confirmation read can be acknowledged by a later matching read. Existing Django APIs provide no operation IDs or conditional revisions, so a server-side race between independent devices cannot be eliminated by the browser. Detected ambiguity remains visible instead of silently increasing quantities.

Verified with a disposable cart: `add-items` increments quantity, `update-items` sets an absolute quantity, and removing an absent variant succeeds. Checkout always revalidates product availability and charges from canonical server data, regardless of cart synchronization status.

Offline support covers edits to known selections in loaded pages. It does not add an offline site shell. New cart persistence works without Web Crypto; encrypted legacy records that cannot be opened remain intact for recovery.

## Focused checks

```sh
node --import tsx --test src/lib/cart/model.test.ts src/lib/cart/repository.test.ts src/lib/cart/controller.test.ts src/lib/cart/transport.test.ts src/lib/cart/purchase.test.ts
node --require next/dist/server/node-environment --conditions=react-server --import tsx --test src/lib/cart/server-route.test.ts
```
