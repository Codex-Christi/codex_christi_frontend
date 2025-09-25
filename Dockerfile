# Stage 1: Dependency installation
# Use a slimmed-down base image for dependencies
FROM node:lts-bookworm-slim AS deps

# Enable Corepack for Yarn
RUN corepack enable

# Set the working directory
WORKDIR /app

# Copy only the necessary package files to leverage Docker's layer caching
COPY package.json yarn.lock .yarnrc.yml ./

# Run the installation, leveraging caching and combining commands for a single layer
RUN yarn install --immutable --inline-builds --cache-folder=/tmp/yarn-cache && \
    rm -rf /tmp/yarn-cache

# Stage 2: Build the application
# Use the same base image
FROM node:lts-bookworm-slim AS builder

# Enable Corepack for Yarn
RUN corepack enable

# Set the working directory
WORKDIR /app

# Copy package files from the deps stage
COPY --from=deps /app/package.json /app/yarn.lock /app/.yarnrc.yml ./

# Copy installed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules/

# Copy the rest of the application files
COPY . .

# Run the Next.js build
# Ensure your next.config.js has `output: 'standalone'`
RUN yarn build

# Stage 3: Production runtime
# Use a minimal base image, since standalone mode includes a minimal Node.js server
FROM node:lts-bookworm-slim AS runner

# Create a group and non-root user
RUN groupadd --gid 1001 "nodejs"
RUN useradd --uid 1001 --create-home --shell /bin/bash --groups "nodejs" "nextjs"

# Set the working directory to the standalone output folder
WORKDIR /app

# Copy necessary files from the builder stage
# This includes the standalone server and static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Set environment variables for production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

EXPOSE 3000

# Change to the non-root user
USER nextjs:nodejs

# Start the application using the standalone server
CMD ["node", "server.js"]
