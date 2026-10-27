import { requireAdminAction, isAdminActionAuthError } from '@/lib/admin/require-admin';
import { writeAdminAuditLog } from '@/lib/admin/admin-auth-ledger';
import { getManagedStorefrontProductIds } from '@/lib/merchizeStorefront/managedProducts';
import {
  checkDeliveryProducts,
  deliveryCheckInputSchema,
  isSameOriginDeliveryRequest,
} from '../deliveryChecks';
import type { DeliveryCheckEvent } from '../deliveryStatus';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // This route stays under /admin so the existing path-scoped admin cookie is sent.
  if (!isSameOriginDeliveryRequest(request))
    return Response.json({ message: 'Same-origin admin request required.' }, { status: 403 });
  let admin;
  try {
    admin = await requireAdminAction('shop.catalog.refresh');
  } catch (error) {
    if (!isAdminActionAuthError(error)) throw error;
    return Response.json({ message: error.message }, { status: 403 });
  }
  const raw = await request.text();
  if (raw.length > 20_000) return Response.json({ message: 'Too many products.' }, { status: 413 });
  const input = deliveryCheckInputSchema.safeParse(
    await Promise.resolve()
      .then(() => JSON.parse(raw))
      .catch(() => null),
  );
  if (!input.success)
    return Response.json(
      { message: 'Choose valid products and a delivery country.' },
      { status: 400 },
    );
  const productIds = [...new Set(input.data.productIds)];
  const managed = new Set(await getManagedStorefrontProductIds());
  if (productIds.some((id) => !managed.has(id)))
    return Response.json(
      { message: 'Choose products listed in this storefront.' },
      { status: 400 },
    );
  if (request.signal.aborted) return new Response(null, { status: 499 });
  const controller = new AbortController();
  const signal = AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(120_000)]);
  const audit = (outcome: 'started' | 'success' | 'failure', metadata = {}) =>
    writeAdminAuditLog({
      actor: admin,
      action: 'shop.catalog.check_product_delivery',
      outcome,
      metadata: { country: input.data.country, products: productIds.length, ...metadata },
    });
  await audit('started');
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      const emit = (event: DeliveryCheckEvent) => {
        if (!signal.aborted) output.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const summary = await checkDeliveryProducts({ ...input.data, productIds, signal, emit });
        if (signal.aborted && !request.signal.aborted && !controller.signal.aborted)
          output.enqueue(
            encoder.encode(
              `${JSON.stringify({ type: 'error', message: 'The check timed out. Retry the remaining products.' })}\n`,
            ),
          );
        else emit({ type: 'complete' });
        await audit(summary.failed || signal.aborted ? 'failure' : 'success', {
          ...summary,
          cancelled: signal.aborted,
        });
      } catch {
        emit({
          type: 'error',
          message: 'The delivery check could not complete. Retry the remaining products.',
        });
        await audit('failure').catch(() => undefined);
      } finally {
        if (!request.signal.aborted && !controller.signal.aborted) output.close();
      }
    },
    cancel() {
      controller.abort();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'private, no-store, no-transform',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
