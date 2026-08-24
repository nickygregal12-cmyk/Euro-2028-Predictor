// WHETHER A FRESH PROBE RECORD IS WORTH COMMITTING.
//
// The status page renders the COMMITTED record, so a scheduled run only reaches
// a reader by way of a commit. Committing every run would be the obvious
// implementation and the wrong one: the probe runs four times a day and its
// `checkedAt` changes every time, so the repository would gain four commits a
// day that say nothing new. History that nobody can skim is history nobody
// reads.
//
// Committing ONLY on change is the other obvious implementation, and is also
// wrong on its own: a page that has said "checked on the 3rd" since the 3rd
// gives a reader no way to tell a stable system from a stopped probe. Silence
// and health look identical, which is the failure this whole stage exists to
// avoid.
//
// So: publish when the ANSWER changed, and otherwise no more than once a day to
// prove the probe is still running. Pure — two records in, a decision and a
// reason out — so every branch is testable without a network or a repository.

/** After this long, a repeat of the same answer is still worth publishing. */
export const REFRESH_AFTER_HOURS = 24

/**
 * @typedef {object} StepShape
 * @property {string} id
 * @property {boolean} ok
 * @property {string} [reason]
 */

/**
 * @typedef {object} RecordShape
 * @property {string | null} checkedAt
 * @property {string | null} origin
 * @property {boolean | null} ok
 * @property {readonly StepShape[]} steps
 */

/**
 * The part of a record that is an ANSWER rather than a timestamp.
 *
 * `milliseconds` is deliberately excluded: it moves every run by a few
 * milliseconds and means nothing to a reader of the page, so treating it as a
 * change would reinstate exactly the churn this avoids.
 *
 * @param {RecordShape} record
 */
function answer(record) {
  return JSON.stringify({
    origin: record.origin,
    ok: record.ok,
    steps: (record.steps ?? []).map((step) => ({
      id: step.id,
      ok: step.ok,
      reason: step.reason ?? null,
    })),
  })
}

/**
 * @param {RecordShape} committed  What the repository holds today.
 * @param {RecordShape} fresh      What this run produced.
 * @param {number} [refreshAfterHours]
 * @returns {{ publish: boolean, reason: string }}
 */
export function publishDecision(committed, fresh, refreshAfterHours = REFRESH_AFTER_HOURS) {
  if (fresh.checkedAt === null) {
    // Refusing here rather than committing a record with no moment in it: the
    // page's whole claim is that it names when it was checked.
    return { publish: false, reason: 'The fresh record names no moment, so there is nothing to publish.' }
  }

  if (committed.checkedAt === null) {
    return { publish: true, reason: 'No check has been published before.' }
  }

  if (answer(committed) !== answer(fresh)) {
    return { publish: true, reason: 'The answer changed since the published record.' }
  }

  const before = Date.parse(committed.checkedAt)
  const now = Date.parse(fresh.checkedAt)
  if (Number.isNaN(before) || Number.isNaN(now)) {
    return { publish: true, reason: 'The published record carries no readable moment.' }
  }

  const hours = (now - before) / 3_600_000
  if (hours >= refreshAfterHours) {
    return {
      publish: true,
      reason: `The answer is unchanged but the published record is ${Math.floor(hours)} hours old.`,
    }
  }

  return {
    publish: false,
    reason: 'The answer is unchanged and the published record is recent.',
  }
}
