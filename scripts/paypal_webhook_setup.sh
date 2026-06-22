#!/usr/bin/env bash

set -euo pipefail

# Default event set for the current TX ledger flow.
# Keep this list small and explicit so it is obvious what the webhook is subscribing to.
DEFAULT_EVENTS=(
  "PAYMENT.AUTHORIZATION.CREATED"
  "PAYMENT.CAPTURE.COMPLETED"
  "PAYMENT.CAPTURE.PENDING"
  "PAYMENT.CAPTURE.DECLINED"
  "PAYMENT.CAPTURE.DENIED"
  "PAYMENT.CAPTURE.REFUNDED"
)

WEBHOOK_PATH="/next-api/paypal/webhooks/ledger-transaction-events"
WEBHOOK_NEXT_API_PREFIX="/next-api"
CANONICAL_PRODUCTION_WEBHOOK_BASE_URL="${PAYPAL_PRODUCTION_WEBHOOK_BASE_URL:-https://codexchristi.org}"

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

# Fail early if a required executable is missing.
require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

# Minimal JSON field extraction.
# This is intentionally lightweight so the script works without jq.
# It is good enough for the small PayPal responses we care about here.
json_get_string() {
  local json="$1"
  local key="$2"

  printf '%s' "$json" | sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n 1
}

# Turn the fixed event list into the payload shape PayPal expects.
build_events_json() {
  local json="["
  local first=1

  for event_name in "${DEFAULT_EVENTS[@]}"; do
    if [[ $first -eq 0 ]]; then
      json+=","
    fi
    json+="{\"name\":\"$event_name\"}"
    first=0
  done

  json+="]"
  printf '%s' "$json"
}

prompt_required() {
  local label="$1"
  local value=""

  while [[ -z "$value" ]]; do
    read -r -p "$label: " value
    value="$(trim "$value")"
  done

  printf '%s' "$value"
}

# Same as prompt_required, but does not echo the value while typing.
prompt_secret() {
  local label="$1"
  local value=""

  while [[ -z "$value" ]]; do
    read -r -s -p "$label: " value
    echo
    value="$(trim "$value")"
  done

  printf '%s' "$value"
}

prompt_secret_with_mode() {
  local label="$1"
  local hide_secret=""

  read -r -p "Hide $label while typing? [y/N]: " hide_secret
  hide_secret="$(tr '[:upper:]' '[:lower:]' <<< "${hide_secret:-n}")"

  if [[ "$hide_secret" == "y" || "$hide_secret" == "yes" ]]; then
    prompt_secret "$label"
    return
  fi

  prompt_required "$label"
}

# Accept either:
# - a full base URL like https://shop.example.com
# - or an ngrok subdomain like my-dev-tunnel
# and normalize both to the PayPal webhook route.
build_webhook_url() {
  local raw="$1"
  local normalized="${raw%/}"

  if [[ "$normalized" == *"$WEBHOOK_PATH" ]]; then
    printf '%s' "$normalized"
    return
  fi

  if [[ "$normalized" == http://* || "$normalized" == https://* ]]; then
    if [[ "$normalized" == *"$WEBHOOK_NEXT_API_PREFIX" ]]; then
      printf '%s/paypal/webhooks/ledger-transaction-events' "$normalized"
      return
    fi

    printf '%s%s' "$normalized" "$WEBHOOK_PATH"
    return
  fi

  printf 'https://%s.ngrok-free.app%s' "$normalized" "$WEBHOOK_PATH"
}

is_ngrok_webhook_target() {
  local raw="$1"
  local normalized="$raw"

  [[ "$normalized" == *"ngrok-free.app"* || ( "$normalized" != http://* && "$normalized" != https://* ) ]]
}

is_canonical_production_webhook_target() {
  local raw="$1"
  local normalized="${raw%/}"
  local canonical="${CANONICAL_PRODUCTION_WEBHOOK_BASE_URL%/}"

  [[ "$normalized" == "$canonical"* ]]
}

is_production_deployment_context() {
  local env_name="${PAYPAL_WEBHOOK_DEPLOYMENT_ENV:-${APP_ENV:-${NODE_ENV:-}}}"
  env_name="$(tr '[:upper:]' '[:lower:]' <<< "${env_name:-}")"

  [[ "$env_name" == "production" ]]
}

require_command curl
require_command sed

echo "PayPal webhook setup"
echo

# Choose which PayPal payment mode this operation will hit.
# This works from your local machine for either sandbox or live.
read -r -p "Payment mode [sandbox/live] (default: sandbox): " payment_mode
payment_mode="$(trim "${payment_mode:-sandbox}")"

if [[ "$payment_mode" != "sandbox" && "$payment_mode" != "live" ]]; then
  echo "Payment mode must be 'sandbox' or 'live'." >&2
  exit 1
fi

read -r -p "Action [create/patch] (default: create): " action
action="$(trim "${action:-create}")"

if [[ "$action" != "create" && "$action" != "patch" ]]; then
  echo "Action must be 'create' or 'patch'." >&2
  exit 1
fi

# Credentials are entered at runtime and never stored in the script.
client_id="$(prompt_required "PayPal client ID")"
client_secret="$(prompt_secret_with_mode "PayPal client secret")"

# Let the caller choose the exact listener URL target.
# Payment mode selects the PayPal API/app. The listener URL is separate.
# A production deployment can still register its stable production listener under the Sandbox app
# while PAYPAL_PAYMENT_MODE=sandbox and NEXT_PUBLIC_PAYPAL_PAYMENT_MODE=sandbox.
# Live mode should target the stable production URL.
echo
echo "Webhook base URL input examples:"
echo "- Full base URL: https://codexchristi.org"
echo "- Next API base URL: https://codexchristi.org/next-api"
echo "- Full webhook URL: https://codexchristi.org/next-api/paypal/webhooks/ledger-transaction-events"
echo "- Ngrok subdomain only: my-paypal-dev-tunnel"
echo "- Full ngrok URL: https://my-paypal-dev-tunnel.ngrok-free.app"
echo
echo "If you provide only a base URL or ngrok subdomain, the script appends:"
echo "- $WEBHOOK_PATH"
echo
echo "Spaces before or after your input are trimmed automatically."
echo
default_webhook_target=""
if is_production_deployment_context; then
  default_webhook_target="$CANONICAL_PRODUCTION_WEBHOOK_BASE_URL"
fi

if [[ -n "$default_webhook_target" ]]; then
  read -r -p "Webhook base URL, full webhook URL, or ngrok subdomain (default: $default_webhook_target): " webhook_target
  webhook_target="${webhook_target:-$default_webhook_target}"
else
  read -r -p "Webhook base URL, full webhook URL, or ngrok subdomain: " webhook_target
fi

webhook_target="$(trim "$webhook_target")"

if [[ -z "$webhook_target" ]]; then
  echo "Webhook base URL, full webhook URL, or ngrok subdomain is required." >&2
  exit 1
fi

webhook_url="$(build_webhook_url "$webhook_target")"
webhook_id=""

if [[ "$action" == "patch" ]]; then
  webhook_id="$(prompt_required "Existing webhook ID to patch")"
fi

read -r -p "Print full access token at the end? [y/N]: " print_token
print_token="$(tr '[:upper:]' '[:lower:]' <<< "${print_token:-n}")"

read -r -p "Print raw PayPal API response? [y/N]: " print_response
print_response="$(tr '[:upper:]' '[:lower:]' <<< "${print_response:-n}")"

if [[ "$payment_mode" == "live" ]]; then
  api_base="https://api-m.paypal.com"
else
  api_base="https://api-m.sandbox.paypal.com"
fi

echo
echo "Requesting access token from $payment_mode..."

token_response="$(
  curl -sS -X POST "$api_base/v1/oauth2/token" \
    -u "$client_id:$client_secret" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials"
)"

access_token="$(json_get_string "$token_response" "access_token")"

if [[ -z "$access_token" ]]; then
  echo "Failed to extract access token." >&2
  echo "$token_response" >&2
  exit 1
fi

events_json="$(build_events_json)"

if [[ "$action" == "create" ]]; then
  # Create a brand-new webhook subscription and print the resulting ID.
  echo "Creating webhook listener..."

  payload="$(printf '{"url":"%s","event_types":%s}' "$webhook_url" "$events_json")"
  webhook_response="$(
    curl -sS -X POST "$api_base/v1/notifications/webhooks" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $access_token" \
      -d "$payload"
  )"
else
  # Update both the target URL and the subscribed events for an existing webhook.
  echo "Patching webhook listener..."

  patch_payload="$(printf '[{"op":"replace","path":"/url","value":"%s"},{"op":"replace","path":"/event_types","value":%s}]' "$webhook_url" "$events_json")"
  webhook_response="$(
    curl -sS -X PATCH "$api_base/v1/notifications/webhooks/$webhook_id" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $access_token" \
      -d "$patch_payload"
  )"
fi

result_webhook_id="${webhook_id:-$(json_get_string "$webhook_response" "id")}"

echo
echo "Done."
echo "Payment mode: $payment_mode"
echo "Webhook URL: $webhook_url"

if [[ -n "$result_webhook_id" ]]; then
  echo "Webhook ID: $result_webhook_id"
fi

if [[ "$payment_mode" == "sandbox" ]]; then
  if is_canonical_production_webhook_target "$webhook_target"; then
    echo "Suggested env for production-deployed sandbox: PAYPAL_SANDBOX_PRODUCTION_WEBHOOK_ID=$result_webhook_id"
  elif is_ngrok_webhook_target "$webhook_target"; then
    echo "Suggested env for ngrok sandbox: PAYPAL_SANDBOX_NGROK_WEBHOOK_ID=$result_webhook_id"
  else
    echo "Suggested env for this sandbox listener: PAYPAL_SANDBOX_ADDITIONAL_WEBHOOK_IDS=$result_webhook_id"
  fi
else
  if is_canonical_production_webhook_target "$webhook_target"; then
    echo "Suggested env for production live: PAYPAL_LIVE_PRODUCTION_WEBHOOK_ID=$result_webhook_id"
  else
    echo "Suggested env for this live listener: PAYPAL_LIVE_ADDITIONAL_WEBHOOK_IDS=$result_webhook_id"
  fi
fi

if [[ "$print_token" == "y" || "$print_token" == "yes" ]]; then
  echo "Access token: $access_token"
fi

if [[ "$print_response" == "y" || "$print_response" == "yes" ]]; then
  echo "Raw response:"
  echo "$webhook_response"
fi

echo
echo "Simulator note:"
echo "- Use PAYPAL_WEBHOOK_SIGNATURE_VERIFICATION=disabled only for simulator events."
echo "- Use PAYPAL_WEBHOOK_SIGNATURE_VERIFICATION=required for real sandbox/live webhook deliveries."
