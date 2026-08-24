#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"
export DISABLE_AUTOUPDATER=1

if [ "$(id -u)" -eq 0 ]; then
  printf 'Run this as the normal development user, not root.\n' >&2
  exit 1
fi

version="$(node -p "require('./config/agent-tools.json').claudeCode.version")"
if [ -z "$version" ]; then
  printf 'config/agent-tools.json has no claudeCode.version.\n' >&2
  exit 1
fi

for variable in \
  ANTHROPIC_API_KEY \
  ANTHROPIC_AUTH_TOKEN \
  ANTHROPIC_BASE_URL \
  CLAUDE_CODE_USE_BEDROCK \
  CLAUDE_CODE_USE_VERTEX \
  CLAUDE_CODE_USE_FOUNDRY; do
  if [ -n "${!variable:-}" ]; then
    printf '%s is set. Unset provider/API overrides before configuring the subscription-only Claude lane.\n' "$variable" >&2
    exit 1
  fi
done

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
installer="${temp_dir}/claude-install.sh"

printf 'Downloading the official Claude Code installer...\n'
curl --fail --silent --show-error --location https://claude.ai/install.sh -o "$installer"
chmod 700 "$installer"

printf 'Installing repository-supported Claude Code %s...\n' "$version"
bash "$installer" "$version"

# Claude's native installer can auto-update unless this user setting is present.
# Merge rather than replace so operator-owned Claude settings survive reruns.
node scripts/agent-tools/configure-claude-settings.mjs "${CLAUDE_CONFIG_DIR:-${HOME}/.claude}/settings.json"

export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"
if ! command -v claude >/dev/null 2>&1; then
  printf 'Claude Code installed but `claude` is not on PATH. Add ~/.local/bin to PATH and retry.\n' >&2
  exit 1
fi

installed_version="$(claude --version 2>/dev/null | awk 'NR == 1 {print $1}' || true)"
if [ "$installed_version" != "$version" ]; then
  printf 'Claude Code version check failed: expected %s, got %s\n' "$version" "${installed_version:-unknown}" >&2
  exit 1
fi

cat <<EOF

Claude Code ${version} is installed.
Automatic client updates are disabled in the merged user settings. Reviewed
updates remain available by raising the central pin and rerunning this installer.

Authenticate it with your existing Claude.ai Pro/Max subscription:
  claude

On first launch, follow the browser login. From an SSH session Claude may show a
login code instead of redirecting to localhost; paste that code back into the
terminal when prompted. Inside Claude, run `/status` once and confirm the Login
method is the intended Claude.ai subscription, then exit.

Keep ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL and the
Bedrock/Vertex/Foundry provider switches unset for this lane. The tracked bridge
fails closed if any of those overrides are present.

After login, run:
  bash scripts/agent-tools/cloud-conductor-doctor.sh
EOF
