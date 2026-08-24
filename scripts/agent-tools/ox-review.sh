#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/agent-tools/ox-review.sh "REVIEW TASK"

Runs the tracked read-only predictor-critic directly with Ox Alpha through the
persistent localhost OpenCode service. This deliberately avoids child-session
result handoff for the independent critic lane.
EOF
}

if [ "$#" -lt 1 ]; then
  usage >&2
  exit 2
fi

if ! command -v opencode >/dev/null 2>&1; then
  printf 'OpenCode is not installed. Run the persistent cloud installer first.\n' >&2
  exit 1
fi

env_file="${HOME}/.config/predictor-cloud/opencode.env"
read_env_value() {
  local name="$1"
  [ -f "$env_file" ] || return 0
  sed -n "s/^${name}=//p" "$env_file" | head -n 1
}

if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  OPENROUTER_API_KEY="$(read_env_value OPENROUTER_API_KEY)"
  export OPENROUTER_API_KEY
fi
if [ -z "${OPENCODE_SERVER_USERNAME:-}" ]; then
  OPENCODE_SERVER_USERNAME="$(read_env_value OPENCODE_SERVER_USERNAME)"
  export OPENCODE_SERVER_USERNAME
fi
if [ -z "${OPENCODE_SERVER_PASSWORD:-}" ]; then
  OPENCODE_SERVER_PASSWORD="$(read_env_value OPENCODE_SERVER_PASSWORD)"
  export OPENCODE_SERVER_PASSWORD
fi

if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  printf 'Ox review is unavailable: OPENROUTER_API_KEY is not configured.\n' >&2
  exit 1
fi

attach_url="${OPENCODE_ATTACH_URL:-http://127.0.0.1:4096}"
prompt="$*"

exec opencode run \
  --attach "$attach_url" \
  --dir "$repo_root" \
  --agent predictor-critic \
  --model openrouter/stealth/ox-alpha \
  "$prompt"
