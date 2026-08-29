#!/usr/bin/env node
/**
 * Conformance check: the Claude Code Bash allowlists must match the OpenCode
 * ones they were ported from, except where a divergence is declared in writing.
 *
 * Canonical source: `.opencode/agents/*.md`. Those files are what the cloud
 * Conductor actually executes, and their `permission.bash` block is enforced by
 * OpenCode itself rather than by anything in this repository.
 *
 * Derived: `.claude/hooks/agent-bash-allow.json`, consumed by the PreToolUse
 * hook `.claude/hooks/allow-bash.py`. Claude Code subagent frontmatter has no
 * `permissions` field, so the patterns cannot live in the agent files and a
 * separate record is unavoidable.
 *
 * This is a checker rather than a generator on purpose. The two files are not
 * required to be byte-identical -- the port deliberately corrects two
 * over-broad OpenCode rules -- so generating one from the other would either
 * discard those corrections or silently re-import the bugs. Instead every
 * difference must appear in the `$divergences` register with a reason, and any
 * difference that is not declared fails this check.
 *
 * Run: npm run check:bash-allowlist
 */

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const openCodeDir = resolve(root, '.opencode/agents')
const portPath = resolve(root, '.claude/hooks/agent-bash-allow.json')

/**
 * Extract the `permission.bash` rules from an OpenCode agent's frontmatter.
 * The block is machine-written and stable, so a targeted parser beats adding a
 * YAML dependency for one shape.
 *
 * @param {string} source
 * @returns {{ allow: string[], never: string[] }}
 */
function parseOpenCodeBashRules(source) {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatter) throw new Error('no frontmatter')

  const lines = frontmatter[1].split('\n')
  const start = lines.findIndex((line) => /^\s{2}bash:\s*$/.test(line))
  if (start === -1) return { allow: [], never: [] }

  const allow = []
  const never = []
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) continue
    if (line.trim().startsWith('#')) continue
    // Dedent back to the sibling level ends the bash block.
    if (!/^\s{4}/.test(line)) break

    const rule = line.match(/^\s{4}"(.+)":\s*(allow|deny|ask)\s*$/)
    if (!rule) continue
    const [, pattern, decision] = rule
    // `"*": ask` is OpenCode's fall-through. The port replaces it with
    // default-deny, which is strictly narrower, so it has no counterpart.
    if (pattern === '*') continue
    if (decision === 'allow') allow.push(pattern)
    if (decision === 'deny') never.push(pattern)
  }
  return { allow, never }
}

/** @param {string[]} a @param {string[]} b */
function difference(a, b) {
  const other = new Set(b)
  return a.filter((entry) => !other.has(entry))
}

const port = JSON.parse(readFileSync(portPath, 'utf8'))
const divergences = port.$divergences ?? []
const problems = []

if (!Array.isArray(divergences)) {
  problems.push('$divergences must be an array')
}

const agentFiles = readdirSync(openCodeDir).filter((name) => name.endsWith('.md'))
const agents = agentFiles.map((name) => name.replace(/\.md$/, '')).sort()

const portedAgents = Object.keys(port)
  .filter((key) => !key.startsWith('$'))
  .sort()

for (const missing of difference(agents, portedAgents)) {
  problems.push(`${missing}: defined in .opencode/agents but absent from the port`)
}
for (const extra of difference(portedAgents, agents)) {
  problems.push(`${extra}: present in the port but has no .opencode/agents definition`)
}

for (const agent of agents) {
  const profile = port[agent]
  if (!profile) continue

  const source = parseOpenCodeBashRules(
    readFileSync(resolve(openCodeDir, `${agent}.md`), 'utf8'),
  )

  for (const list of ['allow', 'never']) {
    const declared = divergences.filter((d) => d.agent === agent && d.list === list)

    for (const entry of declared) {
      if (!entry.reason || entry.reason.length < 20) {
        problems.push(
          `${agent}.${list}: divergence for "${entry.pattern}" needs a real reason`,
        )
      }
    }

    const removed = declared.filter((d) => d.change === 'removed').map((d) => d.pattern)
    const added = declared.filter((d) => d.change === 'added').map((d) => d.pattern)

    const expected = new Set([
      ...source[list].filter((pattern) => !removed.includes(pattern)),
      ...added,
    ])
    const actual = new Set(profile[list] ?? [])

    // A declared divergence that no longer describes reality is itself drift:
    // it silently licenses a difference that has since changed shape.
    for (const pattern of removed) {
      if (!source[list].includes(pattern)) {
        problems.push(
          `${agent}.${list}: divergence claims "${pattern}" was removed, but OpenCode does not define it`,
        )
      }
    }
    for (const pattern of added) {
      if (source[list].includes(pattern)) {
        problems.push(
          `${agent}.${list}: divergence claims "${pattern}" was added, but OpenCode already defines it`,
        )
      }
    }

    for (const pattern of difference([...expected], [...actual])) {
      problems.push(
        `${agent}.${list}: "${pattern}" is in OpenCode but missing from the port, and no divergence declares it`,
      )
    }
    for (const pattern of difference([...actual], [...expected])) {
      problems.push(
        `${agent}.${list}: "${pattern}" is in the port but not in OpenCode, and no divergence declares it`,
      )
    }
  }
}

if (problems.length > 0) {
  console.error('Bash allowlist parity FAILED:\n')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error(
    '\nThe canonical source is .opencode/agents/*.md. Either bring',
    '\n.claude/hooks/agent-bash-allow.json back into line, or add an entry to',
    '\nits $divergences register explaining why the two must differ.',
  )
  process.exit(1)
}

console.log(
  `Bash allowlist parity OK: ${agents.length} agents, ` +
    `${divergences.length} declared divergence(s).`,
)
