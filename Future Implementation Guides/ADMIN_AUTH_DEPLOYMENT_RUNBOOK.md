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
generates the Admin Ops client and applies reviewed migrations before app
restart. Confirm direct and pooled URLs address the same production database.
Do not run an unqualified migration command that could load `.env.local` instead.
See [database setup](../devScripts/README.md#database-setup).

The user reports the previous Next release and Nginx are deployed; production
authentication checks remain pending. The recovery/transfer changes described
here still require their own release. Do not treat local tests as acceptance of
either release.

This release adds `20261028010000_recipient_owned_admin_transfer` to the existing
Admin Ops table. Review a backup and migration history first. The migration
adds source/recipient version snapshots, makes the old sender-password column
nullable, consumes old pending invitations and refuses new active legacy
invitations at database level. An older runtime therefore cannot start its
unsafe transfer flow between migration and restart. Generate the client and
deploy the new runtime with this migration; do not run it manually against a
production URL merely to test it. No Django, Nginx or new service is needed.

Old pending links need a new invitation. If rolling the app back, leave transfers
unavailable rather than drop the guards or restore consumed codes. The nullable
legacy password column remains only for history; new invitations never store a
sender-chosen recipient password.

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

Operational admin creation and edits:

- verify the target Codex Christi user ID before writing the ledger row;
- show a small public profile preview in the UI;
- do not depend on mutable email as identity;
- store the stable Codex Christi user ID as the admin identity;
- hash outside a short transaction, then lock account rows in a stable order and
  recheck the acting master's current role, active status and session version;
- refuse ordinary provisioning edits to any existing master, not just self;
- save the account/version change, affected invitation cancellation and required
  success audit together. An audit failure rolls everything back. A conflicting
  account creation fails rather than overwriting an account created meanwhile.

## Transfer Ownership

1. While signed in and unlocked as the current master, open the ownership form
   at `/admin/admin-ops`. Supply the current unlock password, recipient's exact
   Django user UUID and invitation email. Preview the UUID before sending.
2. The recipient receives a link and six-digit code, valid for ten minutes.
   Their delivery email need not equal their Django email; it is not proof of
   account identity. The sender cannot choose their password or finish for them.
3. The recipient opens `/admin/transfer/accept?invitation=...` and signs in as that
   exact Django account. No prior admin record/unlock is needed for this page;
   every other admin page keeps its gate. Sign Out And Switch Account preserves
   the invitation while using normal Logout. The link has no OTP or login token.
4. The recipient enters the code, chooses and confirms their own 12-128-character
   unlock password, and explicitly accepts. Source revocation, recipient grant,
   invitation consumption/cancellation and required audit share one transaction.
   They then unlock admin with the new password. A failed audit or stale account
   snapshot cannot partly transfer ownership.
5. The sender remains active until acceptance and can cancel the pending
   invitation. After acceptance their old admin version is rejected on the next
   live check, but ordinary website login stays active for both users. Already
   open tabs are not instantly erased. A changed source/recipient admin version,
   role or status requires a fresh invitation; disabled/master targets are refused.

Transfer safeguards:

- Current-password proof shares Unlock's failed-password window: five failures in
  15 minutes block further checks until the existing lockout expires;
- Password proof/hashing shares a two-slot process-local budget with Unlock, password
  change and provisioning hashes; busy work is refused, not queued;
- Target profile verification has an 8-second deadline, refuses redirects and caps
  JSON at 512 KiB. It runs outside the write transaction.
- At most one new invitation per minute and three in 15 minutes per source
  admin, including consumed/email-failed challenges; checks again under the
  source-row transaction lock before creating a challenge.
- Five incorrect codes consume the invitation. Code guesses, cancellation and
  acceptance serialize on locked account rows before changing the challenge.
- Only same-origin, bounded POST requests accept ownership. The recipient user ID
  comes from the verified primary session, never submitted form data. Successful
  acceptance clears only admin cookies; main access/refresh cookies stay intact.
- A delivery failure invalidates the invitation; uncertain sending/acceptance does
  not auto-retry. Check the account/audit and new unlock password before retrying.

Local checks used disposable PostgreSQL records, stubbed mail/profile responses
and synthetic cookies. They do not verify production delivery or HTTPS behavior.
Follow the [deployment checklist](./nextjs-auth-shop-integration-hardening-plan.md#deployment-checklist)
with disposable accounts before accepting this release. Password slots are local
to each Node process, not a cross-container limit. Other sensitive admin password
checks have not all been moved to this helper.

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
