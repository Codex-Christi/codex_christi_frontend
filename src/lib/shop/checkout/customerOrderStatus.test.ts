import assert from 'node:assert/strict';
import test from 'node:test';
import {
  toCustomerOrderStatus,
  type CustomerOrderStatusFields,
  type CustomerOrderStatusRow,
} from './customerOrderStatus';

function row(patch: Partial<CustomerOrderStatusRow> = {}): CustomerOrderStatusRow {
  return {
    orderToken: 'local-order-reference',
    status: 'intent_created',
    retryCount: 0,
    lastEventType: 'CHECKOUT.ORDER.CREATED',
    updatedAt: new Date('2026-11-21T12:00:00.000Z'),
    ...patch,
  };
}

test('the status response lists only public fields and rebuilds nested values', () => {
  const source = {
    ...row({ status: 'error', djangoPaymentSaveCustomId: 'private-django-id' }),
    customerEmail: 'private-email@example.test',
    customerName: 'Private Customer',
    shippingSnapshot: { address: 'Private Street' },
    paypalOrderId: 'private-paypal-id',
    lastErrorCode: 'PRIVATE_ERROR_CODE',
    lastErrorMessage: 'Private provider diagnostic',
  };
  const fields = {
    status: 'error',
    receiptLink: '/next-api/shop/orders/local-order-reference/receipt',
    receiptFile: 'Codex-Christi-receipt',
    paidAmountLabel: '$25.00',
    cartPurchase: {
      orderId: source.orderToken,
      privateProviderId: 'private-cart-provider-id',
      lines: [{ variantId: 'public-variant', quantity: 1, email: 'private-line@example.test' }],
    },
    customerRecoveryStatus: 'paid_unresolved',
    recoveryReason: 'Your order needs review.',
    fulfillmentOnHold: true,
    fulfillmentCheckedAt: new Date('2026-01-01T12:05:00Z'),
    error: { message: 'Your order needs review.', code: 'PRIVATE_ERROR_CODE', stack: 'private' },
    privateField: 'private-extra-field',
  } as unknown as CustomerOrderStatusFields;
  const result = toCustomerOrderStatus(source, fields);

  assert.deepEqual(Object.keys(result).sort(), [
    'cartPurchase',
    'customerRecoveryStatus',
    'error',
    'fulfillmentCheckedAt',
    'fulfillmentOnHold',
    'orderToken',
    'paidAmountLabel',
    'paymentProgressed',
    'paymentSaved',
    'processingCompletedAt',
    'receiptFile',
    'receiptLink',
    'receiptReady',
    'recoveryReason',
    'status',
    'updatedAt',
  ]);
  assert.deepEqual(result.error, { message: 'Your order needs review.' });
  assert.equal(result.fulfillmentOnHold, true);
  assert.equal(result.fulfillmentCheckedAt, '2026-01-01T12:05:00.000Z');
  assert.deepEqual(result.cartPurchase, {
    orderId: source.orderToken,
    lines: [{ variantId: 'public-variant', quantity: 1 }],
  });
  assert.notEqual(result.cartPurchase, fields.cartPurchase);
  assert.notEqual(result.error, fields.error);
  const serialized = JSON.stringify(result);
  for (const secret of ['private-', 'Private Customer', 'Private Street', 'PRIVATE_ERROR_CODE'])
    assert.equal(serialized.includes(secret), false, secret);
});

test('a receipt is ready only when the checked download path and label both exist', () => {
  const source = row({ status: 'payment_saved', djangoPaymentSaveCustomId: 'internal-save-id' });
  const empty = toCustomerOrderStatus(source, { status: 'payment_saved' });
  assert.equal(empty.paymentSaved, true);
  assert.equal(empty.receiptReady, false);
  assert.equal(empty.receiptLink, null);
  assert.equal(empty.receiptFile, null);
  for (const fields of [
    { receiptLink: '/checked-receipt' },
    { receiptFile: 'receipt-label' },
    { receiptLink: '/checked-receipt', receiptFile: ' ' },
    { receiptLink: ' ', receiptFile: 'receipt-label' },
  ])
    assert.equal(
      toCustomerOrderStatus(source, { status: source.status, ...fields }).receiptReady,
      false,
    );
  assert.equal(
    toCustomerOrderStatus(source, {
      status: source.status,
      receiptLink: '/checked-receipt',
      receiptFile: 'receipt-label',
    }).receiptReady,
    true,
  );
});

test('only a conclusively untouched intent reports no payment progress', () => {
  for (const lastEventType of [null, undefined, 'CHECKOUT.ORDER.CREATED'])
    assert.equal(
      toCustomerOrderStatus(row({ lastEventType }), { status: 'intent_created' }).paymentProgressed,
      false,
    );
  for (const patch of [
    { status: 'authorized' },
    { status: 'captured' },
    { status: 'completed' },
    { status: 'refunded' },
    { status: 'unknown' },
    { retryCount: 1 },
    { retryCount: undefined },
    { lastEventType: 'PAYMENT.AUTHORIZATION.CREATED' },
    { lastEventType: '' },
  ]) {
    const source = row(patch);
    assert.equal(toCustomerOrderStatus(source, { status: source.status }).paymentProgressed, true);
  }
});

test('older clients cannot treat saved progress as an untouched payment after internal fields are removed', () => {
  const oldClientCanReplace = (value: unknown) => {
    const status = value as Record<string, unknown>;
    return (
      status.status === 'intent_created' &&
      (!status.lastEventType || status.lastEventType === 'CHECKOUT.ORDER.CREATED') &&
      !status.error &&
      !status.cartPurchase &&
      !status.paidAmountLabel &&
      !status.customerRecoveryStatus &&
      !status.processingCompletedAt &&
      !status.receiptLink &&
      !status.receiptFile &&
      !status.djangoPaymentSaveCustomId
    );
  };
  const fields = { status: 'intent_created' };
  assert.equal(oldClientCanReplace(toCustomerOrderStatus(row(), fields)), true);
  for (const patch of [
    { lastEventType: 'CHECKOUT.ORDER.APPROVED' },
    { retryCount: undefined },
    { paypalAuthorizationId: 'saved-authorization' },
    { djangoPaymentSaveCustomId: 'saved-payment' },
  ]) {
    const source = row(patch);
    const result = toCustomerOrderStatus(source, fields);
    assert.equal(result.status, 'pending');
    assert.equal(result.paymentProgressed, true);
    assert.equal(result.paidAmountLabel, null);
    assert.equal(source.status, 'intent_created');
    assert.equal(oldClientCanReplace(result), false);
  }
});

test('saved authorization, capture, error, receipt, fulfillment, and lock evidence block replacement', () => {
  const evidence: Array<Partial<CustomerOrderStatusRow>> = [
    { paypalAuthorizationId: 'authorization' },
    { authorizePayload: {} },
    { capturePayload: {} },
    { lastErrorCode: '' },
    { lastErrorMessage: 'private diagnostic' },
    { receiptLink: '/stored-receipt' },
    { receiptFile: 'stored-receipt' },
    { djangoPaymentSaveCustomId: 'saved-payment' },
    { djangoPaymentSaveResponsePayload: {} },
    { merchizeFulfillmentRequestPayload: {} },
    { merchizeFulfillmentResponsePayload: {} },
    { merchizeFulfillmentProcessingId: 'processing-id' },
    { merchizeProviderOrderId: 'provider-id' },
    { merchizeProviderOrderCode: 'provider-code' },
    { fulfillmentAddressOverride: {} },
    { fulfillmentAddressOverrideReason: 'reason' },
    { fulfillmentAddressOverriddenBy: 'admin' },
    { fulfillmentAddressOverriddenAt: new Date() },
    { processingTriggerSource: 'capture' },
    { processingTriggerDetail: 'detail' },
    { processingTriggeredAt: new Date() },
    { processingCompletedAt: new Date() },
    { postProcessingLockId: 'lock' },
    { postProcessingLockedAt: new Date() },
    { postProcessingLockExpiresAt: new Date() },
  ];
  for (const patch of evidence) {
    const result = toCustomerOrderStatus(row(patch), { status: 'intent_created' });
    assert.equal(result.paymentProgressed, true, Object.keys(patch)[0]);
    assert.equal(result.paidAmountLabel, null);
  }
});

test('saved-payment evidence becomes a boolean without implying a downloadable receipt', () => {
  for (const id of [null, undefined, '', ' '])
    assert.equal(
      toCustomerOrderStatus(row({ djangoPaymentSaveCustomId: id }), { status: 'intent_created' })
        .paymentSaved,
      false,
    );
  const result = toCustomerOrderStatus(row({ djangoPaymentSaveCustomId: 'saved-id' }), {
    status: 'intent_created',
  });
  assert.equal(result.paymentSaved, true);
  assert.equal(result.paymentProgressed, true);
  assert.equal(result.receiptReady, false);
});

test('status dates serialize as ISO values without parsing ambiguous date strings', () => {
  const updatedAt = new Date('2026-11-21T12:34:56.789Z');
  const completedAt = new Date('2026-11-21T12:35:00.000Z');
  const result = toCustomerOrderStatus(row({ updatedAt, processingCompletedAt: completedAt }), {
    status: 'completed',
  });
  assert.equal(result.updatedAt, updatedAt.toISOString());
  assert.equal(result.processingCompletedAt, completedAt.toISOString());
  for (const value of [
    null,
    undefined,
    new Date('invalid'),
    '11/12/2026',
    'private@example.test',
  ]) {
    const invalid = toCustomerOrderStatus(
      { ...row(), updatedAt: value, processingCompletedAt: value } as CustomerOrderStatusRow,
      { status: 'completed' },
    );
    assert.equal(invalid.updatedAt, null);
    assert.equal(invalid.processingCompletedAt, null);
  }
});
