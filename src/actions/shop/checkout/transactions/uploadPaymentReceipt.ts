import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '@/lib/cloudflare/r2';

const objStorageDomain = `https://payment-receipts.codexchristi.shop`;

export async function uploadPaymentReceiptToR2({
  fileBody,
  filename,
}: {
  filename: string;
  fileBody: Buffer<ArrayBufferLike>;
}) {
  try {
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

    // Return Link for object
    return { accessLink: `${objStorageDomain}/paypal/${encodeURI(filename)}` };

    // Catch any error
  } catch (err) {
    throw new Error(
      typeof err === 'string' ? err : err instanceof Error ? err.message : JSON.stringify(err),
    );
  }
}
