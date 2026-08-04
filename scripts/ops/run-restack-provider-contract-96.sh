#!/usr/bin/env bash
set -euo pipefail

script="scripts/ops/restack-provider-contract-96.sh"
sed -i 's/git fetch origin main agent\/provider-ingestion-contract-80/git fetch origin main agent\/provider-ingestion-contract-94-final/' "$script"
sed -i 's|old_head="$(git rev-parse origin/agent/provider-ingestion-contract-80)"|old_head="$(git rev-parse origin/agent/provider-ingestion-contract-94-final)"|' "$script"
bash "$script"
