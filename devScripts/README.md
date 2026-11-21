# Deployment and Readiness

## Before Deployment

Pull requests and pushes to `main` and `release/leaseweb` run lint, TypeScript,
the existing storefront/authentication/checkout suites, release-settings and
recovery tests, and a synthetic-settings Linux container build. Deployment runs
only for pushes to `release/leaseweb` after both verification jobs pass and the
explicit deployment gate is enabled. Current `main` contains later features;
it is not the first Leaseweb release source.
The production Docker build uses Turbopack.

The deployment job waits for the VPS script instead of starting it in the
background. It fast-forwards to the exact verified commit and refuses to deploy
from a different revision or over tracked local edits. Production deployments
are serialized. The VPS needs Docker Compose v2 with `up --wait` support.

The prepared Leaseweb workflow builds a runtime image and matching read-only
datastore checker on CI, transfers a checksummed archive, and deploys exact
destination image IDs. The VPS script first compares the candidate image's
compiled public settings with its Compose-parsed runtime settings in a one-off
container with no network or data mounts. It then checks existing data read-only
before replacing only the frontend, waits for revision readiness, refreshes Nginx, and
checks both HTTPS routes. A failed replacement or proxy check attempts recovery
to the retained image, Compose configuration and runtime environment. No global
Docker pruning occurs.

Deployment remains disabled until `LEASEWEB_FRONTEND_DEPLOY_ENABLED=true` is
explicitly configured after the private rehearsal. See the
[Leaseweb frontend release procedure](../deploy/LEASEWEB_FRONTEND_RELEASE.md)
for initial setup, build inputs, deployment access and recovery checkpoints.

### Existing Databases

All four production Prisma clients are generated before Next.js compilation:
Merchize SQLite catalog, Neon Admin Ops, Neon PayPal ledger, and Neon Merchize
Fulfillment Ops. Generation creates client code without applying migrations.

The profile-only `datastore-check` service reads `.env.production` and checks the
same selected Neon endpoints used by the application in read-only transactions.
It also checks the existing SQLite catalog through a read-only volume mount.
Failure stops app replacement without changing schemas or repairing data.
Neither the ordinary release nor the legacy `prisma_production_setup.sh` entry
point runs migrations, `db push`, catalog synchronization or permission repairs.
Schema changes require their own separately reviewed operation.

## Persistent Optimized Images

The app mounts the `next_image_cache` named volume at `/app/.next/cache/images`.
Only prepared images are persisted, not the `.next` application build or HTML/ISR
cache. The runtime image creates this directory with `node` ownership before the
volume is first mounted. The existing deployment wrapper preserves the Compose
project name, so subsequent releases reuse the same image volume.

Next's image disk cache is capped at 256 MiB and evicts older entries as needed.
The existing image quality, responsive sizes, AVIF/WebP formats and TTL are
unchanged. A new source URL, size, quality or format can still need its first
optimization. This is expected; persistence avoids repeating that work merely
because the app container was replaced. No warm-up job or extra supplier fetch
is added.

Keep the named volume when replacing containers. Do not use `docker compose
down -v` or remove the volume during ordinary deployments. If a pre-existing
image volume is not writable by the runtime `node` user, repair that volume's
ownership before serving traffic; do not run the app as root to work around it.

Image freshness remains separate from product snapshot/HTML refresh. The current
minimum image TTL is one year. The POD provider controls product source URLs;
if it replaces an image at the same URL, the old optimized image can remain.
Review the refresh policy against actual supplier behavior during private
integration instead of requiring manual preparation of supplier files.
If such an overwrite requires a targeted cache purge, coordinate it with any
Nginx/CDN image cache too. Do not clear the catalog database or whole `.next`
directory to refresh an image. Clearing image entries deliberately makes their
next requests cold again.

## Deferred Cloudflare Web Analytics

The root layout loads one analytics beacon after the page-load event, during
browser idle time. It uses the visible hostname, not the route: `.org/shop`
uses the `.org` token, while `.shop` uses its separate token. The corresponding
`www` hostname uses the same token. Localhost, other hosts, development mode and
missing tokens do not load the manual beacon. Country/FX and application providers
do not control analytics loading.

Copy the two settings from [`.env.cloudflare.example`](../.env.cloudflare.example)
into the existing production environment and fill them with each site's Web
Analytics token. These are public site identifiers, not Cloudflare API keys.
`NEXT_PUBLIC_*` values are embedded during `yarn build`; changing a token requires
a rebuild, not only a container restart. The existing Docker build already passes
these public variables through, so no Docker or dependency change is needed.

After deploying, switch each site under Cloudflare Web Analytics > Manage Site
to **Enable with JS Snippet installation**. The loader skips its manual copy if
an automatically injected beacon is still present, preventing duplicate loading
during rollout. Automatic injection must be turned off for deferral to take effect.
Keep existing tracking exclusions aligned with the manually covered pages.

SPA tracking stays enabled and the beacon is not reinserted on client-side
navigation. Manual setup reports to `https://cloudflareinsights.com/cdn-cgi/rum`;
any CSP must allow that destination and the script at
`https://static.cloudflareinsights.com/beacon.min.js`. Cloudflare does not support
safe SRI version-pinning for manual embedding, unlike its automatic injection.
Late loading can miss short visits and navigation before initialization; it does
not remove the beacon's legacy polyfills or guarantee a Lighthouse score increase.

Verify exactly one beacon request per document on both domains, no early beacon
request before page load, and successful analytics after SPA navigation. Do not
send synthetic test tokens to Cloudflare: intercept telemetry in disposable tests.
To roll back the loading policy, re-enable automatic injection; its tag takes
precedence over this loader. See the [Cloudflare setup guide](https://developers.cloudflare.com/web-analytics/get-started/),
[manual embedding caveats](https://developers.cloudflare.com/web-analytics/faq/),
and [Next.js script strategies](https://nextjs.org/docs/app/api-reference/components/script#lazyonload).

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
The existing Admin Ops schema must be compatible before using that form; runtime
readiness deliberately does not query the remote Admin Ops database. The separate
read-only release preflight checks that compatibility without applying migrations.

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
