#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const EXCEPTION_PREFIX = 'docs/quality/ratchet-exceptions/'
const TEST_FILE = /(?:^|\/)(?:[^/]+\.)?(?:test|spec)\.[cm]?[jt]sx?$/
const PLAYWRIGHT_CONFIG = /^playwright(?:\.[^.]+)*\.config\.ts$/
const WORKFLOW = /^\.github\/workflows\/.*\.ya?ml$/

const severityRank = new Map([
  ['low', 0],
  ['moderate', 1],
  ['high', 2],
  ['critical', 3],
])

function requiredSlice(source, marker, length, label) {
  const index = source.indexOf(marker)
  if (index < 0) throw new Error(`Could not locate ${label} (${marker})`)
  return source.slice(index, index + length)
}

function requiredNumber(source, property, label = property) {
  const match = source.match(new RegExp(`\\b${property}\\s*:\\s*(\\d+(?:\\.\\d+)?)`))
  if (!match) throw new Error(`Could not read numeric ratchet ${label}`)
  return Number(match[1])
}

export function extractCoverageThresholds(source) {
  const coverage = requiredSlice(source, 'coverage:', 2600, 'Vite coverage config')
  const thresholds = requiredSlice(coverage, 'thresholds:', 500, 'Vite coverage thresholds')
  return {
    statements: requiredNumber(thresholds, 'statements', 'coverage.statements'),
    branches: requiredNumber(thresholds, 'branches', 'coverage.branches'),
    functions: requiredNumber(thresholds, 'functions', 'coverage.functions'),
    lines: requiredNumber(thresholds, 'lines', 'coverage.lines'),
  }
}

export function extractMutationBreak(source) {
  const thresholds = requiredSlice(source, 'thresholds:', 500, 'Stryker thresholds')
  return requiredNumber(thresholds, 'break', 'mutation.break')
}

export function extractBundleBudgets(source) {
  const budgets = requiredSlice(source, 'const BUDGETS', 600, 'bundle budgets')
  return {
    entryChunkKb: requiredNumber(budgets, 'entryChunkKb', 'bundle.entryChunkKb'),
    totalJsKb: requiredNumber(budgets, 'totalJsKb', 'bundle.totalJsKb'),
    totalCssKb: requiredNumber(budgets, 'totalCssKb', 'bundle.totalCssKb'),
  }
}

export function extractDependencySeverity(source) {
  const match = source.match(/fail-on-severity:\s*(low|moderate|high|critical)\b/)
  if (!match) throw new Error('Could not read dependency-review.fail-on-severity')
  return match[1]
}

export function extractPlaywrightRetries(source) {
  const match = source.match(/\bretries:\s*(?:process\.env\.CI\s*\?\s*)?(\d+)/)
  return match ? Number(match[1]) : 0
}

function scrubComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

export function countTestControls(source) {
  const code = scrubComments(source)
  return {
    suppressions: [...code.matchAll(/\b(?:test|it|describe)\.(?:skip|todo|fixme)\s*\(/g)].length,
    focused: [...code.matchAll(/\b(?:test|it|describe)\.only\s*\(/g)].length,
  }
}

export function compareRatchet(id, from, to, direction) {
  if (direction === 'floor' && Number(to) < Number(from)) return { id, from, to }
  if (direction === 'ceiling' && Number(to) > Number(from)) return { id, from, to }
  if (direction === 'severity') {
    const fromRank = severityRank.get(String(from))
    const toRank = severityRank.get(String(to))
    if (fromRank === undefined || toRank === undefined) {
      throw new Error(`Unknown severity while comparing ${id}: ${from} -> ${to}`)
    }
    if (toRank > fromRank) return { id, from, to }
  }
  return null
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim()
}

function show(ref, path) {
  try {
    return git(['show', `${ref}:${path}`])
  } catch {
    return null
  }
}

function listFiles(ref) {
  const output = git(['ls-tree', '-r', '--name-only', ref])
  return output ? output.split('\n').filter(Boolean) : []
}

function changedFiles(base, head) {
  const output = git(['diff', '--name-only', `${base}...${head}`])
  return output ? output.split('\n').filter(Boolean) : []
}

function addedFiles(base, head) {
  const output = git(['diff', '--diff-filter=A', '--name-only', `${base}...${head}`])
  return output ? output.split('\n').filter(Boolean) : []
}

function readJsonAt(ref, path) {
  const source = show(ref, path)
  if (source === null) throw new Error(`Required quality authority is missing at ${ref}: ${path}`)
  return JSON.parse(source)
}

function readSourceAt(ref, path) {
  const source = show(ref, path)
  if (source === null) throw new Error(`Required quality authority is missing at ${ref}: ${path}`)
  return source
}

function snapshot(ref) {
  const coverage = extractCoverageThresholds(readSourceAt(ref, 'vite.config.ts'))
  const mutationBreak = extractMutationBreak(readSourceAt(ref, 'stryker.config.mjs'))
  const bundle = extractBundleBudgets(readSourceAt(ref, 'scripts/check-bundle-budget.mjs'))
  const lighthouse = readJsonAt(ref, 'lighthouserc.json').ci.assert.assertions
  const agentLimits = readJsonAt(ref, 'config/agent-context-benchmarks.json').limits
  const dependencySeverity = extractDependencySeverity(
    readSourceAt(ref, '.github/workflows/dependency-review.yml'),
  )

  const floors = {
    'coverage.statements': coverage.statements,
    'coverage.branches': coverage.branches,
    'coverage.functions': coverage.functions,
    'coverage.lines': coverage.lines,
    'mutation.break': mutationBreak,
    'lighthouse.accessibility': lighthouse['categories:accessibility']?.[1]?.minScore,
    'lighthouse.seo': lighthouse['categories:seo']?.[1]?.minScore,
    'lighthouse.best-practices': lighthouse['categories:best-practices']?.[1]?.minScore,
    'lighthouse.performance': lighthouse['categories:performance']?.[1]?.minScore,
  }
  for (const [id, value] of Object.entries(floors)) {
    if (typeof value !== 'number') throw new Error(`Could not read floor ratchet ${id} at ${ref}`)
  }

  const ceilings = {
    'bundle.entryChunkKb': bundle.entryChunkKb,
    'bundle.totalJsKb': bundle.totalJsKb,
    'bundle.totalCssKb': bundle.totalCssKb,
    'agent-context.maxGraphifyBudget': agentLimits.maxGraphifyBudget,
    'agent-context.maxCandidatePaths': agentLimits.maxCandidatePaths,
    'agent-context.maxAuthorities': agentLimits.maxAuthorities,
    'agent-context.maxSelectedSkills': agentLimits.maxSelectedSkills,
    'agent-context.maxPacketBytesWithoutGraph': agentLimits.maxPacketBytesWithoutGraph,
  }
  for (const [id, value] of Object.entries(ceilings)) {
    if (typeof value !== 'number') throw new Error(`Could not read ceiling ratchet ${id} at ${ref}`)
  }

  const files = listFiles(ref)
  const playwrightRetries = Object.fromEntries(
    files
      .filter((path) => PLAYWRIGHT_CONFIG.test(path))
      .map((path) => [path, extractPlaywrightRetries(readSourceAt(ref, path))]),
  )
  const continueOnError = files
    .filter((path) => WORKFLOW.test(path))
    .reduce((total, path) => {
      const source = readSourceAt(ref, path)
      return total + [...source.matchAll(/^\s*continue-on-error:\s*true\s*$/gm)].length
    }, 0)

  return {
    floors,
    ceilings,
    dependencySeverity,
    playwrightRetries,
    continueOnError,
  }
}

function collectWeakenings(base, head) {
  const before = snapshot(base)
  const after = snapshot(head)
  const changes = []

  for (const [id, from] of Object.entries(before.floors)) {
    const change = compareRatchet(id, from, after.floors[id], 'floor')
    if (change) changes.push(change)
  }
  for (const [id, from] of Object.entries(before.ceilings)) {
    const change = compareRatchet(id, from, after.ceilings[id], 'ceiling')
    if (change) changes.push(change)
  }
  const severity = compareRatchet(
    'dependency-review.fail-on-severity',
    before.dependencySeverity,
    after.dependencySeverity,
    'severity',
  )
  if (severity) changes.push(severity)

  for (const path of new Set([
    ...Object.keys(before.playwrightRetries),
    ...Object.keys(after.playwrightRetries),
  ])) {
    const from = before.playwrightRetries[path] ?? 0
    const to = after.playwrightRetries[path] ?? 0
    const change = compareRatchet(`playwright-retries:${path}`, from, to, 'ceiling')
    if (change) changes.push(change)
  }

  const workflowChange = compareRatchet(
    'workflow.continue-on-error-count',
    before.continueOnError,
    after.continueOnError,
    'ceiling',
  )
  if (workflowChange) changes.push(workflowChange)

  for (const path of changedFiles(base, head).filter((candidate) => TEST_FILE.test(candidate))) {
    const oldControls = countTestControls(show(base, path) ?? '')
    const newControls = countTestControls(show(head, path) ?? '')
    const suppression = compareRatchet(
      `test-suppression:${path}`,
      oldControls.suppressions,
      newControls.suppressions,
      'ceiling',
    )
    if (suppression) changes.push(suppression)
    const focused = compareRatchet(
      `focused-test:${path}`,
      oldControls.focused,
      newControls.focused,
      'ceiling',
    )
    if (focused) changes.push(focused)
  }

  return changes
}

function evidenceExists(ref, path) {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}:${path}`], {
      cwd: process.cwd(),
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

function sameValue(a, b) {
  return typeof a === 'number' && typeof b === 'number'
    ? a === b
    : String(a) === String(b)
}

function loadExceptions(base, head) {
  const files = addedFiles(base, head).filter(
    (path) => path.startsWith(EXCEPTION_PREFIX) && path.endsWith('.json'),
  )
  const records = []
  for (const path of files) {
    const source = readSourceAt(head, path)
    let document
    try {
      document = JSON.parse(source)
    } catch (error) {
      throw new Error(`${path} is not valid JSON: ${error.message}`)
    }
    if (document.version !== 1 || !Array.isArray(document.changes)) {
      throw new Error(`${path} must contain { "version": 1, "changes": [...] }`)
    }
    for (const record of document.changes) records.push({ ...record, exceptionFile: path })
  }
  return records
}

export function validateExceptionRecord(record, head, evidenceChecker = evidenceExists) {
  if (typeof record.id !== 'string' || !record.id.trim()) return 'missing id'
  if (!Object.hasOwn(record, 'from') || !Object.hasOwn(record, 'to')) return 'missing from/to'
  if (typeof record.reason !== 'string' || record.reason.trim().length < 40) {
    return 'reason must be at least 40 characters and explain why weakening is justified'
  }
  if (typeof record.evidence !== 'string' || !record.evidence.trim()) {
    return 'evidence must name a repository file that supports the decision'
  }
  if (!evidenceChecker(head, record.evidence)) {
    return `evidence file does not exist at head: ${record.evidence}`
  }
  return null
}

function enforce(base, head) {
  const weakenings = collectWeakenings(base, head)
  const exceptions = loadExceptions(base, head)
  const errors = []
  const used = new Set()

  for (const weakening of weakenings) {
    const matchIndex = exceptions.findIndex(
      (record, index) =>
        !used.has(index) &&
        record.id === weakening.id &&
        sameValue(record.from, weakening.from) &&
        sameValue(record.to, weakening.to),
    )
    if (matchIndex < 0) {
      errors.push(
        `${weakening.id} weakened ${weakening.from} -> ${weakening.to} without a new ratchet exception`,
      )
      continue
    }
    const record = exceptions[matchIndex]
    const invalid = validateExceptionRecord(record, head)
    if (invalid) {
      errors.push(`${record.exceptionFile}: ${record.id}: ${invalid}`)
      continue
    }
    used.add(matchIndex)
    console.warn(
      `Accepted explicit quality-ratchet exception: ${record.id} ${record.from} -> ${record.to}\n` +
        `  reason: ${record.reason.trim()}\n  evidence: ${record.evidence}`,
    )
  }

  exceptions.forEach((record, index) => {
    if (!used.has(index)) {
      errors.push(
        `${record.exceptionFile}: exception ${record.id} does not match a detected weakening in this PR`,
      )
    }
  })

  if (errors.length) {
    console.error('Quality integrity check failed:\n')
    for (const error of errors) console.error(`- ${error}`)
    console.error(
      `\nIf a weakening is genuinely authorised, add a NEW ${EXCEPTION_PREFIX}<date>-<slug>.json file with:\n` +
        '{\n  "version": 1,\n  "changes": [{\n    "id": "the.id.above",\n    "from": 1,\n    "to": 2,\n' +
        '    "reason": "A substantive measured explanation of at least forty characters.",\n' +
        '    "evidence": "path/to/the/measurement-or-authority.md"\n  }]\n}\n' +
        'Exception files must be newly added by the same PR; old exceptions cannot be reused.',
    )
    process.exitCode = 1
    return
  }

  if (weakenings.length === 0) {
    console.log('Quality integrity: no protected gate was weakened.')
  } else {
    console.log(`Quality integrity: ${weakenings.length} explicit weakening(s) were fully evidenced.`)
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const [base, head] = process.argv.slice(2)
  if (!base || !head) {
    console.error('Usage: node scripts/check-quality-integrity.mjs BASE_SHA HEAD_SHA')
    process.exit(2)
  }
  try {
    enforce(base, head)
  } catch (error) {
    console.error(`Quality integrity check could not establish trustworthy evidence: ${error.message}`)
    process.exit(1)
  }
}
