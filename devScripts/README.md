# Deployment and Readiness

## Before Deployment

Pull requests and pushes to `main` run lint, TypeScript, and the existing
storefront regression suite. Deployment starts only after those pass.
The production Docker build uses Turbopack.

The deployment job waits for the VPS script instead of starting it in the
background. It fast-forwards to the exact verified commit and refuses to deploy
from a different revision or over tracked local edits. Production deployments
are serialized. The VPS needs Docker Compose v2 with `up --wait` support.

The VPS script builds the images, waits for the catalog migration to succeed,
and waits up to 120 seconds for the new app container to become healthy. The
running image must identify itself with the expected Git revision. A failed
migration, readiness check, or revision check fails the job before Docker pruning.
An unhealthy deployment does **not** automatically roll back the container;
inspect its logs and restore the previous release manually when needed.

## Readiness

`/next-api/health/ready` (also `/api/health/ready` inside Next) returns `200` only
when the app can query its required local catalog tables. Otherwise it returns
`503`, without exposing database details. Responses are not cached.

The container probes this endpoint every 30 seconds. This is a local readiness
probe, not a catalog refresh: it makes no Merchize, PayPal, or remote database
requests, scans no products, and writes no data. It adds no cron or `after()` job.

## Run Checks Locally

```sh
yarn merchize-offline-catalog:generate
yarn lint
yarn next typegen
yarn tsc --noEmit --incremental false --pretty false
yarn test:storefront
yarn build
```
