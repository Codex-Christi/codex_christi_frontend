import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { PrismaClient } from '../src/lib/prisma/adminOpsLedger/generated/adminOpsLedger/client';
import { normalizePostgresSslMode } from '../src/lib/prisma/postgresSslMode';
import { readDjangoJson } from '../src/lib/django/read-json';
import {
  AdminRecoveryError,
  adminRecoverySnapshotSelect,
  assertAdminRecoveryTarget,
  recoverAdminAccess,
} from '../src/lib/admin/admin-recovery-core';
import {
  assertRecoveryToken,
  confirmRecoveryWrite,
  loadRecoveryConfiguration,
  parseRecoveryOptions,
  readRecoveryInput,
} from './admin-recovery/input';

const usage = `Emergency admin access (run only from a trusted VPS terminal):
  yarn admin:user:create-master create --environment production --env-file /absolute/path/.env.production --user-id UUID
  yarn admin:user:create-master reset-password --environment production --env-file /absolute/path/.env.production --user-id UUID
  Add --dry-run for a read-only preview. Use development for a development database.
  Secrets are entered through hidden prompts. --stdin accepts protected JSON input.
  Passwords and recovery tokens are never accepted in command arguments.
  Reset preserves identity, permissions and disabled status; it does not change Django login.`;

async function verifyNewUser(baseUrl: string, userId: string) {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}/account/${encodeURIComponent(userId)}/profile`,
    {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok)
    throw new AdminRecoveryError('Django could not confirm the new user. Nothing was changed.');
  const parsed = z
    .object({
      data: z.object({
        id: z.string(),
        username: z.string().max(256).nullish(),
        first_name: z.string().max(256).nullish(),
        last_name: z.string().max(256).nullish(),
      }),
    })
    .safeParse(await readDjangoJson(response));
  if (!parsed.success || parsed.data.data.id !== userId)
    throw new AdminRecoveryError('Django returned an unexpected user. Nothing was changed.');
  return parsed.data.data;
}

async function main() {
  if (process.argv.slice(2).some((arg) => arg === '--help')) {
    console.log(usage);
    return;
  }
  const options = parseRecoveryOptions(process.argv.slice(2));
  const config = loadRecoveryConfiguration(options);
  const input = await readRecoveryInput(options.stdin);
  assertRecoveryToken(config.expectedToken, input.creationToken);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: normalizePostgresSslMode(config.connectionString),
      connectionTimeoutMillis: 8000,
    }),
  });
  try {
    const existing = await prisma.adminUser.findUnique({
      where: { codexUserId: options.userId },
      select: adminRecoverySnapshotSelect,
    });
    assertAdminRecoveryTarget(options.mode, existing);
    const profile =
      options.mode === 'create' ? await verifyNewUser(config.djangoBaseUrl!, options.userId) : null;
    console.log(
      JSON.stringify(
        {
          mode: options.mode,
          environment: options.environment,
          envFile: options.envFile,
          database: config.database,
          account: existing
            ? {
                codexUserId: existing.codexUserId,
                email: existing.email,
                displayName: existing.displayName,
                role: existing.role,
                scopes: existing.scopes,
                status: existing.status,
                sessionVersion: existing.sessionVersion,
              }
            : { codexUserId: options.userId, profile, role: 'master_admin', status: 'active' },
          dryRun: options.dryRun,
        },
        null,
        2,
      ),
    );
    if (options.dryRun) {
      console.log('Preview only. No password, account, audit or transfer was changed.');
      return;
    }
    const password = await confirmRecoveryWrite(options, input);
    const admin = await recoverAdminAccess({
      prisma,
      mode: options.mode,
      environment: options.environment,
      codexUserId: options.userId,
      expected: existing,
      password,
    });
    console.log(JSON.stringify({ ok: true, action: options.mode, admin }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(
    error instanceof AdminRecoveryError
      ? error.message
      : 'Recovery did not finish. Check configuration/database availability and verify the outcome before retrying. No automatic retry was attempted.',
  );
  process.exitCode = 1;
});
