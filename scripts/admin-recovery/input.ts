import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import dotenv from 'dotenv';
import { z } from 'zod';
import {
  AdminRecoveryError,
  type AdminRecoveryMode,
} from '../../src/lib/admin/admin-recovery-core';
import { parseNewAdminPassword } from '../../src/lib/formSchemas/admin-password';

export type RecoveryOptions = {
  mode: AdminRecoveryMode;
  environment: 'production' | 'development';
  envFile: string;
  userId: string;
  dryRun: boolean;
  stdin: boolean;
};

export function parseRecoveryOptions(argv: string[]): RecoveryOptions {
  const args = argv.filter((arg) => arg !== '--');
  const mode = args.shift();
  const values = new Map<string, string>();
  const flags = new Set<string>();
  while (args.length) {
    const key = args.shift()!;
    if (['--dry-run', '--stdin'].includes(key) && !flags.has(key)) flags.add(key);
    else if (['--env-file', '--environment', '--user-id'].includes(key) && !values.has(key)) {
      const value = args.shift();
      if (!value || value.startsWith('--'))
        throw new AdminRecoveryError('A required option is missing. Use --help.');
      values.set(key, value);
    } else
      throw new AdminRecoveryError(
        'Unsupported or repeated option. Use --help; never pass secrets as arguments.',
      );
  }
  const environment = values.get('--environment');
  const userId = values.get('--user-id');
  const envFile = values.get('--env-file');
  if (
    (mode !== 'create' && mode !== 'reset-password') ||
    (environment !== 'production' && environment !== 'development') ||
    !envFile ||
    !userId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
  )
    throw new AdminRecoveryError(
      'Specify create or reset-password, --environment, --env-file and a valid --user-id.',
    );
  return {
    mode,
    environment,
    envFile: resolve(envFile),
    userId,
    dryRun: flags.has('--dry-run'),
    stdin: flags.has('--stdin'),
  };
}

export function loadRecoveryConfiguration(options: RecoveryOptions) {
  // Only the explicitly selected file supplies credentials; inherited env is not a fallback.
  const env = dotenv.parse(readFileSync(options.envFile));
  if (env.NODE_ENV && env.NODE_ENV !== options.environment)
    throw new AdminRecoveryError('The selected file NODE_ENV does not match --environment.');
  const connectionString = env.NEON_ADMIN_OPS_LEDGER_URL ?? env.NEON_ADMIN_OPS_LEDGER_POOLED_URL;
  let database: URL;
  try {
    if (!connectionString || /[\s\\]/u.test(connectionString)) throw new Error();
    database = new URL(connectionString);
    if (
      !['postgres:', 'postgresql:'].includes(database.protocol) ||
      !database.hostname ||
      database.pathname.length < 2 ||
      database.hash
    )
      throw new Error();
  } catch {
    throw new AdminRecoveryError(
      'The selected file must contain a valid Admin Ops PostgreSQL URL.',
    );
  }
  const expectedToken = env.ADMIN_MASTER_USER_CREATION_TOKEN?.trim();
  if (!expectedToken)
    throw new AdminRecoveryError('The selected file is missing ADMIN_MASTER_USER_CREATION_TOKEN.');
  const preferInternal =
    options.environment === 'production' || env.DJANGO_PREFER_INTERNAL_BASE_URL === 'true';
  const djangoBaseUrl = preferInternal
    ? (env.DJANGO_INTERNAL_BASE_URL ?? env.NEXT_PUBLIC_DJANGO_API_BASE_URL)
    : (env.NEXT_PUBLIC_DJANGO_API_BASE_URL ?? env.DJANGO_INTERNAL_BASE_URL);
  if (options.mode === 'create') {
    try {
      if (!djangoBaseUrl || /[\s\\]/u.test(djangoBaseUrl)) throw new Error();
      const url = new URL(djangoBaseUrl);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
    } catch {
      throw new AdminRecoveryError(
        'Creation requires a valid Django API base URL in the selected file.',
      );
    }
  }
  return {
    connectionString: connectionString!,
    expectedToken,
    djangoBaseUrl,
    database: {
      host: database!.hostname,
      port: database!.port || '5432',
      name: database!.pathname.slice(1),
    },
  };
}

export function assertRecoveryToken(expected: string, submitted: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(submitted.trim());
  if (!b.length || a.length !== b.length || !timingSafeEqual(a, b))
    throw new AdminRecoveryError('The recovery token is incorrect.');
}

async function ask(prompt: string, hidden = false) {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new AdminRecoveryError(
      'Interactive input needs a terminal. Use --stdin for protected JSON input.',
    );
  const output = hidden
    ? new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
      })
    : process.stdout;
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const controller = new AbortController();
  rl.on('SIGINT', () => controller.abort());
  if (hidden) process.stdout.write(prompt);
  try {
    return await rl.question(hidden ? '' : prompt, { signal: controller.signal });
  } catch {
    throw new AdminRecoveryError('Input cancelled.');
  } finally {
    rl.close();
    if (hidden) process.stdout.write('\n');
  }
}

const inputSchema = z
  .object({
    creationToken: z.string().min(1).max(4096),
    password: z.string().max(4096).optional(),
    passwordConfirmation: z.string().max(4096).optional(),
    confirmation: z.string().max(512).optional(),
  })
  .strict();
type RecoveryInput = z.infer<typeof inputSchema>;

export async function readRecoveryInput(stdin: boolean): Promise<RecoveryInput> {
  if (!stdin) return { creationToken: await ask('Recovery token (hidden): ', true) };
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 8192) throw new AdminRecoveryError('Recovery input exceeds 8 KiB.');
    chunks.push(buffer);
  }
  try {
    const parsed = inputSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (parsed.success) return parsed.data;
  } catch {
    /* Never echo malformed input, which can contain secrets. */
  }
  throw new AdminRecoveryError('Invalid recovery JSON. Check the documented input fields.');
}

export async function confirmRecoveryWrite(options: RecoveryOptions, input: RecoveryInput) {
  const phrase = `${options.mode} ${options.environment} ${options.userId}`;
  console.log(`Required confirmation: ${phrase}`);
  const confirmation = options.stdin ? input.confirmation : await ask('Type the confirmation: ');
  if (confirmation !== phrase)
    throw new AdminRecoveryError('Confirmation did not match. Nothing was changed.');
  const password = options.stdin
    ? input.password
    : await ask('New unlock password (hidden): ', true);
  const repeated = options.stdin
    ? input.passwordConfirmation
    : await ask('Repeat unlock password (hidden): ', true);
  if (typeof password !== 'string' || password !== repeated)
    throw new AdminRecoveryError('The new passwords do not match. Nothing was changed.');
  try {
    return parseNewAdminPassword(password);
  } catch (error) {
    throw new AdminRecoveryError(
      error instanceof Error ? error.message : 'Check the unlock password.',
    );
  }
}
