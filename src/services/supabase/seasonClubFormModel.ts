import { resolveClubIdentity } from '../../domain/clubIdentity/clubIdentityTokens'
import { clubDisplayName } from '../../domain/clubIdentity/clubName'
import type { ClubIdentityTokens } from '../../domain/clubIdentity/clubIdentityTypes'

/**
 * Recent club form and this season's meetings between two clubs (contract 141's
 * `get_season_club_form` and `get_season_club_head_to_head`). Pure: no Supabase
 * import, no network, no clock.
 *
 * BOTH READS ARE DERIVED FROM SETTLED FIXTURES AND NOTHING ELSE. The migration
 * enforces that with a guard: neither function may name a prediction, an entry
 * or a score event, because the moment club form reads a player it needs a
 * reveal boundary it does not have. So what arrives here is football, is the
 * same for everybody, and costs no provider request.
 *
 * `outcome` IS THE SERVER'S LETTER. W, D and L are computed there from the
 * settled score and this file does not re-derive them from `goals_for` and
 * `goals_against`, which would be a second opinion about who won.
 *
 * THE FORM READ CARRIES THE TEAM ID AND THE FIXTURE READ DOES NOT, which is why
 * the two are joined by NAME upstream of the head-to-head call. That is safe
 * rather than lucky: both names come from `public.teams.name`, the same column
 * of the same rows, so the match is an equality on one source of truth rather
 * than a fuzzy comparison of two.
 */

export type ClubFormOutcome = 'W' | 'D' | 'L'

export type SeasonClubForm = {
  teamId: string
  name: string
  tokens: ClubIdentityTokens
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  /** Most recent first, which is how a form string is read. */
  form: readonly ClubFormOutcome[]
}

export type SeasonClubFormTable = {
  serverNow: string | null
  /** How many matches back the server was asked for. */
  matches: number
  clubs: readonly SeasonClubForm[]
}

export type ClubMeeting = {
  seasonFixtureId: string
  kickoffAt: string | null
  atHome: boolean
  goalsFor: number
  goalsAgainst: number
  outcome: ClubFormOutcome
  round: string | null
}

export type ClubHeadToHead = {
  team: { teamId: string; name: string }
  opponent: { teamId: string; name: string }
  summary: {
    played: number
    won: number
    drawn: number
    lost: number
    goalsFor: number
    goalsAgainst: number
  }
  /** Most recent first. Empty when they have not met yet this season. */
  meetings: readonly ClubMeeting[]
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0
}

function outcomes(value: unknown): ClubFormOutcome[] {
  if (!Array.isArray(value)) return []
  // Anything that is not one of the three letters is dropped rather than
  // rendered: a form string is only readable because every character means one
  // of three things.
  return value.filter((entry): entry is ClubFormOutcome =>
    entry === 'W' || entry === 'D' || entry === 'L',
  )
}

export function mapSeasonClubForm(payload: unknown): SeasonClubFormTable {
  const root = (payload ?? {}) as Record<string, unknown>
  const rows = Array.isArray(root.clubs) ? root.clubs : []

  return {
    serverNow: stringOrNull(root.server_now),
    matches: whole(root.matches),
    clubs: rows.flatMap((value) => {
      const row = (value ?? {}) as Record<string, unknown>
      const teamId = stringOrNull(row.team_id)
      const name = stringOrNull(row.name)
      if (!teamId || !name) return []
      return [
        {
          teamId,
          // Display drops the provider's legal suffix; the resolver keeps the
          // stored spelling, because that is what the reference join matches.
          name: clubDisplayName(name),
          tokens: resolveClubIdentity({
            externalId: teamId,
            name,
            tla: stringOrNull(row.short_code) ?? undefined,
            clubColors: stringOrNull(row.club_colours) ?? undefined,
          }),
          played: whole(row.played),
          won: whole(row.won),
          drawn: whole(row.drawn),
          lost: whole(row.lost),
          goalsFor: whole(row.goals_for),
          goalsAgainst: whole(row.goals_against),
          form: outcomes(row.form),
        },
      ]
    }),
  }
}

export function mapClubHeadToHead(payload: unknown): ClubHeadToHead {
  const root = (payload ?? {}) as Record<string, unknown>
  const side = (value: unknown) => {
    const row = (value ?? {}) as Record<string, unknown>
    return { teamId: stringOrNull(row.team_id) ?? '', name: stringOrNull(row.name) ?? '' }
  }
  const summary = (root.summary ?? {}) as Record<string, unknown>
  const meetings = Array.isArray(root.meetings) ? root.meetings : []

  return {
    team: side(root.team),
    opponent: side(root.opponent),
    summary: {
      played: whole(summary.played),
      won: whole(summary.won),
      drawn: whole(summary.drawn),
      lost: whole(summary.lost),
      goalsFor: whole(summary.goals_for),
      goalsAgainst: whole(summary.goals_against),
    },
    meetings: meetings.flatMap((value) => {
      const row = (value ?? {}) as Record<string, unknown>
      const id = stringOrNull(row.season_fixture_id)
      const outcome = outcomes([row.outcome])[0]
      // A meeting with no fixture or no outcome is a settled result this could
      // not describe. Dropped rather than shown as a blank line.
      if (!id || !outcome) return []
      return [
        {
          seasonFixtureId: id,
          kickoffAt: stringOrNull(row.kickoff_at),
          atHome: row.at_home === true,
          goalsFor: whole(row.goals_for),
          goalsAgainst: whole(row.goals_against),
          outcome,
          round: stringOrNull(row.round),
        },
      ]
    }),
  }
}
