# syntax=docker/dockerfile:1.4

########################
# 1) Base image
########################
FROM node:lts-bookworm-slim AS base
WORKDIR /app

# Prisma wants OpenSSL present
RUN apt-get update -y \
  && apt-get install -y openssl \
  && rm -rf /var/lib/apt/lists/*

# Use corepack so Yarn is available
RUN corepack enable

########################
# 2) Dependencies layer
########################
FROM base AS deps
WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./

# Cache Yarn downloads
RUN --mount=type=cache,target=/root/.cache/yarn \
  yarn install --immutable --inline-builds

########################
# 3) Builder layer
########################
FROM deps AS builder
WORKDIR /app

# Copy the full project for build
COPY . .

# More heap for Next build (3 GB) to prevent OOM on small VPS
ENV NODE_OPTIONS="--max-old-space-size=3072"
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client for Merchize catalog schema so imports like
# ./src/lib/prisma/shop/merchize/generated/merchizeCatalog/client
# exist when `yarn build` runs.
RUN yarn prisma generate --schema prisma/shop/merchize/priceCatalog.prisma

RUN --mount=type=cache,target=/root/.cache/yarn \
  yarn build

########################
# 4) Production runtime
########################
FROM node:lts-bookworm-slim AS production
WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --create-home --shell /bin/bash --gid 1001 nextjs

# 4a) Runtime deps + app build
COPY --from=deps --chown=nextjs:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next /app/.next
COPY --from=builder --chown=nextjs:nodejs /app/public /app/public

# Package + lockfile so scripts like "yarn prisma" work
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/yarn.lock ./

# Next config needed at runtime for images etc.
COPY --from=builder /app/next.config.* ./

# Runtime-read datasets / resources
COPY --from=builder --chown=nextjs:nodejs /app/src/datasets /app/src/datasets

# ⬇️ CRITICAL: copy Prisma schema + migrations so migrate deploy can run in production
COPY --from=builder --chown=nextjs:nodejs /app/prisma /app/prisma

# Copy Prisma config so Prisma 7 sees datasource URL in production
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.* ./

# We DO NOT copy any SQLite .db files here.
# The DB file lives in a Docker volume mounted at /app/data in docker-compose.

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

EXPOSE 3000
USER nextjs:nodejs

# On container start:
#   1. Run `prisma migrate deploy` for the Merchize catalog schema (idempotent, prod-safe)
#   2. Start Next.js (via `node server.js` from standalone output)
# CMD ["sh", "-c", "yarn prisma migrate deploy --schema prisma/shop/merchize/priceCatalog.prisma && node server.js"]