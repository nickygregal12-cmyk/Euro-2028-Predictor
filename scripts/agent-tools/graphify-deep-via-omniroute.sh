#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

: "${OMNIROUTE_API_KEY:?Set OMNIROUTE_API_KEY to an OmniRoute Endpoint inference key.}"
: "${GRAPHIFY_OMNIROUTE_MODEL:?Set GRAPHIFY_OMNIROUTE_MODEL to the model or Combo exposed by OmniRoute.}"

export OPENAI_BASE_URL="${OMNIROUTE_BASE_URL:-http://localhost:20128/v1}"
export OPENAI_API_KEY="${OMNIROUTE_API_KEY}"
export OPENAI_MODEL="${GRAPHIFY_OMNIROUTE_MODEL}"

printf 'Deep Graphify is opt-in and may send repository documentation/content to the provider selected by OmniRoute.\n'
printf 'Endpoint: %s\nModel/route: %s\n' "$OPENAI_BASE_URL" "$OPENAI_MODEL"
printf 'Historical evidence and local/generated/secret paths are excluded by .graphifyignore/.gitignore.\n\n'

exec graphify extract . \
  --backend openai \
  --mode deep \
  --max-concurrency "${GRAPHIFY_MAX_CONCURRENCY:-2}" \
  --api-timeout "${GRAPHIFY_API_TIMEOUT_SECONDS:-900}"
