import assert from 'node:assert/strict';
import test from 'node:test';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '@/lib/cloudflare/r2';
import { uploadPaymentReceiptToR2 } from '@/actions/shop/checkout/transactions/uploadPaymentReceipt';
import { receiptDownloadPath } from './receiptReference';
import { getShopSiteUrl } from '@/lib/siteBaseUrls';

test('receipt upload uses the existing bucket with an opaque PDF key and returns a protected link', async (t) => {
  const previous = process.env.R2_PAYMENT_DOCS_BUCKET_NAME;
  process.env.R2_PAYMENT_DOCS_BUCKET_NAME = 'existing-receipt-bucket';
  t.after(() => {
    if (previous === undefined) delete process.env.R2_PAYMENT_DOCS_BUCKET_NAME;
    else process.env.R2_PAYMENT_DOCS_BUCKET_NAME = previous;
  });
  const filename = 'receipt-d73b4b97-3ec0-4163-8a34-55d649404f81.pdf';
  const fileBody = Buffer.from('isolated receipt fixture');
  const send = t.mock.method(r2, 'send', async (command: unknown) => {
    assert.ok(command instanceof PutObjectCommand);
    assert.equal(command.input.Bucket, 'existing-receipt-bucket');
    assert.equal(command.input.Key, `paypal/${filename}`);
    assert.equal(command.input.Body, fileBody);
    assert.equal(command.input.ContentType, 'application/pdf');
    assert.match(command.input.CacheControl!, /private, no-store/u);
    return {};
  });
  assert.deepEqual(await uploadPaymentReceiptToR2({ filename, fileBody, orderToken: 'token-1' }), {
    accessLink: getShopSiteUrl(receiptDownloadPath('token-1')),
  });
  for (const name of [filename.slice(0, -4), '../receipt.pdf', 'customer-name.pdf']) {
    await assert.rejects(
      () => uploadPaymentReceiptToR2({ filename: name, fileBody, orderToken: 'token-1' }),
      /Invalid receipt/u,
    );
  }
  assert.equal(send.mock.callCount(), 1, 'Rejected inputs never contact storage');
});
