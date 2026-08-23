#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"

ok=0
warn=0
fail=0

ready() { printf 'READY    %-24s %s\n' "$1" "$2"; ok=$((ok + 1)); }
optional() { printf 'OPTIONAL %-24s %s\n' "$1" "$2"; warn=$((warn + 1)); }
missing() { printf 'MISSING  %-24s %s\n' "$1" "$2"; fail=$((fail + 1)); }

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
else
  missing 'OpenCode' 'run scripts/agent-tools/cloud-conductor-install.sh'
fi

for agent in predictor-conductor predictor-builder predictor-critic; do
  if [ -f ".opencode/agents/${agent}.md" ]; then
    ready "Agent ${agent}" '.opencode/agents'
  else
    missing "Agent ${agent}" 'tracked agent definition is absent'
  fi
done

env_file="${HOME}/.config/predictor-cloud/opencode.env"
if [ -f "$env_file" ] && grep -q '^OPENROUTER_API_KEY=.' "$env_file"; then
  ready 'OpenRouter key' 'stored in private service env file'
else
  missing 'OpenRouter key' 'service credential is not configured'
fi
if [ -f "$env_file" ] && grep -q '^OPENCODE_SERVER_PASSWORD=.' "$env_file"; then
  ready 'Web auth' 'server password configured'
else
  missing 'Web auth' 'OPENCODE_SERVER_PASSWORD is not configured'
fi

if systemctl --user is-active --quiet predictor-conductor.service; then
  ready 'Conductor service' 'systemd user service is active'
else
  missing 'Conductor service' 'systemctl --user status predictor-conductor.service'
fi

if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:4096/ >/dev/null 2>&1; then
  # A password-protected OpenCode server should normally return 401 to an unauthenticated request,
  # so reaching this branch means the service answered without auth. Treat that as unsafe.
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
    ready 'Tailscale' 'VM is joined to a tailnet'
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

printf '\nSummary: %s ready, %s optional, %s missing\n' "$ok" "$warn" "$fail"
if [ "$fail" -gt 0 ]; then
  exit 1
fi
