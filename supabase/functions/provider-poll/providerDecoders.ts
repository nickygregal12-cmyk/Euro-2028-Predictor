export type ProviderName = 'sportmonks' | 'api-football' | 'football-data'

export type NormalizedFixture = {
  provider: ProviderName
  providerFixtureId: string
  competitionProviderId: string | null
  seasonProviderId: string | null
  roundProviderId: string | null
  homeTeamProviderId: string
  awayTeamProviderId: string
  kickoffAt: string
  status: string
  homeScore: number | null
  awayScore: number | null
}

export class ProviderDecodeError extends Error {
  readonly provider: ProviderName
  readonly path: string

  constructor(provider: ProviderName, path: string, message: string) {
    super(`${provider} ${path}: ${message}`)
    this.name = 'ProviderDecodeError'
    this.provider = provider
    this.path = path
  }
}

type JsonObject = Record<string, unknown>

function objectAt(provider: ProviderName, value: unknown, path: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProviderDecodeError(provider, path, 'expected an object')
  }
  return value as JsonObject
}

function arrayAt(provider: ProviderName, value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ProviderDecodeError(provider, path, 'expected an array')
  }
  return value
}

function stringAt(provider: ProviderName, value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ProviderDecodeError(provider, path, 'expected a non-empty string')
  }
  return value
}

function idAt(provider: ProviderName, value: unknown, path: string): string {
  if (
    (typeof value !== 'string' && typeof value !== 'number')
    || String(value).trim() === ''
  ) {
    throw new ProviderDecodeError(provider, path, 'expected a string or numeric identifier')
  }
  return String(value)
}

function nullableIdAt(
  provider: ProviderName,
  value: unknown,
  path: string,
): string | null {
  return value === null || value === undefined ? null : idAt(provider, value, path)
}

function nullableScoreAt(
  provider: ProviderName,
  value: unknown,
  path: string,
): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ProviderDecodeError(provider, path, 'expected a non-negative integer or null')
  }
  return value
}

function isoInstantAt(provider: ProviderName, value: unknown, path: string): string {
  const text = stringAt(provider, value, path)
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
    throw new ProviderDecodeError(provider, path, 'expected an ISO-8601 instant with timezone')
  }
  const parsed = Date.parse(text)
  if (!Number.isFinite(parsed)) {
    throw new ProviderDecodeError(provider, path, 'expected a valid ISO-8601 instant')
  }
  return new Date(parsed).toISOString()
}

function unixInstantAt(provider: ProviderName, value: unknown, path: string): string {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 0
    || value > 253402300799
  ) {
    throw new ProviderDecodeError(provider, path, 'expected a valid Unix timestamp in seconds')
  }
  return new Date(value * 1000).toISOString()
}

function exactlyTwoParticipants(
  provider: ProviderName,
  participants: unknown,
  path: string,
): { home: JsonObject; away: JsonObject } {
  const rows = arrayAt(provider, participants, path).map((row, index) =>
    objectAt(provider, row, `${path}[${index}]`),
  )
  if (rows.length !== 2) {
    throw new ProviderDecodeError(provider, path, 'expected exactly two participants')
  }

  const location = (row: JsonObject, index: number): unknown =>
    objectAt(provider, row.meta, `${path}[${index}].meta`).location
  const home = rows.find((row, index) => location(row, index) === 'home')
  const away = rows.find((row, index) => location(row, index) === 'away')
  if (!home || !away || home === away) {
    throw new ProviderDecodeError(provider, path, 'expected distinct home and away participants')
  }
  if (idAt(provider, home.id, `${path}.home.id`) === idAt(provider, away.id, `${path}.away.id`)) {
    throw new ProviderDecodeError(provider, path, 'home and away participants must differ')
  }
  return { home, away }
}

function ensureDistinctTeams(
  provider: ProviderName,
  homeTeamProviderId: string,
  awayTeamProviderId: string,
  path: string,
): void {
  if (homeTeamProviderId === awayTeamProviderId) {
    throw new ProviderDecodeError(provider, path, 'home and away teams must differ')
  }
}

function ensureUniqueFixtures(
  provider: ProviderName,
  fixtures: NormalizedFixture[],
): NormalizedFixture[] {
  const seen = new Set<string>()
  for (const fixture of fixtures) {
    if (seen.has(fixture.providerFixtureId)) {
      throw new ProviderDecodeError(
        provider,
        '$',
        `duplicate fixture identifier ${fixture.providerFixtureId}`,
      )
    }
    seen.add(fixture.providerFixtureId)
  }
  return fixtures
}

export function decodeSportMonks(payload: unknown): NormalizedFixture[] {
  const provider: ProviderName = 'sportmonks'
  const root = objectAt(provider, payload, '$')
  const fixtures = arrayAt(provider, root.data, '$.data').map((raw, index) => {
    const path = `$.data[${index}]`
    const row = objectAt(provider, raw, path)
    const { home, away } = exactlyTwoParticipants(provider, row.participants, `${path}.participants`)
    const homeId = idAt(provider, home.id, `${path}.participants.home.id`)
    const awayId = idAt(provider, away.id, `${path}.participants.away.id`)
    const scores = row.scores === undefined ? [] : arrayAt(provider, row.scores, `${path}.scores`)
    let homeScore: number | null = null
    let awayScore: number | null = null
    let homeSeen = false
    let awaySeen = false

    for (let scoreIndex = 0; scoreIndex < scores.length; scoreIndex += 1) {
      const scorePath = `${path}.scores[${scoreIndex}]`
      const score = objectAt(provider, scores[scoreIndex], scorePath)
      if (score.description !== 'CURRENT') continue
      const participantId = idAt(provider, score.participant_id, `${scorePath}.participant_id`)
      const goals = nullableScoreAt(
        provider,
        objectAt(provider, score.score, `${scorePath}.score`).goals,
        `${scorePath}.score.goals`,
      )
      if (participantId === homeId) {
        if (homeSeen) {
          throw new ProviderDecodeError(provider, scorePath, 'duplicate current home score')
        }
        homeSeen = true
        homeScore = goals
      } else if (participantId === awayId) {
        if (awaySeen) {
          throw new ProviderDecodeError(provider, scorePath, 'duplicate current away score')
        }
        awaySeen = true
        awayScore = goals
      } else {
        throw new ProviderDecodeError(provider, scorePath, 'score references an unknown participant')
      }
    }

    return {
      provider,
      providerFixtureId: idAt(provider, row.id, `${path}.id`),
      competitionProviderId: nullableIdAt(provider, row.league_id, `${path}.league_id`),
      seasonProviderId: nullableIdAt(provider, row.season_id, `${path}.season_id`),
      roundProviderId: nullableIdAt(provider, row.round_id, `${path}.round_id`),
      homeTeamProviderId: homeId,
      awayTeamProviderId: awayId,
      kickoffAt: unixInstantAt(
        provider,
        row.starting_at_timestamp,
        `${path}.starting_at_timestamp`,
      ),
      status: idAt(provider, row.state_id ?? row.result_info ?? 'unknown', `${path}.status`),
      homeScore,
      awayScore,
    }
  })
  return ensureUniqueFixtures(provider, fixtures)
}

export function decodeApiFootball(payload: unknown): NormalizedFixture[] {
  const provider: ProviderName = 'api-football'
  const root = objectAt(provider, payload, '$')
  const fixtures = arrayAt(provider, root.response, '$.response').map((raw, index) => {
    const path = `$.response[${index}]`
    const row = objectAt(provider, raw, path)
    const fixture = objectAt(provider, row.fixture, `${path}.fixture`)
    const league = objectAt(provider, row.league, `${path}.league`)
    const teams = objectAt(provider, row.teams, `${path}.teams`)
    const home = objectAt(provider, teams.home, `${path}.teams.home`)
    const away = objectAt(provider, teams.away, `${path}.teams.away`)
    const goals = objectAt(provider, row.goals, `${path}.goals`)
    const status = objectAt(provider, fixture.status, `${path}.fixture.status`)
    const homeTeamProviderId = idAt(provider, home.id, `${path}.teams.home.id`)
    const awayTeamProviderId = idAt(provider, away.id, `${path}.teams.away.id`)
    ensureDistinctTeams(provider, homeTeamProviderId, awayTeamProviderId, `${path}.teams`)

    return {
      provider,
      providerFixtureId: idAt(provider, fixture.id, `${path}.fixture.id`),
      competitionProviderId: nullableIdAt(provider, league.id, `${path}.league.id`),
      seasonProviderId: nullableIdAt(provider, league.season, `${path}.league.season`),
      roundProviderId: nullableIdAt(provider, league.round, `${path}.league.round`),
      homeTeamProviderId,
      awayTeamProviderId,
      kickoffAt: isoInstantAt(provider, fixture.date, `${path}.fixture.date`),
      status: stringAt(provider, status.short ?? status.long, `${path}.fixture.status`),
      homeScore: nullableScoreAt(provider, goals.home, `${path}.goals.home`),
      awayScore: nullableScoreAt(provider, goals.away, `${path}.goals.away`),
    }
  })
  return ensureUniqueFixtures(provider, fixtures)
}

export function decodeFootballData(payload: unknown): NormalizedFixture[] {
  const provider: ProviderName = 'football-data'
  const root = objectAt(provider, payload, '$')
  const rootCompetition = root.competition === undefined
    ? null
    : objectAt(provider, root.competition, '$.competition')
  const fixtures = arrayAt(provider, root.matches, '$.matches').map((raw, index) => {
    const path = `$.matches[${index}]`
    const row = objectAt(provider, raw, path)
    const competition = row.competition === undefined
      ? rootCompetition
      : objectAt(provider, row.competition, `${path}.competition`)
    const season = row.season === undefined
      ? null
      : objectAt(provider, row.season, `${path}.season`)
    const home = objectAt(provider, row.homeTeam, `${path}.homeTeam`)
    const away = objectAt(provider, row.awayTeam, `${path}.awayTeam`)
    const score = objectAt(provider, row.score, `${path}.score`)
    const fullTime = objectAt(provider, score.fullTime, `${path}.score.fullTime`)
    const homeTeamProviderId = idAt(provider, home.id, `${path}.homeTeam.id`)
    const awayTeamProviderId = idAt(provider, away.id, `${path}.awayTeam.id`)
    ensureDistinctTeams(provider, homeTeamProviderId, awayTeamProviderId, path)

    return {
      provider,
      providerFixtureId: idAt(provider, row.id, `${path}.id`),
      competitionProviderId: competition
        ? nullableIdAt(provider, competition.id, `${path}.competition.id`)
        : null,
      seasonProviderId: season
        ? nullableIdAt(provider, season.id ?? season.startDate, `${path}.season`)
        : null,
      roundProviderId: nullableIdAt(provider, row.matchday ?? row.stage, `${path}.round`),
      homeTeamProviderId,
      awayTeamProviderId,
      kickoffAt: isoInstantAt(provider, row.utcDate, `${path}.utcDate`),
      status: stringAt(provider, row.status, `${path}.status`),
      homeScore: nullableScoreAt(provider, fullTime.home, `${path}.score.fullTime.home`),
      awayScore: nullableScoreAt(provider, fullTime.away, `${path}.score.fullTime.away`),
    }
  })
  return ensureUniqueFixtures(provider, fixtures)
}

export function decodeProviderPayload(
  provider: ProviderName,
  payload: unknown,
): NormalizedFixture[] {
  switch (provider) {
    case 'sportmonks':
      return decodeSportMonks(payload)
    case 'api-football':
      return decodeApiFootball(payload)
    case 'football-data':
      return decodeFootballData(payload)
  }
}
