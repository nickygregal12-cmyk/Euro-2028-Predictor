#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"

if [ "$(id -u)" -eq 0 ]; then
  printf 'Run this as the normal development user, not root.\n' >&2
  exit 1
fi

version="$(node -p "require('./config/agent-tools.json').claudeCode.version")"
if [ -z "$version" ]; then
  printf 'config/agent-tools.json has no claudeCode.version.\n' >&2
  exit 1
fi

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  printf 'ANTHROPIC_API_KEY is set. Unset it before configuring the subscription-only Claude lane.\n' >&2
  exit 1
fi

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
installer="${temp_dir}/claude-install.sh"

printf 'Downloading the official Claude Code installer...\n'
curl --fail --silent --show-error --location https://claude.ai/install.sh -o "$installer"
chmod 700 "$installer"

printf 'Installing repository-supported Claude Code %s...\n' "$version"
bash "$installer" "$version"

export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"
if ! command -v claude >/dev/null 2>&1; then
  printf 'Claude Code installed but `claude` is not on PATH. Add ~/.local/bin to PATH and retry.\n' >&2
  exit 1
fi

installed="$(claude --version 2>/dev/null | head -n 1 || true)"
if ! grep -q "$version" <<<"$installed"; then
  printf 'Claude Code version check failed: expected %s, got %s\n' "$version" "${installed:-unknown}" >&2
  exit 1
fi

cat <<EOF

Claude Code ${version} is installed.

Authenticate it with your existing Claude subscription:
  claude auth login

Then verify:
  claude auth status --text

Do not use `claude auth login --console` for this lane and keep ANTHROPIC_API_KEY
unset if you want subscription usage rather than API billing.

After login, run:
  bash scripts/agent-tools/cloud-conductor-doctor.sh --live
EOF
