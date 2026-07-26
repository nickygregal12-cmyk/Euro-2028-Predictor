import {
  calculateSourceMetadata,
  createEmptyMatchEnrichment,
  type MatchCentreViewModel,
  type MatchEvent,
  type MatchLifecycleState,
} from './matchCentreContract'

const BASE_TIME = '2028-06-09T20:00:00.000Z'

const baseEvents: MatchEvent[] = [
  {
    id: 'event-goal-1',
    kind: 'goal',
    minute: 18,
    addedMinute: null,
    teamId: 'scotland',
    playerName: 'Home Player',
    secondaryPlayerName: null,
    label: 'Goal',
    sequence: 1,
  },
  {
    id: 'event-card-1',
    kind: 'card',
    minute: 31,
    addedMinute: null,
    teamId: 'germany',
    playerName: 'Away Player',
    secondaryPlayerName: null,
    label: 'Yellow card',
    sequence: 2,
  },
  {
    id: 'event-sub-1',
    kind: 'substitution',
    minute: 64,
    addedMinute: null,
    teamId: 'scotland',
    playerName: 'Player On',
    secondaryPlayerName: 'Player Off',
    label: 'Substitution',
    sequence: 3,
  },
]

function scenario(
  lifecycle: MatchLifecycleState,
  overrides: Partial<MatchCentreViewModel['external']> = {},
): MatchCentreViewModel {
  return {
    external: {
      fixtureId: 'fixture-1',
      matchRef: 'M01',
      kickoffAt: BASE_TIME,
      lifecycle,
      clockLabel: null,
      venue: 'National Stadium',
      referee: 'Match Official',
      home: { id: 'scotland', name: 'Scotland', countryCode: 'gb-sct' },
      away: { id: 'germany', name: 'Germany', countryCode: 'de' },
      score: null,
      events: [],
      lineups: { home: null, away: null },
      statistics: [],
      source: calculateSourceMetadata({
        provider: 'mock',
        providerFixtureId: 'mock-1',
        fetchedAt: BASE_TIME,
        now: BASE_TIME,
        staleAfterSeconds: 60,
      }),
      ...overrides,
    },
    predictor: {
      userPrediction: { homeScore: 1, awayScore: 1, joker: false },
      points: { status: 'pending', value: null },
      leaguePredictionSplit: { home: 4, draw: 3, away: 5, total: 12 },
      liveRankImpact: null,
      groupTableImpact: null,
      thirdPlaceTableImpact: null,
      bracketImpact: null,
    },
    enrichment: createEmptyMatchEnrichment(),
  }
}

export const MATCH_CENTRE_SCENARIOS = {
  scheduled: scenario('SCHEDULED'),
  lineupsUnavailable: scenario('PRE_MATCH', {
    source: calculateSourceMetadata({
      provider: 'mock',
      providerFixtureId: 'mock-1',
      fetchedAt: BASE_TIME,
      now: BASE_TIME,
      staleAfterSeconds: 60,
      provisional: true,
    }),
  }),
  live: scenario('LIVE_SECOND_HALF', {
    clockLabel: "67'",
    score: { home: 1, away: 0 },
    events: baseEvents,
    statistics: [
      { key: 'possession', label: 'Possession', home: '46%', away: '54%' },
      { key: 'shots', label: 'Shots', home: 7, away: 9 },
    ],
  }),
  halfTime: scenario('HALF_TIME', {
    clockLabel: 'HT',
    score: { home: 1, away: 0 },
    events: baseEvents.slice(0, 2),
  }),
  fullTime: scenario('FULL_TIME', {
    clockLabel: 'FT',
    score: { home: 1, away: 1 },
    events: baseEvents,
  }),
  penalties: scenario('PENALTIES', {
    clockLabel: 'Pens',
    score: {
      home: 1,
      away: 1,
      homeExtraTime: 1,
      awayExtraTime: 1,
      homePenalties: 4,
      awayPenalties: 3,
    },
  }),
  stale: scenario('LIVE_FIRST_HALF', {
    clockLabel: "22'",
    score: { home: 0, away: 0 },
    source: calculateSourceMetadata({
      provider: 'mock',
      providerFixtureId: 'mock-1',
      fetchedAt: '2028-06-09T20:00:00.000Z',
      now: '2028-06-09T20:03:00.000Z',
      staleAfterSeconds: 60,
    }),
  }),
  postponed: scenario('POSTPONED', {
    source: calculateSourceMetadata({
      provider: 'mock',
      providerFixtureId: 'mock-1',
      fetchedAt: BASE_TIME,
      now: BASE_TIME,
      staleAfterSeconds: 60,
      provisional: true,
    }),
  }),
  unavailable: scenario('SCHEDULED', {
    venue: null,
    referee: null,
    source: calculateSourceMetadata({
      provider: 'mock',
      providerFixtureId: 'mock-1',
      fetchedAt: BASE_TIME,
      now: BASE_TIME,
      staleAfterSeconds: 60,
      unavailable: true,
    }),
  }),
  corrected: scenario('FULL_TIME', {
    score: { home: 2, away: 1 },
    events: [
      ...baseEvents,
      {
        id: 'event-correction-1',
        kind: 'other',
        minute: 90,
        addedMinute: 4,
        teamId: null,
        playerName: null,
        secondaryPlayerName: null,
        label: 'Score corrected by provider',
        sequence: 4,
      },
    ],
    source: calculateSourceMetadata({
      provider: 'mock',
      providerFixtureId: 'mock-1',
      fetchedAt: BASE_TIME,
      providerUpdatedAt: '2028-06-09T22:02:00.000Z',
      now: BASE_TIME,
      staleAfterSeconds: 60,
      provisional: true,
    }),
  }),
} satisfies Record<string, MatchCentreViewModel>

export type MatchCentreScenarioName = keyof typeof MATCH_CENTRE_SCENARIOS
