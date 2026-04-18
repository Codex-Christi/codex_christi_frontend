#!/usr/bin/env bash

set -euo pipefail

# Default event set for the current TX ledger flow.
# Keep this list small and explicit so it is obvious what the webhook is subscribing to.
DEFAULT_EVENTS=(
  "PAYMENT.AUTHORIZATION.CREATED"
  "PAYMENT.CAPTURE.COMPLETED"
  "PAYMENT.CAPTURE.PENDING"
  "PAYMENT.CAPTURE.DENIED"
  "PAYMENT.CAPTURE.REFUNDED"
)

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

  if [[ "$normalized" == http://* || "$normalized" == https://* ]]; then
    printf '%s/next-api/paypal/webhooks/ledger-transaction-events' "$normalized"
    return
  fi

  printf 'https://%s.ngrok-free.app/next-api/paypal/webhooks/ledger-transaction-events' "$normalized"
}

require_command curl
require_command sed

echo "PayPal webhook setup"
echo

# Choose which PayPal environment this operation will hit.
# This works from your local machine for either sandbox or live.
read -r -p "Environment [sandbox/live] (default: sandbox): " environment
environment="$(trim "${environment:-sandbox}")"

if [[ "$environment" != "sandbox" && "$environment" != "live" ]]; then
  echo "Environment must be 'sandbox' or 'live'." >&2
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
# For sandbox this can be ngrok; for live this can be your production domain.
echo
echo "Webhook base URL input examples:"
echo "- Full base URL: https://codexchristi.org"
echo "- Full shop URL: https://codexchristi.shop"
echo "- Ngrok subdomain only: my-paypal-dev-tunnel"
echo "- Full ngrok URL: https://my-paypal-dev-tunnel.ngrok-free.app"
echo
echo "Do not include the webhook path itself; the script appends:"
echo "- /next-api/paypal/webhooks/ledger-transaction-events"
echo
echo "Spaces before or after your input are trimmed automatically."
echo
read -r -p "Webhook base URL or ngrok subdomain: " webhook_target
webhook_target="$(trim "$webhook_target")"

if [[ -z "$webhook_target" ]]; then
  echo "Webhook base URL or ngrok subdomain is required." >&2
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

if [[ "$environment" == "live" ]]; then
  api_base="https://api-m.paypal.com"
else
  api_base="https://api-m.sandbox.paypal.com"
fi

echo
echo "Requesting access token from $environment..."

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
echo "Environment: $environment"
echo "Webhook URL: $webhook_url"

if [[ -n "$result_webhook_id" ]]; then
  echo "Webhook ID: $result_webhook_id"
fi

if [[ "$environment" == "sandbox" ]]; then
  echo "Suggested env: PAYPAL_WEBHOOK_ID_SANDBOX=$result_webhook_id"
else
  echo "Suggested env: PAYPAL_WEBHOOK_ID_LIVE=$result_webhook_id"
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
echo "- Use PAYPAL_WEBHOOK_VERIFY=false only for simulator events."
echo "- Use PAYPAL_WEBHOOK_VERIFY=true for real sandbox/live webhook deliveries."
