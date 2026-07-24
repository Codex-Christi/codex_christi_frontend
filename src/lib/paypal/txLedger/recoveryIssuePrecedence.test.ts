import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePaidOrderRecoveryIssue } from './recoveryIssuePrecedence';

test('uses a current readiness blocker instead of an older Merchize ledger issue', () => {
  const issue = resolvePaidOrderRecoveryIssue({
    ledgerIssue: {
      code: 'MERCHIZE_CATALOG_MAPPING_REQUIRED',
      message: 'Historical mapping error.',
    },
    providerIssue: {
      code: 'MERCHIZE_MANUAL_RELEASE_REQUIRED',
      message: 'Current manual release requirement.',
    },
    providerIssueIsCurrent: true,
  });

  assert.deepEqual(issue, {
    code: 'MERCHIZE_MANUAL_RELEASE_REQUIRED',
    message: 'Current manual release requirement.',
  });
});

test('does not replace a payment-side ledger issue with provider readiness', () => {
  const issue = resolvePaidOrderRecoveryIssue({
    ledgerIssue: {
      code: 'POST_PROCESSING_FAILED',
      message: 'Payment-side processing failed.',
    },
    providerIssue: {
      code: 'MERCHIZE_MANUAL_RELEASE_REQUIRED',
      message: 'Current manual release requirement.',
    },
    providerIssueIsCurrent: true,
  });

  assert.equal(issue.code, 'POST_PROCESSING_FAILED');
});

test('does not replace a newer Merchize ledger issue with stale provider state', () => {
  const issue = resolvePaidOrderRecoveryIssue({
    ledgerIssue: {
      code: 'MERCHIZE_PUSH_DISABLED_BY_CONFIG',
      message: 'Push is disabled.',
    },
    providerIssue: {
      code: 'MERCHIZE_MANUAL_RELEASE_REQUIRED',
      message: 'Older manual release requirement.',
    },
    providerIssueIsCurrent: false,
  });

  assert.equal(issue.code, 'MERCHIZE_PUSH_DISABLED_BY_CONFIG');
});

test('uses the provider issue when the ledger does not contain an issue', () => {
  const issue = resolvePaidOrderRecoveryIssue({
    ledgerIssue: { code: null, message: null },
    providerIssue: {
      code: 'MERCHIZE_ADDRESS_INVALID',
      message: 'Current address issue.',
    },
    providerIssueIsCurrent: true,
  });

  assert.equal(issue.code, 'MERCHIZE_ADDRESS_INVALID');
});
