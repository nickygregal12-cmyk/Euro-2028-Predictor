#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

export PATH="${HOME}/.local/bin:${PATH}"

check_command() {
  local command_name="$1"
  local label="$2"
  if command -v "$command_name" >/dev/null 2>&1; then
    printf 'READY    %-18s %s\n' "$label" "$(command -v "$command_name")"
  else
    printf 'MISSING  %-18s run scripts/agent-tools/bootstrap.sh\n' "$label"
  fi
}

printf 'Predictor developer toolchain\n'
printf '=============================\n'
check_command graphify Graphify
check_command omniroute OmniRoute
check_command serena Serena
check_command specify 'Spec Kit'
check_command ast-grep ast-grep
check_command bd Beads

printf '\nOn-demand tools (pinned in config/agent-tools.json; npx installs only when invoked):\n'
node - <<'NODE'
const tools = require('./config/agent-tools.json')
for (const key of ['context7', 'dependencyCruiser', 'repomix', 'lostPixel', 'reactScan']) {
  const tool = tools[key]
  console.log(`ON-DEMAND ${key.padEnd(18)} ${tool.package}@${tool.version}`)
}
for (const key of ['agentMail', 'weave', 'mergiraf']) {
  const tool = tools[key]
  console.log(`OPTIONAL  ${key.padEnd(18)} ${tool.version} (${tool.mode})`)
}
NODE

printf '\nNo service is started by this command. See docs/ops/developer-toolchain.md for activation rules.\n'
