export type PublicRuntimeConfig = Readonly<{
  siteUrl: string;
  shopSiteUrl: string;
  paymentMode: 'sandbox' | 'live';
  paymentClientId: string;
  cartKey: string;
  analyticsOrgToken: string | null;
  analyticsShopToken: string | null;
}>;

type RuntimeConfigStatus = Readonly<
  | { status: 'loading' | 'error'; config: null }
  | { status: 'ready'; config: PublicRuntimeConfig }
>;

const unavailable = 'Browser configuration is unavailable.';
const publicKeys = [
  'siteUrl',
  'shopSiteUrl',
  'paymentMode',
  'paymentClientId',
  'cartKey',
  'analyticsOrgToken',
  'analyticsShopToken',
] as const;
const initialStatus: RuntimeConfigStatus = { status: 'loading', config: null };

function isSiteUrl(value: unknown, approved: string[]): value is string {
  return typeof value === 'string' && approved.includes(value.replace(/\/$/, ''));
}

function isBrowserToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(value);
}

function isCartKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 4096 &&
    !/[\x00-\x1f\x7f-\x9f$`\u2028\u2029]/.test(value)
  );
}

function parsePublicConfig(value: unknown): PublicRuntimeConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(unavailable);
  const candidate = value as Record<string, unknown>;
  if (
    Object.keys(candidate).length !== publicKeys.length ||
    !publicKeys.every((key) => Object.prototype.hasOwnProperty.call(candidate, key))
  ) {
    throw new Error(unavailable);
  }

  const {
    siteUrl,
    shopSiteUrl,
    paymentMode,
    paymentClientId,
    cartKey,
    analyticsOrgToken,
    analyticsShopToken,
  } = candidate;
  if (
    !isSiteUrl(siteUrl, ['https://codexchristi.org', 'https://www.codexchristi.org']) ||
    !isSiteUrl(shopSiteUrl, ['https://codexchristi.shop', 'https://www.codexchristi.shop']) ||
    (paymentMode !== 'sandbox' && paymentMode !== 'live') ||
    !isBrowserToken(paymentClientId) ||
    !isCartKey(cartKey) ||
    (analyticsOrgToken !== null && !isBrowserToken(analyticsOrgToken)) ||
    (analyticsShopToken !== null && !isBrowserToken(analyticsShopToken))
  ) {
    throw new Error(unavailable);
  }

  return Object.freeze({
    siteUrl,
    shopSiteUrl,
    paymentMode,
    paymentClientId,
    cartKey,
    analyticsOrgToken,
    analyticsShopToken,
  });
}

async function requestConfiguration(request: typeof fetch, timeoutMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(unavailable));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(async () => {
        const response = await request('/next-api/runtime-config', {
          cache: 'no-store',
          credentials: 'omit',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(unavailable);
        return parsePublicConfig(await response.json());
      }),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Keep the promise and snapshot in the document's shared module instance rather
// than refetching configuration from every component, cart or checkout request.
export function createPublicRuntimeConfigLoader(
  request: typeof fetch = (...args) => fetch(...args),
  timeoutMs = 8000,
) {
  let snapshot = initialStatus;
  let pending: Promise<PublicRuntimeConfig> | undefined;
  const listeners = new Set<() => void>();

  function update(next: RuntimeConfigStatus) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function load(): Promise<PublicRuntimeConfig> {
    if (snapshot.status === 'ready') return Promise.resolve(snapshot.config);
    if (pending) return pending;

    pending = requestConfiguration(request, timeoutMs)
      .then((config) => {
        update({ status: 'ready', config });
        return config;
      })
      .catch(() => {
        update({ status: 'error', config: null });
        // Errors from fetch or JSON parsing may include data. Use a fixed message.
        throw new Error(unavailable);
      })
      .finally(() => {
        pending = undefined;
      });

    if (snapshot.status === 'error') update(initialStatus);
    return pending;
  }

  return {
    load,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialStatus,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const loader = createPublicRuntimeConfigLoader();

export const loadPublicRuntimeConfig = loader.load;
export const getRuntimeConfigSnapshot = loader.getSnapshot;
export const getRuntimeConfigServerSnapshot = loader.getServerSnapshot;
export const subscribeToRuntimeConfig = loader.subscribe;
