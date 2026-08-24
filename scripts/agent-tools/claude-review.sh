#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/agent-tools/claude-review.sh "REVIEW TASK"

Runs the official Claude Code client non-interactively in plan mode. The bridge
is intentionally read-only and refuses provider/API environment overrides so a
Claude.ai subscription review cannot silently become API or cloud-provider billing.
EOF
}

if [ "$#" -lt 1 ]; then
  usage >&2
  exit 2
fi

if ! command -v claude >/dev/null 2>&1; then
  printf 'Claude Code is not installed. Run: bash scripts/agent-tools/cloud-conductor-claude-install.sh\n' >&2
  exit 1
fi

for variable in \
  ANTHROPIC_API_KEY \
  ANTHROPIC_AUTH_TOKEN \
  CLAUDE_CODE_USE_BEDROCK \
  CLAUDE_CODE_USE_VERTEX \
  CLAUDE_CODE_USE_FOUNDRY; do
  if [ -n "${!variable:-}" ]; then
    printf 'Refusing Claude review because %s is set. Unset provider/API overrides and use Claude.ai subscription OAuth instead.\n' "$variable" >&2
    exit 1
  fi
done

claude_config_dir="${CLAUDE_CONFIG_DIR:-${HOME}/.claude}"
credential_file="${claude_config_dir}/.credentials.json"
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  if [ ! -f "$credential_file" ]; then
    printf 'Claude Code has no local OAuth credential. Run `claude`, complete the browser login with the Claude.ai subscription account, and use `/status` once to confirm the login method.\n' >&2
    exit 1
  fi
  credential_mode="$(stat -c '%a' "$credential_file" 2>/dev/null || true)"
  if [ "$credential_mode" != '600' ]; then
    printf 'Refusing Claude review because %s is not mode 0600. Fix the credential-file permissions before use.\n' "$credential_file" >&2
    exit 1
  fi
fi

for settings_file in \
  "${claude_config_dir}/settings.json" \
  "${repo_root}/.claude/settings.json" \
  "${repo_root}/.claude/settings.local.json"; do
  if [ -f "$settings_file" ] && grep -q '"apiKeyHelper"' "$settings_file"; then
    printf 'Refusing Claude review because apiKeyHelper is configured in %s and can override subscription OAuth.\n' "$settings_file" >&2
    exit 1
  fi
done

review_task="$*"
prompt="$(cat <<EOF
You are an independent read-only specialist reviewing the Predictor repository.
Read root AGENTS.md and NOW.md first, then follow the repository's deterministic
routing/context rules. Inspect only the authority, source, tests and diff needed
for the task. Do not edit files, commit, push, create a PR, mutate hosted state,
read .env files, request secrets, or treat model consensus as repository truth.
Return concrete findings with exact evidence and explicitly distinguish proven
issues from hypotheses.

Review task:
${review_task}
EOF
)"

exec claude -p --permission-mode plan "$prompt"
