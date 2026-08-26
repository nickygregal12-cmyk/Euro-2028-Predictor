#!/usr/bin/env node
/**
 * Loop Bootstrap control surface.
 *
 *   node scripts/control-plane/cli.mjs init --hard-stop <iso> [--mode ACTIVE]
 *   node scripts/control-plane/cli.mjs add <id> --objective <text> [--after a,b]
 *                                             [--handler name] [--mutating]
 *   node scripts/control-plane/cli.mjs run [--max-ticks N]
 *   node scripts/control-plane/cli.mjs supervise [--max-passes N]
 *   node scripts/control-plane/cli.mjs status
 *   node scripts/control-plane/cli.mjs stop [--reason text] | resume
 *
 * State lives outside the repository (see state.mjs). Nothing here mutates a
 * hosted service: `pr.triage` reads a PR payload someone else fetched.
 */

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

import { stateDir } from './state.mjs'
import { openControlPlaneState } from './ledger.mjs'
import { LoopEngine } from './loop.mjs'
import { Supervisor } from './supervisor.mjs'
import { watchHandlers } from './watch.mjs'
import { normalisePullRequest, triagePullRequest } from './github.mjs'

const now = () => new Date().toISOString()

/**
 * @param {string[]} argv
 * @param {string} name
 * @param {any} [fallback]
 * @returns {any}
 */
function arg(argv, name, fallback = undefined) {
  const index = argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = argv[index + 1]
  return value && !value.startsWith('--') ? value : true
}

/**
 * Read a flag that must carry a real value. `arg` yields `true` for a bare
 * `--flag`, which silently became NaN once parsed as a date or a number — so a
 * mistyped safety limit disabled the brake instead of failing the command.
 *
 * @param {string[]} argv
 * @param {string} name
 * @returns {string | null}
 */
function valuedArg(argv, name) {
  const value = arg(argv, name)
  return typeof value === 'string' ? value : null
}

/**
 * @param {string[]} argv
 * @param {string} name
 * @param {number} fallback
 * @returns {number | null} null when present but not a finite number
 */
function numericArg(argv, name, fallback) {
  const raw = arg(argv, name)
  if (raw === undefined) return fallback
  const value = Number(valuedArg(argv, name))
  return Number.isFinite(value) ? value : null
}

/**
 * Built-in handlers. Each is read-only: it gathers evidence and returns it.
 * Mutating handlers are registered by the caller, never shipped as defaults.
 *
 * @type {Record<string, (ctx: any) => Promise<any>>}
 */
export const readOnlyHandlers = {
  // `ci.watch` reads GitHub and moves a parked task; it cannot push, comment or
  // merge, so it belongs with the read-only set rather than behind the same
  // deliberate registration the mutating handlers need.
  ...watchHandlers(),

  /** Reconcile local git against origin and persist what was observed. */
  'git.reconcile': async ({ at }) => {
    const git = (/** @type {string[]} */ ...args) =>
      execFileSync('git', args, { encoding: 'utf8' }).trim()
    try {
      git('fetch', '--quiet', 'origin', 'main')
      const evidence = {
        head: git('rev-parse', 'HEAD'),
        branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
        originMain: git('rev-parse', 'origin/main'),
        clean: git('status', '--porcelain') === '',
      }
      return {
        ok: true,
        evidence: JSON.stringify(evidence),
        checkpoint: { at, sha: evidence.head, completed: 'git reconciliation', observed: evidence },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, failureClass: 'UNKNOWN', evidence: message }
    }
  },

  /** Run a bounded, explicitly listed test command and record the real result. */
  'tests.focused': async ({ task, at }) => {
    const command = task.command
    if (!Array.isArray(command) || command.length === 0) {
      return { ok: false, failureClass: 'UNKNOWN', evidence: 'task.command must be an argv array' }
    }
    try {
      const output = execFileSync(command[0], command.slice(1), {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: task.timeoutMs ?? 15 * 60 * 1000,
      })
      const tail = output.trim().split('\n').slice(-5).join('\n')
      return { ok: true, evidence: tail, checkpoint: { at, completed: command.join(' '), tests: tail } }
    } catch (error) {
      const failed = /** @type {{ stdout?: string, stderr?: string }} */ (error)
      const output = `${failed?.stdout ?? ''}${failed?.stderr ?? ''}`.trim()
      const { classifyFailure } = await import('./policy.mjs')
      return {
        ok: false,
        failureClass: classifyFailure({ name: command.join(' '), output }),
        evidence: output.split('\n').slice(-15).join('\n'),
      }
    }
  },

  /** Triage a previously observed PR payload. Pure: no network from here. */
  'pr.triage': async ({ task, at }) => {
    if (!task.observationFile) {
      return { ok: false, failureClass: 'UNKNOWN', evidence: 'task.observationFile is required' }
    }
    const raw = JSON.parse(readFileSync(task.observationFile, 'utf8'))
    const pr = normalisePullRequest(raw, {
      requiredCheckNames: task.requiredChecks ?? [],
      baseSha: task.baseSha,
    })
    // Both come from the observation, and from nowhere else. They used to be
    // task fields, which meant a record could DECLARE a failure inherited or
    // flaky and the classifier would agree — the editable-data escape hatch the
    // authority policy refuses for exactly the same reason. "Flake" is a claim
    // about one commit, and only that commit's own history can support it.
    const experience = raw.experience ?? {}
    const triage = triagePullRequest(pr, {
      redOnBase: experience.redOnBase ?? [],
      previouslyGreenOnSameSha: experience.previouslyGreenOnSameSha ?? [],
    })
    return {
      ok: true,
      // Triage parks the task where the PR actually is; it never marks a PR done.
      status: triage.status === 'ELIGIBLE' ? 'ELIGIBLE' : triage.status,
      nextAction: triage.nextAction,
      evidence: JSON.stringify(triage),
      checkpoint: { at, sha: triage.headSha, pr: triage.number, awaiting: triage.pending, triage },
    }
  },
}

async function main() {
  const argv = process.argv.slice(2)
  const command = argv[0]
  const store = openControlPlaneState()

  switch (command) {
    case 'init': {
      const hardStop = valuedArg(argv, 'hard-stop')
      if (!hardStop || Number.isNaN(Date.parse(hardStop))) {
        console.error('init requires --hard-stop <ISO timestamp>, e.g. 2026-08-25T06:00:00Z')
        process.exitCode = 2
        return
      }
      const maxPullRequests = numericArg(argv, 'max-prs', 8)
      if (maxPullRequests === null || maxPullRequests < 0) {
        console.error('--max-prs must be a non-negative number')
        process.exitCode = 2
        return
      }
      const run = store.startRun({
        hardStop,
        mode: arg(argv, 'mode', 'OBSERVE_ONLY'),
        now: now(),
        maxPullRequests,
      })
      console.log(JSON.stringify({ stateDir: stateDir(), run }, null, 2))
      return
    }

    case 'add': {
      const id = argv[1]
      if (!id) {
        console.error('add requires a task id')
        process.exitCode = 2
        return
      }
      const task = store.upsertTask({
        id,
        objective: arg(argv, 'objective', id),
        handler: arg(argv, 'handler', 'git.reconcile'),
        stage: arg(argv, 'stage', null),
        order: numericArg(argv, 'order', 0) ?? 0,
        dependencies: String(arg(argv, 'after', '')).split(',').filter(Boolean),
        mutating: arg(argv, 'mutating', false) === true,
        command: arg(argv, 'command') ? JSON.parse(arg(argv, 'command')) : undefined,
        observationFile: arg(argv, 'observation'),
        requiredChecks: arg(argv, 'required') ? String(arg(argv, 'required')).split(',') : undefined,
      })
      console.log(JSON.stringify(task, null, 2))
      return
    }

    case 'run': {
      const maxTicks = numericArg(argv, 'max-ticks', 50)
      if (maxTicks === null || maxTicks < 1) {
        console.error('--max-ticks must be a positive number')
        process.exitCode = 2
        return
      }
      const engine = new LoopEngine({ store, handlers: readOnlyHandlers, now })
      const decisions = await engine.run({ maxTicks })
      for (const decision of decisions) {
        console.log(`${decision.at} ${decision.outcome} ${decision.dispatched ?? ''}`.trim())
      }
      return
    }

    case 'supervise': {
      // The persistent form of `run`. Same handlers — `readOnlyHandlers` is
      // still the default set, because a supervisor started to watch a
      // programme must not be able to push. A caller that wants mutation
      // registers the delivery handlers itself, exactly as `run` requires.
      const maxPasses = numericArg(argv, 'max-passes', 1000)
      if (maxPasses === null || maxPasses < 1) {
        console.error('--max-passes must be a positive number')
        process.exitCode = 2
        return
      }
      const supervisor = new Supervisor({
        store,
        handlers: readOnlyHandlers,
        now,
        sleep: (ms) => new Promise((resolve) => { setTimeout(resolve, ms) }),
        maxPasses,
        log: (message) => { console.log(`${now()} ${message}`) },
      })
      const result = await supervisor.run()
      console.log(`${result.outcome} after ${result.passes.length} pass(es)`)
      if (result.outcome === 'LEASE_HELD') process.exitCode = 1
      return
    }

    case 'status': {
      const run = store.loadRun()
      const tasks = store.listTasks()
      console.log(`state dir: ${stateDir()}`)
      if (!run) {
        console.log('no run initialised')
        return
      }
      console.log(
        `run ${run.runId} mode=${run.mode} emergencyStop=${run.emergencyStop} ` +
          `prs=${run.pullRequestsOpened}/${run.maxPullRequests} hardStop=${run.hardStop}`,
      )
      console.log(`last progress: ${run.lastProgressAt}`)
      for (const task of tasks) {
        const status = task.status ?? 'QUEUED'
        const blocker = task.blocker ? ` blocker=${task.blocker}` : ''
        const next = task.nextAction ? ` next=${task.nextAction}` : ''
        console.log(
          `  [${status.padEnd(14)}] ${task.id} attempts=${task.attempts}${blocker}${next}`,
        )
      }
      return
    }

    case 'stop': {
      store.setEmergencyStop(true, now(), arg(argv, 'reason', 'operator request'))
      console.log('EMERGENCY_STOP engaged')
      return
    }

    case 'resume': {
      store.setEmergencyStop(false, now(), arg(argv, 'reason', 'operator request'))
      console.log('EMERGENCY_STOP cleared')
      return
    }

    default:
      console.error(`unknown command: ${command ?? '(none)'}`)
      process.exitCode = 2
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
