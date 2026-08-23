#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"

ok=0
warn_count=0
fail_count=0

ready() { printf 'READY    %-24s %s\n' "$1" "$2"; ok=$((ok + 1)); }
optional() { printf 'OPTIONAL %-24s %s\n' "$1" "$2"; warn_count=$((warn_count + 1)); }
missing() { printf 'MISSING  %-24s %s\n' "$1" "$2"; fail_count=$((fail_count + 1)); }

printf 'Predictor persistent cloud workspace\n'
printf '====================================\n'

expected_node="$(python3 - <<'PY'
import json
from pathlib import Path
print(json.loads(Path('package.json').read_text())['engines']['node'])
PY
)"
actual_node="$(node --version 2>/dev/null | sed 's/^v//' || true)"
if [ "$actual_node" = "$expected_node" ]; then
  ready 'Node' "$actual_node"
else
  missing 'Node' "expected ${expected_node}, got ${actual_node:-none}"
fi

if command -v opencode >/dev/null 2>&1; then
  ready 'OpenCode' "$(opencode --version 2>/dev/null | head -n 1)"
  agents="$(opencode agent list 2>/dev/null || true)"
  for agent in predictor-conductor predictor-builder predictor-critic; do
    if grep -q "$agent" <<<"$agents"; then
      ready "Agent ${agent}" 'tracked project agent is visible'
    else
      missing "Agent ${agent}" 'not visible to OpenCode from repository root'
    fi
  done
else
  missing 'OpenCode' 'run scripts/agent-tools/cloud-conductor-install.sh'
fi

if command -v opencode >/dev/null 2>&1 && opencode auth list 2>/dev/null | grep -qi 'openai'; then
  ready 'ChatGPT/OpenAI auth' 'direct OpenAI provider authenticated'
else
  missing 'ChatGPT/OpenAI auth' 'connect OpenAI in OpenCode using ChatGPT Plus/Pro; do not silently substitute paid API billing'
fi

env_file="${HOME}/.config/predictor-cloud/opencode.env"
if [ -f "$env_file" ] && [ "$(stat -c '%a' "$env_file" 2>/dev/null || true)" = '600' ]; then
  ready 'Cloud env file' 'present with mode 0600'
else
  missing 'Cloud env file' 'missing or not mode 0600'
fi
if [ -f "$env_file" ] && grep -q '^OPENROUTER_API_KEY=.' "$env_file"; then
  ready 'Ox/OpenRouter auth' 'scoped key present (value hidden)'
else
  missing 'Ox/OpenRouter auth' 'OPENROUTER_API_KEY is required for the free Ox critic lane'
fi
if [ -f "$env_file" ] && grep -q '^OPENCODE_SERVER_PASSWORD=.' "$env_file"; then
  ready 'Web auth' 'server password configured'
else
  missing 'Web auth' 'OPENCODE_SERVER_PASSWORD is not configured'
fi

if command -v claude >/dev/null 2>&1; then
  optional 'Claude Code' 'installed; authenticate a Claude subscription only if you want the optional escalation lane'
else
  optional 'Claude Code' 'not installed; optional only, not required for the free-first workflow'
fi

if systemctl --user is-active --quiet predictor-conductor.service; then
  ready 'Conductor service' 'systemd user service is active'
else
  missing 'Conductor service' 'systemctl --user status predictor-conductor.service'
fi

if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:4096/ >/dev/null 2>&1; then
  missing 'Local auth boundary' 'localhost:4096 answered without HTTP auth; inspect service environment'
else
  status="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 3 http://127.0.0.1:4096/ || true)"
  if [ "$status" = "401" ]; then
    ready 'Local auth boundary' 'localhost:4096 requires HTTP Basic auth'
  elif [ "$status" = "000" ]; then
    missing 'Local web endpoint' 'no response on localhost:4096'
  else
    optional 'Local web endpoint' "unexpected unauthenticated HTTP status ${status}; inspect before remote use"
  fi
fi

if command -v tailscale >/dev/null 2>&1; then
  if tailscale status >/dev/null 2>&1; then
    ready 'Tailscale' 'host is joined to a tailnet'
  else
    missing 'Tailscale' 'run: sudo tailscale up'
  fi
else
  missing 'Tailscale' 'client is not installed'
fi

if command -v tailscale >/dev/null 2>&1 && tailscale serve status 2>/dev/null | grep -q '4096'; then
  ready 'Private web route' 'Tailscale Serve points to OpenCode'
else
  optional 'Private web route' 'run after tailscale up: sudo tailscale serve --bg 4096'
fi

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  ready 'GitHub CLI' 'authenticated for push/PR workflows'
else
  optional 'GitHub CLI' 'run gh auth login if the Builder should push/create PRs'
fi

printf '\nCost posture: direct ChatGPT subscription + free Ox are the default lanes; paid APIs are not automatic fallbacks.\n'
printf 'Summary: %s ready, %s optional, %s missing\n' "$ok" "$warn_count" "$fail_count"
if [ "$fail_count" -gt 0 ]; then
  exit 1
fi
