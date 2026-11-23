# Codex Christi Leaseweb release

This candidate prepares a normal Git-based release of the application verified
on the VPS. It does not move public traffic or enable a deployment gate.

## Repository boundaries

| Repository | VPS directory | Responsibility |
| --- | --- | --- |
| Frontend | `/home/codex-christi/codexchristi` | Next.js image, existing frontend Prisma clients and catalog |
| Nginx | `/home/codex-christi/codex-nginx` | Codex routing, caching, reload checks and its own Actions workflow |
| Shared Caddy | `/opt/jambo-codex-dev-edge` | Shared HTTPS entrance, separate Git history and manual maintenance |
| Backend | `/home/codex-christi/codex_christi_backend` | Backend developer's established Django/PostgreSQL workflow |

Keep the backend's source, Compose file, settings and database standards under
the backend owner's control. This frontend release does not change them.

## Application source

Use one temporary `review/leaseweb` branch for the frontend deployment review.
It starts from deployed revision `e7a7599e93338d1d6b270d1aeee5f68d21e34848`.
Only reviewed deployment and runtime-configuration changes belong in this
candidate. `package.json`, `yarn.lock`, `prisma.config.ts`, and the four existing
Prisma schemas retain that baseline. Current local `main` contains later features,
and the original working tree contains unfinished account-security work.
Neither is silently included in this candidate.

Push the temporary branch for review and CI checks. It cannot deploy. After
the complete intended application is verified, merge the reviewed changes into
`main`; automated staging runs only from `main`, behind the staging gate.
Merging into newer `main` retains its later application changes. Review and test
that complete result, including its required database compatibility and customer
flows, before enabling deployment. The four-schema build guard still requires
explicit review of any additional database-backed feature. Delete the temporary
branch after merging. No permanent release branch is needed, and the original
working trees and indexes are not reset or cleaned to prepare this candidate.

Build from Git on Linux or from a Git archive. The verified source contains
case-sensitive asset names that a normal macOS checkout can collapse. Sparse
local review copies are for reviewing deployment files, not building the app
with a filesystem copy of incomplete source.

## Environment file names

| Component | Established file |
| --- | --- |
| Frontend application | `.env.production`, private on the VPS |
| Frontend release identifiers and recovery copies | `.deploy/` records created by the release script |
| Nginx | `.env` |
| Shared Caddy | `.env` for local settings, `versions.env` for its tracked image pin |
| Backend | Its existing `.env`, unchanged |

The temporary `.env.preview` and `compose.preview.json` copies from the private
installation are compatibility material. Keep them until repository/profile
adoption has verified the replacement commands; they are not a new application
environment naming convention. Preserve the guarded Caddy configuration until
the public-profile transition is explicitly performed.

The frontend builds without production application environment values. The
existing `.env.production` on the VPS supplies them when Compose starts the
container. No `config/public-build.env`, GitHub application-environment variable,
or BuildKit production environment secret is needed.

Next.js reads server configuration at runtime. The same-origin
`/next-api/runtime-config` endpoint returns an explicitly checked set of browser
values (site origins, payment mode and selected public client ID, browser cart
obfuscation key, and optional analytics identifiers). Server credentials and
the internal Django URL are not included. The existing `NEXT_PUBLIC_` variable
names in `.env.production` remain supported for migration; they are read at
runtime rather than compiled into the JavaScript bundle. Keep the same cart
obfuscation key to preserve existing browser records. Do not regard that key,
the PayPal client ID, or analytics identifiers as private once sent to a browser.

The runtime-settings check validates the required configuration, including
PayPal mode and client ID agreement, offline before app replacement. Changes
to runtime settings take effect when the container is recreated and visitors
reload the page, without rebuilding the image. The approved canonical public
site URLs used in static SEO metadata remain deployment-independent.

## Build, verify and release

The Dockerfile specifies the fixed major and Debian distribution policy
`node:26-bookworm-slim`. CI resolves its current official Linux/amd64 manifest
to a digest once per run, verifies Node and Linux compatibility, uses the
resolved version for source checks, and reuses the same digest for both image
builds. The staging proof records the resolved identity. Updating within the
approved major does not require a GitHub settings change. Changing the Node
major or Debian distribution requires a deliberate repository change and
qualification.
All four Prisma clients are generated before compilation:

- SQLite Merchize catalog.
- Neon Admin Ops.
- Neon PayPal transaction ledger.
- Neon Merchize Fulfillment Ops.

Generation uses harmless local placeholder URLs and produces client code. CI
and the Docker build do not connect to the existing Neon databases or run
migrations. Schema files and existing migration records remain as they are.

The workflow runs source checks and focused deployment/settings safeguards,
then builds one runtime image and matching datastore-check image for the
commit. It checks those exact images with synthetic runtime settings and no
external payment or database access. Only when the main-branch staging gate is
enabled does it package and transfer those same tested images into the bounded
inbox and verify the receipt. Staging is not deployment. Administrator approval
and a separately reviewed protected release path are required before activation.

The VPS script serializes frontend/proxy operations, refuses a dirty or wrong
checkout, checks runtime settings without network access, and verifies
the catalog and existing Neon schemas read-only before replacing the app.
It waits for revision readiness, reloads Nginx to refresh the new upstream IP,
and checks the HTTPS routes. A failed replacement attempts recovery using the
retained image, Compose file and runtime environment; a failed recovery is
reported as failure. Recovery does not restore or rewrite application data.
The new settings-check capability has version 2. Version 1 remains supported
for recorded rollback targets using their embedded compiled settings; do not
reuse the historical private-rehearsal receipts as proof of a new candidate.

The catalog volume remains `codex-christi-next-data`; its SQLite file belongs
to Next.js. It is separate from the Django PostgreSQL volume. Preserve the
existing named image/proxy caches. Deployment never uses global pruning,
`down -v`, orphan removal, `prisma migrate` or `prisma db push`.

## Adopt and rehearse before enabling automation

1. Review the frontend and Nginx temporary `review/leaseweb` branches and publish
   them to their intended repositories for checks. Merge into `main` only after
   verifying the complete intended result. Review the shared edge's initial
   `main` separately; it keeps manual maintenance and needs no temporary branch.
   The frontend review branch does not deploy.
2. Adopt exact Git checkouts at the established VPS paths, preserving private
   environments, certificates, release records and recovery files. Frontend,
   Nginx and edge deployment directories currently contain selected installation
   files rather than complete Git checkouts. Check directory mounts carefully
   before replacing any directory; preserve the active guarded Caddy path.
3. Rehearse an ordinary frontend release and recovery privately. A green source
   test alone does not establish the complete image/SSH/VPS procedure.
4. Configure the separate restricted staging authentication and verify its
   fixed command and inbox. Neither staging identity receives Docker, Git,
   sudo or general shell access.
5. Leave `LEASEWEB_FRONTEND_STAGE_ENABLED` and `LEASEWEB_NGINX_STAGE_ENABLED`
   disabled until the intended `main` revisions and staging workflow checks pass.
   Keep the old deployment switches disabled during the transition.

The current private Caddy entrance publishes only `127.0.0.1:8443`. Before
rehearsing this new image through the browser, review a separate Caddy change
to allow only GET and HEAD for the exact `/next-api/runtime-config` path. Keep
the existing private preview guard and every other restricted route unchanged.
Preview restrictions block account, checkout, payment and job routes; successful
GET checks do not prove those business flows. Current settings preserve sandbox
PayPal mode. Confirm the desired payment mode, credentials and webhook ownership
before accepting real customer payments.

## Public move and recovery

Coordinate final Django data/settings and external mail/storage/supplier checks
with the backend owner. Refresh the frontend catalog consistently if the old
origin has changed. Coordinate one active owner for shared Neon recovery jobs,
webhook capture and fulfillment during transition.

Before moving traffic, replace origin keys retained in historical Nginx Git
history. Removing current tracked key files does not remove historical keys.
Provision new private keys only in ignored VPS certificate directories and
coordinate both HTTPS hops. No key material belongs in a review patch or bundle.

Record Cloudflare DNS and recovery targets, verify current official Cloudflare
address ranges and Full (strict) TLS, and validate the separate public Caddy
Compose file/profile. Keep Next.js, Nginx, Django and PostgreSQL private. After
switching the intended origin, verify both domains through Cloudflare and their
required customer flows before enabling ordinary frontend/Nginx deployment.

Retain Hetzner and checkpoints through the agreed recovery window. DNS recovery
changes routing; it does not reconcile database writes accepted at different
origins. Define data recovery before accepting writes on the new origin.
