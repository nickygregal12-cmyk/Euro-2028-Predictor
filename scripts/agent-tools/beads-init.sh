#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:${PATH}"

if ! command -v bd >/dev/null 2>&1; then
  echo 'Beads is not installed. Run scripts/agent-tools/bootstrap.sh first.' >&2
  exit 1
fi

# Stealth mode is deliberate: GitHub issues/PRs and repository specs remain the
# durable collaboration record. Beads is local execution memory unless a later,
# explicit repository decision promotes it.
bd init --stealth --quiet
printf 'Beads local task memory initialised in stealth mode.\n'
printf 'Use: bd prime, bd ready, bd show <id>, bd remember "insight".\n'
