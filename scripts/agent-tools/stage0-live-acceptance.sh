#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"

if [ "${1:-}" != '--live' ] || [ "$#" -ne 1 ]; then
  cat >&2 <<'EOF'
Usage: bash scripts/agent-tools/stage0-live-acceptance.sh --live

Runs the bounded Stage 0 host/MCP acceptance pass. It performs read-only MCP
operations and harmless browser launches, plus one subscription-backed OpenCode
acceptance session. It does not mutate Supabase, Netlify, GitHub, Sentry,
PostHog or repository contents.
EOF
  exit 2
fi

fail() {
  printf 'STAGE0_FAIL %s\n' "$1" >&2
  exit 1
}

printf 'Predictor Stage 0 live acceptance\n'
printf '=================================\n'

branch="$(git branch --show-current)"
head="$(git rev-parse HEAD)"
git fetch --quiet origin main
origin_main="$(git rev-parse origin/main)"
printf 'BRANCH=%s\nHEAD=%s\nORIGIN_MAIN=%s\n' "$branch" "$head" "$origin_main"
[ "$branch" = 'main' ] || fail 'run from main after the Stage 0 repository PR is merged'
[ "$head" = "$origin_main" ] || fail 'local main is not the fresh origin/main head'
[ -z "$(git status --porcelain)" ] || fail 'working tree is not clean'

identity_name="$(git config user.name || true)"
identity_email="$(git config user.email || true)"
[ -n "$identity_name" ] || fail 'git user.name is empty'
[ -n "$identity_email" ] || fail 'git user.email is empty'
printf 'GIT_IDENTITY=OK name=%s email=%s\n' "$identity_name" "$identity_email"

expected_contract="$(node -p "require('./NOW.json').contractVersion" 2>/dev/null || true)"
if [ -z "$expected_contract" ]; then
  expected_contract="$(node -p "require('./config/production-hosted-contract.json').requiredMigrationCount")"
fi
printf 'EXPECTED_CONTRACT=%s\n' "$expected_contract"

printf '\nHost doctor + MCP initialise/tools-list\n---------------------------------------\n'
bash scripts/agent-tools/cloud-conductor-doctor.sh --mcp

env_file="${HOME}/.config/predictor-cloud/opencode.env"
[ -r "$env_file" ] || fail 'protected OpenCode service env is missing'
# shellcheck disable=SC1090
set -a
source "$env_file"
set +a
[ -n "${GITHUB_MCP_TOKEN:-}" ] || fail 'service env has no GitHub MCP token'
[ -n "${OPENCODE_SERVER_PASSWORD:-}" ] || fail 'service env has no OpenCode server password'
printf 'SERVICE_ENV=OK GitHub MCP token present (value hidden); web password present (value hidden)\n'

acceptance_prompt=$(cat <<'EOF'
Run the Predictor Stage 0 LIVE ACCEPTANCE MATRIX. This is an evidence-gathering task only.

Hard rules:
- Read AGENTS.md, NOW.md, config/netlify-sites.json, config/production-hosted-contract.json and the current Stage 0 MCP authority first.
- Do not edit files, create branches/commits/PRs, send feedback, update issues, change provider state, or mutate any hosted service.
- Never return credentials, environment values, player data, event/replay payloads, or secrets.
- `gh` is NOT acceptable evidence for the GitHub MCP item.
- Model agreement is not evidence. Report the concrete tool call/result that established each item.

Delegate the browser portion to predictor-visual-qa and the hosted-service portion to predictor-release-verifier.

VISUAL QA acceptance:
1. Through Playwright MCP, launch the configured pinned browser and navigate only to https://example.com/. Read the page title or main heading, then close/clean up.
2. Through Chrome DevTools MCP, separately launch/navigate only to https://example.com/. Read the page title or main heading, then close/clean up.
3. Report PASS/FAIL for each MCP and the exact harmless observation. No screenshots are required.

RELEASE VERIFIER acceptance:
1. GitHub: use the GitHub MCP itself to perform one bounded read of this repository/current main or current PR metadata. Do not substitute gh, web search or repository files. Report the MCP tool name used and the observed non-secret identifier/SHA.
2. Netlify: read config/netlify-sites.json, select the canonical production `hub` and `euro` site IDs, and through the bounded Netlify deploy reader resolve actual current deploy evidence for at least the intended current site. Report site name/site ID/deploy ID/state only. Do not read environment values.
3. Supabase Production: through supabase-prod only, make a read-only migration-history/fingerprint check. Confirm the latest migration is 20260824100000 `live_results_channel` and, where supported, the ledger count is 218. Pair that with the configured project-scoped endpoint and canonical hosted record. Do not claim the MCP server independently returned its project ref unless it actually did.
4. Sentry: inspect the exact Sentry tools available to this role. A harmless inspect/read must work. A write-shaped tool such as update_issue must be ABSENT from the role's available tools or mechanically denied before invocation. Do not attempt a real mutation. Report exact relevant visible tool names.
5. PostHog: inspect the exact PostHog tools available to this role. A harmless schema/read operation must work. A write-shaped command such as agent-feedback must be ABSENT from the role's available tools or mechanically denied before invocation. Do not send feedback or invoke a write. Do not inspect real-person replay/event payloads. Report exact relevant visible tool names.

Return exactly one compact matrix with these rows:
PLAYWRIGHT_BROWSER
CHROME_DEVTOOLS_BROWSER
GITHUB_MCP_ROLE_READ
NETLIFY_CANONICAL_DEPLOY_READ
SENTRY_EFFECTIVE_READ_ONLY
POSTHOG_EFFECTIVE_READ_ONLY
SUPABASE_PROD_IDENTITY_FINGERPRINT

For every row include RESULT=PASS|FAIL|LIMITATION, TOOL=<exact tool or mechanism>, EVIDENCE=<non-secret evidence>, and REMAINING=<none or precise gap>.
End with exactly one of:
MCP FOUNDATION LIVE ACCEPTANCE PASSED
MCP FOUNDATION LIVE ACCEPTANCE NOT PASSED
EOF
)

printf '\nRole-scoped live acceptance\n---------------------------\n'
log_file="/tmp/predictor-stage0-live-acceptance-$(date -u +%Y%m%dT%H%M%SZ).log"
set +e
opencode run \
  --attach http://127.0.0.1:4096 \
  --agent predictor-conductor \
  --format default \
  "$acceptance_prompt" | tee "$log_file"
run_status=${PIPESTATUS[0]}
set -e
printf '\nACCEPTANCE_LOG=%s\n' "$log_file"
[ "$run_status" -eq 0 ] || fail "OpenCode acceptance session exited ${run_status}"

grep -q '^MCP FOUNDATION LIVE ACCEPTANCE PASSED$' "$log_file" \
  || fail 'live acceptance matrix did not pass every required row'
printf 'STAGE0_LIVE_ACCEPTANCE=PASS\n'
