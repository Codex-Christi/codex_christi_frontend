# syntax=docker/dockerfile:1.4

FROM node:lts-bookworm-slim AS base
WORKDIR /app
RUN corepack enable \
  && apt-get update -y \
  && apt-get install -y openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
RUN --mount=type=cache,target=/root/.cache/yarn \
    yarn install --immutable --inline-builds

FROM deps AS builder
WORKDIR /app
# ⬇️ Make sure the env file is available to `next build`
COPY .env.production ./
COPY . .

# NOTE:
# We no longer run the Prisma setup script in the Docker build stage.
# The SQLite DB lives in a Docker volume at runtime and is initialized/updated
# by your app (e.g. via the admin refresh route), not during image build.

# Generate Prisma client for the Merchize catalog schema so the
# TypeScript imports like "./generated/merchizeCatalog/client" work
# inside the built image. This does NOT touch the database.
RUN cp .env.production .env \
  && yarn prisma generate --schema prisma/shop/merchize/priceCatalog.prisma \
  && rm .env

# More heap for Next build (3 GB) to prevent OOM on small VPS
ENV NODE_OPTIONS="--max-old-space-size=3072"
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/root/.cache/yarn \
    yarn build

FROM node:lts-bookworm-slim AS production
WORKDIR /app

RUN groupadd --gid 1001 nodejs \
 && useradd --uid 1001 --create-home --shell /bin/bash --gid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# copy only what runtime needs (Next.js standalone output)
# Standalone bundle already includes the minimal node_modules tree.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Runtime-read datasets / resources
# The SQLite DB lives in a Docker volume mounted at /app/data in docker-compose.
# We do NOT copy any DB file from build stages to avoid accidental resets.
COPY --from=builder --chown=nextjs:nodejs /app/src/datasets ./src/datasets

EXPOSE 3000
USER nextjs:nodejs
CMD ["node", "server.js"]