export const customerPostPurchaseDescriptions = {
  order_received: 'We’ll update this page when preparation begins.',
  checking_delivery_details:
    'We\'re checking your delivery address. No action is needed right now.',
  awaiting_preparation: 'We’ll update this page when preparation begins.',
  preparation_under_review: 'Your order needs review before preparation can begin.',
  sent_for_preparation: 'We’re waiting for production to start.',
  production_started: 'We’ll update this page when shipping starts.',
  shipped: 'Shipping has started for your order.',
  delivered: 'Delivery has been confirmed.',
} as const;

export type CustomerPostPurchaseStage = keyof typeof customerPostPurchaseDescriptions;

export const customerPostPurchaseTitles: Record<CustomerPostPurchaseStage, string> = {
  order_received: 'Order received',
  checking_delivery_details: 'Order received',
  awaiting_preparation: 'Waiting for preparation',
  preparation_under_review: 'Order under review',
  sent_for_preparation: 'Sent for preparation',
  production_started: 'Production started',
  shipped: 'Shipment started',
  delivered: 'Order delivered',
};
