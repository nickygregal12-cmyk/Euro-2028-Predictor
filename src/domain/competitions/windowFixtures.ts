// Kickoff-derived window fixture aggregation (architecture §4, §10).
//
// The database stores only authoritative result facts (`scheduled | confirmed
// | corrected`) — there is no live feed, and nothing is ever scored from a
// kickoff-derived state. This module derives the DISPLAY aggregate a window
// reports to `resolveCompetitionStatus`: a fixture whose kickoff has passed
// without a confirmed result reads as in play for a bounded spell and as
// awaiting confirmation afterwards (§4 D4). Pure — `now` is server time,
// passed in.

import type { WindowFixtureAggregate } from './competitionModel'

export type WindowFixtureRead = {
  /** Null while the kickoff is still to be scheduled. */
  kickoffAt: string | null
  resultState: 'scheduled' | 'confirmed' | 'corrected'
}

/**
 * How long after kickoff a fixture may still read as in play: regulation plus
 * half-time, extra time, penalties and stoppage headroom. Display only — the
 * result lifecycle, not this constant, decides when anything is scored.
 */
export const MATCH_IN_PLAY_WINDOW_MINUTES = 150

export function deriveWindowFixtureAggregate(
  fixtures: WindowFixtureRead[],
  now: Date,
): WindowFixtureAggregate {
  const nowMs = now.getTime()
  let live = 0
  let awaitingConfirmation = 0
  let confirmed = 0

  for (const fixture of fixtures) {
    if (fixture.resultState === 'confirmed' || fixture.resultState === 'corrected') {
      confirmed += 1
      continue
    }
    if (!fixture.kickoffAt) continue
    const kickoff = new Date(fixture.kickoffAt).getTime()
    if (Number.isNaN(kickoff) || nowMs < kickoff) continue
    if (nowMs < kickoff + MATCH_IN_PLAY_WINDOW_MINUTES * 60_000) {
      live += 1
    } else {
      awaitingConfirmation += 1
    }
  }

  return { total: fixtures.length, live, awaitingConfirmation, confirmed }
}
