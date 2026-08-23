#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const benchmarkPath = resolve(root, 'config/agent-context-benchmarks.json')
const routingPath = resolve(root, 'config/agent-routing.json')
const skillsPath = resolve(root, 'config/agent-skills.json')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function route(prompt) {
  const output = execFileSync(
    process.execPath,
    ['scripts/agent-tools/route-task.mjs', '--no-graph', '--json', prompt],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  return JSON.parse(output)
}

const args = new Set(process.argv.slice(2))
const check = args.has('--check')
const jsonOutput = args.has('--json')
for (const arg of args) {
  if (!['--check', '--json'].includes(arg)) {
    console.error(`agent:bench: unknown option '${arg}'`)
    process.exit(2)
  }
}

const benchmark = readJson(benchmarkPath)
const routing = readJson(routingPath)
const skillRegistry = readJson(skillsPath)
const limits = benchmark.limits ?? {}
const failures = []
const rows = []

function expect(condition, message) {
  if (!condition) failures.push(message)
}

expect(
  Number(routing.graphifyBudget) <= Number(limits.maxGraphifyBudget),
  `graphifyBudget ${routing.graphifyBudget} exceeds ${limits.maxGraphifyBudget}`,
)
expect(
  Number(routing.maxCandidatePaths) <= Number(limits.maxCandidatePaths),
  `maxCandidatePaths ${routing.maxCandidatePaths} exceeds ${limits.maxCandidatePaths}`,
)
expect(
  Number(routing.maxAuthorities) <= Number(limits.maxAuthorities),
  `maxAuthorities ${routing.maxAuthorities} exceeds ${limits.maxAuthorities}`,
)

const prompts = new Set()
for (const benchmarkCase of benchmark.cases ?? []) {
  expect(!prompts.has(benchmarkCase.prompt), `${benchmarkCase.id}: duplicate benchmark prompt`)
  prompts.add(benchmarkCase.prompt)

  const packet = route(benchmarkCase.prompt)
  const routeNames = packet.routes ?? []
  const skillNames = (packet.skills ?? []).map((skill) => skill.name)
  const authorityLimit = Number(benchmarkCase.maxAuthorities ?? limits.maxAuthorities)
  const skillLimit = Number(benchmarkCase.maxSelectedSkills ?? limits.maxSelectedSkills)
  const packetBytes = Buffer.byteLength(JSON.stringify(packet), 'utf8')

  expect(packet.orientation?.graphify === 'skipped', `${benchmarkCase.id}: benchmark must stay network-free`)

  for (const requiredRoute of benchmarkCase.requiredRoutes ?? []) {
    expect(routeNames.includes(requiredRoute), `${benchmarkCase.id}: missing route ${requiredRoute}`)
  }
  for (const requiredSkill of benchmarkCase.requiredSkills ?? []) {
    expect(skillNames.includes(requiredSkill), `${benchmarkCase.id}: missing skill ${requiredSkill}`)
  }
  for (const forbiddenSkill of benchmarkCase.forbiddenSkills ?? []) {
    expect(!skillNames.includes(forbiddenSkill), `${benchmarkCase.id}: unexpectedly loaded ${forbiddenSkill}`)
  }

  if (benchmarkCase.expectNoDeterministicFallback) {
    expect(routeNames.length === 0, `${benchmarkCase.id}: should rely on Graphify rather than guess a fallback route`)
    expect(skillNames.length === 0, `${benchmarkCase.id}: graph-required fallback should not preload skills`)
  }

  expect(
    (packet.authorities ?? []).length <= authorityLimit,
    `${benchmarkCase.id}: ${(packet.authorities ?? []).length} authorities exceeds ${authorityLimit}`,
  )
  expect(
    skillNames.length <= skillLimit,
    `${benchmarkCase.id}: ${skillNames.length} selected skills exceeds ${skillLimit}`,
  )
  expect(
    packetBytes <= Number(limits.maxPacketBytesWithoutGraph),
    `${benchmarkCase.id}: ${packetBytes} packet bytes exceeds ${limits.maxPacketBytesWithoutGraph}`,
  )

  const roleCounts = new Map()
  for (const skill of packet.skills ?? []) {
    roleCounts.set(skill.role, (roleCounts.get(skill.role) ?? 0) + 1)
  }
  for (const [role, count] of roleCounts) {
    const roleLimit = Number(skillRegistry.budget?.[role] ?? 1)
    expect(count <= roleLimit, `${benchmarkCase.id}: ${role} skill count ${count} exceeds role budget ${roleLimit}`)
  }

  rows.push({
    id: benchmarkCase.id,
    routes: routeNames.length,
    authorities: (packet.authorities ?? []).length,
    skills: skillNames.length,
    packetBytes,
    graphRequired: Boolean(benchmarkCase.expectNoDeterministicFallback),
  })
}

const result = {
  ok: failures.length === 0,
  limits,
  routing: {
    graphifyBudget: routing.graphifyBudget,
    maxCandidatePaths: routing.maxCandidatePaths,
    maxAuthorities: routing.maxAuthorities,
  },
  cases: rows,
  failures,
}

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log('Agent context acceptance benchmark')
  console.log(
    `Limits: Graphify ${routing.graphifyBudget}/${limits.maxGraphifyBudget} tokens; ` +
      `candidate paths ${routing.maxCandidatePaths}/${limits.maxCandidatePaths}; ` +
      `authorities ${routing.maxAuthorities}/${limits.maxAuthorities}`,
  )
  console.table(rows)
  if (failures.length) {
    console.error('\nFailures:')
    for (const failure of failures) console.error(`- ${failure}`)
  } else {
    console.log('\nAll representative simple-prompt packets are within the configured context budget.')
  }
}

if (check && failures.length) process.exit(1)
