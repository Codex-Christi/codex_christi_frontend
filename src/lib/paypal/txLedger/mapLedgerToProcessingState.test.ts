import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mapLedgerToProcessingState,
  type PayPalTxPaymentStatusResponse,
} from './mapLedgerToProcessingState';

const receipt: PayPalTxPaymentStatusResponse = {
  orderToken: 'checkout-reference',
  status: 'receipt_uploaded',
  receiptLink: 'https://receipts.example/receipt.pdf',
  receiptFile: 'receipt.pdf',
};

test('a downloadable receipt is done while fulfillment remains pending', () => {
  const state = mapLedgerToProcessingState(receipt);

  assert.equal(state.flowStatus, 'processing');
  assert.deepEqual(state.steps.map((step) => step.status), ['success', 'success', 'idle']);
  assert.equal(state.receiptLink, receipt.receiptLink);
  assert.equal(state.receiptFileName, receipt.receiptFile);
});

test('receipt preparation stays in progress if either download field is missing', () => {
  for (const missing of ['receiptLink', 'receiptFile'] as const) {
    const state = mapLedgerToProcessingState({ ...receipt, [missing]: null });

    assert.equal(state.flowStatus, 'processing');
    assert.deepEqual(state.steps.map((step) => step.status), ['success', 'pending', 'idle']);
  }
});

test('stalled processing after receipt upload keeps the receipt done and requests review', () => {
  const reason = 'Payment-save or fulfillment handoff did not finish.';
  const state = mapLedgerToProcessingState({
    ...receipt,
    customerRecoveryStatus: 'paid_unresolved',
    recoveryReason: reason,
  });

  assert.equal(state.flowStatus, 'error');
  assert.equal(state.needsManualReview, true);
  assert.deepEqual(state.steps.map((step) => step.status), ['success', 'success', 'error']);
  assert.equal(state.steps[2].errorMessage, reason);
});

test('stalled processing after payment save requests review instead of staying in progress', () => {
  const state = mapLedgerToProcessingState({
    ...receipt,
    status: 'payment_saved',
    djangoPaymentSaveCustomId: 'saved-payment',
    customerRecoveryStatus: 'paid_unresolved',
  });

  assert.equal(state.flowStatus, 'error');
  assert.equal(state.needsManualReview, true);
  assert.deepEqual(state.steps.map((step) => step.status), ['success', 'success', 'error']);
});

test('an error takes precedence over normal receipt and payment checkpoints', () => {
  for (const status of ['receipt_uploaded', 'payment_saved']) {
    const state = mapLedgerToProcessingState({
      ...receipt,
      status,
      error: { message: 'Processing stopped.' },
    });

    assert.equal(state.flowStatus, 'error');
    assert.deepEqual(state.steps.map((step) => step.status), ['success', 'success', 'error']);
    assert.equal(state.steps[2].errorMessage, 'Processing stopped.');
  }
});

test('an unfinished receipt needs attention when paid processing stalls', () => {
  const state = mapLedgerToProcessingState({
    ...receipt,
    receiptFile: null,
    customerRecoveryStatus: 'paid_unresolved',
  });

  assert.equal(state.flowStatus, 'error');
  assert.deepEqual(state.steps.map((step) => step.status), ['success', 'error', 'idle']);
});

test('completed and missing records retain their terminal states', () => {
  const completed = mapLedgerToProcessingState({ ...receipt, status: 'completed' });
  const missing = mapLedgerToProcessingState({ orderToken: receipt.orderToken, status: 'not_found' });

  assert.equal(completed.flowStatus, 'completed');
  assert.deepEqual(completed.steps.map((step) => step.status), ['success', 'success', 'success']);
  assert.equal(missing.flowStatus, 'idle');
  assert.deepEqual(missing.steps.map((step) => step.status), ['idle', 'idle', 'idle']);
});
