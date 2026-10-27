import type { Metadata } from 'next';
import DraftPolicyPage from '@/components/UI/Shop/Checkout/DraftPolicyPage';

export const metadata: Metadata = {
  title: 'Draft privacy policy | Codex Christi Shop',
  robots: { index: false, follow: false },
};

export default function PrivacyPolicyPage() {
  return (
    <DraftPolicyPage title='Privacy policy'>
      <section>
        <h2>Checkout information</h2>
        <p>
          Proposed wording: the shop uses the contact and delivery information entered at checkout
          to verify the checkout, process the order, and provide order updates. Payment details are
          entered into PayPal’s payment fields rather than a shop-built card or PIN form.
        </p>
      </section>
      <section>
        <h2>Information saved on your device</h2>
        <p>
          Proposed wording: the cart and checkout use browser storage to keep selections and support
          interrupted checkout recovery. Signed-in carts can also be saved to the account. The final
          policy must explain the storage and cookie choices available to customers.
        </p>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>
          Proposed wording: order processing involves payment and fulfillment providers. The final
          policy needs a verified list of recipients, their roles, international transfers where
          relevant, and the information shared with each provider.
        </p>
      </section>
      <section>
        <h2>Details awaiting approval</h2>
        <p>
          The responsible business and privacy contact, retention periods, customer requests,
          marketing and analytics practices, security statements, and applicable legal requirements
          must be confirmed. This draft does not claim certification or compliance with any
          particular privacy law.
        </p>
      </section>
    </DraftPolicyPage>
  );
}
