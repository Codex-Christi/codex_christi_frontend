#!/usr/bin/env bash
# Check the exact built images on a network-isolated runner. These are synthetic
# settings only; no application environment file, credentials or external service is used.
set -euo pipefail
[[ $# == 2 && "$1" =~ ^sha256:[0-9a-f]{64}$ && "$2" =~ ^sha256:[0-9a-f]{64}$ ]] || exit 2
runtime_image="$1"
checker_image="$2"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
fixture_dir="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/codex-runtime-fixture-XXXXXXXX")"
cleanup() {
  rm -f "$fixture_dir/sandbox.env" "$fixture_dir/live.env"
  rmdir "$fixture_dir"
}
trap cleanup EXIT
umask 077

# Check the image before introducing fixtures. In particular, no old manifest or
# environment-specific build inputs may be supplied as baked image defaults.
docker run --rm --pull never --network none --read-only --entrypoint node "$runtime_image" --input-type=module -e '
  import { existsSync } from "node:fs";
  const configNames = ["SITE_URL", "SHOP_SITE_URL", "DJANGO_API_BASE_URL", "CART_STORAGE_OBFUSCATION_KEY",
    "SESSION_SECRET", "ADMIN_SESSION_SECRET"];
  if (existsSync("/app/release-public-settings.json") || Object.keys(process.env).some((key) =>
    key.startsWith("NEXT_PUBLIC_") || key.startsWith("PAYPAL_") ||
    key.startsWith("CLOUDFLARE_WEB_ANALYTICS_") || configNames.includes(key))) process.exit(1);
'

# The sandbox fixture uses the existing deployment's legacy names. The live
# fixture uses canonical runtime-only names. Their values deliberately differ.
cat > "$fixture_dir/sandbox.env" <<'SETTINGS'
NEXT_PUBLIC_SITE_URL=https://codexchristi.org
NEXT_PUBLIC_SHOP_SITE_URL=https://codexchristi.shop
NEXT_PUBLIC_DJANGO_API_BASE_URL=https://codexchristi.org/api/v1
NEXT_PUBLIC_PAYPAL_PAYMENT_MODE=sandbox
NEXT_PUBLIC_PAYPAL_SANDBOX_CLIENT_ID=synthetic-sandbox-client
PAYPAL_PAYMENT_MODE=sandbox
PAYPAL_SANDBOX_CLIENT_ID=synthetic-sandbox-client
NEXT_PUBLIC_CART_KEY=synthetic-sandbox-cart
NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN=synthetic-sandbox-org
NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_SHOP_TOKEN=synthetic-sandbox-shop
PAYPAL_SANDBOX_CLIENT_SECRET=private-sandbox-fixture-not-public
SESSION_SECRET=private-session-fixture-not-public
NEXT_PUBLIC_UNREVIEWED_LEGACY_SETTING=private-unknown-fixture-not-public
SETTINGS
cat > "$fixture_dir/live.env" <<'SETTINGS'
SITE_URL=https://www.codexchristi.org
SHOP_SITE_URL=https://www.codexchristi.shop
DJANGO_API_BASE_URL=https://www.codexchristi.org/api/v1
PAYPAL_PAYMENT_MODE=live
PAYPAL_LIVE_CLIENT_ID=synthetic-live-client
CART_STORAGE_OBFUSCATION_KEY=synthetic-live-cart
PAYPAL_LIVE_CLIENT_SECRET=private-live-fixture-not-public
SESSION_SECRET=private-session-fixture-not-public
SETTINGS

for mode in sandbox live; do
  docker run --rm --pull never --network none --read-only --env-file "$fixture_dir/$mode.env" \
    --entrypoint node "$runtime_image" scripts/check-release-settings.mjs --runtime
  docker run --rm --pull never --network none --read-only --tmpfs /tmp:rw,nosuid,nodev,mode=1777,size=64m \
    --env-file "$fixture_dir/$mode.env" \
    --mount "type=bind,src=$root/scripts/tests/check-runtime-image-config.mjs,dst=/checks/runtime-config.mjs,readonly" \
    --entrypoint node "$runtime_image" /checks/runtime-config.mjs "$mode"
done

# A conflicting runtime payment mode must be rejected before activation.
if output="$(docker run --rm --pull never --network none --read-only --env-file "$fixture_dir/sandbox.env" \
  --env PAYPAL_PAYMENT_MODE=live --entrypoint node "$runtime_image" scripts/check-release-settings.mjs --runtime 2>&1)"; then
  exit 1
fi
test "$output" = 'Release settings check failed; runtime configuration is invalid.'

# Exercise the actual checker image's CLI without connecting to any datastore.
# Missing datastore configuration must be rejected, not silently accepted.
if output="$(docker run --rm --pull never --network none --read-only --tmpfs /tmp:rw,nosuid,nodev,mode=1777,size=16m "$checker_image" 2>&1)"; then
  exit 1
fi
test "$output" = 'Production datastore check failed at configuration; existing databases unchanged.'
echo 'Runtime image portability and offline release preflight checks=OK.'
