import type { FixtureListRow } from './fixtureListModel'
import type { LmsRoundPage } from './lmsRoundModel'

/**
 * What one fixture means for the player's Last Man Standing entry.
 *
 * Alpha item 14 asks for football state connected to the player's prediction
 * AND its consequence. The Match Predictor half is delivered — prediction,
 * result, points. This is the Last Man Standing half, and it is the one that
 * changes how a match feels: a fixture where your survival is riding on a club
 * is not the same fixture as the one beside it.
 *
 * ONLY THE CURRENT ROUND, AND THAT IS A READ BOUNDARY RATHER THAN A CHOICE.
 * `get_season_lms_round` takes no round argument — it answers the round that is
 * open now. So a fixture from six weeks ago cannot be told what it did to an
 * entry, and this says nothing about it rather than guessing. When a round read
 * exists that takes a round, this becomes answerable for any fixture and the
 * shape below does not have to change.
 *
 * JOINED BY SEASON FIXTURE ID, exactly. The round's fixtures carry
 * `season_fixture_id`, which is the same id contract 139's list returns, so
 * there is no name matching anywhere in this path — unlike club form, which has
 * no id to join on.
 *
 * IT NEVER SAYS WHAT HAPPENS NEXT. Whether a draw eliminates is a stored rule
 * this surface cannot see, and `lmsRoundModel` already declines to guess it.
 * This reports that the pick is in the fixture and what the round read says
 * about it; the survival verdict stays the settlement authority's.
 *
 * PURE. Both reads are inputs; no clock, no storage, no network.
 */

export type LmsStake =
  /** The player's pick is one of these two clubs. */
  | { kind: 'my_pick'; club: string; opponent: string }
  /** In the round, but the player picked elsewhere. */
  | { kind: 'in_my_round' }

export type LmsStakeView = {
  stake: LmsStake
  /** One sentence. Never a prediction about survival. */
  line: string
}

export function presentLmsStake(
  fixture: FixtureListRow,
  round: LmsRoundPage | null,
): LmsStakeView | null {
  // Not an entrant, no open round, or eliminated. An eliminated player has no
  // stake in any fixture, and saying "your club is playing" to somebody who is
  // out would be worse than saying nothing.
  if (!round || !round.entered || round.round === null) return null
  if (round.entryOutcome === 'eliminated') return null

  const inRound = round.fixtures.find((entry) => entry.fixtureId === fixture.id)
  if (!inRound) return null

  if (round.pick === null) {
    // In the round they still have to pick in. The card says what to do; this
    // says that this particular match is one of the options on the table.
    return {
      stake: { kind: 'in_my_round' },
      line: `This is a ${round.round.label} fixture, and you have not picked yet.`,
    }
  }

  const picked =
    inRound.home.teamId === round.pick.teamId
      ? inRound.home
      : inRound.away.teamId === round.pick.teamId
        ? inRound.away
        : null

  if (!picked) {
    return {
      stake: { kind: 'in_my_round' },
      line: `This is a ${round.round.label} fixture. Your pick is in another match.`,
    }
  }

  const opponent = inRound.home.teamId === picked.teamId ? inRound.away : inRound.home

  return {
    stake: { kind: 'my_pick', club: picked.name, opponent: opponent.name },
    // States the stake and stops. What a draw does is a stored rule this
    // surface cannot see, and the settlement authority owns the verdict.
    line: `Your ${round.round.label} pick is ${picked.name}, so your Last Man Standing entry is riding on this match.`,
  }
}
