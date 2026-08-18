#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:${PATH}"

tool_dir="${HOME}/.local/share/predictor-agent-tools/mcp-agent-mail"
port="$(node -p "require('./config/agent-tools.json').agentMail.port")"
python_version="$(node -p "require('./config/agent-tools.json').agentMail.python")"

if [ ! -d "${tool_dir}/.git" ]; then
  echo 'MCP Agent Mail is not installed. Run scripts/agent-tools/install-agent-mail.sh first.' >&2
  exit 1
fi

export HTTP_HOST=127.0.0.1
export HTTP_PORT="$port"
export HTTP_ALLOW_LOCALHOST_UNAUTHENTICATED=true

printf 'Starting MCP Agent Mail on http://127.0.0.1:%s/mcp/\n' "$port"
printf 'Codespaces keeps the forwarded port private by default; do not make it public without configuring bearer authentication.\n'
cd "$tool_dir"
exec uv run --python "$python_version" python -m mcp_agent_mail.cli serve-http
