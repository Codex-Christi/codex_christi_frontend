import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shipping & POD Policy | Codex Christi Shop',
  description:
    'Learn how shipping, print-on-demand fulfillment, and address accuracy work for Codex Christi orders.',
};

const policyCards = [
  {
    title: 'Payment protection',
    body: 'Your payment is securely processed through PayPal. We only collect payment after you approve the checkout, and you will receive a confirmation once the order is recorded.',
  },
  {
    title: 'Print-on-demand refunds',
    body: 'Every item is made specifically for your order. We cannot offer refunds or replacements for customer mistakes such as the wrong size, color, quantity, or design selection.',
  },
  {
    title: 'Address accuracy',
    body: 'The shipping address you confirm is the address we fulfill. Incorrect or incomplete addresses may result in failed delivery, and we cannot replace or refund those orders.',
  },
];

const ShippingPODPolicyPage = () => {
  return (
    <div className='relative overflow-hidden px-4 py-16 text-white sm:px-6 lg:px-10'>
      <div className='pointer-events-none absolute inset-0'>
        <div className='absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#38bdf8]/30 via-[#6366f1]/30 to-transparent blur-3xl' />
        <div className='absolute -bottom-24 right-8 h-80 w-80 rounded-full bg-gradient-to-tr from-[#f97316]/25 via-[#e11d48]/25 to-transparent blur-[120px]' />
      </div>

      <div className='relative mx-auto flex w-full max-w-5xl flex-col gap-12'>
        <header className='space-y-4 text-center'>
          <p className='text-xs uppercase tracking-[0.4em] text-white/60'>Codex Christi Shop</p>
          <h1 className='text-4xl font-semibold sm:text-5xl'>Shipping & POD policy</h1>
          <p className='mx-auto max-w-2xl text-base text-white/70'>
            We use a print-on-demand fulfillment partner to create each item just for you. Please
            review the details below before placing your order.
          </p>
        </header>

        <section className='grid gap-6 md:grid-cols-3'>
          {policyCards.map((card) => (
            <article
              key={card.title}
              className='rounded-3xl border border-white/10 bg-white/5 px-5 py-6 shadow-[0_20px_45px_rgba(0,0,0,0.35)] backdrop-blur'
            >
              <h2 className='text-lg font-semibold'>{card.title}</h2>
              <p className='mt-3 text-sm text-white/70'>{card.body}</p>
            </article>
          ))}
        </section>

        <section className='rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f172a]/80 via-[#111827]/80 to-[#1f2937]/80 px-6 py-8 shadow-[0_30px_60px_rgba(0,0,0,0.4)]'>
          <h2 className='text-xl font-semibold'>Quick summary</h2>
          <ul className='mt-4 space-y-3 text-sm text-white/75'>
            <li>
              Confirm your shipping address and order details before paying. Address changes may
              not be possible once production begins.
            </li>
            <li>
              Orders placed with buyer errors (wrong size, quantity, or address) are not eligible
              for refunds or replacements.
            </li>
            <li>
              If PayPal presents a different address, we will ask you which address to use before
              we move forward.
            </li>
          </ul>
        </section>

        <section className='rounded-3xl border border-white/10 bg-white/5 px-6 py-8 text-sm text-white/70'>
          <h2 className='text-xl font-semibold text-white'>Address responsibility notice</h2>
          <p className='mt-3'>
            By completing checkout, you confirm the accuracy of the shipping information provided.
            Because each item is made to order, returns and reships are not available for orders
            shipped to incorrect addresses supplied by the buyer.
          </p>
        </section>
      </div>
    </div>
  );
};

export default ShippingPODPolicyPage;
