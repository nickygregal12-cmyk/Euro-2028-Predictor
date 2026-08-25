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

token_has_non_whitespace() {
  [[ "$1" =~ [^[:space:]] ]]
}

if ! token_has_non_whitespace "${GITHUB_MCP_TOKEN:-}"; then
  env_file="${HOME}/.config/predictor-cloud/opencode.env"
  if [ ! -f "$env_file" ] || [ ! -r "$env_file" ]; then
    printf 'MISSING protected OpenCode service env is missing or unreadable\n' >&2
    exit 1
  fi
  if [ "$(stat -c '%a' "$env_file" 2>/dev/null || true)" != '600' ]; then
    printf 'MISSING protected OpenCode service env must have mode 0600\n' >&2
    exit 1
  fi
  github_mcp_token="$(python3 - "$env_file" <<'PY'
from pathlib import Path
import sys

prefix = "GITHUB_MCP_TOKEN="
matches = [line[len(prefix):] for line in Path(sys.argv[1]).read_text().splitlines() if line.startswith(prefix)]
if len(matches) != 1 or not matches[0].strip():
    raise SystemExit(1)
sys.stdout.write(matches[0])
PY
  )" || {
    printf 'MISSING protected OpenCode service env has no single non-blank GitHub MCP token\n' >&2
    exit 1
  }
  export GITHUB_MCP_TOKEN="$github_mcp_token"
  unset github_mcp_token
fi

# `opencode mcp list` performs protocol initialization and tools/list only. It
# does not invoke an external MCP tool. Keep the whole connectivity probe bounded.
set +e
raw="$(timeout 45 opencode mcp list 2>&1)"
status=$?
set -e
clean="$(printf '%s\n' "$raw" | sed -E $'s/\x1b\\[[0-9;]*m//g')"
classification_failure=0
for server in "${servers[@]}"; do
  line="$(printf '%s\n' "$clean" | grep -i -m 1 -E "[[:space:]]${server}[[:space:]]" || true)"
  detail="$line"
  if grep -qi 'failed' <<<"$line"; then
    detail="$(printf '%s\n' "$clean" | grep -i -A 2 -m 1 -E "[[:space:]]${server}[[:space:]]" || true)"
  fi

  auth='UNKNOWN'
  connected='NO'
  unavailable='NO'
  failed='NO'
  unknown='NO'

  if [[ "$server" != supabase-* && "$server" != netlify && "$server" != sentry && "$server" != posthog && "$server" != github ]]; then
    auth='N/A'
  fi

  # Match actual authentication failures, not the substring "auth". In
  # particular, healthy OpenCode output such as "connected (OAuth)" must remain
  # a positive connection signal.
  if grep -Eqi 'needs[[:space:]]+authentication|authentication[[:space:]]+(required|needed)|auth[[:space:]]+(required|needed)|unauthori[sz]ed|(^|[^0-9])401([^0-9]|$)|login[[:space:]]+(required|needed)|please[[:space:]]+(log[[:space:]]+in|login|sign[[:space:]]+in)' <<<"$detail"; then
    auth='REQUIRED'
  fi
  if [ "$server" = 'github' ] && [ -z "${GITHUB_MCP_TOKEN:-}" ]; then
    auth='REQUIRED'
  fi

  if grep -Eqi '(^|[^0-9])5[0-9]{2}([^0-9]|$)|bad gateway|service unavailable|timed out|timeout' <<<"$detail"; then
    unavailable='YES'
  fi
  if grep -Eqi 'fail(ed|ure)?|error|unable to connect|connection refused|disconnected|not[[:space:]]+(connected|ready)' <<<"$detail"; then
    failed='YES'
  fi

  if [ "$auth" != 'REQUIRED' ] && [ "$unavailable" != 'YES' ] && [ "$failed" != 'YES' ] && grep -Eqi 'connected|ready' <<<"$line"; then
    connected='YES'
    if [ "$auth" != 'N/A' ]; then
      auth='OK'
    fi
  fi

  # A line that is neither a recognised positive state nor a recognised failure
  # must not be silently treated as healthy. Preserve the diagnostic row and
  # make the overall readiness command fail closed.
  if [ -z "$line" ] || { [ "$connected" = 'NO' ] && [ "$auth" != 'REQUIRED' ] && [ "$unavailable" != 'YES' ] && [ "$failed" != 'YES' ]; }; then
    unknown='YES'
    classification_failure=1
  fi

  printf 'CONFIGURED %-18s AUTH=%-8s CONNECTED=%-3s UNAVAILABLE=%s' "$server" "$auth" "$connected" "$unavailable"
  if [ "$unknown" = 'YES' ]; then
    printf ' CLASSIFICATION=UNKNOWN'
  fi
  printf '\n'
done
printf 'Connectivity probe: initialize/tools-list only; zero external MCP tools invoked.\n'
if [ "$status" -eq 124 ]; then
  printf 'UNAVAILABLE readiness probe exceeded 45 seconds.\n'
fi
if [ "$classification_failure" -ne 0 ]; then
  printf 'FAILED readiness output contained an unclassified MCP state.\n' >&2
  exit 1
fi
