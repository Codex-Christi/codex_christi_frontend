import Image from 'next/image';
import { ArrowLeft, ArrowRight, FileDown, Package } from 'lucide-react';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import type { HistoryOrder } from '@/lib/shop/orderHistory/model';
import styles from '../orderHistory.module.css';
import RefreshOrders from './refresh-orders';
import { CopyReference } from './history-actions';

export const historyPath = '/shop/account-overview/order-history';

export function HistoryHeader({ detail = false }: { detail?: boolean }) {
  return (
    <header className={styles.header}>
      <CustomShopLink
        href={detail ? historyPath : '/shop/account-overview'}
        prefetch={false}
        ariaLabel={detail ? 'Back to order history' : 'Back to account'}
        className={styles.iconButton}
      >
        <ArrowLeft size={20} />
      </CustomShopLink>
      <h1>{detail ? 'Order details' : 'Order history'}</h1>
      <RefreshOrders />
    </header>
  );
}

export function HistoryEmpty({
  paged = false,
  refunds = false,
}: {
  paged?: boolean;
  refunds?: boolean;
}) {
  return (
    <div className={styles.empty}>
      <Package size={40} aria-hidden='true' />
      <h2>
        {paged ? 'No purchases on this page' : refunds ? 'No refunds recorded' : 'No purchases yet'}
      </h2>
      <CustomShopLink href={paged || refunds ? historyPath : '/shop'} prefetch={false}>
        {paged || refunds ? 'View all purchases' : 'Browse the shop'}
      </CustomShopLink>
    </div>
  );
}

export function HistoryUnavailable({ invalid = false }: { invalid?: boolean }) {
  return (
    <>
      <HistoryHeader />
      <div className={styles.empty} role='alert'>
        <h2>
          {invalid
            ? 'This order-history link is invalid'
            : 'Your orders are temporarily unavailable'}
        </h2>
        <CustomShopLink href={historyPath} prefetch={false}>
          Return to order history
        </CustomShopLink>
      </div>
    </>
  );
}

export function orderDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function OrderLines({ order, preview = false }: { order: HistoryOrder; preview?: boolean }) {
  const lines = preview ? order.lines.slice(0, 2) : order.lines;
  return order.detailsAvailable ? (
    <ul className={`${styles.lines} ${preview ? styles.preview : ''}`}>
      {lines.map((line) => (
        <li key={line.id} className={styles.line}>
          <div className={styles.image}>
            {line.image ? (
              <Image
                src={line.image}
                alt={line.title}
                width={80}
                height={80}
                sizes='80px'
                quality={75}
              />
            ) : (
              <Package size={28} aria-hidden='true' />
            )}
          </div>
          <div className={styles.lineText}>
            <h3 title={line.title}>{line.title}</h3>
            {(line.lineAmount || line.unitAmount) && (
              <strong className={styles.linePrice}>
                {line.lineAmount ?? `${line.unitAmount} each`}
              </strong>
            )}
            {line.options && <p>{line.options}</p>}
            <p>
              Quantity: {line.quantity}
              {!preview && line.quantity > 1 && line.lineAmount && line.unitAmount
                ? ` · ${line.unitAmount} each`
                : ''}
            </p>
          </div>
        </li>
      ))}
      {preview && order.lines.length > lines.length && (
        <li className={styles.muted}>+{order.lines.length - lines.length} more items</li>
      )}
    </ul>
  ) : (
    <p className={styles.muted}>The saved item details for this purchase are unavailable.</p>
  );
}

export function OrderIdentity({ order }: { order: HistoryOrder }) {
  return (
    <div className={styles.identity}>
      <div>
        <div className={styles.reference}>
          <h2 title={order.reference}>Order {order.reference}</h2>
          <CopyReference value={order.reference} />
        </div>
        <span className={styles.muted}>
          {order.dateLabel} <time dateTime={order.displayDate}>{orderDate(order.displayDate)}</time>
        </span>
      </div>
      <span className={order.needsReview ? styles.warning : styles.badge}>{order.status}</span>
    </div>
  );
}

export function ReceiptLink({ order }: { order: HistoryOrder }) {
  return order.receiptAvailable ? (
    <a
      className={styles.action}
      href={`/next-api/shop/account/orders/${encodeURIComponent(order.orderToken)}/receipt`}
      target='_blank'
      rel='noopener noreferrer'
    >
      <FileDown size={18} /> Receipt
    </a>
  ) : null;
}

export default function Orders({ orders }: { orders: HistoryOrder[] }) {
  return (
    <div className={styles.orders}>
      {orders.map((order) => (
        <article key={order.orderToken} className={styles.card}>
          <OrderIdentity order={order} />
          <OrderLines order={order} preview />
          <div className={styles.actions}>
            <span>{order.paidAmount ? `Paid ${order.paidAmount}` : 'Payment requires review'}</span>
            <ReceiptLink order={order} />
            <CustomShopLink
              href={`${historyPath}/${encodeURIComponent(order.orderToken)}`}
              prefetch={false}
              className={styles.action}
            >
              View order <ArrowRight size={18} />
            </CustomShopLink>
          </div>
        </article>
      ))}
    </div>
  );
}
