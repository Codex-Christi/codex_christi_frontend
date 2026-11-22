import { buildShopFulfillmentEmail, buildShopVerificationEmail } from './templates';

/** Synthetic examples shared by offline previews and rendering checks. */
export function shopEmailFixtures() {
  const verification = (purpose: 'checkout' | 'checkout-recovery' | 'order-link') =>
    buildShopVerificationEmail({
      purpose,
      otp: '482617',
      recipientName: 'Alex',
      expiresInMinutes: 10,
    });
  return [
    { name: 'checkout-verification', message: verification('checkout') },
    { name: 'checkout-recovery', message: verification('checkout-recovery') },
    { name: 'guest-order-link', message: verification('order-link') },
    {
      name: 'order-preparation',
      message: buildShopFulfillmentEmail({
        customerName: 'Alex',
        orderToken: 'sample-order-reference-0001',
        supportReference: 'sample-order-reference-0001',
        receiptAvailable: true,
      }),
    },
  ];
}
