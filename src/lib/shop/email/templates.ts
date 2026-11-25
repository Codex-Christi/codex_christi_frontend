import { getShopSiteUrl } from '@/lib/siteBaseUrls.server';
import { buildShopEmailLayout } from './layout';

export type ShopVerificationPurpose = 'checkout' | 'checkout-recovery' | 'order-link';

const verificationCopy = {
  checkout: {
    subject: 'Verify your checkout email',
    eyebrow: 'Checkout verification',
    heading: 'Confirm your email',
    previewText: 'Enter your code in checkout to continue with your order.',
    instructions: 'Enter this code in checkout to confirm where we should send your order updates.',
  },
  'checkout-recovery': {
    subject: 'Your checkout and order access code',
    eyebrow: 'Checkout & order access',
    heading: 'Pick up where you left off',
    previewText: 'Use your code to check your checkout or order status.',
    instructions:
      'Enter this code on the page where you requested it to check your checkout or order status.',
  },
  'order-link': {
    subject: 'Link a guest order to your account',
    eyebrow: 'Guest order linking',
    heading: 'Bring your order into your account',
    previewText: 'Confirm your email to link a guest purchase to your account.',
    instructions:
      'Enter this code on the page where you requested it to link a guest purchase to your signed-in Codex Christi account.',
  },
} satisfies Record<
  ShopVerificationPurpose,
  {
    subject: string;
    eyebrow: string;
    heading: string;
    previewText: string;
    instructions: string;
  }
>;

const senderName = 'Codex Christi Shop';

export function buildShopVerificationEmail({
  purpose,
  otp,
  expiresInMinutes,
  recipientName,
}: {
  purpose: ShopVerificationPurpose;
  otp: string;
  expiresInMinutes: number;
  recipientName?: string;
}) {
  if (!/^\d{6}$/u.test(otp)) throw new Error('A six-digit verification code is required.');
  const copy = verificationCopy[purpose];
  if (!copy) throw new Error('Unknown shop verification message.');

  return {
    subject: `${copy.subject} · ${senderName}`,
    senderName,
    ...buildShopEmailLayout({
      ...copy,
      greeting: recipientName?.trim() ? `Hi ${recipientName.trim()},` : 'Hello,',
      paragraphs: [copy.instructions],
      code: { value: otp, expiresInMinutes },
      footerText: 'If you didn’t request this code, you can ignore this email.',
    }),
  };
}

export function buildShopFulfillmentEmail({
  customerName,
  orderToken,
  supportReference,
  receiptAvailable,
}: {
  customerName: string;
  orderToken: string;
  supportReference: string;
  receiptAvailable: boolean;
}) {
  if (!orderToken?.trim() || !supportReference?.trim())
    throw new Error('An order reference is required.');
  const subjectReference = supportReference.replace(/[\u0000-\u001f\u007f]/gu, ' ').slice(0, 8);
  return {
    subject: `Your order was sent for preparation · ${subjectReference} · ${senderName}`,
    senderName,
    ...buildShopEmailLayout({
      previewText: 'Your payment was received and your order was sent for preparation.',
      eyebrow: 'Order update',
      heading: 'Order sent for preparation',
      greeting: customerName?.trim() ? `Hi ${customerName.trim()},` : 'Hello,',
      paragraphs: [
        'Your payment was received and your order was sent for preparation. We’ll update your order page when production starts.',
        'Keep the reference below if you need to contact us about your order.',
      ],
      details: [
        { label: 'Order status', value: 'Sent for preparation' },
        { label: 'Support reference', value: supportReference },
      ],
      action: {
        label: receiptAvailable ? 'View order & receipt' : 'View order',
        href: getShopSiteUrl(
          `/shop/checkout/confirmation/${encodeURIComponent(orderToken)}?view=details`,
        ),
      },
      footerText: 'For your privacy, you may need to verify access before viewing your order.',
    }),
  };
}

const lifecycleCopy = {
  received: {
    heading: 'Order received',
    message: 'We received your order and payment. We’ll email you when your order moves forward. You do not need to pay again.',
  },
  production: {
    heading: 'Your order is in production',
    message: 'Production has started. You can check your order page for shipment updates.',
  },
  shipment: {
    heading: 'Shipment has started',
    message: 'At least part of your order has shipped. Open your order for the latest package and tracking details.',
  },
  delivery: {
    heading: 'Your order was delivered',
    message: 'Delivery has been confirmed for your order. Open your order for details.',
  },
} as const;

export type ShopFulfillmentNotice = keyof typeof lifecycleCopy;

export function buildShopFulfillmentMilestoneEmail(notice: ShopFulfillmentNotice, orderToken: string) {
  const { heading, message } = lifecycleCopy[notice];
  return {
    senderName,
    subject: `${heading} · ${senderName}`,
    ...buildShopEmailLayout({
      previewText: message,
      eyebrow: 'Order update',
      heading,
      paragraphs: [message],
      action: {
        label: 'View your order',
        href: getShopSiteUrl(`/shop/checkout/confirmation/${encodeURIComponent(orderToken)}?view=details`),
      },
      footerText: 'For your privacy, you may need to verify access before viewing your order.',
    }),
  };
}

export function buildShopAddressCorrectionEmail(orderToken: string) {
  return {
    subject: `Check your delivery address · ${senderName}`,
    senderName,
    ...buildShopEmailLayout({
      previewText: 'Your payment was received. Please review your delivery address.',
      eyebrow: 'Order update',
      heading: 'Check your delivery address',
      paragraphs: [
        'Your payment was received. We need a corrected delivery address before preparing your order.',
        'Open your order and verify access to submit the correction. You do not need to pay again.',
      ],
      action: {
        label: 'View your order',
        href: getShopSiteUrl(`/shop/checkout/confirmation/${encodeURIComponent(orderToken)}?view=details`),
      },
      footerText: 'For your privacy, do not reply with your delivery address.',
    }),
  };
}
