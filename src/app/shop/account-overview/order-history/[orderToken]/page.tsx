import { notFound } from 'next/navigation';
import { accountOrders } from '@/lib/shop/orderHistory/server';
import { AccountHistoryAccessError } from '@/lib/shop/orderHistory/reader';
import {
  HistoryHeader,
  HistoryUnavailable,
  OrderIdentity,
  OrderLines,
  ReceiptLink,
  orderDate,
} from '../_components/orders';
import HistoryOwnerBoundary from '../_components/history-owner-boundary';
import styles from '../orderHistory.module.css';
import { orderHistoryMetadata } from '../metadata';
import { RefreshTracking } from '../_components/history-actions';

export const metadata = orderHistoryMetadata;

function SavedTimestamp({ value }: { value: string | null }) {
  return value ? <time dateTime={value}>{orderDate(value, true)} UTC</time> : 'Not yet checked';
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
        {order.detailsSource === 'payment_record' && (
          <p className={styles.muted}>
            Some original product details are unavailable for this older order.
          </p>
        )}
        <details className={styles.fullReference}>
          <summary>Full order reference</summary>
          <p className={styles.referenceText}>{order.reference}</p>
        </details>
        <dl className={styles.amounts}>
          <div>
            <dt>Payment received</dt>
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
        <div className={styles.actions}>
          <ReceiptLink order={order} />
          <a
            className={styles.action}
            href={`/shop/checkout/confirmation/${encodeURIComponent(order.orderToken)}?view=details`}
          >
            Open order confirmation
          </a>
        </div>
        <section className={styles.updates}>
          <div className={styles.sectionHeading}>
            <h2>Delivery updates</h2>
            <RefreshTracking orderToken={order.orderToken} />
          </div>
          {result.unavailable ? (
            <p>Shipment updates are temporarily unavailable.</p>
          ) : !result.updates.length ? (
            <p>No shipment update has been recorded.</p>
          ) : (
            result.updates.map((update) => (
              <div key={update.reference} className={styles.shipment}>
                <dl>
                  <dt>Shipping reference</dt>
                  <dd className={styles.referenceText}>{update.reference}</dd>
                  <dt>Order preparation</dt>
                  <dd>{update.progress ?? 'Not recorded'}</dd>
                  <dt>Delivery</dt>
                  <dd>{update.tracking ?? 'Not recorded'}</dd>
                  <dt>Preparation checked</dt>
                  <dd>
                    <SavedTimestamp value={update.progressCheckedAt} />
                  </dd>
                  <dt>Tracking checked</dt>
                  <dd>
                    <SavedTimestamp value={update.trackingCheckedAt} />
                  </dd>
                </dl>
                {!!update.packages?.length && (
                  <ul className={styles.packages}>
                    {update.packages.map((pack, index) => (
                      <li key={`${pack.id}-${index}`}>
                        <strong>Package {index + 1}</strong>
                        <span>{pack.status}</span>
                        {pack.carrier && <span>{pack.carrier}</span>}
                        {pack.trackingNumber && (
                          <span className={styles.referenceText}>{pack.trackingNumber}</span>
                        )}
                        {pack.trackingUrl && (
                          <a
                            href={pack.trackingUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className={styles.action}
                          >
                            Track package
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </section>
      </article>
    </HistoryOwnerBoundary>
  );
}
