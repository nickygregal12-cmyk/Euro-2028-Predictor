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
is intentionally read-only and refuses to run when ANTHROPIC_API_KEY is set so
an existing Claude subscription is not silently replaced by API billing.
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

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  printf 'Refusing Claude review because ANTHROPIC_API_KEY is set. Unset it and use Claude subscription authentication instead.\n' >&2
  exit 1
fi

if ! claude auth status >/dev/null 2>&1; then
  printf 'Claude Code is not authenticated. Run `claude auth login` and choose the Claude subscription account, not Console/API billing.\n' >&2
  exit 1
fi

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
