#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

version="$(node -p "require('./config/agent-tools.json').dependencyCruiser.version")"
typescript_version="$(node -p "require('./package.json').devDependencies.typescript.replace(/^[~^]/, '')")"
report="$(mktemp)"
trap 'rm -f "$report"' EXIT

printf 'Checking application dependency contracts with dependency-cruiser %s + TypeScript %s...\n' \
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
