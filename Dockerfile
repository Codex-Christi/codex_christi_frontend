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
COPY . .
# More heap for Next build (3 GB) to prevent OOM on small VPS
ENV NODE_OPTIONS="--max-old-space-size=3072"
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/root/.cache/yarn \
    yarn build

FROM node:lts-bookworm-slim AS production
WORKDIR /app

RUN groupadd --gid 1001 nodejs \
 && useradd --uid 1001 --create-home --shell /bin/bash --gid 1001 nextjs

# copy only what runtime needs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next /app/.next
COPY --from=builder --chown=nextjs:nodejs /app/public /app/public
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/yarn.lock ./

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

EXPOSE 3000
USER nextjs:nodejs
CMD ["yarn", "start"]