#!/usr/bin/env bash
set -euo pipefail

# Compatibility entrypoint: production deployment now verifies existing databases.
# Client generation belongs to the image build; schema changes are a separate job.
script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node --import tsx "$script_directory/check-production-datastores.mjs"
