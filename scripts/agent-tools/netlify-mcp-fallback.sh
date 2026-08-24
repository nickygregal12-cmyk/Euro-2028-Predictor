#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
package="$(node -p "const t=require('./config/agent-tools.json').netlifyMcp; t.package+'@'+t.version")"

if [ "${1:-}" != '--stdio' ]; then
  cat <<EOF
Netlify remote MCP is primary. A provider 5xx means UNAVAILABLE, not invalid auth.
No automatic failover will run. If an operator explicitly chooses the local
fallback, connect a client that allowlists only the proven read tool
netlify-deploy-services-reader, then run:
  bash scripts/agent-tools/netlify-mcp-fallback.sh --stdio
Prepared exact package: ${package}
EOF
  exit 0
fi

printf 'Starting the explicit Netlify stdio fallback (%s). No tool is invoked by this wrapper.\n' "$package" >&2
exec npx -y "$package"
