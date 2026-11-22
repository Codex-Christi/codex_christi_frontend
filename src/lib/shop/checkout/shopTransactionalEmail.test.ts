import assert from 'node:assert/strict';
import test from 'node:test';
import { buildShopEmailLayout } from '@/lib/shop/email/layout';
import { shopEmailFixtures } from '@/lib/shop/email/fixtures';
import { buildShopFulfillmentEmail, buildShopVerificationEmail } from '@/lib/shop/email/templates';

test('verification purposes have distinct subjects and previews without exposing codes', () => {
  const fixtures = shopEmailFixtures().slice(0, 3);
  assert.equal(new Set(fixtures.map(({ message }) => message.subject)).size, 3);
  const previews = fixtures.map(({ message }) => {
    assert.ok(message.subject.includes('Codex Christi Shop'));
    assert.ok(!message.subject.includes('482617'));
    const preview = message.htmlbody.match(/<div style="display:none[^>]*>(.*?)<\/div>/su)?.[1];
    assert.ok(preview && !preview.includes('482617'));
    assert.ok(message.htmlbody.includes('482617'));
    assert.ok(message.textbody.includes('482617'));
    assert.ok(message.textbody.includes('10 minutes'));
    return preview;
  });
  assert.equal(new Set(previews).size, 3);
  assert.match(fixtures[0].message.textbody, /in checkout/u);
  assert.match(fixtures[1].message.textbody, /checkout or order status/u);
  assert.match(fixtures[2].message.textbody, /signed-in Codex Christi account/u);
});

test('code expiry is supplied by the caller and malformed required metadata is rejected', () => {
  const input = { purpose: 'checkout' as const, otp: '482617', expiresInMinutes: 1 };
  const message = buildShopVerificationEmail(input);
  assert.match(message.textbody, /expires in 1 minute\./u);
  for (const expiresInMinutes of [0, -1, NaN, Infinity])
    assert.throws(() => buildShopVerificationEmail({ ...input, expiresInMinutes }), /expiry/u);
  for (const otp of ['', '12345', '1234567', '<code>'])
    assert.throws(() => buildShopVerificationEmail({ ...input, otp }), /six-digit/u);
  assert.throws(
    () => buildShopVerificationEmail({ ...input, purpose: 'unknown' as 'checkout' }),
    /Unknown/u,
  );
});

test('customer values are escaped in HTML while plain text keeps the original readable content', () => {
  const name = 'Alex <img src=x onerror="alert(1)"> & Co.';
  const message = buildShopVerificationEmail({
    purpose: 'checkout',
    otp: '482617',
    expiresInMinutes: 7,
    recipientName: name,
  });
  assert.ok(message.htmlbody.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Co.'));
  assert.ok(!message.htmlbody.includes('<img src=x'));
  assert.ok(message.textbody.includes(name));
  assert.ok(message.htmlbody.includes('7 minutes'));
  assert.ok(message.textbody.includes('7 minutes'));
});

test('fulfillment uses a private order page and preserves the existing receipt condition', () => {
  const input = {
    customerName: 'Alex',
    orderToken: 'sample/order?test=1',
    supportReference: 'sample-reference-0001',
    receiptAvailable: true,
  };
  const available = buildShopFulfillmentEmail(input);
  assert.match(available.textbody, /payment has been received/u);
  assert.ok(available.textbody.includes('sample-reference-0001'));
  assert.ok(available.htmlbody.includes('sample%2Forder%3Ftest%3D1?view=details'));
  assert.ok(!available.htmlbody.includes('/admin/'));
  const pending = buildShopFulfillmentEmail({ ...input, receiptAvailable: false });
  assert.ok(!pending.textbody.includes('View order & receipt'));
  assert.ok(!pending.htmlbody.includes('/shop/checkout/confirmation/'));
  assert.throws(() => buildShopFulfillmentEmail({ ...input, supportReference: '' }), /reference/u);
  assert.throws(() => buildShopFulfillmentEmail({ ...input, orderToken: '' }), /reference/u);
});

test('email links reject scripts, data URLs and embedded credentials', () => {
  for (const href of [
    'javascript:alert(1)',
    'data:text/html,test',
    'https://user:password@example.test/order',
    'https://user@example.test/order',
  ])
    assert.throws(() =>
      buildShopEmailLayout({
        previewText: 'Order update',
        eyebrow: 'Order update',
        heading: 'Your order',
        paragraphs: [],
        action: { href, label: 'View order' },
        footerText: 'Keep your reference.',
      }),
    );
});

test('all messages have lightweight HTML and a complete image-independent text alternative', () => {
  for (const { message } of shopEmailFixtures()) {
    assert.ok(Buffer.byteLength(message.htmlbody) < 12_000);
    assert.match(message.htmlbody, /<html lang="en">/u);
    assert.match(message.htmlbody, /role="presentation"/u);
    assert.ok(!/background-image|@font-face|<script|<form/iu.test(message.htmlbody));
    const withoutImages = message.htmlbody.replace(/<img\b[^>]*>/gu, '');
    assert.ok(withoutImages.includes('Codex Christi Shop'));
    assert.ok(message.textbody.includes('Codex Christi Shop'));
    assert.ok(message.textbody.includes('Visit Codex Christi Shop: https://'));
    assert.ok(!message.subject.includes('\n'));
  }
});
