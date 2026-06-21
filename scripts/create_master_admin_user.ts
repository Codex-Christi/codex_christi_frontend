import argon2 from 'argon2';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/lib/prisma/adminOpsLedger/generated/adminOpsLedger/client';
import { normalizePostgresSslMode } from '../src/lib/prisma/postgresSslMode';
import {
  getDefaultAdminRole,
  getDefaultAdminScopes,
  parseAdminScopes,
} from '../src/lib/admin/admin-config';

dotenv.config({ path: '.env.local' });
dotenv.config();

type ParsedArgs = {
  creationToken?: string;
  userId?: string;
  password?: string;
  scopes?: string;
};

type CodexUserPreview = {
  displayName: string;
  username: string | null;
};

function parseArgs(): ParsedArgs {
  const parsed: ParsedArgs = {};
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];
    const inlineSeparatorIndex = current.indexOf('=');
    const inlineKey =
      inlineSeparatorIndex > -1 ? current.slice(0, inlineSeparatorIndex) : current;
    const inlineValue =
      inlineSeparatorIndex > -1 ? current.slice(inlineSeparatorIndex + 1) : undefined;

    if (inlineKey === '--creation-token' && inlineValue) parsed.creationToken = inlineValue;
    if (inlineKey === '--user-id' && inlineValue) parsed.userId = inlineValue;
    if (inlineKey === '--password' && inlineValue) parsed.password = inlineValue;
    if (inlineKey === '--scopes' && inlineValue) parsed.scopes = inlineValue;

    if (inlineValue) {
      continue;
    }

    if (current === '--creation-token') parsed.creationToken = next;
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

function getDjangoApiBaseUrl() {
  const publicBaseUrl = process.env.NEXT_PUBLIC_DJANGO_API_BASE_URL;
  const internalBaseUrl = process.env.DJANGO_INTERNAL_BASE_URL;
  const shouldPreferInternalBaseUrl =
    process.env.NODE_ENV === 'production' ||
    process.env.DJANGO_PREFER_INTERNAL_BASE_URL === 'true';
  const baseUrl = shouldPreferInternalBaseUrl
    ? internalBaseUrl ?? publicBaseUrl
    : publicBaseUrl ?? internalBaseUrl;

  if (!baseUrl) {
    throw new Error('Set NEXT_PUBLIC_DJANGO_API_BASE_URL before creating a master admin user.');
  }

  return baseUrl.replace(/\/+$/, '');
}

function assertCreationToken(submittedToken: string | undefined) {
  const expectedToken = process.env.ADMIN_MASTER_USER_CREATION_TOKEN?.trim();
  const candidateToken = submittedToken?.trim();

  if (!expectedToken) {
    throw new Error('Set ADMIN_MASTER_USER_CREATION_TOKEN before creating a master admin user.');
  }

  if (!candidateToken) {
    throw new Error('Pass --creation-token before creating a master admin user.');
  }

  const expected = Buffer.from(expectedToken);
  const candidate = Buffer.from(candidateToken);

  if (expected.length !== candidate.length || !crypto.timingSafeEqual(expected, candidate)) {
    throw new Error('The submitted master admin creation token is invalid.');
  }
}

async function verifyCodexChristiUserId(userId: string): Promise<CodexUserPreview> {
  if (!isUuid(userId)) {
    throw new Error('Enter a valid Codex Christi user UUID.');
  }

  const response = await fetch(
    `${getDjangoApiBaseUrl()}/account/${encodeURIComponent(userId)}/profile`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (response.status === 404) {
    throw new Error('No Codex Christi user exists for that user ID.');
  }

  if (!response.ok) {
    throw new Error('Unable to verify the Codex Christi user ID right now.');
  }

  const payload = (await response.json()) as {
    data?: {
      id?: string;
      first_name?: string | null;
      last_name?: string | null;
      username?: string | null;
    };
  };
  const profile = payload.data;

  if (!profile?.id || profile.id !== userId) {
    throw new Error('Codex Christi profile verification returned an unexpected user ID.');
  }

  const fullName = [normalizeText(profile.first_name), normalizeText(profile.last_name)]
    .filter(Boolean)
    .join(' ');

  return {
    displayName: fullName || normalizeText(profile.username) || userId,
    username: normalizeText(profile.username),
  };
}

async function main() {
  const args = parseArgs();
  assertCreationToken(args.creationToken);

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

  const verifiedUser = await verifyCodexChristiUserId(codexUserId);

  const adapter = new PrismaPg({
    connectionString: normalizePostgresSslMode(getConnectionString()),
  });
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
        verifiedDisplayName: verifiedUser.displayName,
        verifiedUsername: verifiedUser.username,
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
        verifiedUser,
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

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed || null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
