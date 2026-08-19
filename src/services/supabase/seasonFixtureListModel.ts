import { resolveClubIdentity } from '../../domain/clubIdentity/clubIdentityTokens'
import { clubDisplayName } from '../../domain/clubIdentity/clubName'
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

/**
 * WHERE THIS FIXTURE STANDS AGAINST ITS OWN CALENDAR (contract 207).
 *
 * Two facts a surface used to have to infer from a date, and the inference was
 * wrong in both directions. `kickoffAt` on a postponed fixture is where it WAS
 * due — a real instant, and not a plan — so a countdown drawn from it counts
 * down to nothing, and a "has this moved?" test built from the shape of a date
 * silently reclassifies fixtures whenever the shape is tuned.
 *
 * Both are now stated by the server. `rescheduled` is contract 117's stored
 * fact rather than a guess: a fixture has moved because a revision recorded
 * that it did, which is the same fact contract 119's per-fixture lock reads, so
 * the deadline and the wording cannot disagree.
 */
type SeasonFixtureSchedule = {
  /** False exactly while the platform holds the fixture postponed. */
  kickoffConfirmed: boolean
  /** True once any kickoff revision has been recorded against this fixture. */
  rescheduled: boolean
  /** The instant of the FIRST recorded move. Null where it has never moved. */
  originalKickoffAt: string | null
}

export type SeasonListFixture = {
  id: string
  /** ISO instant, or null for a fixture the league has not timed. */
  kickoffAt: string | null
  status: string
  /** The matchweek this fixture BELONGS to, whenever it is actually played. */
  round: SeasonFixtureRound
  /** Contract 207. Whether `kickoffAt` is still a plan, and whether it moved. */
  schedule: SeasonFixtureSchedule
  home: SeasonFixtureClub
  away: SeasonFixtureClub
  /** Settled by the platform. Null until it is. */
  result: { home: number; away: number } | null
  /** What a provider currently reports. Never a result. */
  live: { kind: string; home: number | null; away: number | null; observedAt: string } | null
}

export type SeasonFixtureCompetition = {
  id: string
  name: string
  seasonKey: string
  timeZone: string
  /**
   * The competition's route segment. Contract 148 returns it; contract 139
   * does not, so it is optional and a list-derived fixture leaves it null. A
   * surface that needs to build a URL from a fixture alone reads it from the
   * addressed read.
   */
  slug: string | null
}

export type SeasonFixtureList = {
  competition: SeasonFixtureCompetition
  window: { from: string; to: string }
  serverNow: string | null
  fixtures: readonly SeasonListFixture[]
}

/**
 * One fixture, addressed by its own id (contract 148, `MIG-UI-11`).
 *
 * IT IS A SIBLING OF THE LIST, NOT A WIDENING OF IT. The RPC returns contract
 * 139's fixture entry field for field, which is why it decodes through the same
 * `mapFixture` below: a fixture must look identical whether it arrived from the
 * calendar or from a link, and two decoders over one payload shape is how that
 * stops being true.
 */
export type SeasonFixtureAnswer = {
  competition: SeasonFixtureCompetition
  serverNow: string | null
  /** Null when the payload carried no usable fixture. Never a partial one. */
  fixture: SeasonListFixture | null
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
  const provided = stringOrNull(row.name)
  if (!provided) return null
  // The provider's legal spelling is what `teams.name` holds; what a fixture
  // list prints is the club. `clubDisplayName` removes the paperwork and
  // nothing else — the tokens below still resolve from the name as stored, so
  // the reference join is unaffected by how the row is labelled.
  const name = clubDisplayName(provided)

  return {
    name,
    // `short_code` and `club_colours` are contract 136's reference join. Both
    // optional: an unmatched club resolves to the neutral mark rather than
    // failing the fixture, which is the resolver's own documented behaviour.
    tokens: resolveClubIdentity({
      externalId: fixtureId,
      name: provided,
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

/**
 * A MISSING BLOCK FAILS CLOSED TO "CONFIRMED, NEVER MOVED", not to postponed.
 *
 * The only payload that can omit it is one from a server older than contract
 * 207, and every fixture such a server holds is one nothing has ever
 * postponed — the automatic path did not exist. Defaulting the other way would
 * draw the whole calendar as abnormal the moment a deploy ran out of order.
 */
function mapSchedule(value: unknown, status: string): SeasonFixtureSchedule {
  const row = objectOf(value)
  return {
    kickoffConfirmed:
      typeof row.kickoff_confirmed === 'boolean'
        ? row.kickoff_confirmed
        : status !== 'postponed',
    rescheduled: row.rescheduled === true,
    originalKickoffAt: stringOrNull(row.original_kickoff_at),
  }
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
    schedule: mapSchedule(row.schedule, status),
    home,
    away,
    result: mapResult(row.result),
    live: mapLive(row.live),
  }
}

function mapCompetition(value: unknown, what: string): SeasonFixtureCompetition {
  const competition = objectOf(value)
  const id = stringOrNull(competition.id)
  const name = stringOrNull(competition.name)
  const seasonKey = stringOrNull(competition.season_key)

  if (!id || !name || !seasonKey) {
    throw new Error(`The ${what} response was not in the expected shape.`)
  }

  return {
    id,
    name,
    seasonKey,
    // The competition's own calendar zone, as the server persists it. It is
    // NO LONGER A PRESENTATION INPUT: since the owner's 10 August 2026 UI
    // direction, kickoffs and day headings resolve in the viewer's device
    // zone through `src/shared/time/kickoff.ts`. This field is retained
    // because it is a fact about the competition — the zone its calendar and
    // its monthly retention table are derived in — and a decoder that
    // discarded it would make that unavailable to the reads that need it.
    timeZone: stringOrNull(competition.time_zone) ?? 'UTC',
    slug: stringOrNull(competition.slug),
  }
}

/** Contract 148: the one fixture a Match Centre URL names, with no date hint. */
export function mapSeasonFixture(value: unknown): SeasonFixtureAnswer {
  const payload = objectOf(value)
  return {
    competition: mapCompetition(payload.competition, 'season fixture'),
    serverNow: stringOrNull(payload.server_now),
    fixture: mapFixture(payload.fixture),
  }
}

export function mapSeasonFixtureList(value: unknown): SeasonFixtureList {
  const payload = objectOf(value)
  const window = objectOf(payload.window)

  const competition = mapCompetition(payload.competition, 'season fixtures')
  const from = stringOrNull(window.from)
  const to = stringOrNull(window.to)

  if (!from || !to) {
    throw new Error('The season fixtures response was not in the expected shape.')
  }

  const raw = Array.isArray(payload.fixtures) ? payload.fixtures : []

  return {
    competition,
    window: { from, to },
    serverNow: stringOrNull(payload.server_now),
    // Server order is kickoff order and is preserved exactly. Re-sorting here
    // would be a second opinion about when a match is played.
    fixtures: raw
      .map(mapFixture)
      .filter((fixture): fixture is SeasonListFixture => fixture !== null),
  }
}
