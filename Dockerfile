# syntax=docker/dockerfile:1.4

# Keep the Node major and Debian distribution stable. CI resolves this policy
# to one immutable linux/amd64 digest for every build in the release.
ARG NODE_IMAGE=node:26-bookworm-slim

########################
# 1) Shared runtime OS; one TLS/OpenSSL layer for both release targets
########################
FROM ${NODE_IMAGE} AS os-base
ARG NODE_IMAGE
WORKDIR /app

# Build-time Prisma generation and runtime TLS need the same native libraries.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Only dependency-installing stages need the pinned package manager.
FROM os-base AS base

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

# Both dependency installs share the download cache; lock concurrent writers.
RUN --mount=type=cache,target=/root/.cache/yarn,sharing=locked \
  yarn install --cache-folder /root/.cache/yarn --frozen-lockfile --non-interactive

# The isolated datastore checker needs only its own runtime dependencies.
# Use the same Yarn lock and root manifest selectors (including the TS loader)
# to retain the exact versions used by the application's generated clients.
FROM base AS checker-deps
COPY scripts/datastore-check.package.json ./package.json
COPY yarn.lock .yarnrc.yml ./
RUN --mount=type=cache,target=/root/.cache/yarn,sharing=locked \
  yarn install --cache-folder /root/.cache/yarn --frozen-lockfile --non-interactive --production=true

########################
# 3) Generate the four production clients, without connecting to any database
########################
FROM deps AS generated
WORKDIR /app

# Keep generation cached when UI/app source changes. tsconfig.json preserves
# Prisma's module-format inference; .dockerignore excludes local generated clients.
COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma

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
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=1792"
ENV NEXT_TELEMETRY_DISABLED=1

# Application environment is supplied only when this image runs. Do not mount
# environment files, or inject application configuration during compilation.
# The final runtime and checker stages attach the revision, so changing a
# release ID alone does not invalidate a source-identical Next.js build.
RUN yarn build

########################
# 5) Runtime (small)
########################
FROM os-base AS runtime
WORKDIR /app
ARG APP_REVISION=unknown
ARG NODE_IMAGE
LABEL org.opencontainers.image.revision=${APP_REVISION}
LABEL org.codex-christi.release-settings=2
LABEL org.codex-christi.node.base=${NODE_IMAGE}

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
FROM checker-deps AS datastore-check
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
COPY scripts/check-production-datastores.mjs ./scripts/check-production-datastores.mjs
COPY src/lib/prisma/postgresSslMode.ts ./src/lib/prisma/postgresSslMode.ts
COPY src/lib/prisma/shop/shopOpsDataTarget.ts ./src/lib/prisma/shop/shopOpsDataTarget.ts
COPY --from=generated /app/src/lib/prisma/shop/merchize/generated ./src/lib/prisma/shop/merchize/generated
COPY --from=generated /app/src/lib/prisma/adminOpsLedger/generated ./src/lib/prisma/adminOpsLedger/generated
COPY --from=generated /app/src/lib/prisma/shop/paypal/txLedger/generated ./src/lib/prisma/shop/paypal/txLedger/generated
COPY --from=generated /app/src/lib/prisma/shop/merchizeFulfillmentOps/generated ./src/lib/prisma/shop/merchizeFulfillmentOps/generated
USER node
CMD ["node", "--import", "tsx", "scripts/check-production-datastores.mjs"]
