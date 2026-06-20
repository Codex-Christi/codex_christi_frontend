import 'server-only';

import { redactText } from './redaction';
import type {
  MerchizeInDepthOrderDetailResponse,
  MerchizeOrderLookupResponse,
} from './merchizeTypes';

const DEFAULT_TIMEOUT_MS = 15_000;

type MerchizeRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  timeoutMs?: number;
};

export type MerchizeExternalOrderReference =
  | {
      code: string;
      externalNumber?: string | null;
      identifier?: string | null;
    }
  | {
      code?: string | null;
      externalNumber: string;
      identifier?: string | null;
    };

export type MerchizeExternalOrderStatusAction = 'hold' | 'resume';

export type MerchizeExternalOrderMutationResponse = {
  success?: boolean;
  status?: unknown;
  message?: string;
  data?: unknown;
  error?: unknown;
};

export type MerchizeExternalOrderSnapshotResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

export class MerchizeApiError extends Error {
  status: number | null;
  code: string;
  responseSummary: unknown;

  constructor(
    message: string,
    args: {
      status?: number | null;
      code?: string;
      responseSummary?: unknown;
    } = {},
  ) {
    super(redactText(message));
    this.name = 'MerchizeApiError';
    this.status = args.status ?? null;
    this.code = args.code ?? 'MERCHIZE_API_ERROR';
    this.responseSummary = args.responseSummary ?? null;
  }
}

function getMerchizeConfig() {
  const baseUrl = process.env.MERCHIZE_BO_API_BASE_URL ?? process.env.MERCHIZE_BASE_URL;
  const apiKey = process.env.MERCHIZE_API_KEY;
  const accessToken = process.env.MERCHIZE_ACCESS_TOKEN ?? process.env.MERCHIZE_TOKEN;
  const storeId = process.env.MERCHIZE_STORE_ID;

  if (!baseUrl) {
    throw new MerchizeApiError('MERCHIZE_BO_API_BASE_URL or MERCHIZE_BASE_URL is not configured.', {
      code: 'MERCHIZE_CONFIG_MISSING',
    });
  }

  if (!apiKey && !accessToken) {
    throw new MerchizeApiError('MERCHIZE_API_KEY or MERCHIZE_ACCESS_TOKEN is not configured.', {
      code: 'MERCHIZE_AUTH_MISSING',
    });
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    accessToken,
    storeId,
  };
}

function buildHeaders(config: ReturnType<typeof getMerchizeConfig>) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (config.apiKey) headers['X-API-KEY'] = config.apiKey;
  if (config.accessToken) headers.Authorization = `Bearer ${config.accessToken}`;
  if (config.storeId) headers['x-store-id'] = config.storeId;

  return headers;
}

function buildExternalOrderBody(
  reference: MerchizeExternalOrderReference,
  action?: MerchizeExternalOrderStatusAction,
) {
  const code = 'code' in reference && reference.code ? reference.code.trim() : '';
  const externalNumber =
    'externalNumber' in reference && reference.externalNumber
      ? reference.externalNumber.trim()
      : '';
  const identifier = reference.identifier?.trim() ?? '';

  if (!code && !externalNumber) {
    throw new MerchizeApiError('Merchize external order action requires code or external_number.', {
      code: 'MERCHIZE_ORDER_REFERENCE_MISSING',
    });
  }

  return {
    order: {
      code,
      external_number: externalNumber,
      identifier,
      ...(action ? { action } : {}),
    },
  };
}

function buildExternalOrderQuery(reference: MerchizeExternalOrderReference) {
  const params = new URLSearchParams();
  const code = 'code' in reference && reference.code ? reference.code.trim() : '';
  const externalNumber =
    'externalNumber' in reference && reference.externalNumber
      ? reference.externalNumber.trim()
      : '';
  const identifier = reference.identifier?.trim() ?? '';

  if (code) {
    params.set('code', code);
  } else if (externalNumber) {
    params.set('external_number', externalNumber);
    if (identifier) params.set('identifier', identifier);
  } else {
    throw new MerchizeApiError('Merchize external order query requires code or external_number.', {
      code: 'MERCHIZE_ORDER_REFERENCE_MISSING',
    });
  }

  return params.toString();
}

function buildExternalOrderListBody(references: MerchizeExternalOrderReference[]) {
  if (!references.length) {
    throw new MerchizeApiError('Merchize external order list query requires at least one order.', {
      code: 'MERCHIZE_ORDER_REFERENCE_MISSING',
    });
  }

  return {
    orders: references.map((reference) => buildExternalOrderBody(reference).order),
  };
}

function summarizeFailedBody(body: string) {
  if (!body.trim()) return null;

  try {
    return JSON.parse(redactText(body)) as unknown;
  } catch {
    return redactText(body).slice(0, 500);
  }
}

async function merchizeRequest<T>(path: string, options: MerchizeRequestOptions = {}): Promise<T> {
  const config = getMerchizeConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: buildHeaders(config),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    const text = await response.text();

    if (!response.ok) {
      throw new MerchizeApiError(
        `Merchize API request failed: ${response.status} ${response.statusText}`,
        {
          status: response.status,
          code: 'MERCHIZE_HTTP_ERROR',
          responseSummary: summarizeFailedBody(text),
        },
      );
    }

    return text ? (JSON.parse(text) as T) : (null as T);
  } catch (error) {
    if (error instanceof MerchizeApiError) throw error;
    if (error instanceof SyntaxError) {
      throw new MerchizeApiError('Merchize API returned invalid JSON.', {
        code: 'MERCHIZE_INVALID_JSON',
      });
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MerchizeApiError('Merchize API request timed out.', {
        code: 'MERCHIZE_TIMEOUT',
      });
    }

    throw new MerchizeApiError(error instanceof Error ? error.message : 'Merchize API failed.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMerchizeOrderByExternalNumber(
  externalNumber: string,
  identifier?: string | null,
) {
  const params = new URLSearchParams({ external_number: externalNumber });
  if (identifier?.trim()) params.set('identifier', identifier.trim());
  return merchizeRequest<MerchizeOrderLookupResponse>(
    `/order/external/orders/order-detail?${params.toString()}`,
  );
}

export async function pushMerchizeExternalOrderToFulfillment(
  reference: MerchizeExternalOrderReference,
) {
  return merchizeRequest<MerchizeExternalOrderMutationResponse>('/order/external/orders/push', {
    method: 'POST',
    body: buildExternalOrderBody(reference),
  });
}

export async function updateMerchizeExternalOrderStatus(
  reference: MerchizeExternalOrderReference,
  action: MerchizeExternalOrderStatusAction,
) {
  return merchizeRequest<MerchizeExternalOrderMutationResponse>(
    '/order/external/orders/update-order-status',
    {
      method: 'POST',
      body: buildExternalOrderBody(reference, action),
    },
  );
}

export async function cancelMerchizeExternalOrder(reference: MerchizeExternalOrderReference) {
  return merchizeRequest<MerchizeExternalOrderMutationResponse>('/order/external/orders/cancel', {
    method: 'POST',
    body: buildExternalOrderBody(reference),
  });
}

export async function getMerchizeExternalOrderProgress(reference: MerchizeExternalOrderReference) {
  return merchizeRequest<MerchizeExternalOrderSnapshotResponse>(
    `/order/external/orders/order-progress?${buildExternalOrderQuery(reference)}`,
  );
}

export async function getMerchizeExternalOrderTracking(reference: MerchizeExternalOrderReference) {
  return merchizeRequest<MerchizeExternalOrderSnapshotResponse>(
    `/order/external/orders/tracking?${buildExternalOrderQuery(reference)}`,
  );
}

export async function getMerchizeExternalOrderInvoice(reference: MerchizeExternalOrderReference) {
  return merchizeRequest<MerchizeExternalOrderSnapshotResponse>(
    `/order/external/orders/order-invoice?${buildExternalOrderQuery(reference)}`,
  );
}

export async function listMerchizeExternalOrdersDetail(
  references: MerchizeExternalOrderReference[],
) {
  return merchizeRequest<MerchizeExternalOrderSnapshotResponse>(
    '/order/external/orders/list-orders-detail',
    {
      method: 'POST',
      body: buildExternalOrderListBody(references),
    },
  );
}

export async function listMerchizeExternalOrdersTracking(
  references: MerchizeExternalOrderReference[],
) {
  return merchizeRequest<MerchizeExternalOrderSnapshotResponse>(
    '/order/external/orders/list-orders-tracking',
    {
      method: 'POST',
      body: buildExternalOrderListBody(references),
    },
  );
}

export async function listMerchizeExternalOrdersInvoice(
  references: MerchizeExternalOrderReference[],
) {
  return merchizeRequest<MerchizeExternalOrderSnapshotResponse>(
    '/order/external/orders/list-orders-invoice',
    {
      method: 'POST',
      body: buildExternalOrderListBody(references),
    },
  );
}

export async function getMerchizeInDepthOrderDetail(merchizeOrderId: string) {
  return merchizeRequest<MerchizeInDepthOrderDetailResponse>(
    `/order/orders/${encodeURIComponent(merchizeOrderId)}`,
  );
}

export async function getMerchizeAddressSuggestion(merchizeOrderId: string) {
  return merchizeRequest<unknown>(
    `/order/orders/${encodeURIComponent(merchizeOrderId)}/address-suggestion`,
  );
}

export async function getMerchizeFulfillmentCostInvoice(merchizeOrderId: string) {
  return merchizeRequest<unknown>(
    `/order/orders/${encodeURIComponent(merchizeOrderId)}/fulfillment-cost-invoice`,
  );
}

export async function getMerchizeTransactionFee(merchizeOrderId: string) {
  return merchizeRequest<unknown>(
    `/order/orders/${encodeURIComponent(merchizeOrderId)}/transaction-fee`,
  );
}

export async function getMerchizeOrderHistory(merchizeOrderId: string) {
  return merchizeRequest<unknown>(`/order/orders/${encodeURIComponent(merchizeOrderId)}/histories`);
}

export async function getMerchizeOrderProgress(merchizeOrderId: string) {
  return merchizeRequest<unknown>(
    `/order/get-order-progress/${encodeURIComponent(merchizeOrderId)}`,
  );
}
