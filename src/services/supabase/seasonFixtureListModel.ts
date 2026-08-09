import { resolveClubIdentity } from '../../domain/clubIdentity/clubIdentityTokens'
import type { ClubIdentityTokens } from '../../domain/clubIdentity/clubIdentityTypes'

/**
 * Season fixture-list parsing (contract 139's `get_season_fixtures`). Pure: no
 * Supabase import, no network, no clock.
 *
 * WHY THIS EXISTS BESIDE `seasonFixturesModel`. That one decodes
 * `get_season_matchweek_card` and returns ONE matchweek's fixtures, because
 * that is the only thing the card read can answer. It is also why the Matches
 * surface grouped strictly by round — and grouping strictly by round is the
 * misreading `MASTER-TODO.md` names by hand: a fixture postponed out of
 * matchweek 5 into November keeps `competition_round_id = 5`, deliberately, so
 * a by-round list puts a November match under a September heading.
 *
 * Contract 139 answers a DATE WINDOW and carries the round as a LABEL. So the
 * order here is kickoff order, always, and the matchweek travels with each
 * fixture as something to print rather than something to group by. A caller
 * that wants one matchweek filters on the label; a caller that wants a weekend
 * gets the postponed match in its real place.
 *
 * PROVISIONAL AND OFFICIAL ARE TWO FIELDS, NOT ONE. `result` is what the
 * platform settled; `live` is what a provider currently says. The read keeps
 * them apart on purpose and so does this — merging them would be a browser
 * deciding that a provider's number is a result, which is the confirmation gate
 * the whole ingestion boundary exists to hold.
 */

export type SeasonFixtureClub = {
  name: string
  tokens: ClubIdentityTokens
}

export type SeasonFixtureRound = {
  id: string
  ordinal: number
  label: string
}

export type SeasonListFixture = {
  id: string
  /** ISO instant, or null for a fixture the league has not timed. */
  kickoffAt: string | null
  status: string
  /** The matchweek this fixture BELONGS to, whenever it is actually played. */
  round: SeasonFixtureRound
  home: SeasonFixtureClub
  away: SeasonFixtureClub
  /** Settled by the platform. Null until it is. */
  result: { home: number; away: number } | null
  /** What a provider currently reports. Never a result. */
  live: { kind: string; home: number | null; away: number | null; observedAt: string } | null
}

export type SeasonFixtureList = {
  competition: { id: string; name: string; seasonKey: string; timeZone: string }
  window: { from: string; to: string }
  serverNow: string | null
  fixtures: readonly SeasonListFixture[]
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function mapClub(value: unknown, fixtureId: string): SeasonFixtureClub | null {
  const row = objectOf(value)
  const name = stringOrNull(row.name)
  if (!name) return null

  return {
    name,
    // `short_code` and `club_colours` are contract 136's reference join. Both
    // optional: an unmatched club resolves to the neutral mark rather than
    // failing the fixture, which is the resolver's own documented behaviour.
    tokens: resolveClubIdentity({
      externalId: fixtureId,
      name,
      tla: stringOrNull(row.short_code) ?? undefined,
      clubColors: stringOrNull(row.club_colours) ?? undefined,
    }),
  }
}

function mapRound(value: unknown): SeasonFixtureRound | null {
  const row = objectOf(value)
  const id = stringOrNull(row.id)
  const ordinal = integerOrNull(row.ordinal)
  const label = stringOrNull(row.label)
  if (!id || ordinal === null || !label) return null
  return { id, ordinal, label }
}

function mapResult(value: unknown): { home: number; away: number } | null {
  const row = objectOf(value)
  const home = integerOrNull(row.home)
  const away = integerOrNull(row.away)
  // A half-result is not a result, and the read only sends one for a played
  // fixture, so a partial object means the payload disagrees with itself.
  return home !== null && away !== null ? { home, away } : null
}

function mapLive(value: unknown): SeasonListFixture['live'] {
  const row = objectOf(value)
  const kind = stringOrNull(row.kind)
  const observedAt = stringOrNull(row.observed_at)
  if (!kind || !observedAt) return null
  return {
    kind,
    // Scores are genuinely optional here: a provider reporting "in play" before
    // a goal has a kind and no numbers, and that is information.
    home: integerOrNull(row.home),
    away: integerOrNull(row.away),
    observedAt,
  }
}

function mapFixture(value: unknown): SeasonListFixture | null {
  const row = objectOf(value)
  const id = stringOrNull(row.id)
  const status = stringOrNull(row.status)
  if (!id || !status) return null

  const round = mapRound(row.round)
  const home = mapClub(row.home, id)
  const away = mapClub(row.away, id)
  // A fixture with no round, or with one club, is not a fixture. Guessing the
  // missing side is not available to a parser.
  if (!round || !home || !away) return null

  return {
    id,
    kickoffAt: stringOrNull(row.kickoff_at),
    status,
    round,
    home,
    away,
    result: mapResult(row.result),
    live: mapLive(row.live),
  }
}

export function mapSeasonFixtureList(value: unknown): SeasonFixtureList {
  const payload = objectOf(value)
  const competition = objectOf(payload.competition)
  const window = objectOf(payload.window)

  const id = stringOrNull(competition.id)
  const name = stringOrNull(competition.name)
  const seasonKey = stringOrNull(competition.season_key)
  const from = stringOrNull(window.from)
  const to = stringOrNull(window.to)

  if (!id || !name || !seasonKey || !from || !to) {
    throw new Error('The season fixtures response was not in the expected shape.')
  }

  const raw = Array.isArray(payload.fixtures) ? payload.fixtures : []

  return {
    competition: {
      id,
      name,
      seasonKey,
      // The competition's own zone, not the viewer's and not UTC. A Saturday
      // 15:00 kickoff is Saturday to everyone who follows that league; falling
      // back to UTC rather than the device keeps two players agreeing.
      timeZone: stringOrNull(competition.time_zone) ?? 'UTC',
    },
    window: { from, to },
    serverNow: stringOrNull(payload.server_now),
    // Server order is kickoff order and is preserved exactly. Re-sorting here
    // would be a second opinion about when a match is played.
    fixtures: raw
      .map(mapFixture)
      .filter((fixture): fixture is SeasonListFixture => fixture !== null),
  }
}
