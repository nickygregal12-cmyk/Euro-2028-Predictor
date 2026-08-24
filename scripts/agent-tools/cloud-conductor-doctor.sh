#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"

live_checks='false'
mcp_checks='false'
case "${1:-}" in
  --live) live_checks='true'; shift ;;
  --mcp) mcp_checks='true'; shift ;;
  -h|--help)
    cat <<'EOF'
Usage: bash scripts/agent-tools/cloud-conductor-doctor.sh [--live|--mcp]

Default checks are local and make no model request.
--live additionally performs one tiny Ox Alpha transport request through the
tracked read-only bridge. It does not call Claude or a paid API.
--mcp performs bounded MCP initialize/tools-list connectivity only and invokes
zero external MCP tools. Provider 5xx responses are reported as UNAVAILABLE.
EOF
    exit 0
    ;;
esac
if [ "$#" -ne 0 ]; then
  printf 'Unknown argument. Use --help.\n' >&2
  exit 2
fi

ready_count=0
optional_count=0
missing_count=0
ready() { printf 'READY    %-28s %s\n' "$1" "$2"; ready_count=$((ready_count + 1)); }
optional() { printf 'OPTIONAL %-28s %s\n' "$1" "$2"; optional_count=$((optional_count + 1)); }
missing() { printf 'MISSING  %-28s %s\n' "$1" "$2"; missing_count=$((missing_count + 1)); }

printf 'Predictor persistent cloud workspace\n'
printf '====================================\n'

expected_node="$(node -p "require('./package.json').engines.node" 2>/dev/null || true)"
actual_node="$(node --version 2>/dev/null | sed 's/^v//' || true)"
if [ -n "$expected_node" ] && [ "$actual_node" = "$expected_node" ]; then
  ready 'Node' "$actual_node"
else
  missing 'Node' "expected ${expected_node:-unknown}, got ${actual_node:-none}"
fi

if node -e "const c=require('./opencode.json'); process.exit(c.default_agent === 'predictor-conductor' ? 0 : 1)" 2>/dev/null; then
  ready 'Default web agent' 'predictor-conductor'
else
  missing 'Default web agent' 'opencode.json must default to predictor-conductor'
fi
if node -e "const c=require('./opencode.json'); process.exit(c.share === 'disabled' && c.autoupdate === false ? 0 : 1)" 2>/dev/null; then
  ready 'Private project defaults' 'session sharing disabled; OpenCode updates stay repository-pinned'
else
  missing 'Private project defaults' 'opencode.json must disable sharing and automatic client updates'
fi

if command -v opencode >/dev/null 2>&1; then
  supported_opencode="$(node -p "require('./config/agent-tools.json').opencode.version" 2>/dev/null || true)"
  installed_opencode="$(opencode --version 2>/dev/null | awk 'NR == 1 {print $1}' || true)"
  if [ "$installed_opencode" = "$supported_opencode" ]; then
    ready 'OpenCode' "$installed_opencode"
  else
    missing 'OpenCode version' "expected ${supported_opencode:-unknown}, got ${installed_opencode:-none}"
  fi
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
  missing 'ChatGPT/OpenAI auth' 'connect OpenAI in OpenCode using ChatGPT Plus/Pro'
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
  missing 'Ox/OpenRouter auth' 'OpenRouter credential is required for the Ox critic lane'
fi
if [ -f "$env_file" ] && grep -q '^OPENCODE_SERVER_PASSWORD=.' "$env_file"; then
  ready 'Web auth' 'server password configured'
else
  missing 'Web auth' 'OpenCode server password is not configured'
fi

if command -v claude >/dev/null 2>&1; then
  supported_claude="$(node -p "require('./config/agent-tools.json').claudeCode.version" 2>/dev/null || true)"
  installed_line="$(claude --version 2>/dev/null | head -n 1 || true)"
  installed_version="$(awk 'NR == 1 {print $1}' <<<"$installed_line")"
  if [ -n "$supported_claude" ] && [ "$installed_version" = "$supported_claude" ]; then
    ready 'Claude Code' "$installed_line"
  else
    optional 'Claude Code version' "installed ${installed_line:-unknown}; repository supports ${supported_claude:-unknown}; the review bridge will refuse version drift"
  fi

  if [ -n "${ANTHROPIC_API_KEY:-}${ANTHROPIC_AUTH_TOKEN:-}${ANTHROPIC_BASE_URL:-}${CLAUDE_CODE_USE_BEDROCK:-}${CLAUDE_CODE_USE_VERTEX:-}${CLAUDE_CODE_USE_FOUNDRY:-}" ]; then
    optional 'Claude billing boundary' 'a provider/API/endpoint override is set; the subscription-only bridge will refuse to run'
  else
    ready 'Claude billing boundary' 'no environment provider/API/endpoint override is active'
  fi
  optional 'Claude login verification' 'run `claude`, then /status, and confirm the Login method is the intended Claude.ai subscription'
  claude_settings="${CLAUDE_CONFIG_DIR:-${HOME}/.claude}/settings.json"
  if [ -f "$claude_settings" ] && node -e "const s=require(process.argv[1]); process.exit(s.env?.DISABLE_AUTOUPDATER === '1' ? 0 : 1)" "$claude_settings" 2>/dev/null; then
    ready 'Claude update boundary' 'DISABLE_AUTOUPDATER=1; reviewed central installer updates remain possible'
  else
    optional 'Claude update boundary' 'rerun cloud-conductor-claude-install.sh to merge DISABLE_AUTOUPDATER=1'
  fi
else
  optional 'Claude Code' 'install with scripts/agent-tools/cloud-conductor-claude-install.sh for the optional Claude lane'
fi

printf '\nMCP capability state\n--------------------\n'
if command -v opencode >/dev/null 2>&1; then
  if [ "$mcp_checks" = 'true' ]; then
    bash scripts/agent-tools/mcp-readiness.sh --connectivity
  else
    bash scripts/agent-tools/mcp-readiness.sh --config-only
  fi
else
  missing 'MCP inventory' 'OpenCode is required to validate configured MCP servers'
fi

if systemctl --user is-active --quiet predictor-conductor.service; then
  ready 'Conductor service' 'systemd user service is active'
else
  missing 'Conductor service' 'systemctl --user status predictor-conductor.service'
fi

status="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 3 http://127.0.0.1:4096/ || true)"
case "$status" in
  401) ready 'Local auth boundary' 'localhost:4096 requires HTTP Basic auth' ;;
  000) missing 'Local web endpoint' 'no response on localhost:4096' ;;
  2??) missing 'Local auth boundary' 'localhost:4096 answered without HTTP auth' ;;
  *) optional 'Local web endpoint' "unexpected unauthenticated HTTP status ${status}" ;;
esac

if command -v tailscale >/dev/null 2>&1 && tailscale status >/dev/null 2>&1; then
  ready 'Tailscale' 'host is joined to a tailnet'
else
  missing 'Tailscale' 'install/join Tailscale with sudo tailscale up'
fi
if command -v tailscale >/dev/null 2>&1 && tailscale serve status 2>/dev/null | grep -q '4096'; then
  ready 'Private web route' 'Tailscale Serve points to OpenCode'
else
  optional 'Private web route' 'run: sudo tailscale serve --bg 4096'
fi

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  ready 'GitHub CLI' 'authenticated for branch/PR workflows'
else
  optional 'GitHub CLI' 'run gh auth login if the Builder should push/create PRs'
fi

memory_kib="$(awk '/MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || true)"
if [ -n "$memory_kib" ]; then
  if [ "$memory_kib" -ge 7340032 ]; then
    ready 'Host capacity' 'about 8 GiB or more; suitable for browser/build verification'
  else
    optional 'Host capacity' 'orchestration is fine; use about 8 GiB before heavy Playwright/build work'
  fi
fi

if [ "$live_checks" = 'true' ]; then
  printf '\nLive provider smoke\n-------------------\n'
  ox_output="$(timeout 90 bash scripts/agent-tools/ox-review.sh 'Transport smoke only. Reply with exactly OX_MODEL_OK and nothing else.' 2>&1 || true)"
  if grep -q 'OX_MODEL_OK' <<<"$ox_output"; then
    ready 'Ox live review bridge' 'direct read-only Ox response received'
  else
    missing 'Ox live review bridge' 'no OX_MODEL_OK response; inspect the bridge/provider without printing secrets'
    printf '%s\n' "$ox_output" | tail -n 8
  fi
fi

printf '\nCost posture: direct ChatGPT subscription + Ox are the default lanes; Claude is optional and subscription-only; paid APIs are not automatic fallbacks.\n'
if [ "$live_checks" = 'false' ]; then
  printf 'Provider requests: none. Re-run with --live for one tiny Ox transport smoke.\n'
else
  printf 'Provider requests: one Ox transport smoke; Claude was not called.\n'
fi
if [ "$mcp_checks" = 'false' ]; then
  printf 'MCP network: not checked. Re-run with --mcp for initialize/tools-list only.\n'
fi
printf 'Summary: %s ready, %s optional, %s missing\n' "$ready_count" "$optional_count" "$missing_count"
if [ "$missing_count" -gt 0 ]; then
  exit 1
fi
