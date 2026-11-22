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
    subject: `We’re preparing your order · ${subjectReference} · ${senderName}`,
    senderName,
    ...buildShopEmailLayout({
      previewText: 'Your payment has been received and your order is moving into preparation.',
      eyebrow: 'Order update',
      heading: 'We’re preparing your order',
      greeting: customerName?.trim() ? `Hi ${customerName.trim()},` : 'Hello,',
      paragraphs: [
        'Your payment has been received, and we’re getting your order ready.',
        'Keep the reference below if you need to contact us about your order.',
      ],
      details: [
        { label: 'Order status', value: 'Preparing your order' },
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
