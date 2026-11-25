import 'server-only';

import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';

export const customerHoldSelect = {
  heldAt: true,
  lastLookupAt: true,
  duplicateDetectedAt: true,
} as const;

export function savedFulfillmentHoldCheck(row: {
  heldAt: Date | null;
  lastLookupAt: Date | null;
  duplicateDetectedAt: Date | null;
}) {
  return row.heldAt && !row.duplicateDetectedAt ? (row.lastLookupAt ?? row.heldAt) : null;
}

/** Read only after payment and order access are verified. */
export async function readCustomerFulfillmentHold(orderToken: string, djangoPaymentSaveCustomId: string) {
  if (!isMerchizeFulfillmentOpsDatabaseConfigured()) return null;

  try {
    const rows = await getMerchizeFulfillmentOpsPrisma().merchizeFulfillmentOrder.findMany({
      where: { orderToken, djangoPaymentSaveCustomId },
      select: customerHoldSelect,
      take: 2,
    });
    return rows.length === 1 ? savedFulfillmentHoldCheck(rows[0]) : null;
  } catch {
    return null;
  }
}
