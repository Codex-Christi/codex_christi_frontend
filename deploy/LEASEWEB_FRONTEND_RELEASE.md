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

The first frontend release branch is `release/leaseweb`, based on deployed
revision `e7a7599e93338d1d6b270d1aeee5f68d21e34848`. Only reviewed deployment
changes belong in this candidate. `package.json`, `yarn.lock`, `prisma.config.ts`,
application source and the four existing Prisma schemas retain that baseline.
Current `main` contains later features, and the original working tree contains
unfinished account-security work. Neither is silently included in this release.

Publish and protect the reviewed release branch deliberately. The first
frontend deployment must use that branch directly; merging it into newer
`main` would retain those newer application changes. Later feature adoption
requires its own release checks. Original working trees and indexes are not
reset or cleaned to prepare this candidate.

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

Only the approved public build settings enter the frontend build. Server
credentials stay in the VPS application environment. The candidate checks the
compiled public settings against the selected runtime settings before replacing
the app, including the PayPal mode and corresponding client ID. Public values
are compiled into browser JavaScript; changing them requires rebuilding.

## Build, verify and release

CI uses the qualified official Linux/amd64 Node 26.13.1 image pin. A different
Node image requires deliberate qualification rather than a moving LTS tag.
All four Prisma clients are generated before compilation:

- SQLite Merchize catalog.
- Neon Admin Ops.
- Neon PayPal transaction ledger.
- Neon Merchize Fulfillment Ops.

Generation uses harmless local placeholder URLs and produces client code. CI
and the Docker build do not connect to the existing Neon databases or run
migrations. Schema files and existing migration records remain as they are.

The candidate workflow runs source checks and the focused deployment/settings
safeguards before its gated release job. The release job builds a runtime image
and matching datastore-check image once, transfers a checksummed archive and
waits for foreground deployment of the exact destination image IDs.

The VPS script serializes frontend/proxy operations, refuses a dirty or wrong
checkout, checks build/runtime settings without network access, and verifies
the catalog and existing Neon schemas read-only before replacing the app.
It waits for revision readiness, reloads Nginx to refresh the new upstream IP,
and checks the HTTPS routes. A failed replacement attempts recovery using the
retained image, Compose file and runtime environment; a failed recovery is
reported as failure. Recovery does not restore or rewrite application data.

The catalog volume remains `codex-christi-next-data`; its SQLite file belongs
to Next.js. It is separate from the Django PostgreSQL volume. Preserve the
existing named image/proxy caches. Deployment never uses global pruning,
`down -v`, orphan removal, `prisma migrate` or `prisma db push`.

## Adopt and rehearse before enabling automation

1. Review the three candidate Git histories and publish to their intended
   repositories. The shared edge keeps manual maintenance initially.
2. Adopt exact Git checkouts at the established VPS paths, preserving private
   environments, certificates, release records and recovery files. Frontend,
   Nginx and edge deployment directories currently contain selected installation
   files rather than complete Git checkouts. Check directory mounts carefully
   before replacing any directory; preserve the active guarded Caddy path.
3. Rehearse an ordinary frontend release and recovery privately. A green source
   test alone does not establish the complete image/SSH/VPS procedure.
4. Configure permanent deployment authentication and verify its exact Docker/Git
   permissions. The temporary developer password and password-required sudo
   are interactive access, not unattended Actions credentials.
5. Keep `LEASEWEB_FRONTEND_DEPLOY_ENABLED` and `LEASEWEB_NGINX_DEPLOY_ENABLED`
   disabled until the intended installation, access and public checks pass.

The current private Caddy entrance publishes only `127.0.0.1:8443`. Preview
restrictions block account, checkout, payment and job routes; its successful
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
