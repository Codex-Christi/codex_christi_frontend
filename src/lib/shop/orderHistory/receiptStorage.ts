import 'server-only';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { receiptObjectKey } from './receiptReference';
import { isAdminScopeAllowed, type AdminRole, type AdminScope } from '@/lib/admin/admin-config';

export const RECEIPT_DOWNLOAD_SECONDS = 60;
let client: S3Client | undefined;

export function canSupportReadReceipt(admin: { role: AdminRole; scopes: AdminScope[] }) {
  return (
    ['master_admin', 'admin', 'support'].includes(admin.role) &&
    isAdminScopeAllowed(admin.scopes, 'shop.view', admin.role)
  );
}

export async function signReceiptDownload(row: Parameters<typeof receiptObjectKey>[0]) {
  const key = receiptObjectKey(row);
  const bucket = process.env.R2_PAYMENT_DOCS_BUCKET_NAME;
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!key || !bucket || !accountId) throw new Error('Receipt storage unavailable.');
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: async () => {
      const accessKeyId = process.env.R2_PAYMENT_DOCS_BUCKET_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_PAYMENT_DOCS_BUCKET_SECRET_ACCESS_KEY;
      if (!accessKeyId || !secretAccessKey) throw new Error('Receipt storage unavailable.');
      return { accessKeyId, secretAccessKey };
    },
  });
  // Signing is local; R2 is contacted only when the authorized user downloads the file.
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: 'application/pdf',
      ResponseContentDisposition: 'attachment; filename="Codex-Christi-receipt.pdf"',
      ResponseCacheControl: 'private, no-store, max-age=0',
    }),
    { expiresIn: RECEIPT_DOWNLOAD_SECONDS },
  );
}
