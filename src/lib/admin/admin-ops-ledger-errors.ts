export class AdminOpsLedgerUnavailableError extends Error {
  constructor(message = 'Admin Ops Ledger database is unavailable.') {
    super(message);
    this.name = 'AdminOpsLedgerUnavailableError';
  }
}

export function toAdminOpsLedgerUnavailableError(error: unknown) {
  if (isAdminOpsLedgerUnavailableError(error)) {
    return error;
  }

  if (!isPrismaConnectionError(error)) {
    return null;
  }

  return new AdminOpsLedgerUnavailableError(
    'Admin Ops Ledger database is unreachable. Check the Neon project, database URL, and network access.',
  );
}

export function isAdminOpsLedgerUnavailableError(
  error: unknown,
): error is AdminOpsLedgerUnavailableError {
  return error instanceof AdminOpsLedgerUnavailableError;
}

function isPrismaConnectionError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as { code?: string; message?: string; name?: string };
  const message = record.message ?? '';

  return (
    record.code === 'P1001' ||
    record.name === 'PrismaClientInitializationError' ||
    message.includes("Can't reach database server") ||
    message.includes('Timed out fetching a new connection from the connection pool')
  );
}
