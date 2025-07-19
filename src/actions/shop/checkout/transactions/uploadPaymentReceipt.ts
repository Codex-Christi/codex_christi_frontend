import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '@/lib/cloudflare/r2';
import { cache } from 'react';

const objStorageDomain = `https://payment-receipts.codexchristi.shop`;

export const uploadPaymentReceiptToR2 = cache(
  async ({ fileBody, filename }: { filename: string; fileBody: Buffer<ArrayBufferLike> }) => {
    try {
      await r2.send(
        new PutObjectCommand({
          Bucket: process.env.R2_PAYMENT_DOCS_BUCKET_NAME,
          Key: `paypal/${filename}`,
          Body: fileBody,
          ContentType: 'application/pdf',
          CacheControl: 'public, max-age=31536000',
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
  },
);
