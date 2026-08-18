#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

read_tool_value() {
  local expression="$1"
  node -e "const c=require('./config/agent-tools.json'); process.stdout.write(String(${expression}))"
}

graphify_version="$(read_tool_value 'c.graphify.version')"
omniroute_version="$(read_tool_value 'c.omniroute.version')"

tool_home="${HOME}/.local/share/predictor-agent-tools"
bin_home="${HOME}/.local/bin"
graphify_venv="${tool_home}/graphify"

mkdir -p "$tool_home" "$bin_home"

printf 'Preparing Predictor dependencies...\n'
npm ci

printf 'Installing Graphify %s in an isolated Python environment...\n' "$graphify_version"
python -m venv "$graphify_venv"
"${graphify_venv}/bin/python" -m pip install --disable-pip-version-check --quiet \
  "graphifyy[sql,openai]==${graphify_version}"
ln -sfn "${graphify_venv}/bin/graphify" "${bin_home}/graphify"

printf 'Installing OmniRoute %s under ~/.local...\n' "$omniroute_version"
npm install --global --prefix "${HOME}/.local" --no-fund --no-audit \
  "omniroute@${omniroute_version}"

printf '\nAgent tooling ready. Nothing has been started and no provider credential has been configured.\n'
"${graphify_venv}/bin/python" - <<'PY'
from importlib.metadata import version
print(f"Graphify: {version('graphifyy')}")
PY
"${bin_home}/omniroute" --version || true
printf '\nNext: see docs/ops/graphify-navigation.md and docs/ops/omniroute-agent-routing.md.\n'
