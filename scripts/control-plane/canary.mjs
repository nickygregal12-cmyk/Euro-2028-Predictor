#!/usr/bin/env node
/**
 * Stage 5 — the delivery canary runner.
 *
 * #1055 built the mutating handlers and proved their sequencing against an
 * injected `runCommand`. It could not prove the loop, because nothing
 * registered them. This registers them, starts the run, and then stops being
 * involved.
 *
 * WHAT IS BEING ACCEPTED HERE IS THE DECISION LOG, NOT THE PULL REQUEST.
 * A pull request opened by an agent proves an agent can call `gh`, which was
 * never in doubt. What this run has to show is:
 *
 *   1. the scheduler chose every task, in dependency order, unprompted
 *   2. the push returned WAITING_CI and the worker exited
 *   3. the task that depends on the push was never dispatched
 *   4. the queue was rescanned and INDEPENDENT work ran while the push waited
 *   5. the run ended WAITING_EXTERNAL — parked, not finished, and not idle
 *
 * OWNER ACTIONS AFTER START = 0. Starting it is the one action; every
 * dispatch after that happens because the engine selected it.
 *
 * WHY THE PULL REQUEST IS NOT A DEPENDANT OF THE PUSH. `delivery.push`
 * deliberately never reaches COMPLETED, so nothing may depend on it and still
 * run. But a pull request for a branch that was never pushed describes a head
 * that does not exist on the remote. The gate is therefore the push's
 * CHECKPOINT rather than its status: parked work still leaves durable evidence
 * behind, and that evidence is what the next task reads. That is the same
 * mechanism a restarted control plane would use to pick this run back up.
 *
 *   node scripts/control-plane/canary.mjs \
 *     --branch <namespace>/<name> --title <text> --body-file <path> \\
 *     --hard-stop <iso> [--message-file <path>] [--independent <json argv>]
 *
 * Nothing here decides what may be delivered. The wrappers and the authority
 * policy do, and they are asked again inside every handler.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { stateDir } from './state.mjs'
import { openControlPlaneState } from './ledger.mjs'
import { LoopEngine } from './loop.mjs'
import { deliveryHandlers, ENFORCEMENT_SURFACE } from './delivery.mjs'
import { readOnlyHandlers } from './cli.mjs'
import { defaultHolder, withWriterLease } from './supervisor.mjs'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** The task id whose checkpoint proves the branch reached the remote. */
export const PUSH_TASK = 'delivery.push'

/** @param {string[]} argv */
function shell(argv) {
  const [command, ...args] = argv
  return execFileSync(/** @type {string} */ (command), args, {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * The canary's handler set: the mutating delivery handlers, the read-only
 * evidence handlers, and two of its own.
 *
 * @param {{ branch: string, title: string, body: string,
 *           runCommand?: (argv: string[]) => string }} options
 */
export function canaryHandlers({ branch, title, body, runCommand = shell }) {
  const delivery = deliveryHandlers({ branch, title, body, runCommand })

  return {
    ...readOnlyHandlers,
    ...delivery,

    /**
     * Stage the working tree, and refuse to stage the gate.
     *
     * `delivery.mjs` already refuses a delivery that touches the enforcement
     * surface, and this is the same refusal one step earlier — at the moment
     * the file list is known rather than after a branch exists. Two edges
     * asking the same question is the pattern the wrappers already use: an
     * authority that is optional to consult is not an authority.
     */
    'canary.stage': async (/** @type {any} */ { at }) => {
      try {
        runCommand(['git', 'add', '--all'])
        const staged = runCommand(['git', 'diff', '--cached', '--name-only'])
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)

        if (staged.length === 0) {
          return {
            ok: false,
            failureClass: 'BRANCH_CODE_FAILURE',
            evidence: 'nothing to deliver: the index is empty',
            blocker: 'NOTHING_STAGED',
          }
        }

        const gate = staged.filter((file) => ENFORCEMENT_SURFACE.includes(file))
        if (gate.length > 0) {
          return {
            ok: false,
            failureClass: 'POLICY_DENIAL',
            evidence: `refusing to stage the enforcement surface: ${gate.join(', ')}`,
            blocker: 'ENFORCEMENT_MODIFIED',
          }
        }

        return {
          ok: true,
          evidence: `staged ${staged.length} file(s)`,
          checkpoint: { at, completed: 'work staged', files: staged },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, failureClass: 'BRANCH_CODE_FAILURE', evidence: message }
      }
    },

    /**
     * Open the pull request, but only once the push has left a checkpoint for
     * this branch. See the header: the push parks rather than completing, so
     * the durable checkpoint is the dependency, not the task status.
     */
    'canary.pr': async (/** @type {any} */ context) => {
      const checkpoint = context.store?.getCheckpoint?.(PUSH_TASK)
      if (!checkpoint || checkpoint.completed !== 'branch pushed') {
        return {
          ok: false,
          failureClass: 'POLICY_DENIAL',
          blocker: 'PUSH_NOT_CHECKPOINTED',
          evidence:
            `no push checkpoint for ${PUSH_TASK}: a pull request would describe a head ` +
            'that is not on the remote',
        }
      }
      if (checkpoint.branch !== branch) {
        return {
          ok: false,
          failureClass: 'POLICY_DENIAL',
          blocker: 'CHECKPOINT_BRANCH_MISMATCH',
          evidence: `push checkpoint is for ${checkpoint.branch}, not ${branch}`,
        }
      }
      return delivery['delivery.pr'](context)
    },
  }
}

/**
 * The canary's task graph.
 *
 * `delivery.merge` has no handler on purpose. It depends on the push, which
 * parks, so the engine must never reach it — and if the engine ever did, the
 * missing handler makes that visible as NO_HANDLER rather than silently
 * merging something. The proof is that it stays QUEUED.
 *
 * @typedef {{ id: string, handler: string, order: number, mutating: boolean,
 *   objective: string, dependencies?: string[], message?: string,
 *   command?: string[] }} CanaryTask
 *
 * @param {{ independentCommand?: string[], commitMessage?: string }} [options]
 * @returns {CanaryTask[]}
 */
export function canaryTasks({ independentCommand, commitMessage } = {}) {
  return [
    { id: 'canary.stage', handler: 'canary.stage', order: 1, mutating: false,
      objective: 'stage the work to be delivered' },
    { id: 'delivery.branch', handler: 'delivery.branch', order: 2, mutating: true,
      dependencies: ['canary.stage'], objective: 'create the task branch' },
    { id: 'delivery.commit', handler: 'delivery.commit', order: 3, mutating: true,
      dependencies: ['delivery.branch'], objective: 'commit the staged work',
      ...(commitMessage ? { message: commitMessage } : {}) },
    { id: PUSH_TASK, handler: 'delivery.push', order: 4, mutating: true,
      dependencies: ['delivery.commit'], objective: 'push the task branch' },
    { id: 'canary.pr', handler: 'canary.pr', order: 5, mutating: true,
      dependencies: ['delivery.commit'], objective: 'open the pull request' },
    { id: 'delivery.merge', handler: 'delivery.merge', order: 6, mutating: true,
      dependencies: [PUSH_TASK], objective: 'merge once required checks report on this head' },
    ...(independentCommand
      ? [{ id: 'independent.evidence', handler: 'tests.focused', order: 7, mutating: false,
          command: independentCommand,
          objective: 'independent work that must proceed while the push waits' }]
      : []),
  ]
}

/**
 * @param {string[]} argv
 * @param {string} name
 * @returns {string | null}
 */
function valuedArg(argv, name) {
  const index = argv.indexOf(`--${name}`)
  if (index === -1) return null
  const value = argv[index + 1]
  return typeof value === 'string' && !value.startsWith('--') ? value : null
}

async function main() {
  const argv = process.argv.slice(2)
  const branch = valuedArg(argv, 'branch')
  const title = valuedArg(argv, 'title')
  const bodyFile = valuedArg(argv, 'body-file')
  const messageFile = valuedArg(argv, 'message-file')
  const hardStop = valuedArg(argv, 'hard-stop')

  if (!branch || !title || !bodyFile || !hardStop) {
    console.error(
      'Usage: canary.mjs --branch <ns>/<name> --title <text> --body-file <path> ' +
        '--hard-stop <ISO> [--message-file <path>] [--independent <json argv>] [--max-ticks N]',
    )
    process.exitCode = 2
    return
  }
  if (Number.isNaN(Date.parse(hardStop))) {
    console.error('--hard-stop must be an ISO timestamp')
    process.exitCode = 2
    return
  }

  const body = readFileSync(bodyFile, 'utf8')
  // The commit message is read from a file rather than argv so the record can be
  // a real multi-paragraph message. The wrapper still only accepts --message.
  const commitMessage = messageFile ? readFileSync(messageFile, 'utf8') : title
  const independentRaw = valuedArg(argv, 'independent')
  const independentCommand = independentRaw ? JSON.parse(independentRaw) : undefined
  const maxTicksRaw = valuedArg(argv, 'max-ticks')
  const maxTicks = maxTicksRaw === null ? 20 : Number(maxTicksRaw)
  if (!Number.isFinite(maxTicks) || maxTicks < 1) {
    console.error('--max-ticks must be a positive number')
    process.exitCode = 2
    return
  }

  const now = () => new Date().toISOString()
  const store = openControlPlaneState()

  // Behind the writer lane, because this is the most destructive thing that
  // drives the engine: `startRun` resets the run a supervisor may be in the
  // middle of, and the handlers registered below push branches and open pull
  // requests. Running it alongside a supervisor was possible until now, and
  // "two writers" understates it — one of them would be rewriting the other's
  // run record while the other was mid-delivery.
  const outcome = await withWriterLease(store, { holder: defaultHolder('canary'), now }, async () => {
    // ACTIVE, because the whole point is that mutation is dispatched. The brake
    // is `maxPullRequests`, and one is all this run may open.
    store.startRun({ hardStop, mode: 'ACTIVE', now: now(), maxPullRequests: 1 })
    for (const task of canaryTasks({ independentCommand, commitMessage })) store.upsertTask(task)

    const engine = new LoopEngine({
      store,
      handlers: canaryHandlers({ branch, title, body }),
      now,
    })

    const decisions = await engine.run({ maxTicks })
    for (const decision of decisions) {
      const status = 'status' in decision ? decision.status : ''
      console.log(
        [decision.at, decision.outcome, decision.dispatched ?? '', status ?? '']
          .filter(Boolean)
          .join(' '),
      )
    }
    console.log(`\nstate dir: ${stateDir()}`)
    for (const task of store.listTasks()) {
      console.log(`  [${(task.status ?? 'QUEUED').padEnd(14)}] ${task.id}`)
    }
  })

  if (!outcome.acquired) {
    // Not an error in the canary: somebody else owns the lane, and starting a
    // delivery run underneath them is the thing being prevented.
    console.error(`writer lane held by ${outcome.heldBy} until ${outcome.expiresAt}; not starting`)
    process.exitCode = 1
    return
  }

  if (!outcome.heldToTheEnd) {
    // The lease is not renewed while the run is in flight, so a canary that
    // outlived its TTL has been sharing the lane. Nothing here can undo that;
    // saying so is the difference between a known overlap and a silent one.
    console.error(
      'WARNING: the writer lane expired during this run and was taken by another ' +
        'process. Anything this canary did after that point overlapped another writer — ' +
        'check the branch, the pull request and the run record before trusting them.',
    )
    process.exitCode = 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
