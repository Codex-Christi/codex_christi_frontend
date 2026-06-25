type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

export function asString(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

export function getNestedAuthToken(payload: unknown, tokenName: 'access' | 'refresh') {
  const root = asRecord(payload);
  const data = asRecord(root?.data);

  return (
    asString(data?.[tokenName]) ??
    asString(data?.[`${tokenName}Token`]) ??
    asString(root?.[tokenName]) ??
    asString(root?.[`${tokenName}Token`])
  );
}

export function getDjangoAuthErrorMessage(payload: unknown, fallback: string) {
  const root = asRecord(payload);
  const firstError = Array.isArray(root?.errors) ? asRecord(root.errors[0]) : null;

  return (
    asString(firstError?.message) ??
    asString(root?.message) ??
    asString(root?.detail) ??
    fallback
  );
}
