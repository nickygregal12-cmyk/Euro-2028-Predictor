import { db } from './client'
import {
  seasonLabelFor,
  type SeasonPlayContext,
  type SeasonPlayContextGateway,
} from '../../features/season/seasonPlayContextModel'

/**
 * The real season play-context gateway, over contract 121's bounded read.
 *
 * ONE READ, TWO QUESTIONS, DELIBERATELY. The route needs a season id and an
 * opening matchweek, and asking separately would be two round trips before the
 * card's own read even starts — on the surface where time-to-first-card is the
 * thing being measured. The database answers both in one call because the
 * second question can only be asked once the first is answered.
 *
 * THE ERROR IS PASSED THROUGH, NOT TRANSLATED HERE. `presentSeasonPlay` tells
 * a mistyped URL apart from a failed read, and it does that by reading the
 * message the database raised. Rewriting the message in this module would
 * either lose that distinction or duplicate the decision in two places.
 */

type ContextPayload = {
  tournament_id: string
  competition_name: string
  season_key: string
  time_zone: string | null
  status: string | null
  matchweek: number | null
  of: number
  locks_at: string | null
}

function requireShape(payload: unknown): ContextPayload {
  const context = payload as ContextPayload
  if (
    context === null ||
    typeof context !== 'object' ||
    typeof context.tournament_id !== 'string' ||
    typeof context.competition_name !== 'string' ||
    typeof context.season_key !== 'string' ||
    typeof context.of !== 'number'
  ) {
    // A guessed season id would send every subsequent read to the wrong
    // competition, so a malformed payload fails rather than being patched up.
    throw new Error('The season play context response was not in the expected shape.')
  }
  return context
}

export function createSeasonPlayContextGateway(): SeasonPlayContextGateway {
  return {
    async load(competitionSlug: string, seasonKey: string): Promise<SeasonPlayContext> {
      const { data, error } = await db.rpc('get_season_play_context', {
        p_competition_slug: competitionSlug,
        p_season_key: seasonKey,
      })
      if (error) throw error
      const context = requireShape(data)

      return {
        tournamentId: context.tournament_id,
        competitionName: context.competition_name,
        seasonLabel: seasonLabelFor(context.season_key),
        // The season carries the timezone every deadline is shown in. Falling
        // back to UTC rather than to the device is deliberate: a deadline is a
        // competition fact, and showing one player's phone's idea of it would
        // make two players disagree about when the same lock happens.
        timeZone: context.time_zone ?? 'UTC',
        status: context.status ?? 'unknown',
        matchweek: context.matchweek,
        matchweekCount: context.of,
        locksAt: context.locks_at,
      }
    },
  }
}
