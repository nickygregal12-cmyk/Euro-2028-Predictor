#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"

if [ "$(id -u)" -eq 0 ]; then
  printf 'Run this as the normal development user; the script uses sudo only for the shared browser runtime.\n' >&2
  exit 1
fi
if ! command -v sudo >/dev/null 2>&1 || ! sudo -n true 2>/dev/null; then
  printf 'Browser bootstrap needs sudo access. Run sudo once, then re-run.\n' >&2
  exit 1
fi

readarray -t browser_config < <(node - <<'NODE'
const config = require('./config/browser-runtime.json')
for (const key of [
  'installerPackage', 'installerVersion', 'browser', 'installRoot',
  'executableLink', 'provenanceFile', 'coupledMcpPackage', 'coupledMcpVersion',
]) console.log(config[key])
NODE
)
installer_package="${browser_config[0]}"
installer_version="${browser_config[1]}"
browser_name="${browser_config[2]}"
install_root="${browser_config[3]}"
executable_link="${browser_config[4]}"
provenance_file="${browser_config[5]}"
coupled_mcp_package="${browser_config[6]}"
coupled_mcp_version="${browser_config[7]}"

configured_mcp_version="$(node -p "require('./config/agent-tools.json').playwrightMcp.version")"
if [ "$configured_mcp_version" != "$coupled_mcp_version" ]; then
  printf 'Browser runtime refuses MCP drift: config/browser-runtime.json expects %s %s but agent-tools pins %s.\n' \
    "$coupled_mcp_package" "$coupled_mcp_version" "$configured_mcp_version" >&2
  exit 1
fi

if [ -x "$executable_link" ] && [ -r "$provenance_file" ] && node -e '
const fs = require("fs")
const p = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
process.exit(
  p.installerPackage === process.argv[2] &&
  p.installerVersion === process.argv[3] &&
  p.browser === process.argv[4] &&
  p.coupledMcpVersion === process.argv[5] ? 0 : 1
)
' "$provenance_file" "$installer_package" "$installer_version" "$browser_name" "$coupled_mcp_version"; then
  printf 'Pinned browser runtime already present: %s\n' "$executable_link"
  exit 0
fi

printf 'Installing pinned %s@%s %s runtime and host dependencies...\n' \
  "$installer_package" "$installer_version" "$browser_name"
sudo install -d -m 0755 "$install_root" "$(dirname "$executable_link")"
sudo env "PATH=$PATH" "PLAYWRIGHT_BROWSERS_PATH=$install_root" \
  npx -y "${installer_package}@${installer_version}" install --with-deps "$browser_name"

browser_executable="$(sudo find "$install_root" -type f -name chrome -path '*/chrome-linux*/chrome' -perm -111 -print | sort | head -n 1)"
if [ -z "$browser_executable" ] || [ ! -x "$browser_executable" ]; then
  printf 'Pinned Playwright install completed but no Chromium executable was found under %s.\n' "$install_root" >&2
  exit 1
fi

sudo ln -sfn "$browser_executable" "$executable_link"
printf '%s\n' "$(node - <<NODE
console.log(JSON.stringify({
  installerPackage: ${installer_package@Q},
  installerVersion: ${installer_version@Q},
  browser: ${browser_name@Q},
  installRoot: ${install_root@Q},
  executable: ${browser_executable@Q},
  executableLink: ${executable_link@Q},
  coupledMcpPackage: ${coupled_mcp_package@Q},
  coupledMcpVersion: ${coupled_mcp_version@Q},
}, null, 2))
NODE
)" | sudo tee "$provenance_file" >/dev/null
sudo chmod 0644 "$provenance_file"

if ! "$executable_link" --version >/dev/null 2>&1; then
  printf 'Installed browser executable did not launch for a version check: %s\n' "$executable_link" >&2
  exit 1
fi
printf 'Pinned browser runtime ready: %s (%s)\n' "$executable_link" "$("$executable_link" --version)"
