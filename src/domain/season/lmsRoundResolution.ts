/**
 * Season Last Man Standing pick and round resolution.
 *
 * Authority: ADR 0013 as amended by ADR 0020. The rules encoded here:
 *
 * - win to survive; a drawn fixture eliminates or survives per the
 *   competition's immutable draws rule;
 * - a Save converts a drawn fixture into survival — it NEVER rescues a
 *   defeat, and it shares neither name nor behaviour with the Predictor's
 *   doubling token;
 * - a life absorbs an elimination that nothing else prevented;
 * - a postponed fixture: the player survives and the team stays consumed —
 *   survival is the compensation, consumption preserves the cost;
 * - a round only ends the competition if it leaves exactly one survivor,
 *   and a postponement cannot win: a sole survivor whose fixture did not
 *   play continues to the next round instead of taking the title;
 * - where a round would leave zero survivors: private competitions follow
 *   their creation-time endgame rule (play on / shared win / reset); the
 *   public competition names joint winners capped at three, above which
 *   there is no winner and the competition restarts with everyone
 *   re-entered;
 * - the play-on backstop — fixture list exhausted with more than one player
 *   alive — shares the win. Exhaustion under any other rule has no recorded
 *   authority and resolves to `null` so callers must decide deliberately.
 *
 * Pure domain: no storage, network or ambient clock. This is not the
 * tournament LMS and imports nothing from it.
 */

export const LMS_PUBLIC_JOINT_WINNER_CAP = 3

export type LmsDrawsRule = 'eliminate' | 'survive'

export type LmsEndgame =
  | { scope: 'private'; onWipeout: 'play_on' | 'shared_win' | 'reset' }
  | { scope: 'public' }

export type LmsFixtureOutcome = 'won' | 'drew' | 'lost' | 'postponed'

export type LmsPickInput = {
  outcome: LmsFixtureOutcome
  drawsRule: LmsDrawsRule
  livesRemaining: number
  savesRemaining: number
}

export type LmsPickResolution =
  | {
      alive: true
      via: 'win' | 'draw_survives' | 'save' | 'life' | 'postponement'
      livesRemaining: number
      savesRemaining: number
    }
  | { alive: false; livesRemaining: 0; savesRemaining: number }
  | { refused: 'invalid_input' }

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

/** One entrant's fate from their pick's fixture outcome. */
export function resolveLmsPick(input: LmsPickInput): LmsPickResolution {
  if (!isCount(input.livesRemaining) || !isCount(input.savesRemaining)) {
    return { refused: 'invalid_input' }
  }
  const { livesRemaining, savesRemaining } = input

  switch (input.outcome) {
    case 'won':
      return { alive: true, via: 'win', livesRemaining, savesRemaining }
    case 'postponed':
      // Survives; the consumed team is not returned (owned by eligibility).
      return { alive: true, via: 'postponement', livesRemaining, savesRemaining }
    case 'drew': {
      if (input.drawsRule === 'survive') {
        return { alive: true, via: 'draw_survives', livesRemaining, savesRemaining }
      }
      if (savesRemaining > 0) {
        return { alive: true, via: 'save', livesRemaining, savesRemaining: savesRemaining - 1 }
      }
      if (livesRemaining > 0) {
        return { alive: true, via: 'life', livesRemaining: livesRemaining - 1, savesRemaining }
      }
      return { alive: false, livesRemaining: 0, savesRemaining }
    }
    case 'lost': {
      // A Save never rescues a defeat.
      if (livesRemaining > 0) {
        return { alive: true, via: 'life', livesRemaining: livesRemaining - 1, savesRemaining }
      }
      return { alive: false, livesRemaining: 0, savesRemaining }
    }
  }
}

export type LmsRoundEntrant = {
  entryId: string
  /** This entrant's resolved fate for the round. */
  alive: boolean
  /** True when survival came via a postponed fixture. */
  viaPostponement: boolean
}

export type LmsRoundConclusion =
  | { kind: 'continues' }
  | {
      /** Sole survivor whose fixture did not play: eliminations stand, no title. */
      kind: 'continues_postponement_cannot_win'
      soleSurvivorEntryId: string
    }
  | { kind: 'winner'; entryId: string }
  | { kind: 'shared_win'; entryIds: readonly string[] }
  | { kind: 'wipeout_play_on' }
  | { kind: 'reset_no_winner' }
  | { kind: 'restart_all_reentered' }
  | { kind: 'refused'; reason: 'invalid_input' }

/**
 * Conclude a round from the resolved fates of every entrant who was alive
 * when it began. Mass elimination is more likely than independence suggests
 * (ADR 0013) — the zero-survivor branches are first-class, not edge cases.
 */
export function concludeLmsRound(
  entrants: readonly LmsRoundEntrant[],
  endgame: LmsEndgame,
): LmsRoundConclusion {
  const seen = new Set<string>()
  for (const entrant of entrants) {
    if (entrant.entryId.trim().length === 0 || seen.has(entrant.entryId)) {
      return { kind: 'refused', reason: 'invalid_input' }
    }
    seen.add(entrant.entryId)
  }
  if (entrants.length === 0) return { kind: 'refused', reason: 'invalid_input' }

  const survivors = entrants.filter((entrant) => entrant.alive)

  if (survivors.length > 1) return { kind: 'continues' }

  if (survivors.length === 1) {
    const survivor = survivors[0]
    return survivor.viaPostponement
      ? { kind: 'continues_postponement_cannot_win', soleSurvivorEntryId: survivor.entryId }
      : { kind: 'winner', entryId: survivor.entryId }
  }

  // Zero survivors — the wipeout round.
  if (endgame.scope === 'public') {
    return entrants.length <= LMS_PUBLIC_JOINT_WINNER_CAP
      ? { kind: 'shared_win', entryIds: entrants.map((entrant) => entrant.entryId).sort() }
      : { kind: 'restart_all_reentered' }
  }
  switch (endgame.onWipeout) {
    case 'play_on':
      return { kind: 'wipeout_play_on' }
    case 'shared_win':
      return { kind: 'shared_win', entryIds: entrants.map((entrant) => entrant.entryId).sort() }
    case 'reset':
      return { kind: 'reset_no_winner' }
  }
}

/**
 * The backstop when the fixture list runs out with more than one player
 * alive: under play on they share the win. Under any other rule the ADR
 * records no outcome, so this returns `null` — an undecided case callers
 * must surface, never a silent guess.
 */
export function resolveLmsSeasonExhaustion(
  aliveEntryIds: readonly string[],
  endgame: LmsEndgame,
): { kind: 'shared_win'; entryIds: readonly string[] } | null {
  if (aliveEntryIds.length <= 1) return null
  if (endgame.scope === 'private' && endgame.onWipeout === 'play_on') {
    return { kind: 'shared_win', entryIds: [...aliveEntryIds].sort() }
  }
  return null
}
