// prisma.config.ts
import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';

// In dev/local, load env files manually for Prisma CLI
dotenv.config({ path: '.env.local' }); // Next-style env file for dev
dotenv.config(); // Also load .env if present

const url =
  process.env.MERCHIZE_PRICE_CATALOG_DATABASE_URL ?? 'file:./data/merchize_price_catalog.db';

export default defineConfig({
  schema: 'prisma/shop/merchize/priceCatalog.prisma',
  datasource: {
    url,
  },
});
