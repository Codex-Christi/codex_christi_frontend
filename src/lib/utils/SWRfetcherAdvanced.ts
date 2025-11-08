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

// --- Start of new logging utility ---
const isDebugging = process.env.NODE_ENV !== 'production';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function logFetchRequest(key: string, fo: FetcherOptions) {
  if (!isDebugging) {
    return;
  }

  // Create a Headers instance to safely check and get header values.
  const headersInstance = new Headers(fo.headers as HeadersInit);

  // Use the .get() method to safely retrieve the Content-Type header.
  const contentType = headersInstance.get('Content-Type');

  let bodyContent = fo.body;

  // Conditionally parse the body only if the Content-Type is 'application/json'.
  // Using .get() is the correct, type-safe way to access headers.
  try {
    if (
      bodyContent &&
      typeof bodyContent === 'string' &&
      contentType?.includes('application/json')
    ) {
      bodyContent = JSON.parse(bodyContent);
    }
  } catch (error) {
    console.log(error);

    // Gracefully ignore parsing errors if the body isn't a valid JSON string.
  }

  // Convert the Headers instance back to a plain object for logging.
  const headersObject = Object.fromEntries(headersInstance.entries());

  console.groupCollapsed(`DEBUG FETCH: ${fo.method} ${key}`);
  console.log('Request URL:', key);
  console.log('Method:', fo.method);
  console.log('Headers:', headersObject);
  console.log('Body:', bodyContent);
  console.groupEnd();
}
// --- End of new logging utility ---

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

  // --- Start of logging integration ---
  // logFetchRequest(key, fo);
  // --- End of logging integration ---

  try {
    const res = await fetch(key, {
      method: fo.method,
      headers: fo.headers,
      body: fo.body as BodyInit | undefined,
    });

    if (!res.ok) {
      console.log(await res.text());

      let errInfo: Record<string, unknown> | null = null;
      try {
        errInfo = await res.json();
      } catch {
        const txt = await res
          .text()
          .then((v) => v)
          .catch(() => null);
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
      // You can add log for json parsing error
      if (isDebugging) console.error('JSON parsing error:', jsonErr);

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
