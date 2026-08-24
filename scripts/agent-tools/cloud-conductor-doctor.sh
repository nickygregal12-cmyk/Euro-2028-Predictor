#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"

live_checks='false'
case "${1:-}" in
  --live)
    live_checks='true'
    shift
    ;;
  -h|--help)
    cat <<'EOF'
Usage: bash scripts/agent-tools/cloud-conductor-doctor.sh [--live]

Default checks are local and make no model request.
--live additionally performs one tiny Ox Alpha transport request through the
tracked read-only bridge. It does not call Claude or any paid API.
EOF
    exit 0
    ;;
esac
if [ "$#" -ne 0 ]; then
  printf 'Unknown argument. Use --help.\n' >&2
  exit 2
fi

ok=0
warn_count=0
fail_count=0

ready() { printf 'READY    %-28s %s\n' "$1" "$2"; ok=$((ok + 1)); }
optional() { printf 'OPTIONAL %-28s %s\n' "$1" "$2"; warn_count=$((warn_count + 1)); }
missing() { printf 'MISSING  %-28s %s\n' "$1" "$2"; fail_count=$((fail_count + 1)); }

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

if node -e "const c=require('./opencode.json'); process.exit(c.default_agent === 'predictor-conductor' ? 0 : 1)" 2>/dev/null; then
  ready 'Default web agent' 'predictor-conductor'
else
  missing 'Default web agent' 'opencode.json must default to predictor-conductor'
fi

if command -v opencode >/dev/null 2>&1; then
  ready 'OpenCode' "$(opencode --version 2>/dev/null | head -n 1)"
  agents="$(opencode agent list 2>/dev/null || true)"
  for agent in predictor-conductor predictor-builder predictor-critic predictor-visual-qa predictor-release-verifier; do
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
  missing 'Ox/OpenRouter auth' 'OPENROUTER_API_KEY is required for the Ox critic lane'
fi
if [ -f "$env_file" ] && grep -q '^OPENCODE_SERVER_PASSWORD=.' "$env_file"; then
  ready 'Web auth' 'server password configured'
else
  missing 'Web auth' 'OPENCODE_SERVER_PASSWORD is not configured'
fi

if command -v claude >/dev/null 2>&1; then
  supported_claude="$(node -p "require('./config/agent-tools.json').claudeCode.version" 2>/dev/null || true)"
  installed_claude="$(claude --version 2>/dev/null | head -n 1 || true)"
  if [ -n "$supported_claude" ] && grep -q "$supported_claude" <<<"$installed_claude"; then
    ready 'Claude Code' "$installed_claude"
  else
    optional 'Claude Code version' "installed ${installed_claude:-unknown}; repository supports ${supported_claude:-unknown}"
  fi

  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    optional 'Claude billing boundary' 'ANTHROPIC_API_KEY is set in this shell; unset it before using the subscription-only review bridge'
  elif claude auth status >/dev/null 2>&1; then
    ready 'Claude subscription auth' 'official client authenticated and no API key is set in this shell'
  else
    optional 'Claude subscription auth' 'run `claude auth login` if the optional Claude escalation lane is wanted'
  fi
else
  optional 'Claude Code' 'install with scripts/agent-tools/cloud-conductor-claude-install.sh if the optional subscription lane is wanted'
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
  if [ "$status" = '401' ]; then
    ready 'Local auth boundary' 'localhost:4096 requires HTTP Basic auth'
  elif [ "$status" = '000' ]; then
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

memory_kib="$(awk '/MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || true)"
if [ -n "$memory_kib" ]; then
  memory_gib="$((memory_kib / 1024 / 1024))"
  if [ "$memory_kib" -ge 7340032 ]; then
    ready 'Host capacity' "${memory_gib} GiB RAM; suitable for browser/build verification"
  else
    optional 'Host capacity' "${memory_gib} GiB RAM; orchestration is fine, but use about 8 GiB before heavy Playwright/build work"
  fi
fi

if [ "$live_checks" = 'true' ]; then
  printf '\nLive provider smoke\n'
  printf '-------------------\n'
  if [ -x scripts/agent-tools/ox-review.sh ] || [ -f scripts/agent-tools/ox-review.sh ]; then
    ox_output="$(timeout 90 bash scripts/agent-tools/ox-review.sh 'Transport smoke only. Reply with exactly OX_MODEL_OK and nothing else.' 2>&1 || true)"
    if grep -q 'OX_MODEL_OK' <<<"$ox_output"; then
      ready 'Ox live review bridge' 'direct read-only Ox response received'
    else
      missing 'Ox live review bridge' 'no OX_MODEL_OK response; inspect the bridge/provider without printing secrets'
      printf '%s\n' "$ox_output" | tail -n 8
    fi
  else
    missing 'Ox live review bridge' 'scripts/agent-tools/ox-review.sh is missing'
  fi
fi

printf '\nCost posture: direct ChatGPT subscription + Ox are the default lanes; Claude is optional and subscription-only; paid APIs are not automatic fallbacks.\n'
if [ "$live_checks" = 'false' ]; then
  printf 'Provider requests: none. Re-run with --live for one tiny Ox transport smoke.\n'
else
  printf 'Provider requests: one Ox transport smoke; Claude was not called.\n'
fi
printf 'Summary: %s ready, %s optional, %s missing\n' "$ok" "$warn_count" "$fail_count"
if [ "$fail_count" -gt 0 ]; then
  exit 1
fi
