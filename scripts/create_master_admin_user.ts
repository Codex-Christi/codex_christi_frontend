import argon2 from 'argon2';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/lib/prisma/adminOpsLedger/generated/adminOpsLedger/client';
import {
  getDefaultAdminRole,
  getDefaultAdminScopes,
  parseAdminScopes,
} from '../src/lib/admin/admin-config';

dotenv.config({ path: '.env.local' });
dotenv.config();

type ParsedArgs = {
  userId?: string;
  password?: string;
  scopes?: string;
};

function parseArgs(): ParsedArgs {
  const parsed: ParsedArgs = {};
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (current === '--user-id') parsed.userId = next;
    if (current === '--password') parsed.password = next;
    if (current === '--scopes') parsed.scopes = next;

    if (current.startsWith('--')) {
      index += 1;
    }
  }

  return parsed;
}

function getConnectionString() {
  const connectionString =
    process.env.NEON_ADMIN_OPS_LEDGER_URL ?? process.env.NEON_ADMIN_OPS_LEDGER_POOLED_URL;

  if (!connectionString) {
    throw new Error('Set NEON_ADMIN_OPS_LEDGER_URL before creating the master admin user.');
  }

  return connectionString;
}

async function main() {
  if (!process.env.ADMIN_MASTER_USER_CREATION_TOKEN?.trim()) {
    throw new Error(
      'Set ADMIN_MASTER_USER_CREATION_TOKEN before creating the master admin user.',
    );
  }

  const args = parseArgs();
  const codexUserId = args.userId?.trim();
  const password = args.password;
  const role = getDefaultAdminRole();
  const scopes = args.scopes ? parseAdminScopes(args.scopes) : getDefaultAdminScopes();

  if (!codexUserId) {
    throw new Error('Missing --user-id.');
  }

  if (!password) {
    throw new Error('Missing --password.');
  }

  if (!scopes.length) {
    throw new Error('At least one valid admin scope is required.');
  }

  const adapter = new PrismaPg({ connectionString: getConnectionString() });
  const prisma = new PrismaClient({ adapter });
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });
  const existing = await prisma.adminUser.findUnique({
    where: { codexUserId },
    select: { id: true },
  });
  const adminUser = await prisma.adminUser.upsert({
    where: { codexUserId },
    create: {
      codexUserId,
      email: null,
      displayName: null,
      passwordHash,
      role,
      scopes,
      status: 'active',
      sessionVersion: 1,
      createdByCodexUserId: 'master_admin_creation_script',
      updatedByCodexUserId: 'master_admin_creation_script',
    },
    update: {
      email: null,
      displayName: null,
      passwordHash,
      role,
      scopes,
      status: 'active',
      disabledAt: null,
      disabledReason: null,
      sessionVersion: {
        increment: 1,
      },
      updatedByCodexUserId: 'master_admin_creation_script',
    },
    select: {
      id: true,
      codexUserId: true,
      email: true,
      role: true,
      scopes: true,
      status: true,
      sessionVersion: true,
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      actorAdminUserId: adminUser.id,
      actorCodexUserId: adminUser.codexUserId,
      action: existing
        ? 'admin.master_user.creation_script_updated'
        : 'admin.master_user.creation_script_created',
      targetType: 'adminUser',
      targetId: adminUser.id,
      outcome: 'success',
      metadata: {
        codexUserId: adminUser.codexUserId,
        role: adminUser.role,
        scopes: adminUser.scopes,
        status: adminUser.status,
        sessionVersion: adminUser.sessionVersion,
      },
    },
  });

  await prisma.$disconnect();

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: existing ? 'updated' : 'created',
        adminUser,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
