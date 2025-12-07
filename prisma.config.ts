// prisma.config.ts
import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env for local/dev CLI usage
dotenv.config({ path: '.env.local' });
dotenv.config();

// 1) Compute an absolute path for the DB, based on project root
// __dirname here is the folder where prisma.config.ts lives.
// In your repo, that's the project root: /Users/devsantorz/Desktop/devProjects/codex_christi
const projectRoot = __dirname;

// Default DB location: <projectRoot>/data/db/shop/merchizeCatalog.db
const defaultDbPath = path.join(projectRoot, 'data', 'db', 'shop', 'merchizeCatalog.db');

// If you *really* want to override via env, you still can.
// But for now I'd recommend leaving MERCHIZE_PRICE_CATALOG_DATABASE_URL unset
// until everything works with the default.
const envUrl = process.env.MERCHIZE_PRICE_CATALOG_DATABASE_URL;

// If envUrl is provided and already starts with "file:", we trust it as-is.
// Otherwise we fall back to file:<absolute path we just built>
const url = envUrl && envUrl.startsWith('file:') ? envUrl : `file:${defaultDbPath}`;

// 2) Ensure the directory exists BEFORE Prisma tries to open the file
try {
  const dir = path.dirname(defaultDbPath);
  fs.mkdirSync(dir, { recursive: true });
} catch (err) {
  console.error('Failed to ensure SQLite directory exists:', err);
}

export default defineConfig({
  schema: './prisma/shop/merchize/priceCatalog.prisma',
  datasource: {
    url,
  },
});
