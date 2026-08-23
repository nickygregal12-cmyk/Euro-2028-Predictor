#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

# Beads command metrics and its Dolt dependency's event flush are disabled for
# the supported Predictor toolchain. Local execution memory must not create an
# implicit outbound telemetry path simply because a CLI is invoked.
export BD_DISABLE_METRICS=1
export DOLT_DISABLE_EVENT_FLUSH=1

read_tool_value() {
  local expression="$1"
  node -e "const c=require('./config/agent-tools.json'); process.stdout.write(String(${expression}))"
}

install_beads_release() {
  local version="$1"
  local os arch archive base_url temp_dir expected actual bd_path

  case "$(uname -s)" in
    Linux) os="linux" ;;
    Darwin) os="darwin" ;;
    FreeBSD) os="freebsd" ;;
    *)
      printf 'Unsupported Beads platform: %s\n' "$(uname -s)" >&2
      return 1
      ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)
      printf 'Unsupported Beads architecture: %s\n' "$(uname -m)" >&2
      return 1
      ;;
  esac

  archive="beads_${version}_${os}_${arch}.tar.gz"
  base_url="https://github.com/gastownhall/beads/releases/download/v${version}"
  temp_dir="$(mktemp -d)"

  curl --fail --silent --show-error --location \
    "${base_url}/${archive}" -o "${temp_dir}/${archive}"
  curl --fail --silent --show-error --location \
    "${base_url}/checksums.txt" -o "${temp_dir}/checksums.txt"

  expected="$(awk -v file="$archive" '$2 == file || $2 == "*" file {print $1; exit}' "${temp_dir}/checksums.txt")"
  if [[ ! "$expected" =~ ^[0-9a-fA-F]{64}$ ]]; then
    printf 'No trusted checksum entry found for Beads asset %s.\n' "$archive" >&2
    rm -rf "$temp_dir"
    return 1
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "${temp_dir}/${archive}" | awk '{print $1}')"
  else
    actual="$(shasum -a 256 "${temp_dir}/${archive}" | awk '{print $1}')"
  fi

  if [ "${actual,,}" != "${expected,,}" ]; then
    printf 'Checksum mismatch for Beads %s: expected %s, got %s.\n' \
      "$version" "$expected" "$actual" >&2
    rm -rf "$temp_dir"
    return 1
  fi

  tar -xzf "${temp_dir}/${archive}" -C "$temp_dir"
  bd_path="$(find "$temp_dir" -type f -name bd -perm -u+x -print -quit)"
  if [ -z "$bd_path" ]; then
    bd_path="$(find "$temp_dir" -type f -name bd -print -quit)"
  fi
  if [ -z "$bd_path" ]; then
    printf 'Verified Beads archive %s did not contain bd.\n' "$archive" >&2
    rm -rf "$temp_dir"
    return 1
  fi

  install -m 0755 "$bd_path" "${bin_home}/bd"
  rm -rf "$temp_dir"
}

uv_version="$(read_tool_value 'c.uv.version')"
graphify_version="$(read_tool_value 'c.graphify.version')"
omniroute_version="$(read_tool_value 'c.omniroute.version')"
opencode_version="$(read_tool_value 'c.opencode.version')"
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
  "opencode-ai@${opencode_version}" \
  "@ast-grep/cli@${ast_grep_version}"

printf 'Installing Beads %s from the checksum-verified GitHub release...\n' "$beads_version"
install_beads_release "$beads_version"

printf '\nBaseline developer tooling is ready. No service was started, no Beads database was initialised, and no provider credential was configured.\n'
"${graphify_venv}/bin/python" - <<'PY'
from importlib.metadata import version
print(f"Graphify: {version('graphifyy')}")
PY
"${bin_home}/omniroute" --version || true
"${bin_home}/opencode" --version || true
"${bin_home}/ast-grep" --version || true
"${bin_home}/bd" version || true
"${bin_home}/serena" --help >/dev/null
"${bin_home}/specify" version || true
printf '\nNext: run scripts/agent-tools/doctor.sh and read docs/ops/developer-toolchain.md.\n'
