#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

version="$(node -p "require('./config/agent-tools.json').lostPixel.version")"

printf 'Building deterministic Storybook for Lost Pixel OSS %s...\n' "$version"
npm run build:storybook
printf 'Generating optional Lost Pixel screenshots. This is not the blocking visual contract.\n'
npx -y "lost-pixel@${version}"
