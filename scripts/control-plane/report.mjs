/**
 * What the programme is doing, for someone holding a phone.
 *
 * `status` already lists every task and its state. That is the right thing to
 * read at a desk and the wrong thing to read on a phone, because it answers
 * "what are all the tasks" when the only question that matters away from the
 * machine is DOES THIS NEED ME. A list of fourteen rows where one of them is
 * `WAITING_OWNER` makes the reader do the filtering, and a reader doing the
 * filtering on a train will miss it.
 *
 * So this leads with the verdict and then justifies it. Everything else —
 * parked work, provider health, blocked tasks — is below the answer rather than
 * around it.
 *
 * IT DECIDES NOTHING AND CHANGES NOTHING. It reads the ledger and formats it.
 * A reporting layer that could act would be a second place where the programme
 * advances, and the whole design has one.
 */

import { EXTERNAL_WAITING_STATES, ineligibilityReason } from './policy.mjs'

/**
 * @typedef {{ verdict: string, headline: string, run: any,
 *   needsOwner: any[], parked: any[], blocked: any[], running: any[],
 *   done: number, total: number, providers: Record<string, any> }} Summary
 */

/**
 * One word for whether anyone is needed, and one line saying why.
 *
 * The order is deliberate: a stopped programme is stopped whatever else is
 * true, and something waiting on a person outranks something waiting on a
 * machine, because only one of the two will resolve itself.
 *
 * @param {import('./state.mjs').ControlPlaneState} store
 * @param {{ now: string }} options
 * @returns {Summary}
 */
export function summariseRun(store, { now }) {
  const run = store.loadRun()
  if (!run) {
    return {
      verdict: 'NO_RUN',
      headline: 'No run has been started.',
      run: null,
      needsOwner: [], parked: [], blocked: [], running: [],
      done: 0, total: 0, providers: {},
    }
  }

  const tasks = store.listTasks()
  const stateOf = (/** @type {any} */ task) => task.status ?? 'QUEUED'
  const needsOwner = tasks.filter((task) => stateOf(task) === 'WAITING_OWNER')
  const parked = tasks.filter((task) => EXTERNAL_WAITING_STATES.includes(stateOf(task)))
  const blocked = tasks.filter((task) => stateOf(task) === 'BLOCKED')
  // "Runnable" is the scheduler's answer, not a state name. Counting every
  // QUEUED task as runnable read a canary run as WORKING when the only queued
  // task was `delivery.merge`, which depends on a parked push and can never be
  // dispatched — found by running the report against a real ledger rather than
  // a fixture. A control room that says WORKING while nothing works is worse
  // than one that says nothing.
  const byId = Object.fromEntries(tasks.map((task) => [task.id, task]))
  const running = tasks.filter(
    (task) =>
      stateOf(task) === 'RUNNING' ||
      (['QUEUED', 'ELIGIBLE'].includes(stateOf(task)) && ineligibilityReason(task, byId) === null),
  )
  const done = tasks.filter((task) => stateOf(task) === 'COMPLETED').length

  const hardStopped = Boolean(run.hardStop) && Date.parse(now) >= Date.parse(String(run.hardStop))

  let verdict = 'WORKING'
  let headline = `${running.length} task(s) runnable, ${done}/${tasks.length} done.`

  if (run.emergencyStop) {
    verdict = 'STOPPED'
    headline = 'Emergency stop is engaged. Nothing will be dispatched until it is cleared.'
  } else if (hardStopped) {
    verdict = 'STOPPED'
    headline = `The hard stop at ${run.hardStop} has passed. Nothing further will be dispatched.`
  } else if (needsOwner.length > 0) {
    verdict = 'NEEDS_YOU'
    const first = /** @type {any} */ (needsOwner[0])
    headline = needsOwner.length === 1
      ? `${first.id}: ${first.nextAction ?? first.blocker ?? 'waiting on a decision'}`
      : `${needsOwner.length} tasks are waiting on you, starting with ${first.id}.`
  } else if (running.length === 0 && parked.length > 0) {
    verdict = 'WAITING'
    headline = `Nothing to do but wait: ${parked.length} task(s) parked on external state.`
  } else if (running.length === 0 && blocked.length > 0) {
    verdict = 'BLOCKED'
    headline = `${blocked.length} task(s) blocked and nothing else runnable.`
  } else if (tasks.length > 0 && done === tasks.length) {
    verdict = 'DONE'
    headline = 'Every task is complete.'
  }

  return {
    verdict,
    headline,
    run,
    needsOwner, parked, blocked, running,
    done, total: tasks.length,
    providers: run.providerHealth ?? {},
  }
}

/** @param {any} task */
const line = (task) => {
  const why = task.nextAction ?? task.blocker ?? task.evidence ?? ''
  return `  ${task.id}${why ? ` — ${why}` : ''}`
}

/**
 * Render the summary as text narrow enough to read on a phone.
 *
 * Sections are omitted when empty rather than printed as "none". A screen that
 * always shows the same headings trains the reader to skip them, and the one
 * time a heading has something under it is the time they will not look.
 *
 * @param {Summary} summary
 * @returns {string}
 */
export function renderText(summary) {
  if (summary.verdict === 'NO_RUN') return 'NO RUN\n\nNo run has been started.'

  const out = [`${summary.verdict.replace('_', ' ')}`, '', summary.headline, '']

  // With exactly one, the headline already IS the item — repeating it makes the
  // reader check whether the two lines differ.
  if (summary.needsOwner.length > 1) {
    out.push('WAITING ON YOU', ...summary.needsOwner.map(line), '')
  }
  if (summary.parked.length > 0) {
    out.push(
      'WAITING ON SOMETHING ELSE',
      ...summary.parked.map((task) => `  ${task.id} — ${task.status}${task.nextAction ? `: ${task.nextAction}` : ''}`),
      '',
    )
  }
  if (summary.blocked.length > 0) {
    out.push('BLOCKED', ...summary.blocked.map(line), '')
  }

  const unhealthy = Object.values(summary.providers).filter(
    (/** @type {any} */ health) => health?.state && health.state !== 'READY',
  )
  if (unhealthy.length > 0) {
    out.push(
      'PROVIDERS',
      ...unhealthy.map((/** @type {any} */ h) =>
        `  ${h.id} — ${h.state.toLowerCase()}${h.reason ? ` after ${h.reason}` : ''}${h.until ? ` until ${h.until}` : ''}`),
      '',
    )
  }

  const run = summary.run
  out.push(
    'RUN',
    `  mode ${run.mode}${run.emergencyStop ? ', EMERGENCY STOP ENGAGED' : ''}`,
    `  pull requests ${run.pullRequestsOpened ?? 0}/${run.maxPullRequests}`,
    `  hard stop ${run.hardStop}`,
    `  ${summary.done}/${summary.total} tasks complete`,
  )

  return out.join('\n')
}
