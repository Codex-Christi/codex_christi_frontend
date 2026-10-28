import styles from './orderHistory.module.css';
export default function LoadingOrders() {
  return (
    <div className={styles.orders} role='status' aria-label='Loading orders' aria-busy='true'>
      {[0, 1, 2].map((id) => (
        <div key={id} className={styles.skeleton} />
      ))}
    </div>
  );
}
