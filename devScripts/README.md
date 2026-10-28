# Deployment and Readiness

## Before Deployment

Pull requests and pushes to `main` run lint, TypeScript, and the existing
storefront, authentication and checkout regression suites. Deployment starts
only after those pass.
The production Docker build uses Turbopack.

The deployment job waits for the VPS script instead of starting it in the
background. It fast-forwards to the exact verified commit and refuses to deploy
from a different revision or over tracked local edits. Production deployments
are serialized. The VPS needs Docker Compose v2 with `up --wait` support.

The VPS script builds the images, waits for database setup to succeed,
and waits up to 120 seconds for the new app container to become healthy. The
running image must identify itself with the expected Git revision. A failed
migration, readiness check, or revision check fails the job before Docker pruning.
An unhealthy deployment does **not** automatically roll back the container;
inspect its logs and restore the previous release manually when needed.

### Database Setup

The existing `migrate` container reads `.env.production`. Before touching any
database, `scripts/prisma_production_setup.sh` requires `NODE_ENV=production`
and a valid Admin Ops PostgreSQL URL. It uses `NEON_ADMIN_OPS_LEDGER_URL` first,
falling back to `NEON_ADMIN_OPS_LEDGER_POOLED_URL` only if the first variable is
unset. An empty or invalid direct URL fails instead of silently using another
database. The selected URL is pinned before Prisma loads dotenv files and is
not printed by the preflight check.

The user confirmed both URL variables exist on the VPS. Before deployment,
confirm both point to the **same intended production database**: migrations use
the direct URL, while the running app prefers the pooled URL. The preflight
checks syntax, not database ownership, branch or connectivity.

Setup generates the Admin Ops client and runs its existing `prisma migrate deploy`
first, then runs the unchanged catalog setup/permissions and PayPal steps.
Any failure stops the script and prevents the app restart. No new migration,
automatic baseline or Admin Ops `db push` is added. If an existing database lacks
Prisma migration history (for example, P3005), stop, back it up and reconcile its
schema/history before retrying. Do not reset production or mark every migration
applied without checking what the database contains.

## Readiness

`/next-api/health/ready` (also `/api/health/ready` inside Next) returns `200` only
when the app can query its required local catalog tables and its authentication
configuration is valid. The Next container must have separate random
`SESSION_SECRET` and `ADMIN_SESSION_SECRET` values of at least 32 UTF-8 bytes
each, an HTTP(S) Django API base URL without credentials, query
or fragment, and a valid `DJANGO_AUTH_REFRESH_PATH` if overriding the default
`/auth/token/refresh`. Internal Docker HTTP URLs are allowed. The selected URL
uses the same internal/public preference as real Django requests.

Otherwise it returns `503` with a generic body. The handler logs only the failed
check, not secrets, URLs or database details. Responses are not cached. These
checks run at request time, so the image build does not need a session secret.

`ADMIN_SESSION_SECRET` is a server signing key, not an admin's unlock password.
Changing that key requires fresh admin unlocks but does not invalidate ordinary
site login. An admin can change their own unlock password at `/admin/security`;
that invalidates previous unlocks for that admin while preserving ordinary login.
The deployment migration step must finish before using that form; runtime
readiness deliberately does not query the remote Admin Ops database.

The container probes this endpoint every 30 seconds. This is a local readiness
probe, not a catalog refresh: it makes no Django, Merchize, PayPal or remote
database requests, scans no products, and writes no data. It adds no
cron or `after()` job. A passing probe does not confirm that Django is reachable
or accepts the configured refresh endpoint; verify that with a disposable
account after deployment. See the [authentication guide](../Future%20Implementation%20Guides/nextjs-auth-shop-integration-hardening-plan.md#deployment-checklist).

## Run Checks Locally

```sh
yarn merchize-offline-catalog:generate
yarn lint
yarn next typegen
yarn tsc --noEmit --incremental false --pretty false
yarn test:storefront
yarn test:auth
yarn test:checkout
yarn build
```
