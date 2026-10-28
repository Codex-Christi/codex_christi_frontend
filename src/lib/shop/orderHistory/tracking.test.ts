import assert from 'node:assert/strict';
import test from 'node:test';
import {
  shipmentSummary,
  matchingShipmentRecords,
  trackingLink,
  stampShipmentSnapshot,
  snapshotCheckedAt,
} from '@/lib/merchizeFulfillmentOps/customerTracking';
import { receiptObjectKey, receiptDownloadPath } from './receiptReference';
import { getShopSiteUrl } from '@/lib/siteBaseUrls';
import { canSupportReadReceipt } from './receiptStorage';

test('package delivery requires explicit evidence and complete coverage; fulfilled does not mean delivered', () => {
  const payload = {
    success: true,
    data: {
      external_number: 'ORD-1',
      package_count: 2,
      packages: [
        { package_id: 'one', status: 'delivered', tracking_number: 'one' },
        { package_id: 'two', status: 'fulfilled', tracking_number: 'two' },
      ],
    },
  };
  assert.equal(shipmentSummary(payload, 'ORD-1').delivered, false);
  payload.data.packages[1].status = 'delivered';
  assert.equal(shipmentSummary(payload, 'ORD-1').delivered, true);
  assert.equal(shipmentSummary(payload, 'another-order').packages.length, 0);
  payload.data.package_count = 3;
  assert.equal(shipmentSummary(payload, 'ORD-1').label, 'Listed packages delivered');
  assert.equal(shipmentSummary({ success: false, data: payload.data }, 'ORD-1').packages.length, 0);
});

test('mixed or conflicting tracking references cannot leak another order or imply delivery', () => {
  assert.equal(
    matchingShipmentRecords(
      { success: true, data: [{ packages: [] }, { external_number: 'other' }] },
      'ORD-1',
    ).length,
    0,
  );
  assert.equal(
    matchingShipmentRecords(
      { success: true, data: { external_number: 'ORD-1', external_order_number: 'other' } },
      'ORD-1',
    ).length,
    0,
  );
  const packages = Array.from({ length: 51 }, (_, id) => ({
    package_id: String(id),
    status: 'delivered',
  }));
  const summary = shipmentSummary(
    { success: true, data: { package_count: 51, packages } },
    'ORD-1',
  );
  assert.equal(summary.packages.length, 50);
  assert.equal(summary.delivered, false, 'Truncated evidence is not complete delivery');
  assert.equal(
    shipmentSummary({ success: true, data: { status: 'fulfilled' } }, 'ORD-1').delivered,
    false,
  );
});

test('tracking URLs are restricted to known HTTPS carriers and freshness comes from matching snapshots', () => {
  for (const value of [
    'javascript:alert(1)',
    'https://evil.example',
    'https://ups.com.evil.example',
    'https://user:pass@ups.com',
    'https://localhost/a',
  ])
    assert.equal(trackingLink(value), null);
  assert.equal(
    trackingLink('https://www.ups.com/track?tracknum=abc'),
    'https://www.ups.com/track?tracknum=abc',
  );
  assert.equal(
    snapshotCheckedAt({ success: true }),
    null,
    'Legacy progress timestamps may have been overwritten by internal reads',
  );
  const stamped = stampShipmentSnapshot(
    { success: true, data: {}, _nextFetchedAt: 'forged' },
    new Date('2026-10-01T00:00:00Z'),
  );
  assert.equal(snapshotCheckedAt(stamped), '2026-10-01T00:00:00.000Z');
});

test('receipt signing references remain scoped and compatible without copying legacy objects', () => {
  const row = {
    orderToken: 'token-1',
    receiptLink: 'https://payment-receipts.codexchristi.shop/paypal/invoice.pdf',
    receiptFile: 'invoice',
  };
  assert.equal(receiptObjectKey(row), 'paypal/invoice.pdf');
  for (const receiptLink of [
    'https://evil.example/paypal/a.pdf',
    'https://payment-receipts.codexchristi.shop/paypal/%2e%2e%2fsecret.pdf',
    'https://user@payment-receipts.codexchristi.shop/paypal/a.pdf',
  ])
    assert.equal(receiptObjectKey({ ...row, receiptLink }), null);
  assert.equal(receiptDownloadPath('token-1'), '/next-api/shop/orders/token-1/receipt');
  const protectedRow = {
    ...row,
    receiptLink: getShopSiteUrl(receiptDownloadPath(row.orderToken)),
    receiptFile: 'receipt-d73b4b97-3ec0-4163-8a34-55d649404f81',
  };
  assert.equal(receiptObjectKey(protectedRow), `paypal/${protectedRow.receiptFile}.pdf`);
  assert.equal(receiptObjectKey({ ...protectedRow, orderToken: 'someone-else' }), null);
  assert.equal(receiptObjectKey({ ...protectedRow, receiptFile: 'arbitrary-file' }), null);
});

test('support downloads require a permitted staff role and shop access', () => {
  assert.equal(canSupportReadReceipt({ role: 'support', scopes: ['shop.view'] }), true);
  assert.equal(canSupportReadReceipt({ role: 'support', scopes: [] }), false);
  assert.equal(canSupportReadReceipt({ role: 'viewer', scopes: ['shop.view'] }), false);
  assert.equal(canSupportReadReceipt({ role: 'master_admin', scopes: [] }), true);
});
