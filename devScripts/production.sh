#!/usr/bin/env bash

set -exo pipefail

# Build and run the latest version of the app
docker compose -f docker-compose.production.yml down
docker system prune --force
docker compose --file docker-compose.production.yml up --build --detach nginx > serverlogs.txt

# Remove the unused containers
docker system prune --force