import {
  buildShopAddressCorrectionEmail,
  buildShopFulfillmentEmail,
  buildShopFulfillmentMilestoneEmail,
  buildShopVerificationEmail,
} from './templates';

/** Synthetic examples shared by offline previews and rendering checks. */
export function shopEmailFixtures() {
  const orderToken = 'sample-order-reference-0001';
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
    { name: 'order-received', message: buildShopFulfillmentMilestoneEmail('received', orderToken) },
    {
      name: 'order-preparation',
      message: buildShopFulfillmentEmail({
        customerName: 'Alex',
        orderToken,
        supportReference: orderToken,
        receiptAvailable: true,
      }),
    },
    { name: 'address-correction', message: buildShopAddressCorrectionEmail(orderToken) },
    { name: 'production-started', message: buildShopFulfillmentMilestoneEmail('production', orderToken) },
    { name: 'tracking-ready', message: buildShopFulfillmentMilestoneEmail('tracking', orderToken) },
    { name: 'shipment-started', message: buildShopFulfillmentMilestoneEmail('shipment', orderToken) },
    { name: 'order-delivered', message: buildShopFulfillmentMilestoneEmail('delivery', orderToken) },
  ];
}
