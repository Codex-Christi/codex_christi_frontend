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

const fulfillmentInput = {
  customerName: 'Alex',
  orderToken: 'sample/order?test=1',
  supportReference: 'sample-reference-0001',
  receiptAvailable: true,
};

for (const receiptAvailable of [true, false]) {
  test(`release email links to the protected order page with receipt ${receiptAvailable ? 'ready' : 'pending'}`, () => {
    const message = buildShopFulfillmentEmail({ ...fulfillmentInput, receiptAvailable });
    const label = receiptAvailable ? 'View order & receipt' : 'View order';
    const action = message.textbody.split('\n\n').find((line) => line.startsWith(`${label}: `));
    assert.ok(action, 'The plain-text email needs a usable order link.');
    const href = action.slice(label.length + 2);
    const url = new URL(href);
    assert.ok(url.pathname.endsWith('/shop/checkout/confirmation/sample%2Forder%3Ftest%3D1'));
    assert.equal(url.search, '?view=details');
    assert.equal(url.hash, '');
    assert.ok(message.htmlbody.includes(`href="${href}"`));
    assert.ok(message.htmlbody.includes(`>${label.replace('&', '&amp;')}</a>`));
    assert.ok(!href.includes(fulfillmentInput.customerName));
    assert.ok(!href.includes(fulfillmentInput.supportReference));
    assert.ok(!message.htmlbody.includes('/admin/'));
    for (const body of [message.textbody, message.htmlbody]) {
      assert.ok(body.includes('Your payment was received'));
      assert.ok(body.includes('sent for preparation'));
      assert.ok(!body.includes('Production has started'));
      assert.ok(body.includes(fulfillmentInput.supportReference));
      assert.ok(body.includes('you may need to verify access before viewing your order'));
      if (!receiptAvailable) assert.ok(!body.includes('receipt'));
    }
  });
}

test('preparing email requires an order and support reference', () => {
  const input = fulfillmentInput;
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
