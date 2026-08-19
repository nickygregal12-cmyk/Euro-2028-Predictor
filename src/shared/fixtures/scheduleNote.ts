import { formatKickoffTime, formatMatchDay } from '../time/kickoff'

/**
 * WHAT TO SAY ABOUT A FIXTURE WHOSE SLOT IS NOT WHAT IT LOOKS LIKE.
 *
 * Contract 207. The kickoff on a postponed fixture is a real instant and NOT a
 * plan — it is where the match was due, or where it is now due once a
 * replacement has been recorded — so the words beside it are the whole
 * difference between a reader turning up and a reader not.
 *
 * ONE FUNCTION, BECAUSE THREE PRESENTERS ASK. `buildHomeModel`,
 * `buildMatchesModel` and the legacy `fixtureListModel` all describe the same
 * fixture, and a player who reads "New date to be confirmed" on one surface and
 * something else on another has been handed two facts rather than one. It lives
 * in `shared` rather than in any of them because a helper owned by one
 * generation of the product is a helper the other will eventually copy.
 *
 * PRIMITIVES, NOT A FIXTURE. The two things it needs are an instant and a
 * stored boolean, and taking those directly keeps `shared` free of any read
 * model — which is what lets both generations import it.
 *
 * PURE, AND NO CLOCK. `rescheduled` is the server's stored fact — contract 117
 * recorded a kickoff revision — and the instant is FORMATTED, never compared
 * against anything. The zone is the viewer's, as it is everywhere in this
 * product since the owner's 10 August 2026 direction.
 */
export function postponedScheduleNote(
  kickoffAt: string | null,
  rescheduled: boolean,
): string {
  if (!rescheduled) return 'New date to be confirmed'

  const day = formatMatchDay(kickoffAt)
  const time = formatKickoffTime(kickoffAt)
  // A fixture recorded as moved but carrying no usable instant is a payload
  // disagreeing with itself. The honest answer is still the one that promises
  // nothing.
  if (day === null && time === null) return 'New date to be confirmed'

  return `Now due ${[day, time].filter(Boolean).join(' · ')}`
}
