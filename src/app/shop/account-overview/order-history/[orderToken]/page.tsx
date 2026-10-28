import { notFound } from 'next/navigation';
import { accountOrders } from '@/lib/shop/orderHistory/server';
import { AccountHistoryAccessError } from '@/lib/shop/orderHistory/reader';
import {
  HistoryHeader,
  HistoryUnavailable,
  OrderIdentity,
  OrderLines,
  ReceiptLink,
} from '../_components/orders';
import HistoryOwnerBoundary from '../_components/history-owner-boundary';
import styles from '../orderHistory.module.css';
import { orderHistoryMetadata } from '../metadata';

export const metadata = orderHistoryMetadata;

function SavedTimestamp({ value }: { value: string | null }) {
  return value ? <time dateTime={value}>{new Date(value).toUTCString()}</time> : 'Not recorded';
}

export default async function AccountOrderDetails({
  params,
}: {
  params: Promise<{ orderToken: string }>;
}) {
  const { orderToken } = await params;
  let result;
  try {
    result = await accountOrders.detail(orderToken);
  } catch (error) {
    if (error instanceof AccountHistoryAccessError)
      return <p role='status'>Sign in to view your orders.</p>;
    return <HistoryUnavailable />;
  }
  if (!result) notFound();
  const { order } = result;
  return (
    <HistoryOwnerBoundary session={result.session}>
      <HistoryHeader detail />
      <article className={styles.details}>
        <OrderIdentity order={order} />
        {order.needsReview && (
          <p role='status' className={styles.warning}>
            This purchase needs review. Keep your order reference when contacting support.
          </p>
        )}
        <OrderLines order={order} />
        <dl className={styles.amounts}>
          <div>
            <dt>Captured payment</dt>
            <dd>{order.paidAmount ?? 'Not verified'}</dd>
          </div>
          {order.expectedAmount && (
            <div>
              <dt>Order total</dt>
              <dd>{order.expectedAmount}</dd>
            </div>
          )}
          {order.shippingAmount && (
            <div>
              <dt>Shipping included</dt>
              <dd>{order.shippingAmount}</dd>
            </div>
          )}
          {order.refunded && (
            <div>
              <dt>Refund status</dt>
              <dd>Refund recorded</dd>
            </div>
          )}
        </dl>
        <ReceiptLink order={order} />
        <section className={styles.updates}>
          <h2>Saved shipment updates</h2>
          {result.unavailable ? (
            <p>Shipment updates are temporarily unavailable.</p>
          ) : !result.updates.length ? (
            <p>No shipment update has been recorded.</p>
          ) : (
            result.updates.map((update) => (
              <dl key={update.reference}>
                <dt>Shipment reference</dt>
                <dd>{update.reference}</dd>
                <dt>Supplier progress</dt>
                <dd>{update.progress ?? 'Not recorded'}</dd>
                <dt>Reported tracking status</dt>
                <dd>{update.tracking ?? 'Not recorded'}</dd>
                <dt>Progress checked</dt>
                <dd>
                  <SavedTimestamp value={update.progressCheckedAt} />
                </dd>
                <dt>Tracking checked</dt>
                <dd>
                  <SavedTimestamp value={update.trackingCheckedAt} />
                </dd>
              </dl>
            ))
          )}
        </section>
      </article>
    </HistoryOwnerBoundary>
  );
}
