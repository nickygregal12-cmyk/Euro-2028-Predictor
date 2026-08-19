import type { SeasonListFixture } from '../../services/supabase/seasonFixtureListModel'
import { formatKickoffTime, formatMatchDay } from '../../shared/time/kickoff'

/**
 * WHAT TO SAY ABOUT A FIXTURE WHOSE SLOT IS NOT WHAT IT LOOKS LIKE.
 *
 * Contract 206. `kickoffAt` on a postponed fixture is a real instant and NOT a
 * plan — it is where the match was due, or where it is now due once a
 * replacement has been recorded — so the words beside it are the whole
 * difference between a reader turning up and a reader not.
 *
 * ONE FUNCTION, BECAUSE TWO SURFACES ASK. `buildHomeModel` and
 * `buildMatchesModel` both draw the same fixture, and a player who reads "New
 * date to be confirmed" on Home and something else in Matches has been handed
 * two facts rather than one. Written here rather than in either of them so
 * neither can drift, and so the wording is changed in one place.
 *
 * PURE, AND NO CLOCK. `rescheduled` is the server's stored fact — contract
 * 117 recorded a kickoff revision — and the instant is FORMATTED, never
 * compared against anything. The zone is the viewer's, as it is everywhere in
 * this lane since the owner's 10 August 2026 direction.
 */
export function postponedScheduleNote(fixture: SeasonListFixture): string {
  if (!fixture.schedule.rescheduled) return 'New date to be confirmed'

  const day = formatMatchDay(fixture.kickoffAt)
  const time = formatKickoffTime(fixture.kickoffAt)
  // A fixture recorded as moved but carrying no usable instant is a payload
  // disagreeing with itself. The honest answer is still the one that promises
  // nothing.
  if (day === null && time === null) return 'New date to be confirmed'

  return `Now due ${[day, time].filter(Boolean).join(' · ')}`
}
