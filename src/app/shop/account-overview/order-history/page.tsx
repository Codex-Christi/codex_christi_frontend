import { ArrowRight } from 'lucide-react';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import { accountOrders } from '@/lib/shop/orderHistory/server';
import {
  AccountHistoryAccessError,
  InvalidHistoryQueryError,
} from '@/lib/shop/orderHistory/reader';
import Orders, {
  HistoryEmpty,
  HistoryHeader,
  HistoryUnavailable,
  historyPath,
} from './_components/orders';
import HistoryOwnerBoundary from './_components/history-owner-boundary';
import styles from './orderHistory.module.css';
import { orderHistoryMetadata } from './metadata';
import { LinkGuestOrder } from './_components/history-actions';

export const metadata = orderHistoryMetadata;

export default async function OrderHistory({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[]; cursor?: string | string[] }>;
}) {
  let result;
  try {
    result = await accountOrders.list(await searchParams);
  } catch (error) {
    if (error instanceof AccountHistoryAccessError)
      return <p role='status'>Sign in to view your orders.</p>;
    return <HistoryUnavailable invalid={error instanceof InvalidHistoryQueryError} />;
  }
  const query = await searchParams;
  const next = new URLSearchParams({ filter: result.filter });
  if (result.nextCursor) next.set('cursor', result.nextCursor);
  return (
    <HistoryOwnerBoundary session={result.session}>
      <HistoryHeader />
      <LinkGuestOrder />
      <nav aria-label='Purchase filters' className={styles.filters}>
        <CustomShopLink
          href={historyPath}
          prefetch={false}
          aria-current={result.filter === 'all' ? 'page' : undefined}
        >
          All purchases
        </CustomShopLink>
        <CustomShopLink
          href={`${historyPath}?filter=refunds`}
          prefetch={false}
          aria-current={result.filter === 'refunds' ? 'page' : undefined}
        >
          Refunds recorded
        </CustomShopLink>
      </nav>
      {result.orders.length ? (
        <Orders orders={result.orders} />
      ) : (
        <HistoryEmpty paged={Boolean(query.cursor)} refunds={result.filter === 'refunds'} />
      )}
      <nav aria-label='Order history pages' className={styles.pagination}>
        {query.cursor && (
          <CustomShopLink href={`${historyPath}?filter=${result.filter}`} prefetch={false}>
            Newest purchases
          </CustomShopLink>
        )}
        {result.nextCursor && (
          <CustomShopLink
            href={`${historyPath}?${next}`}
            prefetch={false}
            className={styles.action}
          >
            Older purchases <ArrowRight size={18} />
          </CustomShopLink>
        )}
      </nav>
    </HistoryOwnerBoundary>
  );
}
