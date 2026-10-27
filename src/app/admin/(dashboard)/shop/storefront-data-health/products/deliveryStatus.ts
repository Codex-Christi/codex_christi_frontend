export type DeliveryEvidence = {
  checkedAt: Date;
  availableCount: number;
  unsupportedCount: number;
  unverifiedCount: number;
  reason: string | null;
  completed: boolean;
  stale: boolean;
  source: 'catalog' | 'live';
};

export function presentDeliveryStatus(
  check: DeliveryEvidence | undefined,
  countryName: string,
  optionCount: number,
  ttlMs: number,
) {
  const requiresCheck =
    !check ||
    check.source !== 'catalog' ||
    check.stale ||
    !check.completed ||
    check.reason === 'verification_unavailable' ||
    check.unverifiedCount > 0;
  return {
    optionCount,
    checkedAt: check?.checkedAt.toISOString() ?? null,
    validUntil: check ? new Date(+check.checkedAt + ttlMs).toISOString() : null,
    source: check?.source ?? null,
    requiresCheck,
    needsReview: optionCount > 0 || requiresCheck || !!check?.reason || !!check?.unsupportedCount,
    status: !check
      ? `Delivery to ${countryName} has not been checked`
      : check.stale
        ? 'Saved delivery data is out of date'
        : !check.completed || check.reason === 'verification_unavailable'
          ? 'Delivery could not be confirmed'
          : check.reason === 'product_unavailable'
            ? 'Product is currently unavailable'
            : check.reason === 'shipping_unavailable'
              ? `No delivery options for ${countryName}`
              : `${check.availableCount} ${check.availableCount === 1 ? 'option' : 'options'} available for delivery to ${countryName}`,
    unsupportedCount: check?.stale ? 0 : (check?.unsupportedCount ?? 0),
    unverifiedCount: check?.stale ? 0 : (check?.unverifiedCount ?? 0),
  };
}

export type DeliveryStatus = ReturnType<typeof presentDeliveryStatus>;
export type DeliveryCheckEvent =
  | { type: 'checking'; productId: string }
  | { type: 'result'; productId: string; result: DeliveryStatus }
  | { type: 'error'; message: string }
  | { type: 'complete' };

export async function requestDeliveryChecks(
  route: string,
  productIds: string[],
  country: string,
  force: boolean,
  signal: AbortSignal,
  receive: (event: DeliveryCheckEvent) => void,
) {
  for (let offset = 0; offset < productIds.length; offset += 100) {
    signal.throwIfAborted();
    const response = await fetch(route, {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: productIds.slice(offset, offset + 100), country, force }),
      signal,
    });
    await readDeliveryCheckEvents(response, receive);
  }
}

export async function readDeliveryCheckEvents(
  response: Response,
  receive: (event: DeliveryCheckEvent) => void,
) {
  if (
    !response.ok ||
    !response.body ||
    !response.headers.get('content-type')?.includes('application/x-ndjson')
  )
    throw new Error(
      response.status === 403
        ? 'Unlock the admin dashboard with catalog refresh permission to continue.'
        : 'Delivery checks could not start. Please retry.',
    );
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      if (buffer.length > 1_000_000) throw new Error('The delivery response exceeded its limit.');
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const event = JSON.parse(buffer.slice(0, newline)) as DeliveryCheckEvent;
        buffer = buffer.slice(newline + 1);
        if (event.type === 'error') throw new Error(event.message);
        if (event.type === 'complete') complete = true;
        receive(event);
      }
    }
    if (!complete || buffer.trim())
      throw new Error('The delivery check was interrupted. Retry the remaining products.');
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
