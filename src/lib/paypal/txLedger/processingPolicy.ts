import 'server-only';

function requiredBooleanEnv(name: string) {
  const value = process.env[name]?.toLowerCase();

  if (value === 'true') return true;
  if (value === 'false') return false;

  throw new Error(`Invalid ${name}. Expected "true" or "false".`);
}

export function isCaptureRouteRunnerEnabled() {
  return requiredBooleanEnv('PAYPAL_TX_LEDGER_ENABLE_CAPTURE_ROUTE_RUNNER');
}

function requiredPositiveIntegerEnv(name: string) {
  const value = process.env[name];
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed > 0) return parsed;

  throw new Error(`Invalid ${name}. Expected a positive integer.`);
}

export function isRecoveryScannerEnabled() {
  return requiredBooleanEnv('PAYPAL_TX_LEDGER_RECOVERY_SCANNER_ENABLED');
}

export function getRecoveryScannerMinAgeMinutes() {
  return requiredPositiveIntegerEnv('PAYPAL_TX_LEDGER_RECOVERY_SCANNER_MIN_AGE_MINUTES');
}

export function getRecoveryScannerBatchSize() {
  return requiredPositiveIntegerEnv('PAYPAL_TX_LEDGER_RECOVERY_SCANNER_BATCH_SIZE');
}
