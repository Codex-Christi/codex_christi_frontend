import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bindCheckoutEmailProofOwner,
  isCheckoutEmailProofOwner,
  readUpstreamEmailProof,
  type CheckoutEmailProof,
} from '../checkoutProof';
import {
  canReuseCheckoutEmailProof,
  checkoutEmailChallengeScope,
  matchesCheckoutEmailIdentity,
} from './checkoutEmailVerification';

const proof: CheckoutEmailProof = {
  browserId: 'browser-one',
  intentUuid: 'intent-one',
  orderId: 'order-one',
  email: 'customer@example.test',
  addressHash: 'address-one',
  verified: true,
  ownerId: null,
};

test('an upstream verified response is reusable only with matching browser-owned proof', () => {
  assert.equal(canReuseCheckoutEmailProof(null, proof, 'browser-one'), false);
  assert.equal(
    canReuseCheckoutEmailProof({ ...proof, verified: false }, proof, 'browser-one'),
    false,
  );
  assert.equal(canReuseCheckoutEmailProof(proof, proof, null), false);
  assert.equal(canReuseCheckoutEmailProof(proof, proof, 'browser-two'), false);
  assert.equal(canReuseCheckoutEmailProof(proof, proof, 'browser-one'), true);
  for (const key of ['intentUuid', 'orderId', 'email', 'addressHash'] as const)
    assert.equal(
      canReuseCheckoutEmailProof(proof, { ...proof, [key]: 'changed' }, 'browser-one'),
      false,
    );
});

test('pending verification identity requires the browser, email, intent and exact order', () => {
  const expected = {
    browserId: proof.browserId!,
    intentUuid: proof.intentUuid,
    email: proof.email,
    orderId: proof.orderId,
  };
  assert.equal(matchesCheckoutEmailIdentity(proof, expected), true);
  assert.equal(matchesCheckoutEmailIdentity(null, expected), false);
  for (const key of ['browserId', 'intentUuid', 'email', 'orderId'] as const)
    assert.equal(matchesCheckoutEmailIdentity(proof, { ...expected, [key]: 'changed' }), false);
});

test('checkout code scope changes with any payment-relevant proof identity', () => {
  const scope = checkoutEmailChallengeScope(proof);
  for (const key of [
    'browserId',
    'ownerId',
    'intentUuid',
    'orderId',
    'email',
    'addressHash',
  ] as const)
    assert.notEqual(checkoutEmailChallengeScope({ ...proof, [key]: 'changed' }), scope);
  assert.throws(() => checkoutEmailChallengeScope({ ...proof, browserId: undefined }));
});

test('guest proof can follow sign-in once while account proof rejects logout and account switching', () => {
  const guest = { ...proof, ownerId: null };
  assert.equal(isCheckoutEmailProofOwner(guest, 'account-a'), true);
  const account = bindCheckoutEmailProofOwner(guest, 'account-a');
  assert.equal(account.ownerId, 'account-a');
  assert.equal(bindCheckoutEmailProofOwner(account, 'account-a'), account);
  assert.equal(isCheckoutEmailProofOwner(account, null), false);
  assert.equal(isCheckoutEmailProofOwner(account, 'account-b'), false);
  assert.equal(isCheckoutEmailProofOwner({ ...proof, ownerId: undefined }, 'account-a'), false);
  assert.throws(() => bindCheckoutEmailProofOwner(account, 'account-b'));
  assert.equal(canReuseCheckoutEmailProof(account, proof, 'browser-one', 'account-a'), true);
  assert.equal(canReuseCheckoutEmailProof(account, proof, 'browser-one', 'account-b'), false);
});

test('an expired upstream intent retains its identity for resend without verifying email', () => {
  const pending = readUpstreamEmailProof(
    {
      success: true,
      data: {
        id: 'intent-one',
        order_id: 'order-one',
        email: proof.email,
        otp_status: 'expired',
        address: '12 Main Road',
        address_2: '',
        city: 'San Jose',
        state: 'CA',
        country: 'US',
        zip_code: '95131',
      },
    },
    proof.email,
  );
  assert.equal(pending.verified, false);
  assert.equal(pending.intentUuid, proof.intentUuid);
  assert.equal(pending.orderId, proof.orderId);
  assert.equal(canReuseCheckoutEmailProof(pending, pending, 'browser-one'), false);
});
