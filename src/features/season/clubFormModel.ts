import type {
  ClubHeadToHead,
  SeasonClubForm,
} from '../../services/supabase/seasonClubFormModel'

/**
 * Club form and this season's meetings, said in a sentence.
 *
 * WHY THIS IS SEPARATE FROM THE DECODER. The decoder keeps the server's
 * numbers; this decides what a person is told about them, and that decision is
 * where the honesty lives. "Won 4 of the last 6" is a claim about a window, and
 * the window is the server's `matches` bound rather than a number chosen here.
 *
 * A CLUB WITH NO SETTLED FIXTURES HAS NO FORM, and says so. Rendering "0 form"
 * or an empty row of pills for a club that has simply not played yet reads as a
 * bad run rather than as a season that has not started, which at Matchweek 1 is
 * every club in the competition.
 *
 * PURE. Both reads are inputs; no clock, no storage, no network.
 */

export type ClubFormSummary = {
  /** Most recent first: "W W D L". Empty when nothing has settled. */
  letters: readonly ('W' | 'D' | 'L')[]
  /** "Won 4, drawn 1, lost 1 of the last 6" — or null when nothing settled. */
  record: string | null
  /** "+7" / "-3" / "0" over the window. Null when nothing settled. */
  goalDifference: string | null
  played: number
}

export function summariseClubForm(club: SeasonClubForm | null): ClubFormSummary {
  if (!club || club.played === 0) {
    return { letters: [], record: null, goalDifference: null, played: 0 }
  }

  const difference = club.goalsFor - club.goalsAgainst
  return {
    letters: club.form,
    // "of the last N" uses the club's own played count rather than the read's
    // requested window: a club that has played four matches in a six-match
    // window has a record over four, and saying "of the last 6" would be
    // counting matches that do not exist.
    record: `Won ${club.won}, drawn ${club.drawn}, lost ${club.lost} of the last ${club.played}`,
    goalDifference: difference > 0 ? `+${difference}` : `${difference}`,
    played: club.played,
  }
}

export type MeetingLine = {
  /**
   * "Celtic · Matchweek 2 · won 2 - 1 · away", whole, from `head.team`'s point
   * of view.
   *
   * THE CLUB NAME IS IN THE LINE RATHER THAN PREPENDED BY THE COMPONENT, and
   * that is a correction rather than a preference. The component had the
   * fixture's home club to hand and the headline had the READ's team, so two
   * names described one result and nothing made them agree — a rendering of
   * the gallery showed "Rangers Matchweek 1 · won 2 - 0" under the headline
   * "Celtic and Hibernian have met once this season". They agree in production
   * because the ids come from the form read, but a surface should not depend on
   * that: the read says whose result it is, once.
   */
  text: string
  outcome: 'W' | 'D' | 'L'
}

export type HeadToHeadSummary = {
  /** One line per meeting, most recent first. */
  meetings: readonly MeetingLine[]
  /** "They have met twice this season" — or the sentence saying they have not. */
  headline: string
}

/**
 * This season's meetings, stated from the point of view of `head.team`.
 *
 * SCOPED TO THE SEASON, and the sentence says so, because the read is. Carrying
 * meetings from previous seasons would need a competition-lineage decision the
 * contract has no authority to make; a headline that said "they have met twice"
 * with no "this season" would be quietly claiming a longer history.
 */
export function summariseHeadToHead(head: ClubHeadToHead | null): HeadToHeadSummary | null {
  if (!head) return null

  const played = head.summary.played
  if (played === 0) {
    return {
      meetings: [],
      headline: `${head.team.name} and ${head.opponent.name} have not met yet this season.`,
    }
  }

  const verb = (outcome: 'W' | 'D' | 'L') =>
    outcome === 'W' ? 'won' : outcome === 'L' ? 'lost' : 'drew'

  return {
    meetings: head.meetings.map((meeting) => ({
      outcome: meeting.outcome,
      text: [
        head.team.name,
        meeting.round,
        // The scoreline is always this club's goals first, matching the verb
        // beside it. Printing it home-first would make "won 1 - 2" possible.
        `${verb(meeting.outcome)} ${meeting.goalsFor} - ${meeting.goalsAgainst}`,
        meeting.atHome ? 'at home' : 'away',
      ]
        .filter((part): part is string => Boolean(part))
        .join(' · '),
    })),
    headline:
      played === 1
        ? `${head.team.name} and ${head.opponent.name} have met once this season.`
        : `${head.team.name} and ${head.opponent.name} have met ${played} times this season.`,
  }
}
