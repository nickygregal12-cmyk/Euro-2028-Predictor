#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

# THE ANALYSIS PARSER IS NOT THE REPOSITORY COMPILER, AND PINNING THEM TOGETHER
# BROKE THIS CHECK SILENTLY.
#
# dependency-cruiser needs a TypeScript parser to RESOLVE THE MODULE GRAPH. It
# is not, and must not become, this repository's type authority — `npx tsc -b`
# is, and it runs on whatever `package.json` declares.
#
# This line used to read the compiler out of `package.json`, which tied the two
# together. When the repository moved to TypeScript 7,
# dependency-cruiser — which supports `typescript >=2.0.0 <7.0.0` and says so —
# found no compatible transpiler, silently cruised ZERO modules, and reported
# "no dependency violations found". A boundary checker that analyses nothing
# passes everything.
#
# So the parser is pinned BESIDE the dependency-cruiser version, in the same
# object, because the two are ONE TOOLCHAIN PAIR: the parser may only move when
# dependency-cruiser's supported range moves. Renovate manages the cruiser and
# deliberately does not manage this — a bot bumping the parser past the range
# would reintroduce exactly the silent-zero-modules defect.
#
# The fail-closed guard below is what caught this and is unchanged. It is the
# reason the failure was loud instead of a permanently green no-op.
version="$(node -p "require('./config/agent-tools.json').dependencyCruiser.version")"
typescript_version="$(node -p "require('./config/agent-tools.json').dependencyCruiser.analysisTypescript")"
report="$(mktemp)"
trap 'rm -f "$report"' EXIT

printf 'Checking application dependency contracts with dependency-cruiser %s + analysis TypeScript %s...\n' \
  "$version" "$typescript_version"

set +e
npx -y \
  --package "dependency-cruiser@${version}" \
  --package "typescript@${typescript_version}" \
  depcruise \
  --config .dependency-cruiser.cjs \
  --output-type json \
  src > "$report"
cruise_status=$?
set -e

set +e
node - "$report" <<'NODE'
const fs = require('node:fs')
const reportPath = process.argv[2]
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
const modules = Array.isArray(report.modules) ? report.modules : []
const violations = Array.isArray(report.summary?.violations)
  ? report.summary.violations
  : []

if (modules.length === 0) {
  console.error('Architecture check is invalid: dependency-cruiser analysed zero modules.')
  process.exitCode = 2
} else {
  const dependencyCount = modules.reduce(
    (total, module) => total + (Array.isArray(module.dependencies) ? module.dependencies.length : 0),
    0,
  )
  console.log(`Analysed ${modules.length} modules and ${dependencyCount} dependencies.`)
}

let errorCount = 0
for (const violation of violations) {
  const severity = String(violation.rule?.severity ?? violation.severity ?? 'error').toUpperCase()
  const rule = violation.rule?.name ?? violation.rule ?? 'unknown-rule'
  const from = violation.from ?? '<unknown>'
  const to = violation.to ?? '<unknown>'
  console.error(`${severity} ${rule}: ${from} -> ${to}`)
  if (severity === 'ERROR') errorCount += 1
}

if (errorCount > 0) {
  console.error(`Architecture check found ${errorCount} error-severity violation(s).`)
  process.exitCode = 1
}
NODE
report_status=$?
set -e

if [ "$cruise_status" -ne 0 ] || [ "$report_status" -ne 0 ]; then
  printf '\nArchitecture contract failed. Detailed dependency-cruiser report:\n' >&2
  npx -y \
    --package "dependency-cruiser@${version}" \
    --package "typescript@${typescript_version}" \
    depcruise \
    --config .dependency-cruiser.cjs \
    --output-type err-long \
    src >&2 || true
  exit 1
fi
