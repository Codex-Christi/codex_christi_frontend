# Admin Auth Deployment Runbook

Last updated: 2026-06-21

This runbook covers the Prisma Admin Ops Ledger backed admin-auth flow. The
older standalone unlock-password hash script is intentionally removed; admin
password hashes are created and stored through the Admin Ops Ledger flows.

## Production Environment Variables

Admin Ops Ledger database:

```bash
NEON_ADMIN_OPS_LEDGER_POOLED_URL=...
NEON_ADMIN_OPS_LEDGER_URL=...
```

Use the pooled URL for runtime app access. Keep the direct URL available for
Prisma migrations and one-off scripts.

Admin session and master creation:

```bash
ADMIN_SESSION_SECRET=...
ADMIN_MASTER_USER_CREATION_TOKEN=...
```

`ADMIN_SESSION_SECRET` signs the second-layer `/admin` session and master
transfer OTP hashes. Use a high-entropy random value.

`ADMIN_MASTER_USER_CREATION_TOKEN` is the expected token for creating or
re-instating a master admin from the command line. The script now requires this
token to also be passed at execution time with `--creation-token`.

Django/Codex Christi profile verification:

```bash
NEXT_PUBLIC_DJANGO_API_BASE_URL=...
DJANGO_INTERNAL_BASE_URL=...
DJANGO_PREFER_INTERNAL_BASE_URL=true
```

`NEXT_PUBLIC_DJANGO_API_BASE_URL` is required. In production, set
`DJANGO_INTERNAL_BASE_URL` when the Next runtime can reach Django through a
private service URL. The admin user creation and transfer flows verify the
target Codex Christi user ID through:

```txt
GET /account/{id}/profile
```

Master transfer email:

```bash
CODEX_PRIMARY_MAIL_AGENT_TOKEN=...
```

This is required for the OTP email used by master-admin transfer.

## Deploy Steps

1. Set the production env vars above.
2. Run the Admin Ops Ledger Prisma migration:

```bash
yarn prisma:adminOpsLedger:migrate:deploy
```

3. Generate the Prisma client when needed:

```bash
yarn prisma:adminOpsLedger:generate
```

4. Create or re-instate a master admin:

```bash
yarn admin:user:create-master -- \
  --creation-token "$ADMIN_MASTER_USER_CREATION_TOKEN_INPUT" \
  --user-id "codex-christi-user-uuid" \
  --password "new-admin-unlock-password"
```

The script verifies:

- `ADMIN_MASTER_USER_CREATION_TOKEN` is configured.
- `--creation-token` matches the configured token.
- The target Codex Christi user ID exists through Django.
- The unlock password is hashed with Argon2id before storage.

5. Sign into the primary Codex Christi login, open `/admin`, then unlock with
   the admin unlock password.

## Runtime Admin User Management

Only master admins can access `/admin/admin-ops`.

Operational admin creation now:

- verifies the target Codex Christi user ID before writing the ledger row;
- shows a small public profile preview in the UI;
- does not depend on mutable email as identity;
- stores the stable Codex Christi user ID as the admin identity.

Master-admin transfer now:

- requires the current master admin unlock password;
- verifies the target Codex Christi user ID before sending OTP;
- sends OTP to the email entered for the transfer;
- logs out the old master after completion.

## Stale Variables And Scripts

Do not use an env-stored admin unlock password hash for the Prisma-backed flow.
Do not use the removed `admin:auth:create-unlock-password-hash` script.

The active password paths are:

- `yarn admin:user:create-master` for master creation/re-instating.
- `/admin/admin-ops` for operational admin creation and updates.
- master transfer UI for moving master admin access.

## Maintenance

For minimal storage pruning:

```bash
yarn admin:auth:prune-ledger:minimum-storage
```

For standard retention:

```bash
yarn admin:auth:prune-ledger:standard
```

The manual security-records maintenance UI remains under:

```txt
/admin/admin-ops/security-records
```
