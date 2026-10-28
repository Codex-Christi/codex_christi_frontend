import { getShopSiteBaseUrl } from '@/lib/siteBaseUrls';

export function receiptDownloadPath(orderToken: string) {
  return `/next-api/shop/orders/${encodeURIComponent(orderToken)}/receipt`;
}

export function opaqueReceiptFile(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^receipt-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value)
  );
}

/** Translate only server-owned receipt references; never sign an arbitrary URL or bucket. */
export function receiptObjectKey(row: {
  orderToken: string;
  receiptLink: string | null;
  receiptFile?: string | null;
}) {
  if (!row.receiptLink) return null;
  try {
    const url = new URL(row.receiptLink);
    if (url.username || url.password || url.hash) return null;
    if (
      url.origin === new URL(getShopSiteBaseUrl()).origin &&
      url.pathname === receiptDownloadPath(row.orderToken) &&
      opaqueReceiptFile(row.receiptFile)
    )
      return `paypal/${row.receiptFile}.pdf`;
    if (
      url.protocol !== 'https:' ||
      url.port ||
      url.hostname !== 'payment-receipts.codexchristi.shop'
    )
      return null;
    const key = decodeURIComponent(url.pathname.slice(1));
    return key.startsWith('paypal/') &&
      key.endsWith('.pdf') &&
      key.length <= 1024 &&
      !/[\\\u0000-\u001f\u007f]/u.test(key) &&
      !/(^|\/)\.\.?(\/|$)/u.test(key)
      ? key
      : null;
  } catch {
    return null;
  }
}
