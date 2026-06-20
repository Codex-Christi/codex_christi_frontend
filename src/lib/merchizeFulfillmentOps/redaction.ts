import 'server-only';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;
const TOKEN_PATTERN = /\b(?:eyJ[A-Za-z0-9_-]+|[A-Za-z0-9_-]{32,})\b/g;

const SENSITIVE_KEY_PARTS = [
  'address',
  'buyer',
  'customer',
  'email',
  'first_name',
  'firstname',
  'last_name',
  'lastname',
  'name',
  'phone',
  'postal',
  'recipient',
  'shipping',
  'street',
  'token',
  'zip',
];

export function redactEmail(email: string | null | undefined) {
  if (!email) return null;
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '[redacted-email]';

  return `${localPart.charAt(0)}***@${domain}`;
}

export function redactText(value: string) {
  return value
    .replace(EMAIL_PATTERN, (email) => redactEmail(email) ?? '[redacted-email]')
    .replace(PHONE_PATTERN, '[redacted-phone]')
    .replace(TOKEN_PATTERN, '[redacted-token]');
}

function shouldRedactKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

export function redactOperationalPayload(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[redacted-depth-limit]';
  if (typeof value === 'string') return redactText(value);
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value))
    return value.slice(0, 20).map((item) => redactOperationalPayload(item, depth + 1));

  const redacted: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    redacted[key] = shouldRedactKey(key)
      ? '[redacted]'
      : redactOperationalPayload(nestedValue, depth + 1);
  }

  return redacted;
}

export function safeLogErrorMessage(error: unknown) {
  return redactText(error instanceof Error ? error.message : String(error));
}
