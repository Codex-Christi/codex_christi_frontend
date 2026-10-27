import type { Metadata } from 'next';
import DraftPolicyPage from '@/components/UI/Shop/Checkout/DraftPolicyPage';

export const metadata: Metadata = {
  title: 'Draft terms of use | Codex Christi Shop',
  robots: { index: false, follow: false },
};

export default function TermsOfUsePage() {
  return (
    <DraftPolicyPage title='Terms of use'>
      <section>
        <h2>Orders and payment</h2>
        <p>
          Proposed terms: customers review the selected items, options, quantities, delivery
          address, currency, and total before approving payment. Payment authentication is handled
          through PayPal. An order’s current payment and processing status is shown on its
          confirmation page.
        </p>
      </section>
      <section>
        <h2>Products made to order</h2>
        <p>
          Proposed terms: products are made to order. Customers should check sizes, options, and
          address details carefully. Cancellation, returns, damaged items, incorrect deliveries, and
          refund conditions need approved wording before this policy is finalized.
        </p>
      </section>
      <section>
        <h2>Delivery</h2>
        <p>
          Proposed terms: delivery availability and charges are confirmed for the selected
          destination during checkout. Production times, delivery estimates, customs charges,
          address changes, and responsibility for delivery issues still need confirmation.
        </p>
      </section>
      <section>
        <h2>Details awaiting approval</h2>
        <p>
          The legal business name, contact channel, governing terms, customer rights, refund rules,
          and any age or destination restrictions must be verified before publication of a final
          policy. This draft does not make claims about those matters.
        </p>
      </section>
    </DraftPolicyPage>
  );
}
