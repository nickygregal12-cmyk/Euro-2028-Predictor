#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:${PATH}"

if ! command -v cargo >/dev/null 2>&1; then
  echo 'Rust/cargo is required. Rebuild the Codespace from the repository devcontainer first.' >&2
  exit 1
fi

mergiraf_version="$(node -p "require('./config/agent-tools.json').mergiraf.version")"
weave_version="$(node -p "require('./config/agent-tools.json').weave.version")"
weave_dir="${HOME}/.local/share/predictor-agent-tools/weave"

printf 'Installing Mergiraf %s...\n' "$mergiraf_version"
cargo install --locked --force --root "${HOME}/.local" mergiraf --version "$mergiraf_version"

printf 'Installing Weave %s from its exact release tag...\n' "$weave_version"
if [ -d "${weave_dir}/.git" ]; then
  git -C "$weave_dir" fetch --tags --force origin
else
  rm -rf "$weave_dir"
  git clone --filter=blob:none --no-checkout https://github.com/Ataraxy-Labs/weave.git "$weave_dir"
fi
git -C "$weave_dir" checkout --detach "v${weave_version}"
(
  cd "$weave_dir"
  cargo install --locked --force --root "${HOME}/.local" --path crates/weave-cli
  cargo install --locked --force --root "${HOME}/.local" --path crates/weave-driver
)

printf 'Installed both merge engines. Neither has been enabled for this repository.\n'
printf 'Choose deliberately with scripts/agent-tools/configure-merge-driver.sh weave|mergiraf|off.\n'
