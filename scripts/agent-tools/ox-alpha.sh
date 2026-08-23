#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

export PATH="${HOME}/.local/bin:${PATH}"

model="openrouter/stealth/ox-alpha"

if ! command -v opencode >/dev/null 2>&1; then
  printf 'OpenCode is not installed. Run: bash scripts/agent-tools/bootstrap.sh\n' >&2
  exit 1
fi

if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  cat >&2 <<'EOF'
OPENROUTER_API_KEY is not available in this environment.

Store it as a GitHub Codespaces secret named OPENROUTER_API_KEY and grant this
repository access. Then stop/restart the Codespace so GitHub injects the secret
as an environment variable. Never commit the key to this repository.
EOF
  exit 1
fi

printf 'Launching OpenCode with Ox Alpha through OpenRouter.\n'
printf 'Model: %s\n' "$model"
printf 'Repository authorities remain canonical: read AGENTS.md and NOW.md before editing.\n\n'

exec opencode --model "$model" "$@"
