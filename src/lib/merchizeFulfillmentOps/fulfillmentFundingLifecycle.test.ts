import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { NextRequest } from 'next/server';
import { SendMailClient } from 'zeptomail';
import { POST } from '@/app/api/jobs/paypal-tx-ledger-recovery-scan/route';
import {
  enqueueCustomerFulfillmentMilestoneNotification,
  resendCustomerNotification,
  sendPendingCustomerNotifications,
  trySendQueuedUrgentCustomerNotification,
} from '@/lib/paypal/txLedger/customerNotificationOutbox';
import { runPaidFulfillmentProcessing } from '@/lib/paypal/txLedger/runPaidFulfillmentProcessing';
import { VERIFIED_MERCHIZE_DELIVERY_STATUS } from './customerTracking';
import { readExternalOrderProgress } from './externalOrderProgress';
import { readSupplierInvoice } from './supplierInvoice';
import { pickCustomerLifecycleNotice } from './notifyMerchizeLifecycle';

const orderToken = 'fixture-funding-order';
const reference = {
  merchizeExternalOrderNumber: 'ORD-FIXTURE-FUNDING',
  merchizeOrderCode: 'RX-FIXTURE',
  merchizeIdentifier: 'codexchristi-shop',
};
const invoiceRow = {
  code: reference.merchizeOrderCode,
  external_number: reference.merchizeExternalOrderNumber,
  identifier: reference.merchizeIdentifier,
};

test('only a matched explicit unpaid invoice can be classified as unpaid', () => {
  for (const value of [0, null, {}]) {
    assert.equal(readSupplierInvoice({ success: true, data: [{ ...invoiceRow, fulfillment_cost: value }] }, reference).state, 'placeholder');
  }
  const unpaid = { ...invoiceRow, fulfillment_cost: { amount: 20, status: 'pending' } };
  assert.equal(readSupplierInvoice({ success: true, data: [unpaid] }, reference).state, 'unpaid');
  assert.equal(readSupplierInvoice({ success: true, data: [unpaid, unpaid] }, reference).state, 'provider_error');
  assert.equal(readSupplierInvoice({ success: true, data: [{ ...unpaid, external_number: 'OTHER' }] }, reference).state, 'provider_error');
  assert.equal(readSupplierInvoice({ success: true, data: [unpaid] }, {
    ...reference, merchizeOrderCode: reference.merchizeExternalOrderNumber,
  }).state, 'unpaid');
});

test('email requires a fresh matched observation and a completed milestone since verified release', () => {
  const now = new Date('2026-11-23T15:00:00Z');
  const pushVerifiedAt = new Date('2026-11-23T12:00:00Z');
  const actual = '2026-11-23T13:00:00Z';
  const progress = (status: string, time: string, identity = invoiceRow) => ({
    success: true, data: [{ ...identity, order_progress: [{ event: 'in_production', status, actual: time }] }],
  });
  const row = {
    ...reference, pushVerifiedAt, lastProgressSyncAt: now,
    merchizeProgressPayload: progress('done', actual), merchizeTrackingPayload: null,
    deliveryStatus: null,
  };
  assert.equal(pickCustomerLifecycleNotice(row, now, now), 'production');
  assert.equal(pickCustomerLifecycleNotice(row, new Date(+now + 1), now), null);
  for (const payload of [progress('pending', actual), progress('done', '2026-11-23T11:00:00Z'),
    progress('done', '2026-11-23T16:00:00Z'), progress('done', actual, { ...invoiceRow, code: 'OTHER' })]) {
    assert.equal(pickCustomerLifecycleNotice({ ...row, merchizeProgressPayload: payload }, now, now), null);
  }
});

type Row = Record<string, unknown>;

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR' || key === 'AND') {
      const conditions = value as Row[];
      return key === 'OR' ? conditions.some((c) => matches(row, c)) : conditions.every((c) => matches(row, c));
    }
    const actual = row[key];
    if (value === undefined) return true;
    if (value === null) return actual == null;
    if (value instanceof Date) return actual instanceof Date && +actual === +value;
    if (typeof value !== 'object') return actual === value;
    const op = value as Row;
    return Object.entries(op).every(([kind, target]) => {
      if (kind === 'not') return target === null ? actual != null : actual !== target;
      if (kind === 'notIn') return !(target as unknown[]).includes(actual);
      if (kind === 'in') return (target as unknown[]).includes(actual);
      if (kind === 'lt') return (actual instanceof Date || typeof actual === 'number') &&
        Number(actual) < Number(target);
      if (kind === 'lte') return actual instanceof Date && actual <= (target as Date);
      if (kind === 'gt') return actual instanceof Date && actual > (target as Date);
      assert.fail(`Unexpected fixture predicate: ${kind}`);
    });
  });
}

function fixtureTable(rows: Row[]) {
  const find = (where: Row) => rows.find((row) => matches(row, where));
  const assign = (row: Row, data: Row) => {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (value && typeof value === 'object' && 'increment' in value) {
        row[key] = Number(row[key] ?? 0) + Number(value.increment);
      } else row[key] = value;
    }
    return { ...row };
  };
  const insert = (data: Row) => {
    const row = { id: `fixture-${rows.length + 1}`, attemptCount: 0, createdAt: new Date(), ...data };
    rows.push(row);
    return { ...row };
  };
  return {
    findFirst: async ({ where }: { where: Row }) => find(where) ?? null,
    findUnique: async ({ where }: { where: Row }) => find(where) ?? null,
    findMany: async ({ where }: { where: Row }) => rows.filter((row) => matches(row, where)).map((row) => ({ ...row })),
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = find(where);
      assert.ok(row);
      return assign(row, data);
    },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => ({
      count: rows.filter((row) => matches(row, where)).map((row) => assign(row, data)).length,
    }),
    create: async ({ data }: { data: Row }) => insert(data),
    createMany: async ({ data, skipDuplicates }: { data: Row[]; skipDuplicates?: boolean }) => ({
      count: data.filter((entry) => !skipDuplicates || !find({ dedupeKey: entry.dedupeKey })).map(insert).length,
    }),
    count: async ({ where }: { where: Row }) => rows.filter((row) => matches(row, where)).length,
    deleteMany: async () => ({ count: 0 }),
    upsert: async () => ({}),
  };
}

function isolatedEnvironment(t: TestContext) {
  const previousLedger = global.__paypalTxLedger__;
  const previousOps = global.__merchizeFulfillmentOpsPrisma__;
  for (const [key, value] of Object.entries({
    SHOP_OPS_DATA_TARGET: 'dev',
    PAYPAL_TX_LEDGER_NEON_BRANCH: 'dev',
    MERCHIZE_FULFILLMENT_OPS_NEON_BRANCH: 'dev',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING: 'postgresql://fixture:fixture@localhost:1/unused',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING: 'postgresql://fixture:fixture@localhost:1/unused',
    PAYPAL_TX_LEDGER_RECOVERY_SCANNER_ENABLED: 'true',
    PAYPAL_TX_LEDGER_RECOVERY_SCANNER_MIN_AGE_MINUTES: '15',
    PAYPAL_TX_LEDGER_RECOVERY_SCANNER_BATCH_SIZE: '1',
    PAYPAL_TX_LEDGER_RECOVERY_SCANNER_SECRET: 'fixture-job',
    MERCHIZE_FULFILLMENT_PUSH_ENABLED: 'false',
    MERCHIZE_BO_API_BASE_URL: 'https://merchize.example.test/bo-api',
    MERCHIZE_API_KEY: 'fixture-key',
    CODEX_PRIMARY_MAIL_AGENT_TOKEN: 'fixture-only',
    ORDER_RECOVERY_ADMIN_EMAILS: 'ops@example.test',
  })) {
    const saved = process.env[key];
    process.env[key] = value;
    t.after(() => { if (saved === undefined) delete process.env[key]; else process.env[key] = saved; });
  }
  t.after(() => {
    global.__paypalTxLedger__ = previousLedger;
    global.__merchizeFulfillmentOpsPrisma__ = previousOps;
  });
}

test('scheduled sync observes funding and package milestones without paying, importing, or pushing', async (t) => {
  isolatedEnvironment(t);
  const start = new Date('2026-11-23T10:00:00Z');
  t.mock.timers.enable({ apis: ['Date'], now: start });
  const amount = { value: '40.00', currencyCode: 'USD' };
  const row = {
    orderToken, status: 'completed', customerName: 'Test Buyer', customerEmail: 'buyer@example.test',
    createdAt: start, updatedAt: start,
    canonicalOrderSnapshot: null, canonicalOrderSnapshotVersion: null, canonicalOrderSnapshotHash: null,
    paypalOrderId: 'fixture-paypal', processingCompletedAt: start, djangoPaymentSaveCustomId: 'fixture-payment',
    authorizePayload: { purchaseUnits: [{ amount }] },
    capturePayload: { id: 'fixture-capture', status: 'COMPLETED', amount },
    merchizeFulfillmentResponsePayload: { status: 201, success: true, data: {
      processing_status: 'completed', response_data: { data: { order_id: reference.merchizeExternalOrderNumber } },
    } },
  };
  const order: Row = {
    ...reference, id: 'fixture-ops', orderToken, djangoPaymentSaveCustomId: row.djangoPaymentSaveCustomId,
    merchizeOrderId: 'fixture-provider-order', pushVerifiedAt: start, lastLookupAt: start,
    productionGateStatus: 'push_verified', updatedAt: start, deliveryStatus: null,
  };
  const paidRows = [row];
  const adminNotices: Row[] = [], customerNotices: Row[] = [], attempts: Row[] = [];
  const ledger = {
    paypalIntent: fixtureTable(paidRows),
    paypalWebhookEvent: fixtureTable([]), paidOrderRecoveryProjection: fixtureTable([]),
    adminNotificationOutbox: fixtureTable(adminNotices), customerNotificationOutbox: fixtureTable(customerNotices),
  };
  const ops = {
    merchizeFulfillmentOrder: fixtureTable([order]), merchizeFulfillmentSyncAttempt: fixtureTable(attempts),
    merchizeFulfillmentItem: fixtureTable([]),
    $transaction: (run: (tx: unknown) => Promise<unknown>) => run(ops),
  };
  global.__paypalTxLedger__ = ledger as unknown as NonNullable<typeof global.__paypalTxLedger__>;
  global.__merchizeFulfillmentOpsPrisma__ = ops as unknown as NonNullable<typeof global.__merchizeFulfillmentOpsPrisma__>;

  const emails: Array<{ subject: string; htmlbody?: string; recipient: string }> = [];
  let failShipment = false;
  let receivedError: Error | undefined;
  t.mock.method(SendMailClient.prototype, 'sendMail', async (mail: {
    subject: string; htmlbody?: string; to: Array<{ email_address: { address: string } }>;
  }) => {
    const recipient = mail.to[0].email_address.address;
    assert.match(recipient, /^(buyer|ops)@example\.test$/u);
    if (failShipment && mail.subject.startsWith('Shipment has started'))
      throw new Error('Test inbox not reached', { cause: { code: 'EAI_AGAIN' } });
    if (receivedError?.cause && mail.subject.startsWith('Order received')) throw receivedError;
    emails.push({ subject: mail.subject, htmlbody: mail.htmlbody, recipient });
    if (receivedError && mail.subject.startsWith('Order received')) throw receivedError;
    return {};
  });

  let invoice: unknown = 0;
  let invoiceMatches = true;
  let production: string | null = null;
  let shipment: string | null = null;
  let delivery: string | null = null;
  let packageStatuses: string[] = [];
  const requests: string[] = [];
  const blockedRequests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const route = url.pathname.split('/').at(-1)!;
    const method = init?.method ?? 'GET';
    requests.push(`${method} ${route}`);
    const deny = () => { blockedRequests.push(`${method} ${route}`); throw new Error('Unexpected provider request'); };
    if (url.hostname !== 'merchize.example.test' || (method !== 'GET' && route !== 'list-orders-ticket')) return deny();
    const ok = (data: unknown) => Response.json({ success: true, data });
    const item = { _id: 'fixture-item', ffm_map_item_status: 'mapped', variant: { is_active: true } };
    if (route === 'order-detail') return ok({ ...invoiceRow, _id: order.merchizeOrderId, order_status: 'unfulfilled', items: [item] });
    if (route === order.merchizeOrderId) return ok({
      ...invoiceRow, _id: order.merchizeOrderId, order_status: 'open', artwork_status: 'ready',
      validate_shipping_address: 'valid', push_to_fulfillment_progress: 'pushed', paid_at: start.toISOString(), items: [item],
    });
    if (route === 'order-invoice') return ok([{ ...invoiceRow, external_number: invoiceMatches ? invoiceRow.external_number : 'OTHER', fulfillment_cost: invoice }]);
    if (route === 'order-progress') return ok([{ ...invoiceRow, order_progress: [
      { event: 'pushed_order', status: 'done', actual: start.toISOString() },
      { event: 'in_production', status: production ? 'done' : 'pending', actual: production },
      { event: 'shipment_started', status: shipment ? 'done' : 'pending', actual: shipment, expected: new Date().toISOString() },
      { event: 'delivered', status: delivery ? 'done' : 'pending', actual: delivery },
    ] }]);
    if (route === 'tracking') return ok(packageStatuses.map((shipment_status, index) => ({
      ...invoiceRow, _id: `fixture-package-${index}`, package_count: packageStatuses.length,
      status: 'fulfilled', shipment_status, tracking_company: 'USPS', tracking_number: 'FIXTURE-NUMBER',
      tracking_url: 'https://tools.usps.com/tracking?test=fixture', has_tracking: true,
    })));
    if (route === 'send-to-fulfillment-date') return ok({ is_pushed: true, is_failed: false });
    if (route === 'unfulfilled') return ok([item]);
    if (['histories', 'address-suggestion', 'require-attention', 'list-orders-ticket', 'transaction-fee', 'fixture-provider-order'].includes(route)) return ok([]);
    return deny();
  });

  const scan = async () => {
    t.mock.timers.tick(16 * 60_000);
    const response = await POST(new NextRequest('http://localhost/api/jobs/paypal-tx-ledger-recovery-scan', {
      method: 'POST', headers: { 'x-cron-secret': 'fixture-job' },
    }));
    const result = await response.json();
    assert.equal(result.paymentRecovery?.results?.length, 0, 'a completed paid order must not restart payment recovery');
    assert.equal(result.fulfillmentLifecycle?.results?.length, 1, JSON.stringify(result));
    assert.deepEqual(result.fulfillmentLifecycle.results[0].failedActions, [], JSON.stringify(
      attempts.filter((attempt) => attempt.status === 'failed').map(({ action, errorCode, errorMessage }) => ({ action, errorCode, errorMessage })),
    ));
    return result;
  };
  const buyerSubjects = () => emails.filter((mail) => mail.recipient === 'buyer@example.test').map((mail) => mail.subject);
  const savedProgress = () => readExternalOrderProgress(order.merchizeProgressPayload, reference);
  await scan();
  assert.equal(order.costReviewStatus, 'pending');
  assert.equal(emails.length, 0);
  invoice = { status: 'pending', currency: 'USD', amount: 20 };
  await scan();
  await scan();
  assert.equal(order.costReviewStatus, 'unpaid');
  assert.equal(adminNotices.filter((note) => note.errorCode === 'MERCHIZE_SUPPLIER_INVOICE_UNPAID').length, 1);
  assert.equal(emails.filter((mail) => mail.recipient === 'ops@example.test').length, 1);
  assert.deepEqual(buyerSubjects(), []);
  invoice = { status: 'paid', currency: 'USD', amount: 20, paid_at: new Date().toISOString() };
  await scan();
  assert.equal(order.costReviewStatus, 'paid');
  assert.deepEqual(buyerSubjects(), []);
  const paidCheck = order.lastCostCheckAt;
  invoiceMatches = false;
  await scan();
  assert.equal(order.costReviewStatus, 'provider_error');
  assert.deepEqual(order.lastCostCheckAt, paidCheck);
  invoiceMatches = true;
  production = new Date().toISOString();
  await scan();
  assert.match(buyerSubjects()[0] ?? '', /^Your order is in production/u);
  packageStatuses = ['pre_transit'];
  await scan();
  assert.equal(order.deliveryStatus, 'tracking_available');
  assert.equal(buyerSubjects().length, 1);
  assert.deepEqual(savedProgress()?.completed, ['in_production']);
  shipment = new Date().toISOString();
  packageStatuses = ['in_transit'];
  failShipment = true;
  await scan();
  const notice = customerNotices.find((entry) => entry.type === 'paid_order_shipment_started');
  assert.equal(notice?.status, 'failed');
  failShipment = false;
  const retry = await Promise.all([
    resendCustomerNotification(String(notice?.id)), resendCustomerNotification(String(notice?.id)),
  ]);
  assert.equal(retry.filter((value) => value.ok).length, 1);
  assert.match(buyerSubjects()[1] ?? '', /^Shipment has started/u);
  delivery = new Date().toISOString();
  packageStatuses = ['delivered', 'in_transit'];
  await scan();
  assert.equal(buyerSubjects().length, 2);
  assert.equal(order.deliveryStatus, 'tracking_available');
  assert.ok(savedProgress()?.completed.includes('shipment_started'));
  packageStatuses = ['delivered', 'delivered'];
  await scan();
  assert.match(buyerSubjects()[2] ?? '', /^Your order was delivered/u);
  assert.equal(buyerSubjects().length, 3);
  assert.equal(order.deliveryStatus, VERIFIED_MERCHIZE_DELIVERY_STATUS);
  assert.ok(savedProgress()?.completed.includes('delivered'));
  assert.equal(order.productionGateStatus, 'push_verified');
  assert.ok(emails.every((mail) => !mail.htmlbody?.includes('FIXTURE-NUMBER')));
  assert.deepEqual(blockedRequests, []);
  assert.ok(requests.filter((entry) => entry.startsWith('POST')).every((entry) => entry === 'POST list-orders-ticket'));

  const contact = { orderToken, paypalOrderId: row.paypalOrderId, customerName: row.customerName, customerEmail: row.customerEmail };
  for (const scenario of ['race', 'retry', 'unknown'] as const) {
    const fixtureToken = `fixture-urgent-${scenario}`;
    paidRows.push({ ...row, orderToken: fixtureToken });
    const fixtureContact = { ...contact, orderToken: fixtureToken };
    const queued = await enqueueCustomerFulfillmentMilestoneNotification('received', fixtureContact);
    const notice = customerNotices.find((entry) => entry.dedupeKey === queued.queuedKey);
    const before = buyerSubjects().length;
    if (scenario === 'race') {
      await Promise.all([
        trySendQueuedUrgentCustomerNotification(queued),
        trySendQueuedUrgentCustomerNotification(queued),
        sendPendingCustomerNotifications({ orderToken: fixtureToken }),
      ]);
    } else {
      receivedError = scenario === 'retry'
        ? new Error('Test inbox not reached', { cause: { code: 'EAI_AGAIN' } })
        : new Error('Test inbox accepted the email but the response was lost');
      await trySendQueuedUrgentCustomerNotification(queued);
      receivedError = undefined;
      assert.equal(notice?.status, scenario === 'retry' ? 'failed' : 'delivery_unknown');
      assert.deepEqual(await sendPendingCustomerNotifications({ orderToken: fixtureToken }), []);
      t.mock.timers.tick(15 * 60_000);
      await sendPendingCustomerNotifications({ orderToken: fixtureToken });
    }
    assert.equal(notice?.status, scenario === 'unknown' ? 'delivery_unknown' : 'sent');
    assert.equal(buyerSubjects().length, before + 1);
    assert.match(buyerSubjects().at(-1) ?? '', /^Order received/u);
    assert.deepEqual(await sendPendingCustomerNotifications({ orderToken: fixtureToken }), []);
    assert.equal((await resendCustomerNotification(String(notice?.id))).ok, false);
  }
});

test('a matched invalid US address sends one correction notice without releasing the order', async (t) => {
  isolatedEnvironment(t);
  process.env.MERCHIZE_FULFILLMENT_PUSH_ENABLED = 'true';
  const now = new Date();
  const address = {
    address: '1 Example Street', address2: '', city: 'Example City',
    state: 'CA', postal_code: '90001', country_code: 'US',
  };
  const amount = { value: '40.00', currencyCode: 'USD' };
  const purchase: Row = {
    orderToken, status: 'payment_saved', paypalOrderId: 'fixture-paypal',
    customerName: 'Fixture Buyer', customerEmail: 'buyer@example.test',
    createdAt: now, updatedAt: new Date(+now - 16 * 60_000),
    canonicalOrderSnapshot: null, canonicalOrderSnapshotVersion: null, canonicalOrderSnapshotHash: null,
    receiptLink: 'https://payment-receipts.codexchristi.shop/paypal/fixture.pdf', receiptFile: 'fixture',
    djangoOrderIntentOrderId: reference.merchizeExternalOrderNumber,
    djangoPaymentSaveCustomId: 'fixture-payment', countryIso2: 'US', countryIso3: 'USA',
    authorizePayload: { purchaseUnits: [{ amount }] },
    capturePayload: { id: 'fixture-capture', status: 'COMPLETED', amount },
    shippingSnapshot: {
      shipping_address_line_1: address.address, shipping_address_line_2: address.address2,
      shipping_city: address.city, shipping_state: address.state, zip_code: address.postal_code,
      shipping_country: 'USA',
    },
    cartSnapshot: [],
    merchizeFulfillmentResponsePayload: {
      status: 201, success: true, data: {
        processing_status: 'completed',
        response_data: { data: { order_id: reference.merchizeExternalOrderNumber } },
      },
    },
  };
  const providerOrder: Row = {
    ...reference, id: 'fixture-ops', orderToken, djangoPaymentSaveCustomId: purchase.djangoPaymentSaveCustomId,
    merchizeOrderId: 'fixture-provider-order', heldAt: null, lastLookupAt: null, duplicateDetectedAt: null,
    pushAcknowledgedAt: null, pushVerifiedAt: null, updatedAt: now,
  };
  const attempts: Row[] = [], customerNotices: Row[] = [];
  const ledger = {
    paypalIntent: fixtureTable([purchase]), paypalWebhookEvent: fixtureTable([]),
    paidOrderRecoveryProjection: fixtureTable([]), adminNotificationOutbox: fixtureTable([]),
    customerNotificationOutbox: fixtureTable(customerNotices),
    $transaction: (run: (tx: unknown) => Promise<unknown>) => run(ledger),
  };
  const orders = fixtureTable([providerOrder]);
  const attemptTable = fixtureTable(attempts);
  const ops = {
    merchizeFulfillmentOrder: {
      ...orders,
      upsert: async () => ({ ...providerOrder }),
      findFirst: async (query: { where: Row; include?: { syncAttempts?: { where: Row } } }) => {
        const row = await orders.findFirst(query);
        const filter = query.include?.syncAttempts?.where;
        return row && {
          ...row,
          ...(filter ? { syncAttempts: attempts.filter((attempt) => matches(attempt, filter)) } : {}),
        };
      },
    },
    merchizeFulfillmentSyncAttempt: attemptTable,
    merchizeFulfillmentItem: fixtureTable([]),
    $transaction: (run: (tx: unknown) => Promise<unknown>) => run(ops),
  };
  global.__paypalTxLedger__ = ledger as unknown as NonNullable<typeof global.__paypalTxLedger__>;
  global.__merchizeFulfillmentOpsPrisma__ = ops as unknown as NonNullable<typeof global.__merchizeFulfillmentOpsPrisma__>;
  const buyerMessages: string[] = [];
  t.mock.method(SendMailClient.prototype, 'sendMail', async (mail: {
    subject: string; to: Array<{ email_address: { address: string } }>;
  }) => {
    if (mail.to[0]?.email_address.address === purchase.customerEmail) buyerMessages.push(mail.subject);
    return {};
  });
  const unexpected: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const endpoint = url.pathname.split('/').at(-1);
    const deny = () => { unexpected.push(`${url.hostname} ${endpoint}`); throw Error('Unexpected fixture request'); };
    const ok = (data: unknown) => Response.json({ success: true, data });
    if (url.hostname !== 'merchize.example.test') return deny();
    if (init?.method !== 'GET' && endpoint !== 'list-orders-ticket') return deny();
    const item = { _id: 'fixture-item', ffm_map_item_status: 'mapped', variant: { is_active: true } };
    if (endpoint === 'order-detail') return ok({
      ...invoiceRow, _id: providerOrder.merchizeOrderId,
      order_status: 'unfulfilled', items: [item],
    });
    if (endpoint === providerOrder.merchizeOrderId) return ok({
      ...invoiceRow, _id: providerOrder.merchizeOrderId, order_status: 'open',
      validate_shipping_address: 'street_undefined',
      artwork_status: 'ready', paid_at: now.toISOString(),
      fulfillment_status: 'unfulfilled',
      has_push_fulfill: false,
      estimated_ffm_cost: { total: 21.3 },
      push_to_fulfillment_progress: '', items: [item],
    });
    if (endpoint === 'buyerdetails') {
      return ok({ shipping_address: address });
    }
    if (endpoint === 'order-invoice') return ok([{ ...invoiceRow, fulfillment_cost: 0 }]);
    if (endpoint === 'send-to-fulfillment-date') return ok({ is_pushed: false, is_failed: false });
    if (endpoint === 'order-progress') return ok([{ ...invoiceRow, order_progress: [{
      event: 'pushed_order', status: 'pending', actual: new Date().toISOString(),
    }] }]);
    if (endpoint === 'unfulfilled') return ok([item]);
    if (endpoint === 'histories') return ok([{ event: 'map_item' }, { event: 'order_imported' }]);
    if (['address-suggestion', 'require-attention', 'tracking', 'transaction-fee',
      'list-orders-ticket'].includes(endpoint ?? '')) return ok([]);
    return deny();
  });

  await runPaidFulfillmentProcessing(orderToken, { executionScope: 'merchize_fulfillment_only' });
  assert.equal(purchase.lastErrorCode, 'MERCHIZE_ADDRESS_INVALID');
  assert.equal(purchase.status, 'fulfillment_attention_required');
  assert.deepEqual(customerNotices.map(({ type, status }) => ({ type, status })), [
    { type: 'paid_order_address_correction_required', status: 'sent' },
  ]);
  assert.deepEqual(await sendPendingCustomerNotifications(), []);
  assert.equal(buyerMessages.length, 1);
  assert.match(buyerMessages[0], /^Check your delivery address/u);
  assert.deepEqual(unexpected, []);
});
