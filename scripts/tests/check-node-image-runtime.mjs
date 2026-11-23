/** Run the qualified native-library probes in the actual standalone image. */
import { createRequire } from 'node:module';

const requireApp = createRequire('/app/server.js');
let stage = 'Node image identity';

function requireCondition(value) {
  if (!value) throw new Error('Image qualification check failed.');
}

function sharpModule() {
  try {
    return requireApp('sharp');
  } catch {
    return createRequire(requireApp.resolve('next/package.json'))('sharp');
  }
}

try {
  requireCondition(process.argv.length === 3 && process.argv[2] === 'native');
  requireCondition(process.platform === 'linux' && process.arch === 'x64'
    && /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/.test(process.env.EXPECTED_NODE_VERSION ?? '')
    && process.versions.node === process.env.EXPECTED_NODE_VERSION);

  stage = 'native SQLite';
  const Database = requireApp('better-sqlite3');
  const database = new Database(':memory:');
  try {
    database.exec('CREATE TABLE runtime_probe (value TEXT NOT NULL)');
    database.prepare('INSERT INTO runtime_probe (value) VALUES (?)').run('fixture');
    requireCondition(database.prepare('SELECT value FROM runtime_probe').get()?.value === 'fixture');
  } finally {
    database.close();
  }

  stage = 'Argon2';
  const argon2 = requireApp('argon2');
  const hash = await argon2.hash('codex-test-password', {
    type: argon2.argon2id, memoryCost: 4096, timeCost: 2, parallelism: 1,
  });
  requireCondition(await argon2.verify(hash, 'codex-test-password'));
  requireCondition(!(await argon2.verify(hash, 'different-test-password')));

  stage = 'Sharp WebP and AVIF';
  const sharp = sharpModule();
  for (const format of ['webp', 'avif']) {
    const bytes = await sharp(Buffer.alloc(16 * 16 * 3, 128), {
      raw: { width: 16, height: 16, channels: 3 },
    }).toFormat(format).toBuffer();
    const metadata = await sharp(bytes).metadata();
    requireCondition(metadata.width === 16 && metadata.height === 16);
  }

  console.log('Native checks=OK; SQLite, Argon2, WebP and AVIF=OK; platform=linux/amd64');
} catch {
  console.error('Node image qualification failed at ' + stage + '.');
  process.exitCode = 1;
}
