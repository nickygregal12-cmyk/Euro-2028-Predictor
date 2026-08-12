import { formatKickoffTime, formatMatchDay } from '../../shared/time/kickoff'
import { ordinal } from '../league/ordinal'

/**
 * `INNOV-016` — the personal matchday briefing.
 *
 * WHAT IT IS, AND WHAT IT IS NOT. It is one glance that joins three answers the
 * player already has on separate parts of the page: how much football is on
 * today, what they still owe, and where they stand. It is NOT another Home
 * redesign and it does not replace the sections beneath it — those are where a
 * player acts, and this is the sentence that tells them whether they need to.
 *
 * EVERY FIGURE IS SOMEBODY ELSE'S. The outstanding actions are the action
 * inbox's, which is each game's own read; the lock is whichever instant that
 * inbox carried; the standing is the league table's. This model counts and
 * words. It decides no deadline, no lock, no rank and no progress, because a
 * briefing that computed its own would be a fifth opinion on a page that
 * already has one.
 *
 * IT NEVER INVENTS A FOOTBALL FACT. `worthKnowing` is passed in by a caller
 * that has an authoritative one — a club's settled form, for instance — and is
 * absent everywhere else. There is deliberately no fallback sentence: "Arsenal
 * are in good form" written by a component from nothing is exactly the kind of
 * confident fiction the guardrails exclude.
 *
 * IT SAYS SO WHEN THERE IS NOTHING TO SAY. A player with no football today,
 * nothing outstanding and no standing gets `quiet: true`, and the surface
 * renders nothing rather than a panel reporting three zeroes.
 *
 * PURE. `now` is an input.
 */

export type BriefingAction = {
  competitionName: string
  gameName: string
  title: string
  locksAt: string | null
}

export type BriefingStanding = {
  /** Where the position is: a private league if there is one, else the season. */
  where: string
  position: number
  /**
   * How many are in that table. Null where the caller genuinely does not know
   * it — a league comparison carries a rank and not a field size — and the
   * sentence then says "2nd in The Office" rather than inventing a denominator.
   */
  fieldSize: number | null
  /** The nearest named rival ahead, when a pinned comparison supplies one. */
  rivalName: string | null
  /** Points behind that rival. Never negative; null when they are behind you. */
  pointsBehind: number | null
}

export type BriefingInput = {
  now: Date
  /** Fixtures in the player's own competitions on the day being briefed. */
  fixturesToday: number
  competitionsWithFixturesToday: number
  /** Outstanding actions, from the same inbox as the badge and Action Centre. */
  outstanding: readonly BriefingAction[]
  standing: BriefingStanding | null
  /**
   * One authoritative football fact, supplied by a caller that has one. There
   * is no fallback: absent means the line is absent.
   */
  worthKnowing?: string | null
}

export type Briefing = {
  /** "Saturday 15 August", in the viewer's zone. */
  dateLabel: string
  footballLine: string
  actionLine: string
  /** "First lock 12:30". Null when nothing outstanding carries an instant. */
  lockLine: string | null
  standingLine: string | null
  worthKnowing: string | null
  /** True when nothing here is worth a player's attention. */
  quiet: boolean
}

function firstLock(actions: readonly BriefingAction[]): string | null {
  const instants = actions
    .map((action) => action.locksAt)
    .filter((value): value is string => value !== null)
    .map((value) => ({ value, at: new Date(value).getTime() }))
    .filter((entry) => !Number.isNaN(entry.at))
  if (instants.length === 0) return null
  return instants.reduce((soonest, entry) => (entry.at < soonest.at ? entry : soonest)).value
}

export function presentBriefing(input: BriefingInput): Briefing {
  const iso = input.now.toISOString()
  const outstanding = input.outstanding.length

  const footballLine =
    input.fixturesToday === 0
      ? 'No matches today in your competitions.'
      : input.competitionsWithFixturesToday > 1
        ? `${input.fixturesToday} ${input.fixturesToday === 1 ? 'match' : 'matches'} today across ${input.competitionsWithFixturesToday} competitions.`
        : `${input.fixturesToday} ${input.fixturesToday === 1 ? 'match' : 'matches'} today.`

  const actionLine =
    outstanding === 0
      ? 'Nothing outstanding.'
      : outstanding === 1
        ? '1 thing to do.'
        : `${outstanding} things to do.`

  const lock = firstLock(input.outstanding)
  const lockTime = lock ? formatKickoffTime(lock) : null
  const lockDay = lock ? formatMatchDay(lock) : null
  const today = formatMatchDay(iso)

  const standing = input.standing
  // One frame per sentence. A league rank and a season field size describe two
  // different tables, so the position and the gap always come from the same one
  // and the denominator is simply omitted where the caller has none.
  const place = standing
    ? standing.fieldSize === null
      ? `${ordinal(standing.position)} in ${standing.where}`
      : `${ordinal(standing.position)} of ${standing.fieldSize} in ${standing.where}`
    : null
  const standingLine =
    standing === null || place === null
      ? null
      : standing.rivalName && standing.pointsBehind !== null
        ? `${place} · ${standing.pointsBehind} ${standing.pointsBehind === 1 ? 'point' : 'points'} behind ${standing.rivalName}.`
        : `${place}.`

  return {
    dateLabel: formatMatchDay(iso) ?? '',
    footballLine,
    actionLine,
    lockLine:
      lockTime === null
        ? null
        : // The day is stated whenever the lock is not today: "First lock 12:30"
          // for something that locks tomorrow is a sentence a player will act on
          // at the wrong time.
          lockDay !== null && lockDay !== today
          ? `First lock ${lockDay} ${lockTime}.`
          : `First lock ${lockTime}.`,
    standingLine,
    worthKnowing: input.worthKnowing ?? null,
    quiet: outstanding === 0 && input.fixturesToday === 0 && standing === null,
  }
}
