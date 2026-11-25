import { customerFulfillmentHold } from '@/lib/shop/checkout/customerFulfillmentHold';
import { orderDate } from './orders';
import styles from '../orderHistory.module.css';

export default function FulfillmentHoldNotice({ checkedAt }: { checkedAt: string }) {
  return (
    <div className={styles.warning} role='status'>
      <strong>{customerFulfillmentHold.title}</strong>
      <p>{customerFulfillmentHold.description}</p>
      <p className={styles.muted}>
        Fulfillment last checked <time dateTime={checkedAt}>{orderDate(checkedAt, true)} UTC</time>
      </p>
    </div>
  );
}
