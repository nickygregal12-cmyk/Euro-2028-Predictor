#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"

mode="${1:---config-only}"
if [ "$mode" != '--config-only' ] && [ "$mode" != '--connectivity' ]; then
  printf 'Usage: bash scripts/agent-tools/mcp-readiness.sh [--config-only|--connectivity]\n' >&2
  exit 2
fi

expected="$(node -p "require('./config/agent-tools.json').opencode.version")"
actual="$(opencode --version 2>/dev/null | awk 'NR == 1 {print $1}' || true)"
if [ "$actual" != "$expected" ]; then
  printf 'MISSING OpenCode expected %s, got %s\n' "$expected" "${actual:-none}" >&2
  exit 1
fi
timeout 30 opencode debug config >/dev/null

mapfile -t servers < <(node -e "console.log(Object.keys(require('./opencode.json').mcp).join('\\n'))")
if [ "$mode" = '--config-only' ]; then
  for server in "${servers[@]}"; do
    printf 'CONFIGURED %-18s AUTH=NOT_CHECKED CONNECTED=NOT_CHECKED UNAVAILABLE=NOT_CHECKED\n' "$server"
  done
  printf 'Connectivity: not checked; this mode performs zero network MCP handshakes.\n'
  exit 0
fi

# `opencode mcp list` performs protocol initialization and tools/list only. It
# does not invoke an external MCP tool. Keep the whole connectivity probe bounded.
set +e
raw="$(timeout 45 opencode mcp list 2>&1)"
status=$?
set -e
clean="$(printf '%s\n' "$raw" | sed -E $'s/\x1b\\[[0-9;]*m//g')"
for server in "${servers[@]}"; do
  line="$(printf '%s\n' "$clean" | grep -i -m 1 -E "[[:space:]]${server}[[:space:]]" || true)"
  detail="$line"
  if grep -qi 'failed' <<<"$line"; then
    detail="$(printf '%s\n' "$clean" | grep -i -A 2 -m 1 -E "[[:space:]]${server}[[:space:]]" || true)"
  fi
  auth='UNKNOWN'
  connected='NO'
  unavailable='NO'
  if [[ "$server" != supabase-* && "$server" != netlify && "$server" != sentry && "$server" != posthog && "$server" != github ]]; then auth='N/A'; fi
  if grep -Eqi 'auth|unauthorized|401|login' <<<"$detail"; then auth='REQUIRED'; fi
  if [ "$server" = 'github' ] && [ -z "${GITHUB_MCP_TOKEN:-}" ]; then auth='REQUIRED'; fi
  if grep -Eqi '(^|[^0-9])5[0-9]{2}([^0-9]|$)|bad gateway|service unavailable|timed out|timeout' <<<"$detail"; then unavailable='YES'; fi
  failed='NO'
  if grep -Eqi 'fail(ed|ure)?|error|unable to connect|connection refused|disconnected|not[[:space:]]+(connected|ready)' <<<"$detail"; then failed='YES'; fi
  if [ "$auth" != 'REQUIRED' ] && [ "$unavailable" != 'YES' ] && [ "$failed" != 'YES' ] && grep -Eqi 'connected|ready' <<<"$line"; then
    connected='YES'
    auth='OK'
  fi
  printf 'CONFIGURED %-18s AUTH=%-8s CONNECTED=%-3s UNAVAILABLE=%s\n' "$server" "$auth" "$connected" "$unavailable"
done
printf 'Connectivity probe: initialize/tools-list only; zero external MCP tools invoked.\n'
if [ "$status" -eq 124 ]; then
  printf 'UNAVAILABLE readiness probe exceeded 45 seconds.\n'
fi
