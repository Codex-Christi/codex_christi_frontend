export type PaidOrderRecoveryIssue = {
  code: string | null;
  message: string | null;
};

function hasIssue(issue: PaidOrderRecoveryIssue) {
  return Boolean(issue.code || issue.message);
}

export function resolvePaidOrderRecoveryIssue({
  ledgerIssue,
  providerIssue,
  providerIssueIsCurrent,
}: {
  ledgerIssue: PaidOrderRecoveryIssue;
  providerIssue: PaidOrderRecoveryIssue | null;
  providerIssueIsCurrent: boolean;
}): PaidOrderRecoveryIssue {
  if (!providerIssue || !hasIssue(providerIssue)) return ledgerIssue;
  if (!hasIssue(ledgerIssue)) return providerIssue;

  if (providerIssueIsCurrent && ledgerIssue.code?.startsWith('MERCHIZE_')) {
    return providerIssue;
  }

  return ledgerIssue;
}
