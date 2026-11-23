# syntax=docker/dockerfile:1.4

# Keep the Node major and Debian distribution stable. CI resolves this policy
# to one immutable linux/amd64 digest for every build in the release.
ARG NODE_IMAGE=node:26-bookworm-slim

########################
# 1) Base image
########################
FROM ${NODE_IMAGE} AS base
ARG NODE_IMAGE
WORKDIR /app

# Prisma wants OpenSSL present
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Match the package manager used by CI instead of following a moving Corepack default.
RUN npm install --global yarn@1.22.22 --force

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

########################
# 2) Dependencies layer
########################
FROM base AS deps
WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json yarn.lock .yarnrc.yml ./

# Cache Yarn downloads
RUN --mount=type=cache,target=/root/.cache/yarn \
  yarn install --frozen-lockfile --non-interactive

########################
# 3) Generate the four production clients, without connecting to any database
########################
FROM deps AS generated
WORKDIR /app

COPY . .

# New database-backed features must be explicitly reconciled with the release build.
# This guard leaves the working checkout alone and prevents partial client releases.
RUN test "$(find prisma -name '*.prisma' -type f | wc -l | tr -d ' ')" = 4 \
  || { echo 'Unexpected Prisma schema: review client generation and read-only checks before release' >&2; exit 1; }

# Generate every Prisma client needed by the standalone app. Prisma 7 config
# asks for datasource URLs even for generate, so non-secret placeholder URLs are
# used for generated Postgres clients instead of leaking real DB credentials into
# build layers.
RUN yarn prisma generate --schema prisma/shop/merchize/priceCatalog.prisma \
  && NEON_ADMIN_OPS_LEDGER_URL=postgresql://user:password@localhost:5432/admin_ops_ledger \
    yarn prisma generate --schema prisma/adminOpsLedger/adminOpsLedger.schema.prisma \
  && PAYPAL_TX_LEDGER_NEON_BRANCH=prod \
    PAYPAL_TX_LEDGER_NEON_DB_STRING=postgresql://user:password@localhost:5432/paypal_tx_ledger \
    yarn prisma generate --schema prisma/shop/paypal/paypalTXLedger.schema.prisma \
  && MERCHIZE_FULFILLMENT_OPS_NEON_BRANCH=prod \
    MERCHIZE_FULFILLMENT_OPS_NEON_DB_STRING=postgresql://user:password@localhost:5432/merchize_fulfillment_ops \
    yarn prisma generate --schema prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOps.schema.prisma

########################
# 4) Next.js compilation, after all clients exist
########################
FROM generated AS builder
ARG APP_REVISION=unknown
ENV APP_REVISION=${APP_REVISION}
ENV DEPLOYMENT_VERSION=${APP_REVISION}
ENV NODE_OPTIONS="--max-old-space-size=1792"
ENV NEXT_TELEMETRY_DISABLED=1

# Application environment is supplied only when this image runs. Do not mount
# environment files, or inject application configuration during compilation.
RUN yarn build

########################
# 5) Runtime (small)
########################
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ARG APP_REVISION=unknown
ARG NODE_IMAGE
LABEL org.opencontainers.image.revision=${APP_REVISION}
LABEL org.codex-christi.release-settings=2
LABEL org.codex-christi.node.base=${NODE_IMAGE}

# Retain OpenSSL and trusted CA certificates for runtime TLS connections.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV APP_REVISION=${APP_REVISION}

# Next.js standalone output already includes the minimal node_modules it needs.
# Copy only what the running server needs.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY scripts/check-deployment-health.mjs ./scripts/check-deployment-health.mjs
COPY scripts/check-release-settings.mjs ./scripts/check-release-settings.mjs
COPY scripts/runtime-config.mjs ./scripts/runtime-config.mjs

# Next config may still be read at runtime (images/rewrites)
COPY --from=builder /app/next.config.* ./

# Runtime-read datasets / resources (if your app imports these at runtime)
COPY --from=builder /app/src/datasets /app/src/datasets

# Next may write prerender/image/cache files at runtime.
# The app runs as `node`, so prepare writable cache folders before dropping privileges.
RUN mkdir -p /app/.next/cache/images \
  && chown -R node:node /app/.next

EXPOSE 3000

# Use the built-in non-root user provided by the official node image
USER node

CMD ["node", "server.js"]

########################
# 6) Explicit read-only preflight runner (keeps tooling out of runtime image)
########################
FROM deps AS datastore-check
WORKDIR /app
ARG APP_REVISION=unknown
ARG NODE_IMAGE
LABEL org.opencontainers.image.revision=${APP_REVISION}
LABEL org.codex-christi.node.base=${NODE_IMAGE}
ENV APP_REVISION=${APP_REVISION}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Keep public assets, application routes and migration/operator tooling out of
# the checker artifact. Only generated clients and pure connection selectors run.
COPY --from=generated /app/scripts/check-production-datastores.mjs ./scripts/check-production-datastores.mjs
COPY --from=generated /app/src/lib/prisma/postgresSslMode.ts ./src/lib/prisma/postgresSslMode.ts
COPY --from=generated /app/src/lib/prisma/shop/shopOpsDataTarget.ts ./src/lib/prisma/shop/shopOpsDataTarget.ts
COPY --from=generated /app/src/lib/prisma/shop/merchize/generated ./src/lib/prisma/shop/merchize/generated
COPY --from=generated /app/src/lib/prisma/adminOpsLedger/generated ./src/lib/prisma/adminOpsLedger/generated
COPY --from=generated /app/src/lib/prisma/shop/paypal/txLedger/generated ./src/lib/prisma/shop/paypal/txLedger/generated
COPY --from=generated /app/src/lib/prisma/shop/merchizeFulfillmentOps/generated ./src/lib/prisma/shop/merchizeFulfillmentOps/generated
USER node
CMD ["node", "--import", "tsx", "scripts/check-production-datastores.mjs"]
