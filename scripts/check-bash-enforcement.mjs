#!/usr/bin/env node
/**
 * Operator check: is the Bash gate actually ACTIVE on this machine?
 *
 * `npm run check:bash-allowlist` proves the policy is well-formed and
 * `tests/scripts/agentBashClassifier.test.ts` proves it classifies correctly.
 * Neither proves the gate runs. A hook that never loads classifies nothing.
 *
 * Verified on 27 August 2026: Claude Code does not load PROJECT hooks in a
 * directory whose trust dialog has not been accepted. In an untrusted fresh
 * clone the write-capable predictor-builder agent loaded and executed an
 * un-allowlisted command, because this repository's own hook was never
 * registered. Worktrees inherit the parent repository's trust, so the exposure
 * is specifically a new repository path before it is trusted.
 *
 * The fix therefore cannot live only in this repository. A machine-scope hook
 * loads regardless of project trust; this script verifies that prerequisite is
 * installed and functioning. It is deliberately NOT a CI merge gate -- CI has
 * no operator machine and nothing for it to assert. It is what an operator runs
 * on a workstation or cloud runner before letting delegated agents loose.
 *
 * Run: npm run check:bash-enforcement
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const problems = []
const notes = []

const settingsPath = join(homedir(), '.claude', 'settings.json')
const gatePath = join(homedir(), '.claude', 'hooks', 'studio-bash-gate.py')
const ceilingPath = join(homedir(), '.claude', 'hooks', 'studio-bash-ceiling.json')

// 1. A machine-scope PreToolUse hook must be registered for Bash.
let registeredCommand = null
if (!existsSync(settingsPath)) {
  problems.push(`no machine settings at ${settingsPath}`)
} else {
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    const entries = settings?.hooks?.PreToolUse ?? []
    for (const entry of entries) {
      if (entry?.matcher !== 'Bash') continue
      for (const hook of entry.hooks ?? []) {
        if (typeof hook?.command === 'string' && hook.command.includes('studio-bash-gate')) {
          registeredCommand = hook.command
        }
      }
    }
    if (!registeredCommand) {
      problems.push('no machine-scope PreToolUse Bash hook invoking studio-bash-gate is registered')
    }
  } catch (error) {
    problems.push(`machine settings are not readable JSON: ${error.message}`)
  }
}

// 2. The gate and its ceiling must exist and be readable.
if (!existsSync(gatePath)) problems.push(`gate missing: ${gatePath}`)
if (!existsSync(ceilingPath)) problems.push(`ceiling missing: ${ceilingPath}`)

// 3. Functional probe. Presence is not proof; ask the gate to refuse something.
//    A command that mutates history is refused for every delegated agent in
//    every repository, so this holds regardless of local policy.
if (problems.length === 0) {
  const probe = (agentType, command) => {
    const payload = JSON.stringify({
      tool_name: 'Bash',
      agent_type: agentType,
      cwd: resolve('.'),
      tool_input: { command },
    })
    const stdout = execFileSync('python3', [gatePath], { input: payload, encoding: 'utf8' })
    return stdout.includes('"permissionDecision"') ? 'DENY' : 'PASS'
  }

  if (probe('predictor-builder', 'git commit -m probe') !== 'DENY') {
    problems.push('the gate did not refuse a raw git commit for a write-capable agent')
  }
  if (probe('predictor-builder', 'git status') !== 'PASS') {
    problems.push('the gate refused read-only git for the builder; policy is broken, not merely strict')
  }
  // The operator's own session must remain untouched.
  const mainSession = JSON.stringify({
    tool_name: 'Bash', cwd: resolve('.'), tool_input: { command: 'git commit -m probe' },
  })
  const mainOut = execFileSync('python3', [gatePath], { input: mainSession, encoding: 'utf8' })
  if (mainOut.includes('"permissionDecision"')) {
    problems.push('the gate is adjudicating the operator main session; it must only govern delegated agents')
  }

  notes.push(`registered: ${registeredCommand}`)
}

// 4. Project-hook trust is reported, not required. It is defence in depth: when
//    the repository IS trusted both gates run, and when it is not the machine
//    gate still does.
try {
  const config = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'))
  // A worktree inherits the trust of the repository it belongs to (verified
  // 27 Aug 2026: a worktree of a trusted repo is gated by the project hook
  // while a worktree of an untrusted clone is not, and neither worktree path
  // is itself registered). So resolve to the main worktree, not to cwd.
  let root = resolve('.')
  try {
    const commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8',
    }).trim()
    if (commonDir.endsWith('/.git')) root = commonDir.slice(0, -'/.git'.length)
  } catch {
    // Not a git checkout, or git unavailable. Fall back to cwd.
  }
  const trusted = config?.projects?.[root]?.hasTrustDialogAccepted
  notes.push(
    trusted === true
      ? `repository ${root} is trusted, so the project hook runs as defence in depth`
      : `repository ${root} is NOT trusted, so the project hook will not load; the machine gate is the only enforcement here`,
  )
} catch {
  notes.push('machine project registry unreadable; trust state unknown')
}

if (problems.length > 0) {
  console.error('Bash enforcement is NOT active:\n')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error(
    '\nDelegated write-capable agents must not be used on this machine until this passes.',
    '\nInstall the machine prerequisite: ~/.claude/hooks/studio-bash-gate.py plus',
    '\nstudio-bash-ceiling.json, registered as a PreToolUse Bash hook in',
    '\n~/.claude/settings.json. See the $deployment-note in',
    '\n.claude/hooks/agent-bash-allow.json for why this cannot live in the repository.',
  )
  process.exit(1)
}

console.log('Bash enforcement is active (machine-scope gate registered and refusing).')
for (const note of notes) console.log(`  - ${note}`)
