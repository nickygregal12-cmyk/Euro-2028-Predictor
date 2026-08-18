#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

version="$(node -p "require('./config/agent-tools.json').dependencyCruiser.version")"

printf 'Checking application dependency contracts with dependency-cruiser %s...\n' "$version"
exec npx -y "dependency-cruiser@${version}" \
  --config .dependency-cruiser.cjs \
  --output-type err-long \
  src
