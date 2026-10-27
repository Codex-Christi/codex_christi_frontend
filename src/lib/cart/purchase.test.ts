import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeCanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/canonicalize';
import {
  CANONICAL_ORDER_SNAPSHOT_HASH_ALGORITHM,
  CANONICAL_ORDER_SNAPSHOT_VERSION,
} from '@/lib/paypal/orderSnapshot/types';
import { getCanonicalPaymentProjectionState } from '@/lib/paypal/txLedger/canonicalPaymentProjectionState';
import { getCapturedCartPurchase } from './purchase';

function paidOrder() {
  const canonicalOrderSnapshot = finalizeCanonicalOrderSnapshot({
    version: CANONICAL_ORDER_SNAPSHOT_VERSION,
    hashAlgorithm: CANONICAL_ORDER_SNAPSHOT_HASH_ALGORITHM,
    createdAt: '2026-10-27T00:00:00.000Z',
    destination: { countryIso3: 'USA', region: 'CA' },
    currency: 'USD',
    lines: [
      {
        lineId: 'product:variant',
        productId: 'product',
        variantId: 'variant',
        supplierProductId: 'supplier-product',
        supplierVariantId: 'supplier-variant',
        sku: 'SKU',
        sellerSku: null,
        title: 'Product',
        selectedOptions: [],
        imageUrl: 'https://example.test/product.jpg',
        quantity: 2,
        unitAmount: { currency: 'USD', value: '20.00' },
        lineAmount: { currency: 'USD', value: '40.00' },
        shippingAllocation: { currency: 'USD', value: '5.00' },
      },
    ],
    subtotal: { currency: 'USD', value: '40.00' },
    shipping: { currency: 'USD', value: '5.00' },
    total: { currency: 'USD', value: '45.00' },
  });
  return {
    orderToken: 'order-token',
    status: 'captured',
    canonicalOrderSnapshot,
    canonicalOrderSnapshotVersion: canonicalOrderSnapshot.version,
    canonicalOrderSnapshotHash: canonicalOrderSnapshot.hash,
    authorizePayload: { amount: { value: '45.00', currencyCode: 'USD' } },
    capturePayload: {
      id: 'capture-id',
      status: 'COMPLETED',
      finalCapture: true,
      amount: { value: '45.00', currencyCode: 'USD' },
    },
  };
}

test('purchase cleanup exposes only verified paid variant quantities, never cart metadata or customer data', () => {
  const row = {
    ...paidOrder(),
    cartSnapshot: [{ variantId: 'untrusted', quantity: 99 }],
    customerInfo: { email: 'private@example.test' },
  };
  assert.deepEqual(getCapturedCartPurchase(row, getCanonicalPaymentProjectionState(row)), {
    orderId: 'order-token',
    lines: [{ variantId: 'variant', quantity: 2 }],
  });
});

test('an authorization, pending capture, or mismatched payment cannot consume the cart', () => {
  const paid = paidOrder();
  for (const row of [
    { ...paid, status: 'authorized', capturePayload: null },
    { ...paid, capturePayload: { ...paid.capturePayload, status: 'PENDING' } },
    {
      ...paid,
      capturePayload: { ...paid.capturePayload, amount: { value: '0.01', currencyCode: 'USD' } },
    },
  ])
    assert.equal(getCapturedCartPurchase(row, getCanonicalPaymentProjectionState(row)), null);
});

test('legacy, partial, or altered canonical data never falls back to the raw cart snapshot', () => {
  const paid = paidOrder();
  const evidence = getCanonicalPaymentProjectionState(paid);
  for (const row of [
    {
      ...paid,
      canonicalOrderSnapshot: null,
      canonicalOrderSnapshotHash: null,
      canonicalOrderSnapshotVersion: null,
    },
    { ...paid, canonicalOrderSnapshotHash: null },
    { ...paid, canonicalOrderSnapshotVersion: null },
    { ...paid, canonicalOrderSnapshotHash: 'f'.repeat(64) },
    {
      ...paid,
      canonicalOrderSnapshot: {
        ...paid.canonicalOrderSnapshot,
        lines: [{ ...paid.canonicalOrderSnapshot.lines[0], quantity: 99 }],
      },
    },
  ]) {
    const legacyFallback = { ...row, cartSnapshot: paid.canonicalOrderSnapshot.lines };
    assert.equal(getCapturedCartPurchase(legacyFallback, evidence), null);
  }
});
