#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

profile="${1:-core}"
version="$(node -p "require('./config/agent-tools.json').repomix.version")"
mkdir -p .artifacts/context

case "$profile" in
  core)
    include='AGENTS.md,NOW.md,.agents/skills/**,config/**,docs/adr/**,docs/architecture/**,docs/ops/**,src/domain/**,src/services/**,tests/domain/**,tests/services/**'
    ;;
  vnext)
    include='AGENTS.md,NOW.md,.agents/skills/**,docs/product/**,src/vnext/**,tests/vnext/**,e2e/vnext-*.spec.ts'
    ;;
  backend)
    include='AGENTS.md,NOW.md,config/**,docs/adr/**,docs/architecture/**,docs/ops/**,src/services/**,src/domain/**,supabase/migrations/**,tests/database/**,tests/services/**'
    ;;
  all)
    include='**/*'
    ;;
  *)
    echo "Unknown profile: ${profile}. Use core, vnext, backend or all." >&2
    exit 2
    ;;
esac

output=".artifacts/context/${profile}.xml"
npx -y "repomix@${version}" \
  --config repomix.config.json \
  --include "$include" \
  --compress \
  --output "$output"

printf 'Context pack: %s\n' "$output"
