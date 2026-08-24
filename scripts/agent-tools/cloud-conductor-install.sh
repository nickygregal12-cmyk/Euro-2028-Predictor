#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

if [ "$(id -u)" -eq 0 ]; then
  printf 'Run this as the normal development user, not root. The script uses sudo only for host packages.\n' >&2
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1 || ! sudo -n true 2>/dev/null; then
  printf 'This installer needs a user with sudo access. Run sudo once, then re-run the installer.\n' >&2
  exit 1
fi

if [ ! -r /etc/os-release ]; then
  printf 'Cannot identify the host OS. Ubuntu 24.04 LTS is the supported persistent-cloud host.\n' >&2
  exit 1
fi

# shellcheck disable=SC1091
source /etc/os-release
if [ "${ID:-}" != "ubuntu" ] || [ "${VERSION_CODENAME:-}" != "noble" ]; then
  printf 'Unsupported host: %s %s. Use Ubuntu 24.04 LTS (noble).\n' "${ID:-unknown}" "${VERSION_CODENAME:-unknown}" >&2
  exit 1
fi

printf 'Installing host prerequisites...\n'
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential ca-certificates curl git gh jq openssl python3 python3-pip python3-venv xz-utils

node_version="$(python3 - <<'PY'
import json
from pathlib import Path
print(json.loads(Path('package.json').read_text())['engines']['node'])
PY
)"

install_node() {
  local arch node_arch archive temp_dir prefix
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) node_arch="x64" ;;
    aarch64|arm64) node_arch="arm64" ;;
    *)
      printf 'Unsupported architecture for Node install: %s\n' "$arch" >&2
      return 1
      ;;
  esac

  archive="node-v${node_version}-linux-${node_arch}.tar.xz"
  temp_dir="$(mktemp -d)"
  prefix="/opt/predictor-node-v${node_version}"

  printf 'Installing repository Node %s from nodejs.org with upstream checksum verification...\n' "$node_version"
  curl --fail --silent --show-error --location \
    "https://nodejs.org/dist/v${node_version}/${archive}" -o "${temp_dir}/${archive}"
  curl --fail --silent --show-error --location \
    "https://nodejs.org/dist/v${node_version}/SHASUMS256.txt" -o "${temp_dir}/SHASUMS256.txt"

  (
    cd "$temp_dir"
    grep "  ${archive}$" SHASUMS256.txt | sha256sum --check --strict -
  )

  sudo rm -rf "$prefix"
  sudo mkdir -p "$prefix"
  sudo tar -xJf "${temp_dir}/${archive}" --strip-components=1 -C "$prefix"
  for executable in node npm npx corepack; do
    sudo ln -sfn "${prefix}/bin/${executable}" "/usr/local/bin/${executable}"
  done
  rm -rf "$temp_dir"
}

current_node="$(node --version 2>/dev/null | sed 's/^v//' || true)"
if [ "$current_node" != "$node_version" ]; then
  install_node
fi

if [ "$(node --version | sed 's/^v//')" != "$node_version" ]; then
  printf 'Node installation did not resolve to repository version %s.\n' "$node_version" >&2
  exit 1
fi

if ! command -v tailscale >/dev/null 2>&1; then
  printf 'Installing Tailscale from its signed Ubuntu Noble repository...\n'
  sudo mkdir -p --mode=0755 /usr/share/keyrings
  curl --fail --silent --show-error --location \
    https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg \
    -o "${TMPDIR:-/tmp}/tailscale-archive-keyring.gpg"
  sudo install -m 0644 "${TMPDIR:-/tmp}/tailscale-archive-keyring.gpg" \
    /usr/share/keyrings/tailscale-archive-keyring.gpg
  rm -f "${TMPDIR:-/tmp}/tailscale-archive-keyring.gpg"
  curl --fail --silent --show-error --location \
    https://pkgs.tailscale.com/stable/ubuntu/noble.tailscale-keyring.list \
    -o "${TMPDIR:-/tmp}/tailscale.list"
  sudo install -m 0644 "${TMPDIR:-/tmp}/tailscale.list" /etc/apt/sources.list.d/tailscale.list
  rm -f "${TMPDIR:-/tmp}/tailscale.list"
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y tailscale
fi

printf 'Provisioning the repository-pinned developer toolchain...\n'
bash scripts/agent-tools/bootstrap.sh
printf 'Provisioning the shared browser runtime used by Visual QA MCPs...\n'
bash scripts/agent-tools/cloud-browser-install.sh

config_dir="${HOME}/.config/predictor-cloud"
env_file="${config_dir}/opencode.env"
service_dir="${HOME}/.config/systemd/user"
service_file="${service_dir}/predictor-conductor.service"
mkdir -p "$config_dir" "$service_dir"
chmod 700 "$config_dir"

# This key is for the default free Ox Alpha critic lane. GPT work deliberately
# uses the direct OpenAI/ChatGPT authentication stored by OpenCode, not this key.
openrouter_key="${OPENROUTER_API_KEY:-}"
if [ -z "$openrouter_key" ] && [ -f "$env_file" ]; then
  openrouter_key="$(sed -n 's/^OPENROUTER_API_KEY=//p' "$env_file" | head -n 1)"
fi
if [ -z "$openrouter_key" ]; then
  if [ ! -t 0 ]; then
    printf 'OPENROUTER_API_KEY is required for the Ox Alpha critic. Re-run interactively or export it for this install command.\n' >&2
    exit 1
  fi
  read -r -s -p 'Paste the scoped OPENROUTER_API_KEY for Ox Alpha (input is hidden): ' openrouter_key
  printf '\n'
fi
if [ -z "$openrouter_key" ]; then
  printf 'OPENROUTER_API_KEY cannot be empty.\n' >&2
  exit 1
fi

server_password="${OPENCODE_SERVER_PASSWORD:-}"
if [ -z "$server_password" ] && [ -f "$env_file" ]; then
  server_password="$(sed -n 's/^OPENCODE_SERVER_PASSWORD=//p' "$env_file" | head -n 1)"
fi
if [ -z "$server_password" ]; then
  server_password="$(openssl rand -hex 24)"
fi

github_mcp_token="${GITHUB_MCP_TOKEN:-}"
if [ -z "$github_mcp_token" ] && command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  # Capture the existing host credential without printing it or putting it in a
  # prompt/command argument. GitHub MCP remains server-side read-only.
  github_mcp_token="$(gh auth token 2>/dev/null || true)"
fi

umask 077
export OPENROUTER_API_KEY="$openrouter_key"
export OPENCODE_SERVER_USERNAME='predictor'
export OPENCODE_SERVER_PASSWORD="$server_password"
if [ -n "$github_mcp_token" ]; then
  export GITHUB_MCP_TOKEN="$github_mcp_token"
fi
node scripts/agent-tools/merge-cloud-env.mjs "$env_file"
unset openrouter_key server_password github_mcp_token GITHUB_MCP_TOKEN

cat > "$service_file" <<EOF
[Unit]
Description=Predictor OpenCode Conductor
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
WorkingDirectory=${repo_root}
EnvironmentFile=${env_file}
Environment=PATH=${HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin
Environment=DISABLE_AUTOUPDATER=1
ExecStart=${HOME}/.local/bin/opencode web --hostname 127.0.0.1 --port 4096
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
UMask=0077

[Install]
WantedBy=default.target
EOF

sudo loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable --now predictor-conductor.service

printf '\nPersistent Conductor service installed.\n'
printf 'OpenCode listens only on localhost:4096; do NOT expose that port publicly.\n'
printf '\nNext, join this host to your private Tailscale network:\n'
printf '  sudo tailscale up\n'
printf '\nThen privately publish the localhost web UI inside your tailnet:\n'
printf '  sudo tailscale serve --bg 4096\n'
printf '\nOpen the UI and connect OpenAI using the ChatGPT Plus/Pro login.\n'
printf 'Do not add a paid OpenAI API key as an automatic fallback.\n'
printf '\nCheck everything with:\n'
printf '  bash scripts/agent-tools/cloud-conductor-doctor.sh\n'
printf '\nThe browser login username is: predictor\n'
printf 'The generated browser password is stored at: %s\n' "$env_file"
printf 'Read only the OPENCODE_SERVER_PASSWORD line and save it in your password manager. Never commit this file.\n'
printf '\nGitHub write access is separate. Run `gh auth login` once on this host if you want the Builder to push branches/create PRs.\n'
printf 'Claude Code is optional: install/authenticate the official client only if an existing Claude subscription should be used for selected escalations.\n'
printf '\nRestart OpenCode after config/auth changes. Authenticate OAuth MCPs explicitly with `opencode mcp auth NAME`, then inspect `opencode mcp list`.\n'
printf 'For an SSH host, forward the callback localhost port shown by OpenCode for the duration of browser OAuth.\n'
printf 'GitHub MCP token provisioning reuses `gh auth token` only inside this protected installer and never prints it.\n'
