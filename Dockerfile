# syntax=docker/dockerfile:1.4

FROM node:lts-bookworm-slim AS base
WORKDIR /app
RUN corepack enable

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
# Use .env.production as .env so Prisma config and setup script see the DB URL
RUN cp .env.production .env

# Run Merchize catalog Prisma setup (generate + migrate/db push) without re-installing deps or building
RUN chmod +x ./scripts/setup_merchize_catalog.sh && \
    ./scripts/setup_merchize_catalog.sh --no-deps --no-build

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
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/src/datasets ./src/datasets

EXPOSE 3000
USER nextjs:nodejs
CMD ["node", "server.js"]