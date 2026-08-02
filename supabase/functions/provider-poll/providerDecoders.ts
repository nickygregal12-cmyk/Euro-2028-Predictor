export type ProviderName = 'sportmonks' | 'api-football' | 'football-data';

export type NormalizedFixture = {
  provider: ProviderName;
  providerFixtureId: string;
  competitionProviderId: string | null;
  seasonProviderId: string | null;
  roundProviderId: string | null;
  homeTeamProviderId: string;
  awayTeamProviderId: string;
  kickoffAt: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
};

export class ProviderDecodeError extends Error {
  constructor(
    public readonly provider: ProviderName,
    public readonly path: string,
    message: string,
  ) {
    super(`${provider} ${path}: ${message}`);
    this.name = 'ProviderDecodeError';
  }
}

type JsonObject = Record<string, unknown>;

function objectAt(provider: ProviderName, value: unknown, path: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProviderDecodeError(provider, path, 'expected an object');
  }
  return value as JsonObject;
}

function arrayAt(provider: ProviderName, value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ProviderDecodeError(provider, path, 'expected an array');
  }
  return value;
}

function stringAt(provider: ProviderName, value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ProviderDecodeError(provider, path, 'expected a non-empty string');
  }
  return value;
}

function idAt(provider: ProviderName, value: unknown, path: string): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
    throw new ProviderDecodeError(provider, path, 'expected a string or numeric identifier');
  }
  return String(value);
}

function nullableIdAt(provider: ProviderName, value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null;
  return idAt(provider, value, path);
}

function nullableScoreAt(provider: ProviderName, value: unknown, path: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ProviderDecodeError(provider, path, 'expected a non-negative integer or null');
  }
  return value;
}

function isoInstantAt(provider: ProviderName, value: unknown, path: string): string {
  const text = stringAt(provider, value, path);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    throw new ProviderDecodeError(provider, path, 'expected an ISO-8601 instant');
  }
  return new Date(parsed).toISOString();
}

function exactlyTwoParticipants(
  provider: ProviderName,
  participants: unknown,
  path: string,
): { home: JsonObject; away: JsonObject } {
  const rows = arrayAt(provider, participants, path).map((row, index) =>
    objectAt(provider, row, `${path}[${index}]`),
  );
  const home = rows.find((row) => row.meta && objectAt(provider, row.meta, `${path}.meta`).location === 'home');
  const away = rows.find((row) => row.meta && objectAt(provider, row.meta, `${path}.meta`).location === 'away');
  if (!home || !away) {
    throw new ProviderDecodeError(provider, path, 'expected distinct home and away participants');
  }
  return { home, away };
}

export function decodeSportMonks(payload: unknown): NormalizedFixture[] {
  const provider: ProviderName = 'sportmonks';
  const root = objectAt(provider, payload, '$');
  return arrayAt(provider, root.data, '$.data').map((raw, index) => {
    const path = `$.data[${index}]`;
    const row = objectAt(provider, raw, path);
    const { home, away } = exactlyTwoParticipants(provider, row.participants, `${path}.participants`);
    const scores = row.scores === undefined ? [] : arrayAt(provider, row.scores, `${path}.scores`);
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    for (let scoreIndex = 0; scoreIndex < scores.length; scoreIndex += 1) {
      const score = objectAt(provider, scores[scoreIndex], `${path}.scores[${scoreIndex}]`);
      const description = score.description;
      if (description !== 'CURRENT' && description !== 'FT') continue;
      const participant = nullableIdAt(provider, score.participant_id, `${path}.scores[${scoreIndex}].participant_id`);
      const goals = nullableScoreAt(provider, objectAt(provider, score.score, `${path}.scores[${scoreIndex}].score`).goals, `${path}.scores[${scoreIndex}].score.goals`);
      if (participant === idAt(provider, home.id, `${path}.participants.home.id`)) homeScore = goals;
      if (participant === idAt(provider, away.id, `${path}.participants.away.id`)) awayScore = goals;
    }
    return {
      provider,
      providerFixtureId: idAt(provider, row.id, `${path}.id`),
      competitionProviderId: nullableIdAt(provider, row.league_id, `${path}.league_id`),
      seasonProviderId: nullableIdAt(provider, row.season_id, `${path}.season_id`),
      roundProviderId: nullableIdAt(provider, row.round_id, `${path}.round_id`),
      homeTeamProviderId: idAt(provider, home.id, `${path}.participants.home.id`),
      awayTeamProviderId: idAt(provider, away.id, `${path}.participants.away.id`),
      kickoffAt: isoInstantAt(provider, row.starting_at, `${path}.starting_at`),
      status: stringAt(provider, row.state_id ?? row.result_info ?? 'unknown', `${path}.status`),
      homeScore,
      awayScore,
    };
  });
}

export function decodeApiFootball(payload: unknown): NormalizedFixture[] {
  const provider: ProviderName = 'api-football';
  const root = objectAt(provider, payload, '$');
  return arrayAt(provider, root.response, '$.response').map((raw, index) => {
    const path = `$.response[${index}]`;
    const row = objectAt(provider, raw, path);
    const fixture = objectAt(provider, row.fixture, `${path}.fixture`);
    const league = objectAt(provider, row.league, `${path}.league`);
    const teams = objectAt(provider, row.teams, `${path}.teams`);
    const home = objectAt(provider, teams.home, `${path}.teams.home`);
    const away = objectAt(provider, teams.away, `${path}.teams.away`);
    const goals = objectAt(provider, row.goals, `${path}.goals`);
    const status = objectAt(provider, fixture.status, `${path}.fixture.status`);
    return {
      provider,
      providerFixtureId: idAt(provider, fixture.id, `${path}.fixture.id`),
      competitionProviderId: nullableIdAt(provider, league.id, `${path}.league.id`),
      seasonProviderId: nullableIdAt(provider, league.season, `${path}.league.season`),
      roundProviderId: nullableIdAt(provider, league.round, `${path}.league.round`),
      homeTeamProviderId: idAt(provider, home.id, `${path}.teams.home.id`),
      awayTeamProviderId: idAt(provider, away.id, `${path}.teams.away.id`),
      kickoffAt: isoInstantAt(provider, fixture.date, `${path}.fixture.date`),
      status: stringAt(provider, status.short ?? status.long, `${path}.fixture.status`),
      homeScore: nullableScoreAt(provider, goals.home, `${path}.goals.home`),
      awayScore: nullableScoreAt(provider, goals.away, `${path}.goals.away`),
    };
  });
}

export function decodeFootballData(payload: unknown): NormalizedFixture[] {
  const provider: ProviderName = 'football-data';
  const root = objectAt(provider, payload, '$');
  const rootCompetition = root.competition === undefined ? null : objectAt(provider, root.competition, '$.competition');
  return arrayAt(provider, root.matches, '$.matches').map((raw, index) => {
    const path = `$.matches[${index}]`;
    const row = objectAt(provider, raw, path);
    const competition = row.competition === undefined ? rootCompetition : objectAt(provider, row.competition, `${path}.competition`);
    const season = row.season === undefined ? null : objectAt(provider, row.season, `${path}.season`);
    const home = objectAt(provider, row.homeTeam, `${path}.homeTeam`);
    const away = objectAt(provider, row.awayTeam, `${path}.awayTeam`);
    const score = objectAt(provider, row.score, `${path}.score`);
    const fullTime = objectAt(provider, score.fullTime, `${path}.score.fullTime`);
    return {
      provider,
      providerFixtureId: idAt(provider, row.id, `${path}.id`),
      competitionProviderId: competition ? nullableIdAt(provider, competition.id, `${path}.competition.id`) : null,
      seasonProviderId: season ? nullableIdAt(provider, season.id ?? season.startDate, `${path}.season`) : null,
      roundProviderId: nullableIdAt(provider, row.matchday ?? row.stage, `${path}.round`),
      homeTeamProviderId: idAt(provider, home.id, `${path}.homeTeam.id`),
      awayTeamProviderId: idAt(provider, away.id, `${path}.awayTeam.id`),
      kickoffAt: isoInstantAt(provider, row.utcDate, `${path}.utcDate`),
      status: stringAt(provider, row.status, `${path}.status`),
      homeScore: nullableScoreAt(provider, fullTime.home, `${path}.score.fullTime.home`),
      awayScore: nullableScoreAt(provider, fullTime.away, `${path}.score.fullTime.away`),
    };
  });
}

export function decodeProviderPayload(provider: ProviderName, payload: unknown): NormalizedFixture[] {
  switch (provider) {
    case 'sportmonks':
      return decodeSportMonks(payload);
    case 'api-football':
      return decodeApiFootball(payload);
    case 'football-data':
      return decodeFootballData(payload);
  }
}
