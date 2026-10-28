import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '@/lib/cloudflare/r2';
import { getShopSiteUrl } from '@/lib/siteBaseUrls';
import { receiptDownloadPath, opaqueReceiptFile } from '@/lib/shop/orderHistory/receiptReference';

export async function uploadPaymentReceiptToR2({
  fileBody,
  filename,
  orderToken,
}: {
  filename: string;
  orderToken: string;
  fileBody: Buffer<ArrayBufferLike>;
}) {
  if (
    !filename.endsWith('.pdf') ||
    !opaqueReceiptFile(filename.slice(0, -4)) ||
    !/^[A-Za-z0-9_-]{1,128}$/u.test(orderToken)
  )
    throw new Error('Invalid receipt storage reference.');
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_PAYMENT_DOCS_BUCKET_NAME,
      Key: `paypal/${filename}`,
      Body: fileBody,
      ContentType: 'application/pdf',
      // Receipt objects can be regenerated after an audited fulfillment-address
      // correction, so clients and the CDN must revalidate the stable object URL.
      CacheControl: 'private, no-store, max-age=0, must-revalidate',
    }),
  );

  return { accessLink: getShopSiteUrl(receiptDownloadPath(orderToken)) };
}
