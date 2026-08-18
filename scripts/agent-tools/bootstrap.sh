#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

read_tool_value() {
  local expression="$1"
  node -e "const c=require('./config/agent-tools.json'); process.stdout.write(String(${expression}))"
}

uv_version="$(read_tool_value 'c.uv.version')"
graphify_version="$(read_tool_value 'c.graphify.version')"
omniroute_version="$(read_tool_value 'c.omniroute.version')"
serena_version="$(read_tool_value 'c.serena.version')"
serena_python="$(read_tool_value 'c.serena.python')"
spec_kit_version="$(read_tool_value 'c.specKit.version')"
spec_kit_python="$(read_tool_value 'c.specKit.python')"
ast_grep_version="$(read_tool_value 'c.astGrep.version')"
beads_version="$(read_tool_value 'c.beads.version')"

tool_home="${HOME}/.local/share/predictor-agent-tools"
bin_home="${HOME}/.local/bin"
graphify_venv="${tool_home}/graphify"

mkdir -p "$tool_home" "$bin_home"
export PATH="${bin_home}:${PATH}"

printf 'Preparing Predictor dependencies...\n'
npm ci

printf 'Installing uv %s as the isolated Python-tool manager...\n' "$uv_version"
python -m pip install --disable-pip-version-check --quiet --user "uv==${uv_version}"

printf 'Installing Graphify %s in an isolated Python environment...\n' "$graphify_version"
python -m venv "$graphify_venv"
"${graphify_venv}/bin/python" -m pip install --disable-pip-version-check --quiet \
  "graphifyy[sql,openai]==${graphify_version}"
ln -sfn "${graphify_venv}/bin/graphify" "${bin_home}/graphify"

printf 'Installing Serena %s with its own Python %s runtime...\n' "$serena_version" "$serena_python"
uv python install "$serena_python"
uv tool install --force --python "$serena_python" "serena-agent==${serena_version}"

printf 'Installing Spec Kit %s as an execution adapter (repository authorities stay canonical)...\n' "$spec_kit_version"
uv tool install --force --python "$spec_kit_python" "specify-cli==${spec_kit_version}"

printf 'Installing Node-based developer CLIs under ~/.local...\n'
npm install --global --prefix "${HOME}/.local" --no-fund --no-audit \
  "omniroute@${omniroute_version}" \
  "@ast-grep/cli@${ast_grep_version}" \
  "@beads/bd@${beads_version}"

printf '\nBaseline developer tooling is ready. No service was started, no Beads database was initialised, and no provider credential was configured.\n'
"${graphify_venv}/bin/python" - <<'PY'
from importlib.metadata import version
print(f"Graphify: {version('graphifyy')}")
PY
"${bin_home}/omniroute" --version || true
"${bin_home}/ast-grep" --version || true
"${bin_home}/bd" version || true
"${bin_home}/serena" --help >/dev/null
"${bin_home}/specify" version || true
printf '\nNext: run scripts/agent-tools/doctor.sh and read docs/ops/developer-toolchain.md.\n'
