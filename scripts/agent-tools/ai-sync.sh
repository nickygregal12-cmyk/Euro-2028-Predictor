#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: bash scripts/agent-tools/ai-sync.sh core|test|observability\n' >&2
}

profile="${1:-}"
case "${profile}" in
  core|test|observability) ;;
  *) usage; exit 2 ;;
esac

repository_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf '%s\n' 'AI sync: run this command from a Git checkout.' >&2
  exit 1
}
cd "${repository_root}"

uv_version="$(node -p "require('./config/agent-tools.json').uv.version")"
[ -n "${uv_version}" ] || {
  printf '%s\n' 'AI sync: config/agent-tools.json has no uv version.' >&2
  exit 1
}

python -m pip install --disable-pip-version-check --quiet "uv==${uv_version}"

sync_groups=()
case "${profile}" in
  test) sync_groups=(--group test --group analytics) ;;
  observability) sync_groups=(--group test --group observability) ;;
esac

uv sync --directory ai --locked "${sync_groups[@]}"

if [ -n "${GITHUB_PATH:-}" ]; then
  printf '%s\n' "${repository_root}/ai/.venv/bin" >> "${GITHUB_PATH}"
fi

printf 'AI sync: profile=%s uv=%s lock=ai/uv.lock\n' "${profile}" "${uv_version}"

