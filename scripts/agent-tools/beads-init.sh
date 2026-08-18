#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:${PATH}"
export BD_DISABLE_METRICS=1
export DOLT_DISABLE_EVENT_FLUSH=1

if ! command -v bd >/dev/null 2>&1; then
  echo 'Beads is not installed. Run scripts/agent-tools/bootstrap.sh first.' >&2
  exit 1
fi

# Stealth mode is deliberate: GitHub issues/PRs and repository specs remain the
# durable collaboration record. Beads is local execution memory unless a later,
# explicit repository decision promotes it. Metrics and Dolt event flushing are
# disabled above so that local memory does not introduce an outbound telemetry path.
bd init --stealth --quiet
printf 'Beads local task memory initialised in stealth mode with metrics disabled.\n'
printf 'Use: bd prime, bd ready, bd show <id>, bd remember "insight".\n'
