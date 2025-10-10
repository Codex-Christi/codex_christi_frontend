// lib/fetcher.ts

interface NormalizedError {
  original: unknown;
  message: string;
  name: string;
  stack?: string;
  cause?: unknown;
}

function normalizeError(err: unknown): NormalizedError {
  const fallback: NormalizedError = {
    original: err,
    message: String(err ?? 'Unknown error'),
    name: 'Error',
    stack: undefined,
    cause: undefined,
  };

  if (err instanceof Error) {
    return {
      original: err,
      message: err.message,
      name: err.name,
      stack: err.stack,
      cause: err.cause,
    };
  }

  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    return {
      original: err,
      message: typeof obj.message === 'string' ? obj.message : fallback.message,
      name: typeof obj.name === 'string' ? obj.name : fallback.name,
      stack: typeof obj.stack === 'string' ? obj.stack : undefined,
      cause: obj.cause,
    };
  }

  return fallback;
}

export class FetcherError extends Error {
  info: Record<string, unknown> | null;
  status: number | null;

  constructor(
    message: string,
    info: Record<string, unknown> | null = null,
    status: number | null = null,
  ) {
    super(message);
    this.name = 'FetcherError';
    this.info = info;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface FetcherOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: HeadersInit;
  body?: unknown;
}

interface UniversalFetchOptions<Arg = unknown> {
  arg?: Arg;
  fetcherOptions?: FetcherOptions;
}

// Overload when no arg (i.e. typical GET)
export async function universalFetcher<Data>(
  key: string,
  options?: UniversalFetchOptions<void>,
): Promise<Data>;

// Overload when arg is provided (mutation)
export async function universalFetcher<Data, Arg>(
  key: string,
  options: UniversalFetchOptions<Arg>,
): Promise<Data>;

// Implementation
export async function universalFetcher<Data, Arg = undefined>(
  key: string,
  options: UniversalFetchOptions<Arg> = {},
): Promise<Data> {
  const isMutation = options.arg !== undefined;

  const fo: FetcherOptions = {
    method: isMutation ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.fetcherOptions?.headers ?? {}),
    },
    ...options.fetcherOptions,
  };

  if (isMutation) {
    const body = options.arg as unknown;
    fo.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(key, {
      method: fo.method,
      headers: fo.headers,
      body: fo.body as BodyInit | undefined,
    });

    if (!res.ok) {
      let errInfo: Record<string, unknown> | null = null;
      try {
        errInfo = await res.json();
      } catch {
        const txt = await res.text().catch(() => null);
        if (txt !== null) {
          errInfo = { message: txt };
        }
      }
      throw new FetcherError(`HTTP ${res.status}`, errInfo, res.status);
    }

    try {
      const data = (await res.json()) as Data;
      return data;
    } catch (jsonErr) {
      const norm = normalizeError(jsonErr);
      throw new FetcherError('Invalid JSON response', { cause: norm }, null);
    }
  } catch (err: unknown) {
    const norm = normalizeError(err);
    if (err instanceof FetcherError) {
      throw err;
    }
    throw new FetcherError(
      norm.message,
      { name: norm.name, stack: norm.stack, cause: norm.cause },
      null,
    );
  }
}
