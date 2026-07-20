// Pure domain for H2H pass 1 (design-system §6). Given two entries' predictions
// and the shared actuals, derive each side's stat bundle and the where-you-split
// agreements. Reuses calculateScore + maxRemainingPoints so H2H numbers can
// never drift from the rest of scoring. No React, no DB.

import { calculateScore } from './calculateScore'
import { maxRemainingPoints } from './maxRemainingPoints'
import type { KnockoutStage } from './scoringConfig'

// One entry's raw picks (the caller assembles this for both players — own from
// the predictions provider, the rival from the reveal endpoint).
export type EntryPredictions = {
  groupMatches: { matchId: string; homeScore: number; awayScore: number; joker: boolean }[]
  progression: { teamId: string; stage: KnockoutStage }[]
}

// Shared, public tournament state (same for both players).
export type H2HActuals = {
  // Resulted group matches: matchId → final score.
  resultsByMatch: Map<string, { home: number; away: number }>
  // Groups whose table isn't settled yet (each still worth up to a perfect
  // group-order score). Pre-knockout that's usually all six.
  undecidedGroupCount: number
  // Teams whose run has ended (KO loss, or failed to qualify from a finished
  // group). Empty until knockouts/qualification resolve.
  eliminatedTeamIds: Set<string>
}

export type EntryStats = {
  totalPoints: number
  exactScores: number
  koPicksAlive: number
  maxPossible: number
}

/** Derive one entry's H2H stat bundle from its picks and the shared actuals. */
export function computeEntryStats(preds: EntryPredictions, actuals: H2HActuals): EntryStats {
  const groupMatchActuals = [...actuals.resultsByMatch.entries()].map(([matchId, r]) => ({
    matchId,
    homeScore: r.home,
    awayScore: r.away,
  }))
  const breakdown = calculateScore(
    { groupMatches: preds.groupMatches.map((m) => ({ matchId: m.matchId, homeScore: m.homeScore, awayScore: m.awayScore, joker: m.joker })) },
    { groupMatches: groupMatchActuals },
  )
  const exactScores = breakdown.groupMatches.items.filter((i) => i.kind === 'exact').length

  const remaining = maxRemainingPoints({
    groupMatches: preds.groupMatches.map((m) => ({
      matchId: m.matchId,
      resulted: actuals.resultsByMatch.has(m.matchId),
      joker: m.joker,
    })),
    groupOrders: Array.from({ length: actuals.undecidedGroupCount }, (_, i) => ({
      groupId: `g${i}`,
      decided: false,
    })),
    knockout: preds.progression.map((p) => ({
      teamId: p.teamId,
      predictedStage: p.stage,
      status: actuals.eliminatedTeamIds.has(p.teamId) ? { kind: 'eliminated' as const } : { kind: 'undecided' as const },
    })),
    bonus: { goldenBootDecided: false, totalGoalsDecided: false },
  })

  const koPicksAlive = preds.progression.filter((p) => !actuals.eliminatedTeamIds.has(p.teamId)).length

  return {
    totalPoints: breakdown.total,
    exactScores,
    koPicksAlive,
    maxPossible: breakdown.total + remaining.total,
  }
}

// --- Where you split -------------------------------------------------------

function championOf(progression: EntryPredictions['progression']): string | null {
  return progression.find((p) => p.stage === 'CHAMPION')?.teamId ?? null
}

// Teams predicted to reach at least the final (finalists = final + champion).
function finalistsOf(progression: EntryPredictions['progression']): Set<string> {
  return new Set(progression.filter((p) => p.stage === 'FINAL' || p.stage === 'CHAMPION').map((p) => p.teamId))
}

export type H2HSplit = {
  // Champion pick: same team, or a split (each side's pick).
  champion: { agree: boolean; mineTeamId: string | null; theirsTeamId: string | null }
  // Finalist picks (the big calls): teams both backed, and each side's solo picks.
  finalists: { sharedTeamIds: string[]; mineOnlyTeamIds: string[]; theirsOnlyTeamIds: string[] }
}

/**
 * Where two entries agree and diverge on the big calls: the champion and the
 * finalists (teams each predicted to reach the final). Team ids out; the UI
 * resolves names/flags. Extensible to group winners + per-match splits later.
 */
export function whereYouSplit(mine: EntryPredictions, theirs: EntryPredictions): H2HSplit {
  const myChamp = championOf(mine.progression)
  const theirChamp = championOf(theirs.progression)

  const myFinalists = finalistsOf(mine.progression)
  const theirFinalists = finalistsOf(theirs.progression)
  const shared: string[] = []
  const mineOnly: string[] = []
  for (const t of myFinalists) (theirFinalists.has(t) ? shared : mineOnly).push(t)
  const theirsOnly = [...theirFinalists].filter((t) => !myFinalists.has(t))

  return {
    champion: {
      agree: myChamp !== null && myChamp === theirChamp,
      mineTeamId: myChamp,
      theirsTeamId: theirChamp,
    },
    finalists: { sharedTeamIds: shared, mineOnlyTeamIds: mineOnly, theirsOnlyTeamIds: theirsOnly },
  }
}

// --- Reveal visibility (client mirror of the server gate) ------------------

/**
 * Whether H2H against a player may be shown. Mirrors get_rival_entry's gate
 * (post-lock AND a shared league) so the H2H button can be hidden — but the
 * SERVER is the real guard; this must never be the only check.
 */
export function canRevealRival(input: { locked: boolean; sharesLeague: boolean }): boolean {
  return input.locked && input.sharesLeague
}
