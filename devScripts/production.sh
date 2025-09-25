#!/usr/bin/env bash

set -eo pipefail

# Build and run the latest version of the app
# docker compose --file docker-compose.production.yml up --build --detach nginx > serverlogs.txt
docker compose up --build --detach --force-recreate

# Remove the unused containers
docker system prune --force