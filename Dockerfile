# syntax=docker/dockerfile:1.4

########################
# 1) Base image
########################
FROM node:lts-bookworm-slim AS base
WORKDIR /app

# Prisma wants OpenSSL present
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Use corepack so Yarn is available
RUN corepack enable

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
  yarn_major="$(yarn --version | cut -d. -f1)" \
  && if [ "$yarn_major" -ge 2 ]; then \
    yarn install --immutable --inline-builds; \
  else \
    yarn install --frozen-lockfile --check-files; \
  fi

########################
# 3) Builder layer
########################
FROM deps AS builder
WORKDIR /app

# Copy the full project for build
COPY . .

# More heap for Next build (3 GB) to prevent OOM on small VPS
ENV NODE_OPTIONS="--max-old-space-size=1792"
ENV NEXT_TELEMETRY_DISABLED=1

RUN --mount=type=secret,id=production_env,target=/run/secrets/production_env \
  public_env=/tmp/next-public-build.env \
  && grep -E '^NEXT_PUBLIC_[A-Za-z0-9_]+=' /run/secrets/production_env > "$public_env" \
  && set -a \
  && source "$public_env" \
  && set +a \
  && case "${NEXT_PUBLIC_PAYPAL_PAYMENT_MODE:-}" in \
    sandbox) test -n "${NEXT_PUBLIC_PAYPAL_SANDBOX_CLIENT_ID:-}" ;; \
    live) test -n "${NEXT_PUBLIC_PAYPAL_LIVE_CLIENT_ID:-}" ;; \
    *) echo "NEXT_PUBLIC_PAYPAL_PAYMENT_MODE must be sandbox or live" >&2; exit 1 ;; \
  esac

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

RUN --mount=type=cache,target=/root/.cache/yarn \
  set -a \
  && source /tmp/next-public-build.env \
  && set +a \
  && yarn build

########################
# 4) Runtime (small)
########################
FROM node:lts-bookworm-slim AS runtime
WORKDIR /app

# Prisma query engine needs OpenSSL at runtime
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone output already includes the minimal node_modules it needs.
# Copy only what the running server needs.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Next config may still be read at runtime (images/rewrites)
COPY --from=builder /app/next.config.* ./

# Runtime-read datasets / resources (if your app imports these at runtime)
COPY --from=builder /app/src/datasets /app/src/datasets

# Next may write prerender/image/cache files at runtime.
# The app runs as `node`, so prepare writable cache folders before dropping privileges.
RUN mkdir -p /app/.next/cache \
  && chown -R node:node /app/.next

EXPOSE 3000

# Use the built-in non-root user provided by the official node image
USER node

CMD ["node", "server.js"]

########################
# 5) Migrations runner (keeps Prisma CLI out of runtime image)
########################
FROM deps AS migrate
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Only what production database setup needs.
COPY prisma /app/prisma
COPY prisma.config.* /app/
COPY scripts/prisma_production_setup.sh /app/scripts/prisma_production_setup.sh

RUN chmod +x /app/scripts/prisma_production_setup.sh

CMD ["bash", "/app/scripts/prisma_production_setup.sh"]
