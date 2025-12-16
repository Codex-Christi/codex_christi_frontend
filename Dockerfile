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

########################
# 2) Dependencies layer
########################
FROM base AS deps
WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json yarn.lock .yarnrc.yml ./
# If you use Yarn Berry (recommended), keep the .yarn directory
COPY .yarn ./.yarn

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

# Next.js standalone output already includes the minimal node_modules it needs.
# Copy only what the running server needs.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Next config may still be read at runtime (images/rewrites)
COPY --from=builder /app/next.config.* ./

# Runtime-read datasets / resources (if your app imports these at runtime)
COPY --from=builder /app/src/datasets /app/src/datasets

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

# Only what Prisma migrate needs
COPY prisma /app/prisma
COPY prisma.config.* /app/

# Default command is optional; compose can override
CMD ["sh", "-c", "yarn prisma migrate deploy --schema prisma/shop/merchize/priceCatalog.prisma"]