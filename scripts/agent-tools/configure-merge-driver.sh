#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:${PATH}"

choice="${1:-}"
attributes_file=".git/info/attributes"
mkdir -p .git/info

clean_predictor_merge_attributes() {
  [ -f "$attributes_file" ] || return 0
  local tmp
  tmp="$(mktemp)"
  grep -vE 'merge=(weave|mergiraf)([[:space:]]|$)' "$attributes_file" > "$tmp" || true
  mv "$tmp" "$attributes_file"
}

clear_merge_configs() {
  git config --local --unset-all merge.weave.name >/dev/null 2>&1 || true
  git config --local --unset-all merge.weave.driver >/dev/null 2>&1 || true
  git config --local --unset-all merge.mergiraf.name >/dev/null 2>&1 || true
  git config --local --unset-all merge.mergiraf.driver >/dev/null 2>&1 || true
}

case "$choice" in
  weave)
    command -v weave >/dev/null 2>&1 && command -v weave-driver >/dev/null 2>&1 || {
      echo 'Weave is not installed. Run scripts/agent-tools/install-merge-tools.sh.' >&2
      exit 1
    }
    clean_predictor_merge_attributes
    clear_merge_configs
    weave setup --local
    echo 'Weave enabled for this clone only. No tracked .gitattributes file was changed.'
    ;;
  mergiraf)
    command -v mergiraf >/dev/null 2>&1 || {
      echo 'Mergiraf is not installed. Run scripts/agent-tools/install-merge-tools.sh.' >&2
      exit 1
    }
    clean_predictor_merge_attributes
    clear_merge_configs
    git config --local merge.mergiraf.name 'Mergiraf syntax-aware merge'
    git config --local merge.mergiraf.driver 'mergiraf merge --git %O %A %B -s %S -x %X -y %Y -p %P -l %L'
    printf '* merge=mergiraf\n' >> "$attributes_file"
    echo 'Mergiraf enabled for this clone only. Unsupported file types fall back to Git.'
    ;;
  off)
    clean_predictor_merge_attributes
    clear_merge_configs
    echo 'Predictor semantic merge drivers disabled for this clone.'
    ;;
  *)
    echo 'Usage: scripts/agent-tools/configure-merge-driver.sh weave|mergiraf|off' >&2
    exit 2
    ;;
esac
