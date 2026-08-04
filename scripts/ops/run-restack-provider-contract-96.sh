#!/usr/bin/env bash
set -euo pipefail

source_script="scripts/ops/restack-provider-contract-96.sh"
temp_script="/tmp/restack-provider-contract-96.sh"
cp "$source_script" "$temp_script"
sed -i 's/git fetch origin main agent\/provider-ingestion-contract-80/git fetch origin main agent\/provider-ingestion-contract-94-final/' "$temp_script"
sed -i 's|old_head="$(git rev-parse origin/agent/provider-ingestion-contract-80)"|old_head="$(git rev-parse origin/agent/provider-ingestion-contract-94-final)"|' "$temp_script"
bash "$temp_script"
