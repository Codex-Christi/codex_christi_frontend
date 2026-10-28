# Admin Auth Deployment Runbook

Last updated: 2026-10-27

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
transfer OTP hashes. Use a separate random value of at least 32 UTF-8 bytes.

`ADMIN_MASTER_USER_CREATION_TOKEN` protects emergency CLI creation and password
resets. The operator must also supply it through a hidden prompt or protected
stdin. Do not put it or a password in command arguments, shell history or logs.

Django/Codex Christi profile verification:

```bash
NEXT_PUBLIC_DJANGO_API_BASE_URL=...
DJANGO_INTERNAL_BASE_URL=...
DJANGO_PREFER_INTERNAL_BASE_URL=true
```

Creation needs a Django API base URL. In production, set
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

Use the existing deployment workflow. Its migrate service reads `.env.production`,
generates the Admin Ops client and applies the existing migrations before app
restart. Confirm direct and pooled URLs address the same production database.
Do not run an unqualified migration command that could load `.env.local` instead.
See [database setup](../devScripts/README.md#database-setup).

The user reports the previous Next release and Nginx are deployed; production
authentication checks remain pending. The recovery/transfer changes described
here still require their own release. Do not treat local tests as acceptance of
either release.

## Emergency Creation And Password Reset

Routine changes belong at `/admin/security`. Emergency CLI access requires a
trusted VPS terminal, dependencies/generated client, the selected protected env
file and the recovery token. It is not a public account-recovery endpoint and
does not recover a lost Django login or mailbox.

The selected database must be reachable from that maintenance environment.
Creation also needs its selected Django URL: Docker-only hostnames require the
same Docker network or a separate explicitly selected file with reachable URLs.
Do not change production URLs merely to test the command.

The existing script name is retained, but its mode is mandatory. Start with a
read-only preview, replacing the example path and UUID:

```sh
yarn admin:user:create-master reset-password \
  --environment production --env-file /absolute/path/.env.production \
  --user-id "codex-christi-user-uuid" --dry-run
```

Review the displayed database host/name, selected file, user ID, role and status.
The environment label cannot prove a Neon branch is correct. Only the explicitly
selected file supplies credentials; inherited variables and implicit `.env.local`
or `.env` files are not used. A conflicting file `NODE_ENV` is refused.

To apply the reset, repeat without `--dry-run`. Enter the hidden recovery token,
type the displayed confirmation, then enter and repeat the new unlock password.
Passwords use the shared 12-128-character policy without trimming.

- `reset-password` requires an existing admin of any role. It preserves identity,
  email, display name, role, scopes and disabled status. A disabled account stays
  disabled; this is not a way to restore the former owner's master access.
- Reset changes the hash, increments the admin session version, cancels pending
  transfers to/from that account and saves an audit in one transaction. A changed
  preview or failed audit rolls back the write. Existing unlocks fail their next
  authorization check; ordinary website login is unchanged.
- Reset does not contact Django. It remains usable during a Django outage, but
  opening admin later still requires a valid ordinary website login.
- `create` replaces `reset-password` in the command only when adding a new master.
  It verifies the Django UUID with an 8-second deadline and bounded response,
  refuses an existing admin and creates the new account/audit together. It never
  upserts, promotes or re-enables an existing account.
- No changes occur for a dry run, invalid token, cancelled/mismatched confirmation
  or invalid password. On an uncertain database/network result, verify the actual
  account/audit before retrying; the command does not automatically retry.

For trusted automation, `--stdin` accepts one JSON object, capped at 8 KiB:

```json
{
  "creationToken": "<protected recovery token>",
  "confirmation": "reset-password production <exact-user-uuid>",
  "password": "<new unlock password>",
  "passwordConfirmation": "<same new unlock password>"
}
```

For `--dry-run`, only `creationToken` is needed. Deliver JSON through a protected
pipe or file; do not put real secrets into shell literals, examples or command
arguments. Remove any temporary secret file after use. There is no `--yes` bypass.
The old `--creation-token`, `--password` and `--scopes` arguments are refused.

## Runtime Admin User Management

Only master admins can access `/admin/admin-ops`.

Operational admin creation now:

- verifies the target Codex Christi user ID before writing the ledger row;
- shows a small public profile preview in the UI;
- does not depend on mutable email as identity;
- stores the stable Codex Christi user ID as the admin identity.

Master-admin transfer now:

- requires the current master admin unlock password;
- shares Unlock's database-backed failed-password window: five failures in
  15 minutes block further checks until the existing lockout expires;
- shares a two-slot process-local password-work budget with Unlock, password
  change and provisioning hashes; busy work is refused, not queued;
- verifies the target Codex Christi user ID before sending OTP;
- applies an 8-second profile deadline, rejects redirects and caps JSON at 512 KiB;
- sends OTP to the email entered for the transfer;
- allows one new challenge per minute and at most three in 15 minutes per source
  admin, including consumed/email-failed challenges; checks again under the
  source-row transaction lock before creating a challenge;
- logs out the old master after completion.

These limits do not establish that the entered email belongs to the target
account. Signed-in recipient acceptance remains follow-up work. Password slots
are local to each Node process, not a cross-container limit. Other sensitive
admin password checks have not all been moved to this helper.

## Stale Variables And Scripts

Do not use an env-stored admin unlock password hash for the Prisma-backed flow.
Do not use the removed `admin:auth:create-unlock-password-hash` script.

The active password paths are:

- `yarn admin:user:create-master create|reset-password` for explicit emergency operations.
- `/admin/security` for a signed-in admin's routine unlock-password change.
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
