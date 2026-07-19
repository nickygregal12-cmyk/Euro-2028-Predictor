// Pure domain helpers for the knockout-bracket PICK model. Data in, data out;
// no UI, no database access. Two representations of the same information:
//
//   winners      — map of match ref → the teamId the user picked to win it
//                  (R16-1…R16-8, QF-1…QF-4, SF-1, SF-2, FINAL). This is what the
//                  bracket UI works in.
//   progression  — one row per team → the furthest stage it is predicted to
//                  reach ('qf' | 'sf' | 'final' | 'champion'). This is what the
//                  predicted_progression table stores and what calculateScore
//                  §3 consumes. A team only gets a row once it wins at least one
//                  knockout match; reaching the R16 itself follows from group
//                  qualification, so it is never a bracket pick.
//
// The feed-through (who plays whom in the next round) is read from
// KNOCKOUT_BRACKET — the same config advanceBracket() reads — never transcribed
// afresh here. Forward reconstruction goes through advanceBracket() itself.

import { KNOCKOUT_BRACKET } from './knockoutBracket'
import { advanceBracket } from './advanceBracket'
import type { R16Fixture } from './resolveRoundOf16'

// DB stage values for predicted_progression (winner-only mode).
export type ProgressionStage = 'qf' | 'sf' | 'final' | 'champion'

// Least-to-furthest, so "reached further" is an index comparison.
const STAGE_ORDER: ProgressionStage[] = ['qf', 'sf', 'final', 'champion']

// The stage a team reaches by WINNING a match in each round.
const STAGE_AFTER: Record<RoundPrefix, ProgressionStage> = {
  R16: 'qf',
  QF: 'sf',
  SF: 'final',
  FINAL: 'champion',
}

type RoundPrefix = 'R16' | 'QF' | 'SF' | 'FINAL'

export function roundOfRef(ref: string): RoundPrefix {
  if (ref.startsWith('R16')) return 'R16'
  if (ref.startsWith('QF')) return 'QF'
  if (ref.startsWith('SF')) return 'SF'
  return 'FINAL'
}

/**
 * The forward match each match ref feeds into (undefined for the FINAL).
 * Derived from KNOCKOUT_BRACKET so the tree has exactly one source of truth:
 * every match lists its two feeder refs, so inverting that mapping gives each
 * feeder its parent.
 */
export const PARENT_OF: Record<string, string> = (() => {
  const parents: Record<string, string> = {}
  for (const m of KNOCKOUT_BRACKET) {
    parents[m.homeFrom] = m.ref
    parents[m.awayFrom] = m.ref
  }
  return parents
})()

/**
 * Applies a winner pick. Sets `winners[ref] = teamId`; if a *different* team
 * previously won `ref` and had carried through into later rounds, those now-
 * invalid downstream picks are cleared (a team can't win a QF it no longer
 * reached). Returns the new winners map and the refs cleared, so the UI can
 * warn before committing (the cascade-confirm rule). Pure — no mutation of the
 * input.
 */
export function applyBracketPick(
  winners: Record<string, string>,
  ref: string,
  teamId: string,
): { winners: Record<string, string>; cleared: string[] } {
  const previous = winners[ref]
  const next = { ...winners, [ref]: teamId }
  const cleared: string[] = []

  if (previous !== undefined && previous !== teamId) {
    // The old winner propagated as far as it kept winning; clear every later
    // pick it still occupied, walking up the tree until it no longer does.
    let cur = ref
    let parent = PARENT_OF[cur]
    while (parent !== undefined && next[parent] === previous) {
      delete next[parent]
      cleared.push(parent)
      cur = parent
      parent = PARENT_OF[cur]
    }
  }

  return { winners: next, cleared }
}

/**
 * Collapses a winners map into predicted_progression rows: one row per team at
 * the furthest stage it reaches. A team appears once even though it may win
 * several rounds along its path.
 */
export function winnersToProgression(
  winners: Record<string, string>,
): { teamId: string; stage: ProgressionStage }[] {
  const best = new Map<string, ProgressionStage>()
  for (const [ref, teamId] of Object.entries(winners)) {
    const stage = STAGE_AFTER[roundOfRef(ref)]
    const current = best.get(teamId)
    if (current === undefined || STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf(current)) {
      best.set(teamId, stage)
    }
  }
  return [...best].map(([teamId, stage]) => ({ teamId, stage }))
}

/**
 * Rebuilds the winners map from stored progression, given the resolved Round of
 * 16 fixtures (from resolveRoundOf16). Walks the tree round by round: a fixture's
 * winner is whichever side reached a stage beyond that round. Later rounds are
 * expanded via advanceBracket() as earlier winners are filled in, so "who feeds
 * where" always comes from the domain. Sides whose team has no stored stage
 * (or where neither/both qualify, i.e. inconsistent data) are left unpicked.
 */
export function winnersFromProgression(
  r16Fixtures: R16Fixture[],
  progression: Record<string, ProgressionStage>,
): Record<string, string> {
  const winners: Record<string, string> = {}
  const stageIndex = (teamId: string): number => {
    const stage = progression[teamId]
    return stage === undefined ? -1 : STAGE_ORDER.indexOf(stage)
  }

  const pick = (ref: string, homeId: string, awayId: string, threshold: number) => {
    const homeThrough = stageIndex(homeId) >= threshold
    const awayThrough = stageIndex(awayId) >= threshold
    if (homeThrough && !awayThrough) winners[ref] = homeId
    else if (awayThrough && !homeThrough) winners[ref] = awayId
  }

  // R16: winning it means reaching at least the QF (index 0).
  for (const f of r16Fixtures) {
    pick(f.ref, f.home.teamId, f.away.teamId, STAGE_ORDER.indexOf('qf'))
  }

  // Forward rounds: advanceBracket surfaces each fixture once both feeders are
  // decided, so we resolve QF, then SF, then FINAL in turn.
  for (const round of ['QF', 'SF', 'FINAL'] as const) {
    const threshold = STAGE_ORDER.indexOf(STAGE_AFTER[round])
    for (const f of advanceBracket(winners)) {
      if (f.round !== round) continue
      pick(f.ref, f.home.teamId, f.away.teamId, threshold)
    }
  }

  return winners
}
