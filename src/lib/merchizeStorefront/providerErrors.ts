export type MerchizeProviderErrorKind =
  | 'not_found'
  | 'bad_request'
  | 'forbidden_or_suspended'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'network'
  | 'unknown';

export class MerchizeProviderError extends Error {
  status: number | null;
  statusText: string | null;
  body: string | null;
  url: string;
  kind: MerchizeProviderErrorKind;

  constructor({
    url,
    status,
    statusText,
    body,
    message,
  }: {
    url: string;
    status: number | null;
    statusText?: string | null;
    body?: string | null;
    message?: string;
  }) {
    const kind = classifyMerchizeStatus(status);
    super(message ?? formatMerchizeProviderErrorMessage(url, status, statusText, body));
    this.name = 'MerchizeProviderError';
    this.url = url;
    this.status = status;
    this.statusText = statusText ?? null;
    this.body = body ?? null;
    this.kind = kind;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type StatusBearingError = {
  message?: unknown;
  name?: unknown;
  status?: unknown;
  statusText?: unknown;
  info?: unknown;
};

export function classifyMerchizeStatus(status: number | null): MerchizeProviderErrorKind {
  if (status === null) return 'network';
  if (status === 404 || status === 410) return 'not_found';
  if (status === 400 || status === 422) return 'bad_request';
  if (status === 401 || status === 403) return 'forbidden_or_suspended';
  if (status === 429) return 'rate_limited';
  if (status === 408 || status >= 500) return 'provider_unavailable';
  return 'unknown';
}

export function coerceMerchizeProviderError(error: unknown, url = '') {
  if (error instanceof MerchizeProviderError) return error;

  if (!error || typeof error !== 'object') return null;

  const candidate = error as StatusBearingError;
  const status = typeof candidate.status === 'number' ? candidate.status : null;
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  const message = typeof candidate.message === 'string' ? candidate.message : String(error);

  if (name !== 'FetcherError' && candidate.status === undefined) return null;

  const normalizedStatus =
    status === null && message.toLowerCase().includes('invalid json') ? 422 : status;

  return new MerchizeProviderError({
    url,
    status: normalizedStatus,
    statusText: typeof candidate.statusText === 'string' ? candidate.statusText : null,
    body: stringifyProviderErrorInfo(candidate.info),
    message,
  });
}

export function shouldUseStorefrontSnapshot(error: unknown) {
  const providerError = coerceMerchizeProviderError(error);
  if (!providerError) return false;

  return (
    providerError.kind === 'forbidden_or_suspended' ||
    providerError.kind === 'rate_limited' ||
    providerError.kind === 'provider_unavailable' ||
    providerError.kind === 'network'
  );
}

export function merchizeErrorStatus(error: unknown) {
  const providerError = coerceMerchizeProviderError(error);
  if (!providerError) return 500;
  if (providerError.kind === 'not_found') return 404;
  if (providerError.kind === 'bad_request') return providerError.status ?? 400;
  return providerError.status ?? 500;
}

export async function fetchMerchizeJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new MerchizeProviderError({
      url,
      status: null,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new MerchizeProviderError({
      url,
      status: response.status,
      statusText: response.statusText,
      body,
    });
  }

  return (await response.json()) as T;
}

function formatMerchizeProviderErrorMessage(
  url: string,
  status: number | null,
  statusText?: string | null,
  body?: string | null,
) {
  if (status === null) return `Merchize request failed: ${url}`;
  const bodyPreview = body ? ` - ${body.slice(0, 200)}` : '';
  return `Merchize request failed: ${status}${statusText ? ` ${statusText}` : ''}${bodyPreview}`;
}

function stringifyProviderErrorInfo(info: unknown) {
  if (!info) return null;
  if (typeof info === 'string') return info;

  try {
    return JSON.stringify(info);
  } catch {
    return String(info);
  }
}
