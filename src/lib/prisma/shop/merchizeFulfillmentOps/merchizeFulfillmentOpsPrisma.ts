import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/merchizeFulfillmentOps/client';

function resolveMerchizeFulfillmentOpsConnectionString(): string | null {
  const explicitTarget = process.env.MERCHIZE_FULFILLMENT_OPS_NEON_BRANCH;
  const prodUrl =
    process.env.MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_STRING ??
    process.env.MERCHIZE_FULFILLMENT_OPS_DATABASE_URL;
  const devUrl =
    process.env.MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING ??
    process.env.MERCHIZE_FULFILLMENT_OPS_DATABASE_DEV_URL;

  if (explicitTarget === 'prod') return prodUrl ?? null;
  if (explicitTarget === 'dev') return devUrl ?? null;
  if (process.env.NODE_ENV !== 'production' && devUrl) return devUrl;

  return prodUrl ?? devUrl ?? null;
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

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== 'production') {
    global.__merchizeFulfillmentOpsPrisma__ = prisma;
  }

  return prisma;
}
