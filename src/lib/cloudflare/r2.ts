import { S3Client } from '@aws-sdk/client-s3';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_PAYMENT_DOCS_BUCKET_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_PAYMENT_DOCS_BUCKET_SECRET_ACCESS_KEY || '',
  },
});
