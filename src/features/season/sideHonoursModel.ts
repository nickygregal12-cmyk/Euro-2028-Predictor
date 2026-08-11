import { explainFixtureScore } from '../../domain/season/scoring'
import type { SeasonLeagueMatchweekPredictions } from '../../services/supabase/seasonLeaguePredictionsModel'
import type { SeasonLeagueMovement } from '../../services/supabase/seasonLeagueMovementModel'

/**
 * `INNOV-012` — a private league's side honours for one settled matchweek.
 *
 * THEY CHANGE NOTHING. No honour here alters points, rank, order or eligibility;
 * the league table is contract 128's and stays exactly as it was. These are a
 * second, smaller thing to win in a week somebody has already lost the main one,
 * which is the whole reason they exist.
 *
 * EVERY DEFINITION IS DETERMINISTIC AND PUBLISHED. Each honour carries the rule
 * that produced it, in the player's own words, and the surface prints it — an
 * award nobody can check is a decoration.
 *
 * TIES ARE SHARED, NEVER BROKEN. Two players level on exact scores both hold
 * the honour, named in display-name order so two renders cannot disagree. There
 * is no hidden tie-break, because a hidden tie-break is a rule nobody published.
 *
 * NOTHING IS AWARDED FROM AN UNSETTLED MATCHWEEK. Matchweek Winner comes from
 * the server's BANKED points and is absent until they exist; the derived
 * honours run over fixtures that carry a confirmed result and count nothing
 * else. A matchweek in progress produces no honours at all rather than a
 * provisional winner who then changes.
 *
 * THE DERIVED HONOURS ARE FACTS ABOUT PREDICTIONS, NOT A SECOND SCORING
 * AUTHORITY. Counting how often a prediction matched a result is the same class
 * of derivation contract 151 already performs server-side; no point value
 * appears in this file, and the one comparison it makes is
 * `explainFixtureScore`'s. Nothing here may be turned into points.
 *
 * NO HUMILIATING HONOUR EXISTS HERE, deliberately. Every award names something
 * a player did well. A wooden spoon is a league-level product decision and is
 * not one a model gets to take.
 *
 * PURE.
 */

export type HonourKey =
  | 'matchweek_winner'
  | 'exact_scores'
  | 'draw_specialist'
  | 'goals_guru'
  | 'biggest_mover'

export type Honour = {
  key: HonourKey
  title: string
  /** The winners, display-name ordered. More than one means the honour is shared. */
  winners: readonly { userId: string; displayName: string; isSelf: boolean }[]
  /** The winning figure, already worded — "3 exact scores", "up 4 places". */
  value: string
  /** How it was calculated, in one sentence. Always shown to the player. */
  definition: string
}

export type SideHonours = {
  matchweekLabel: string
  /** True once the matchweek has settled and honours can be awarded at all. */
  settled: boolean
  honours: readonly Honour[]
  /** How many members were measured. Stated, because the read caps its rows. */
  measured: number
  /** True when the read truncated the league, so the honours cover a subset. */
  truncated: boolean
}

type Candidate = { userId: string; displayName: string; isSelf: boolean; score: number }

/**
 * The highest scorer, or nobody. Ties share; a field where the best score is
 * not better than nothing produces no honour rather than awarding a zero.
 */
function best(candidates: readonly Candidate[], minimum: number): Candidate[] {
  const top = candidates.reduce((high, entry) => Math.max(high, entry.score), Number.NEGATIVE_INFINITY)
  if (!Number.isFinite(top) || top < minimum) return []
  return candidates
    .filter((entry) => entry.score === top)
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
}

/** The lowest scorer, for honours where small is good. Same rules otherwise. */
function closest(candidates: readonly Candidate[]): Candidate[] {
  const low = candidates.reduce((least, entry) => Math.min(least, entry.score), Number.POSITIVE_INFINITY)
  if (!Number.isFinite(low)) return []
  return candidates
    .filter((entry) => entry.score === low)
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
}

const winnersOf = (candidates: readonly Candidate[]) =>
  candidates.map(({ userId, displayName, isSelf }) => ({ userId, displayName, isSelf }))

export function presentSideHonours(
  page: SeasonLeagueMatchweekPredictions,
  movement: SeasonLeagueMovement | null,
): SideHonours {
  const label = page.matchweek.label
  const settledFixtures = page.fixtures.flatMap((fixture) =>
    fixture.result ? [{ id: fixture.id, result: fixture.result }] : [],
  )
  // A matchweek is settled for this purpose when the SERVER has banked points
  // for it. The presence of results is not the same fact: a matchweek can carry
  // every result and still be mid-settlement.
  const settled = page.revealed && page.members.some((member) => member.points !== null)

  if (!settled || settledFixtures.length === 0) {
    return {
      matchweekLabel: label,
      settled: false,
      honours: [],
      measured: page.membersReturned,
      truncated: page.membersTruncated,
    }
  }

  const banked: Candidate[] = []
  const exacts: Candidate[] = []
  const draws: Candidate[] = []
  const goals: Candidate[] = []

  for (const member of page.members) {
    const identity = {
      userId: member.userId,
      displayName: member.displayName,
      isSelf: member.isSelf,
    }
    if (member.points !== null) banked.push({ ...identity, score: member.points })

    let exact = 0
    let correctDraws = 0
    let goalError = 0
    let predicted = 0

    for (const fixture of settledFixtures) {
      const prediction = member.predictions[fixture.id]
      if (!prediction) continue
      predicted += 1
      const explained = explainFixtureScore(prediction, fixture.result)
      if (explained.reason === 'exact_score') exact += 1
      if (
        prediction.home === prediction.away &&
        fixture.result.home === fixture.result.away
      ) {
        correctDraws += 1
      }
      goalError += Math.abs(
        prediction.home + prediction.away - (fixture.result.home + fixture.result.away),
      )
    }

    if (predicted === 0) continue
    exacts.push({ ...identity, score: exact })
    draws.push({ ...identity, score: correctDraws })
    // Averaged, so a member who predicted every fixture is not penalised
    // against one who predicted three. The read allows a partial card.
    goals.push({ ...identity, score: goalError / predicted })
  }

  const movers: Candidate[] =
    movement?.settled && movement.matchweek?.id === page.matchweek.id
      ? movement.members.map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
          isSelf: member.isSelf,
          score: member.movement,
        }))
      : []

  const honours: Honour[] = []

  const winner = best(banked, 1)
  if (winner.length > 0) {
    honours.push({
      key: 'matchweek_winner',
      title: 'Matchweek winner',
      winners: winnersOf(winner),
      value: `${winner[0]?.score} ${winner[0]?.score === 1 ? 'point' : 'points'}`,
      definition:
        'The most points banked in this matchweek, from the league table’s own totals. Jokers are included, because the season counts them.',
    })
  }

  const kings = best(exacts, 1)
  if (kings.length > 0) {
    honours.push({
      key: 'exact_scores',
      title: 'Exact score king',
      winners: winnersOf(kings),
      value: `${kings[0]?.score} exact ${kings[0]?.score === 1 ? 'score' : 'scores'}`,
      definition:
        'The most predictions that matched the confirmed result exactly, across this matchweek’s settled fixtures.',
    })
  }

  const drawSpecialists = best(draws, 1)
  if (drawSpecialists.length > 0) {
    honours.push({
      key: 'draw_specialist',
      title: 'Draw specialist',
      winners: winnersOf(drawSpecialists),
      value: `${drawSpecialists[0]?.score} ${drawSpecialists[0]?.score === 1 ? 'draw' : 'draws'} called`,
      definition:
        'The most fixtures predicted as a draw that finished level. Predicting a draw that did not happen counts for nothing here.',
    })
  }

  const gurus = closest(goals)
  if (gurus.length > 0) {
    honours.push({
      key: 'goals_guru',
      title: 'Goals guru',
      winners: winnersOf(gurus),
      value: `${(gurus[0]?.score ?? 0).toFixed(1)} goals out per match`,
      definition:
        'The smallest average difference between the goals predicted in a match and the goals actually scored, over the fixtures this player predicted.',
    })
  }

  const climbers = best(movers, 1)
  if (climbers.length > 0) {
    honours.push({
      key: 'biggest_mover',
      title: 'Biggest mover',
      winners: winnersOf(climbers),
      value: `up ${climbers[0]?.score} ${climbers[0]?.score === 1 ? 'place' : 'places'}`,
      definition:
        'The largest climb in this league’s table over the matchweek, from the positions before and after it settled.',
    })
  }

  return {
    matchweekLabel: label,
    settled: true,
    honours,
    measured: page.membersReturned,
    truncated: page.membersTruncated,
  }
}
