#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const repositoryRoot = process.cwd()
const baselinePath = resolve(repositoryRoot, 'config/knip-baseline.json')

const findingCategories = [
  'binaries',
  'catalog',
  'catalogReferences',
  'dependencies',
  'devDependencies',
  'duplicates',
  'enumMembers',
  'exports',
  'files',
  'namespaceMembers',
  'optionalPeerDependencies',
  'types',
  'unlisted',
  'unresolved',
]

/**
 * @param {unknown} finding
 * @returns {string}
 */
function findingName(finding) {
  if (typeof finding === 'string') return finding
  if (
    finding &&
    typeof finding === 'object' &&
    'name' in finding &&
    typeof finding.name === 'string'
  ) {
    return finding.name
  }
  return JSON.stringify(finding)
}

/**
 * @param {{issues?: Array<Record<string, unknown>>}} report
 * @returns {string[]}
 */
export function collectFindingSignatures(report) {
  /** @type {string[]} */
  const signatures = []
  for (const issue of report.issues ?? []) {
    const file = typeof issue.file === 'string' ? issue.file : '<repository>'
    for (const category of findingCategories) {
      const findings = issue[category]
      if (!Array.isArray(findings)) continue
      for (const finding of findings) {
        signatures.push(`${category}\t${file}\t${findingName(finding)}`)
      }
    }
  }
  return [...new Set(signatures)].sort()
}

/**
 * @param {string[]} signatures
 * @returns {Record<string, number>}
 */
export function countByCategory(signatures) {
  /** @type {Record<string, number>} */
  const counts = {}
  for (const signature of signatures) {
    const category = signature.split('\t', 1)[0] ?? '<unknown>'
    counts[category] = (counts[category] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)))
}

/**
 * @param {string} stdout
 * @returns {{issues?: Array<Record<string, unknown>>}}
 */
function parseKnipOutput(stdout) {
  const jsonStart = stdout.indexOf('{"issues"')
  if (jsonStart < 0) throw new Error('Knip did not emit its JSON report')
  return JSON.parse(stdout.slice(jsonStart))
}

function main() {
  const executable = resolve(
    repositoryRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'knip.cmd' : 'knip',
  )
  const run = spawnSync(executable, ['--no-exit-code', '--reporter', 'json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  if (run.error) throw run.error
  if (run.status !== 0) {
    process.stderr.write(run.stderr)
    throw new Error(`Knip exited ${run.status}`)
  }

  const report = parseKnipOutput(run.stdout)
  // Temporary PR diagnostic: the CI workflow already uploads .lighthouseci/
  // with `if: always()`, so preserve Knip's exact JSON there without changing
  // the gate or baseline. This line is reverted once the branch-only finding is
  // identified and fixed.
  mkdirSync(resolve(repositoryRoot, '.lighthouseci'), { recursive: true })
  writeFileSync(resolve(repositoryRoot, '.lighthouseci', 'knip-report.json'), JSON.stringify(report, null, 2))

  const current = collectFindingSignatures(report)
  const baseline = /** @type {{schemaVersion?: number, signatures?: string[]}} */ (
    JSON.parse(readFileSync(baselinePath, 'utf8'))
  )
  if (baseline.schemaVersion !== 1 || !Array.isArray(baseline.signatures)) {
    throw new Error('config/knip-baseline.json has an unsupported shape')
  }

  const allowed = new Set(baseline.signatures)
  const currentSet = new Set(current)
  const added = current.filter((signature) => !allowed.has(signature))
  const removed = baseline.signatures.filter((signature) => !currentSet.has(signature))

  if (added.length > 0) {
    console.error(`New Knip findings (${added.length}) are not in the classified baseline:`)
    for (const signature of added.slice(0, 100)) console.error(`  ${signature}`)
    if (added.length > 100) console.error(`  ...and ${added.length - 100} more`)
    console.error('Fix the regression. Update the baseline only after classifying intentional findings.')
    process.exitCode = 1
    return
  }

  const counts = countByCategory(current)
  console.log(
    `Knip baseline passed: ${current.length} classified findings; ` +
      `${removed.length} baseline findings removed; no new findings.`,
  )
  console.log(JSON.stringify(counts))
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main()
}
