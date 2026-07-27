import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { normalizePostgresSslMode } from '@/lib/prisma/postgresSslMode';
import { getShopOpsDataTargetStatus } from '@/lib/prisma/shop/shopOpsDataTarget';
import { PrismaClient } from './generated/merchizeFulfillmentOps/client';

function resolveMerchizeFulfillmentOpsConnectionString(): string | null {
  const targetStatus = getShopOpsDataTargetStatus();
  if (!targetStatus.aligned) return null;

  const target = targetStatus.target;
  const prodUrl =
    process.env.MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_STRING?.trim() ||
    process.env.MERCHIZE_FULFILLMENT_OPS_DATABASE_URL?.trim();
  const devUrl =
    process.env.MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING?.trim() ||
    process.env.MERCHIZE_FULFILLMENT_OPS_DATABASE_DEV_URL?.trim();

  if (target === 'prod') return prodUrl ?? null;
  if (target === 'dev') return devUrl ?? null;
  return null;
}

export function isMerchizeFulfillmentOpsDatabaseConfigured() {
  return Boolean(resolveMerchizeFulfillmentOpsConnectionString());
}

declare global {
  var __merchizeFulfillmentOpsPrisma__: PrismaClient | undefined;
}

export function getMerchizeFulfillmentOpsPrisma() {
  const connectionString = resolveMerchizeFulfillmentOpsConnectionString();
  if (!connectionString) {
    throw new Error(
      'No Merchize Fulfillment Ops database URL is configured. Set MERCHIZE_FULFILLMENT_OPS_DATABASE_URL or the Merchize Fulfillment Ops Neon pooled URL variables.',
    );
  }

  if (global.__merchizeFulfillmentOpsPrisma__) {
    return global.__merchizeFulfillmentOpsPrisma__;
  }

  const adapter = new PrismaPg({ connectionString: normalizePostgresSslMode(connectionString) });
  const prisma = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== 'production') {
    global.__merchizeFulfillmentOpsPrisma__ = prisma;
  }

  return prisma;
}
