#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ setup_merchize_catalog.sh is deprecated; use setup_merchize_offline_catalog.sh."
exec "$SCRIPT_DIR/setup_merchize_offline_catalog.sh" "$@"
