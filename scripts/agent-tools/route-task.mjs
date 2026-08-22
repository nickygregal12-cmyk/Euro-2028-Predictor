#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const routingPath = resolve(root, 'config/agent-routing.json')
const skillsPath = resolve(root, 'config/agent-skills.json')
const graphifyWrapper = resolve(root, 'scripts/agent-tools/graphify-query.sh')

function fail(message) {
  console.error(`agent:route: ${message}`)
  process.exit(1)
}

function usage() {
  console.log(`Usage:
  npm run agent:route -- "TASK"
  npm run agent:route -- --path src/example.ts "TASK"
  npm run agent:route -- --graph /path/to/graph.json --source-sha SHA "TASK"
  npm run agent:route -- --no-graph --path src/example.ts --json "TASK"

Options:
  --path PATH       Add a known implementation path. Repeatable.
  --graph PATH      Use a downloaded PR Graphify artifact instead of merged main.
  --source-sha SHA  Assert the source commit represented by --graph.
  --allow-stale     Deliberately permit an older ancestor graph through the wrapper.
  --no-graph        Skip Graphify even when no exact implementation path is known.
  --budget N        Override the bounded Graphify orientation budget.
  --json            Emit the task packet as JSON.
  -h, --help        Show this help.

The router is navigation only. It points to canonical authorities and skills; it
never decides product, database or hosted truth.`)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`cannot read ${path}: ${error.message}`)
  }
}

if (!existsSync(routingPath) || !existsSync(skillsPath)) {
  fail('routing registries are missing')
}

const routing = readJson(routingPath)
const skillRegistry = readJson(skillsPath)
const args = process.argv.slice(2)
const explicitPaths = []
let graphPath = null
let graphSourceSha = null
let allowStale = false
let noGraph = false
let jsonOutput = false
let budget = Number(routing.graphifyBudget ?? 900)
const taskParts = []

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
  if (arg === '--path') {
    const value = args[index + 1]
    if (!value) fail('--path requires a value')
    explicitPaths.push(value.replace(/^\.\//, ''))
    index += 1
  } else if (arg === '--graph') {
    const value = args[index + 1]
    if (!value) fail('--graph requires a path')
    graphPath = value
    index += 1
  } else if (arg === '--source-sha') {
    const value = args[index + 1]
    if (!value) fail('--source-sha requires a SHA')
    graphSourceSha = value
    index += 1
  } else if (arg === '--allow-stale') {
    allowStale = true
  } else if (arg === '--no-graph') {
    noGraph = true
  } else if (arg === '--json') {
    jsonOutput = true
  } else if (arg === '--budget') {
    const value = Number(args[index + 1])
    if (!Number.isInteger(value) || value < 200 || value > 4000) {
      fail('--budget must be an integer between 200 and 4000')
    }
    budget = value
    index += 1
  } else if (arg === '-h' || arg === '--help') {
    usage()
    process.exit(0)
  } else {
    taskParts.push(arg)
  }
}

if ((graphPath && !graphSourceSha) || (!graphPath && graphSourceSha)) {
  fail('--graph and --source-sha must be supplied together')
}
if (noGraph && graphPath) {
  fail('--no-graph cannot be combined with --graph')
}

const task = taskParts.join(' ').trim()
if (!task) {
  usage()
  process.exit(2)
}

let trackedFiles = []
try {
  trackedFiles = execFileSync('git', ['ls-files'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
} catch (error) {
  fail(`cannot enumerate tracked files: ${error.message}`)
}

const trackedSet = new Set(trackedFiles)
const exactTaskPaths = trackedFiles.filter((path) => task.includes(path))
const knownPaths = [...new Set([...explicitPaths, ...exactTaskPaths])]

for (const path of explicitPaths) {
  if (!trackedSet.has(path)) {
    fail(`--path is not a tracked file: ${path}`)
  }
}

let graphStatus = noGraph ? 'skipped' : knownPaths.length > 0 ? 'not-needed' : 'not-run'
let graphOutput = ''
let graphWarning = null
let graphSource = graphPath ? 'pr-artifact' : 'merged-main-snapshot'

if (!noGraph && knownPaths.length === 0) {
  const wrapperArgs = [graphifyWrapper]
  if (graphPath) wrapperArgs.push('--graph', graphPath, '--source-sha', graphSourceSha)
  if (allowStale) wrapperArgs.push('--allow-stale')

  const orientationQuestion =
    `For this task, identify the smallest likely implementation path and relevant executable tests: ${task}`
  wrapperArgs.push('query', orientationQuestion, '--budget', String(budget))

  const result = spawnSync('bash', wrapperArgs, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GRAPHIFY_QUERY_LOG_DISABLE: '1' },
    maxBuffer: 1024 * 1024,
  })

  if (result.status === 0) {
    graphStatus = 'queried'
    graphOutput = result.stdout ?? ''
  } else {
    graphStatus = 'unavailable'
    graphWarning = (result.stderr || result.error?.message || 'Graphify query failed')
      .trim()
      .split('\n')
      .slice(-3)
      .join(' | ')
  }
}

function pathsInText(text) {
  if (!text) return []
  return trackedFiles
    .map((path) => ({ path, index: text.indexOf(path) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index)
    .map(({ path }) => path)
}

const graphPaths = pathsInText(graphOutput)
const maxCandidatePaths = Number(routing.maxCandidatePaths ?? 12)
const candidatePaths = [...new Set([...knownPaths, ...graphPaths])].slice(0, maxCandidatePaths)
const taskLower = task.toLowerCase()

function pathMatches(candidate, pattern) {
  if (pattern.endsWith('/') || pattern.endsWith('-')) return candidate.startsWith(pattern)
  return candidate === pattern
}

function routeMatches(route) {
  const pathMatch = (route.paths ?? []).some((pattern) =>
    candidatePaths.some((candidate) => pathMatches(candidate, pattern)),
  )
  const keywordMatch = (route.taskKeywords ?? []).some((keyword) =>
    taskLower.includes(keyword.toLowerCase()),
  )
  return pathMatch || keywordMatch
}

const matchedRoutes = [...(routing.routes ?? [])]
  .filter(routeMatches)
  .sort((left, right) => Number(right.priority ?? 0) - Number(left.priority ?? 0))

const unique = (values) => [...new Set(values)]
const maxAuthorities = Number(routing.maxAuthorities ?? 4)
const authorities = unique(matchedRoutes.flatMap((route) => route.authorities ?? [])).slice(
  0,
  maxAuthorities,
)

const requestedSkills = unique(matchedRoutes.flatMap((route) => route.skills ?? []))
const skillMeta = skillRegistry.skills ?? {}

const hasProcess = requestedSkills.some((name) => skillMeta[name]?.role === 'process')
if (!hasProcess && candidatePaths.length > 1) {
  requestedSkills.push('predictor-spec-driven-delivery')
}

const budgets = skillRegistry.budget ?? {}
const roleCounts = new Map()
const skills = []
const suppressedSkills = []

for (const name of requestedSkills) {
  const meta = skillMeta[name]
  if (!meta) {
    suppressedSkills.push({ name, reason: 'unregistered' })
    continue
  }
  const role = meta.role
  const limit = Number(budgets[role] ?? 1)
  const used = roleCounts.get(role) ?? 0
  if (used >= limit) {
    suppressedSkills.push({ name, reason: `${role} budget ${limit} already used` })
    continue
  }
  roleCounts.set(role, used + 1)
  skills.push({ name, role, path: meta.path, purpose: meta.purpose })
}

const packet = {
  task,
  orientation: {
    graphify: graphStatus,
    source: graphStatus === 'queried' ? graphSource : null,
    sourceSha: graphPath ? graphSourceSha : null,
    budget: graphStatus === 'queried' ? budget : null,
    warning: graphWarning,
  },
  routes: matchedRoutes.map((route) => route.id),
  candidatePaths,
  authorities,
  skills,
  suppressedSkills,
  next: [
    'Read only the listed authorities that are relevant to the change.',
    'Open the candidate source/tests; use Serena for exact symbols/callers instead of broad file reading.',
    'If Graphify found no useful path, use bounded repository search and update the working set before editing.',
    'For an existing unmerged PR, use that PR Graphify artifact when branch-specific traversal matters.',
    'Verify behaviour in executable source/tests; routing output is navigation, never product or hosted truth.',
  ],
}

if (jsonOutput) {
  console.log(JSON.stringify(packet, null, 2))
  process.exit(0)
}

console.log(`TASK\n${packet.task}\n`)
console.log(
  `ORIENTATION\nGraphify: ${packet.orientation.graphify}${packet.orientation.source ? ` via ${packet.orientation.source}` : ''}${packet.orientation.budget ? ` (${packet.orientation.budget}-token budget)` : ''}`,
)
if (packet.orientation.warning) console.log(`Warning: ${packet.orientation.warning}`)

console.log('\nROUTES')
console.log(
  packet.routes.length
    ? packet.routes.map((route) => `- ${route}`).join('\n')
    : '- no deterministic route matched',
)

console.log('\nWORKING SET')
console.log(
  packet.candidatePaths.length
    ? packet.candidatePaths.map((path) => `- ${path}`).join('\n')
    : '- no source path identified yet',
)

console.log('\nREAD')
console.log(
  packet.authorities.length
    ? packet.authorities.map((path) => `- ${path}`).join('\n')
    : '- root AGENTS.md / NOW.md, then the smallest authority found during source inspection',
)

console.log('\nSKILLS')
console.log(
  packet.skills.length
    ? packet.skills
        .map((skill) => `- ${skill.role}: ${skill.name} (${skill.path})`)
        .join('\n')
    : '- none',
)
if (packet.suppressedSkills.length) {
  console.log('\nSKILLS NOT LOADED')
  console.log(
    packet.suppressedSkills.map((skill) => `- ${skill.name}: ${skill.reason}`).join('\n'),
  )
}

console.log('\nNEXT')
console.log(packet.next.map((step, index) => `${index + 1}. ${step}`).join('\n'))
