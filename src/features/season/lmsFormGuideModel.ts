import type { SeasonClubForm } from '../../services/supabase/seasonClubFormModel'
import { summariseClubForm, type ClubFormSummary } from './clubFormModel'
import type { LmsRoundPage } from './lmsRoundModel'

/**
 * The form of the clubs a Last Man Standing round is offering, ordered by how
 * they are playing.
 *
 * WHY THIS IS THE RIGHT SECOND COLUMN. The primary task is "pick one club to
 * win", and the question the player is actually asking is "which of these is
 * playing well". Contract 141's form read already answers it for the whole
 * season in one request, and the Match Centre already renders it — so this is
 * the same authoritative fact, arranged for the decision in front of the
 * player. It duplicates nothing: the pick list is a list of FIXTURES with two
 * clubs each, ordered by kickoff; this is a list of CLUBS ordered by form.
 *
 * IT NEVER RECOMMENDS. No "best pick", no ranking score, no arrow. A form
 * guide is context; suggesting a pick would be the product making a prediction
 * on the player's behalf, which the direction rules out for provider data and
 * which is no better derived locally.
 *
 * A CLUB THE PLAYER HAS USED IS MARKED, NOT REMOVED. `used` is the round read's
 * own fact about the caller's current cycle, and a form guide that quietly
 * dropped a strong club the player cannot pick would be answering a different
 * question from the one beside it.
 *
 * JOINED BY CLUB NAME, deliberately and for the reason the Match Centre records:
 * contract 141's form read carries team ids and names, and both names come from
 * `public.teams.name`, so this is an equality on one source of truth. Here the
 * round read carries the team id too, so the join is by id where it can be and
 * by name only as a fallback.
 *
 * PURE, and it renders nothing when the form read has not answered — an empty
 * panel is worse than no panel, and "no form yet" is a different statement from
 * "we could not read it".
 */

export type LmsFormRow = {
  teamId: string
  name: string
  /** True when this club is the caller's pick in this round. */
  picked: boolean
  /** True when the caller has already spent this club in the current cycle. */
  used: boolean
  summary: ClubFormSummary
  /** The club it faces in this round, so the row is a fixture at a glance. */
  opponent: string | null
}

export type LmsFormGuide = {
  rows: readonly LmsFormRow[]
  /** True when no club in the round has a settled match behind it. */
  empty: boolean
}

/** Points from the form window: three for a win, one for a draw. Ordering only. */
function formStrength(summary: ClubFormSummary): number {
  if (summary.played === 0) return -1
  const points = summary.letters.reduce(
    (total, letter) => total + (letter === 'W' ? 3 : letter === 'D' ? 1 : 0),
    0,
  )
  // Per match played, so a club with four matches behind it is not ranked below
  // one with six purely for having played less football.
  return points / summary.played
}

export function presentLmsFormGuide(
  round: LmsRoundPage | null,
  form: readonly SeasonClubForm[] | null,
  pickedTeamId: string | null,
): LmsFormGuide | null {
  // Null, not empty: the read has not answered, and a panel of clubs all
  // showing "no form" would say something false about every one of them.
  if (!round || form === null) return null

  const byId = new Map(form.map((club) => [club.teamId, club]))
  const byName = new Map(form.map((club) => [club.name, club]))

  const rows: LmsFormRow[] = []
  for (const fixture of round.fixtures) {
    for (const [club, opponent] of [
      [fixture.home, fixture.away],
      [fixture.away, fixture.home],
    ] as const) {
      const found = byId.get(club.teamId) ?? byName.get(club.name) ?? null
      rows.push({
        teamId: club.teamId,
        name: club.name,
        picked: pickedTeamId === club.teamId,
        used: club.used,
        summary: summariseClubForm(found),
        opponent: opponent.name,
      })
    }
  }

  rows.sort((left, right) => {
    const difference = formStrength(right.summary) - formStrength(left.summary)
    // Alphabetical as the tie-break, so the order is stable between renders
    // rather than depending on fixture order for equal form.
    return difference !== 0 ? difference : left.name.localeCompare(right.name)
  })

  return { rows, empty: rows.every((row) => row.summary.played === 0) }
}
