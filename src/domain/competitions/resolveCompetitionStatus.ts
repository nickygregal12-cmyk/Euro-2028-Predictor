// Pure per-competition state resolver — the `competitions.*` slice of the
// tournament-context engine (architecture-and-tournament-states §3, §8).
//
// Data in, data out. No clock of its own: `now` is server time, passed in. No
// Supabase, no React, no Original Predictor imports.
//
// The state SET is canonical (§8). The PRECEDENCE between simultaneously true
// states is proposed here and is recorded in ADR-0004 pending owner sign-off —
// it mirrors the Home action priority queue (§6), which is canonical, so that
// the Games hub and Home never disagree about what a user should do next.

import type {
  CompetitionEntrant,
  CompetitionRecord,
  CompetitionStatus,
  CompetitionWindow,
} from './competitionModel'

export type ResolveCompetitionInput = {
  competition: CompetitionRecord
  /** Every window of this competition. Order is irrelevant; sequence is used. */
  windows: CompetitionWindow[]
  /** The viewing user's entrant row, or null when they have not entered. */
  entrant: CompetitionEntrant | null
  /** Server time. Never `new Date()` inside this module. */
  now: Date
}

function at(instant: string | null): number | null {
  if (!instant) return null
  const value = new Date(instant).getTime()
  return Number.isNaN(value) ? null : value
}

/** Inclusive boundary, matching the server's `now() >= t` convention. */
function reached(instant: string | null, now: number): boolean {
  const value = at(instant)
  return value !== null && now >= value
}

function windowIsOpen(w: CompetitionWindow, now: number): boolean {
  if (!reached(w.opensAt, now)) return false
  return !reached(w.locksAt, now)
}

/**
 * The window a user is currently acting in or watching. Preference order:
 * an open window, then a locked-but-unsettled window, then the next window
 * still to open. Ties break on the lowest sequence, so a competition can never
 * present two active rounds.
 */
function selectActiveWindow(
  windows: CompetitionWindow[],
  now: number,
): CompetitionWindow | null {
  const ordered = [...windows].sort((a, b) => a.sequence - b.sequence)
  const open = ordered.find((w) => windowIsOpen(w, now))
  if (open) return open

  const inFlight = ordered.find(
    (w) => reached(w.locksAt, now) && !isWindowSettled(w, now),
  )
  if (inFlight) return inFlight

  return ordered.find((w) => !reached(w.opensAt, now)) ?? null
}

/**
 * A window has settled once its settle instant has passed AND every one of its
 * real fixtures is officially confirmed. Fixtures that have merely finished
 * (`full_time_unconfirmed`, §4) never settle a window — nothing is scored,
 * eliminated or progressed from a provisional result.
 */
function isWindowSettled(w: CompetitionWindow, now: number): boolean {
  const allConfirmed = w.fixtures.total > 0 && w.fixtures.confirmed >= w.fixtures.total
  return allConfirmed && reached(w.settlesAt, now)
}

/**
 * Resolve exactly one state for one competition and one user.
 *
 * Precedence, highest first:
 *   1. complete            — the competition is finished for everybody
 *   2. champion            — terminal user outcome, outranks any round activity
 *   3. eliminated          — terminal user outcome; an eliminated user is never
 *                            shown a live round as though it were theirs
 *   4. not entered         → not_open | registration_open | registration_closed
 *   5. action_required     — the user owes an input in an open window (§6.5/§6.6)
 *   6. round_live          — a fixture in the active window is in play (§6.3)
 *   7. round_awaiting_confirmation — played, unconfirmed (§4 D4)
 *   8. waiting_for_draw    — structure not yet drawn
 *   9. qualified | survived — standing outcome between rounds
 *  10. waiting_for_round   — entered, competition running, nothing owed
 *  11. entered             — entered, competition not yet running
 */
export function resolveCompetitionStatus(input: ResolveCompetitionInput): CompetitionStatus {
  const { competition, windows, entrant, now } = input
  const nowMs = now.getTime()
  const activeWindow = selectActiveWindow(windows, nowMs)

  const base = {
    competitionId: competition.id,
    gameKey: competition.gameKey,
    entered: entrant !== null,
    activeWindow,
  }

  // 1. Whole competition finished.
  if (reached(competition.completedAt, nowMs)) {
    return { ...base, state: 'complete', nextDeadline: null }
  }

  // 2-3. Terminal user outcomes.
  if (entrant?.outcome === 'champion') {
    return { ...base, state: 'champion', nextDeadline: null }
  }
  if (entrant?.outcome === 'eliminated') {
    return { ...base, state: 'eliminated', nextDeadline: null }
  }

  // 4. Not entered — the registration view.
  if (!entrant) {
    if (!competition.published || !reached(competition.registrationOpensAt, nowMs)) {
      return { ...base, state: 'not_open', nextDeadline: null }
    }
    if (reached(competition.registrationClosesAt, nowMs)) {
      return { ...base, state: 'registration_closed', nextDeadline: null }
    }
    return {
      ...base,
      state: 'registration_open',
      nextDeadline: competition.registrationClosesAt,
    }
  }

  const windowOpen = activeWindow !== null && windowIsOpen(activeWindow, nowMs)

  // 5. The user owes an input in an open window.
  if (windowOpen && entrant.pendingInputs > 0) {
    return { ...base, state: 'action_required', nextDeadline: activeWindow.locksAt }
  }

  // 6. A fixture in the active window is in play.
  if (activeWindow && activeWindow.fixtures.live > 0) {
    return { ...base, state: 'round_live', nextDeadline: null }
  }

  // 7. Played but not officially confirmed — provisional, never scored.
  if (activeWindow && activeWindow.fixtures.awaitingConfirmation > 0) {
    return { ...base, state: 'round_awaiting_confirmation', nextDeadline: null }
  }

  // 8. Structure not yet drawn.
  if (competition.drawRequired && !reached(competition.drawCompletedAt, nowMs)) {
    return { ...base, state: 'waiting_for_draw', nextDeadline: null }
  }

  // 9. Standing outcome carried between rounds.
  if (entrant.outcome === 'qualified') {
    return { ...base, state: 'qualified', nextDeadline: activeWindow?.locksAt ?? null }
  }
  if (entrant.outcome === 'survived') {
    return { ...base, state: 'survived', nextDeadline: activeWindow?.locksAt ?? null }
  }

  // 10. Running, nothing owed right now.
  if (windowOpen || windows.some((w) => reached(w.opensAt, nowMs))) {
    return { ...base, state: 'waiting_for_round', nextDeadline: activeWindow?.locksAt ?? null }
  }

  // 11. Entered; the competition has not started.
  return { ...base, state: 'entered', nextDeadline: activeWindow?.locksAt ?? null }
}
