#!/usr/bin/env node
/**
 * Loop Bootstrap control surface.
 *
 *   node scripts/control-plane/cli.mjs init --hard-stop <iso> [--mode ACTIVE]
 *   node scripts/control-plane/cli.mjs add <id> --objective <text> [--after a,b]
 *                                             [--handler name] [--mutating]
 *   node scripts/control-plane/cli.mjs run [--max-ticks N]
 *   node scripts/control-plane/cli.mjs status
 *   node scripts/control-plane/cli.mjs stop [--reason text] | resume
 *
 * State lives outside the repository (see state.mjs). Nothing here mutates a
 * hosted service: `pr.triage` reads a PR payload someone else fetched.
 */

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

import { ControlPlaneStore, stateDir } from './state.mjs'
import { LoopEngine } from './loop.mjs'
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
 * Built-in handlers. Each is read-only: it gathers evidence and returns it.
 * Mutating handlers are registered by the caller, never shipped as defaults.
 *
 * @type {Record<string, (ctx: any) => Promise<any>>}
 */
export const readOnlyHandlers = {
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
    const triage = triagePullRequest(pr, {
      redOnBase: task.redOnBase ?? [],
      previouslyGreenOnSameSha: task.previouslyGreenOnSameSha ?? [],
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
  const store = new ControlPlaneStore()

  switch (command) {
    case 'init': {
      const run = store.startRun({
        hardStop: arg(argv, 'hard-stop'),
        mode: arg(argv, 'mode', 'OBSERVE_ONLY'),
        now: now(),
        maxPullRequests: Number(arg(argv, 'max-prs', 8)),
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
        order: Number(arg(argv, 'order', 0)),
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
      const engine = new LoopEngine({ store, handlers: readOnlyHandlers, now })
      const decisions = await engine.run({ maxTicks: Number(arg(argv, 'max-ticks', 50)) })
      for (const decision of decisions) {
        console.log(`${decision.at} ${decision.outcome} ${decision.dispatched ?? ''}`.trim())
      }
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
