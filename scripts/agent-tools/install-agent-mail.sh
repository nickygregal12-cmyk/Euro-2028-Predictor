#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:${PATH}"

version="$(node -p "require('./config/agent-tools.json').agentMail.version")"
python_version="$(node -p "require('./config/agent-tools.json').agentMail.python")"
tool_dir="${HOME}/.local/share/predictor-agent-tools/mcp-agent-mail"

if ! command -v uv >/dev/null 2>&1; then
  echo 'uv is not installed. Run scripts/agent-tools/bootstrap.sh first.' >&2
  exit 1
fi

uv python install "$python_version"

if [ -d "${tool_dir}/.git" ]; then
  git -C "$tool_dir" fetch --tags --force origin
else
  rm -rf "$tool_dir"
  git clone --filter=blob:none --no-checkout https://github.com/Dicklesworthstone/mcp_agent_mail.git "$tool_dir"
fi

git -C "$tool_dir" checkout --detach "v${version}"
(
  cd "$tool_dir"
  uv sync --frozen --python "$python_version"
)

printf 'MCP Agent Mail %s installed at %s.\n' "$version" "$tool_dir"
printf 'It was not started, no shell aliases were added, and its upstream auto-installer was not run.\n'
printf 'Start deliberately with scripts/agent-tools/agent-mail.sh.\n'
