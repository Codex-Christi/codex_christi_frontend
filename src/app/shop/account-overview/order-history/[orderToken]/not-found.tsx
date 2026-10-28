import { HistoryHeader } from '../_components/orders';
export default function OrderNotFound() {
  return (
    <>
      <HistoryHeader detail />
      <p>This purchase could not be found in your account.</p>
    </>
  );
}
