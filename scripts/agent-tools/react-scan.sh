#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

url="${1:-http://127.0.0.1:5173}"
version="$(node -p "require('./config/agent-tools.json').reactScan.version")"

printf 'Starting React Scan %s against %s\n' "$version" "$url"
printf 'This is manual diagnosis only; it does not alter the application bundle.\n'
exec npx -y "react-scan@${version}" "$url"
