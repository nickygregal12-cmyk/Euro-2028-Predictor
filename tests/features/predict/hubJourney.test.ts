import { describe, expect, it } from 'vitest'
import type { Prediction } from '../../../src/app/providers/PredictionsProvider'
import { buildPredictHubModel } from '../../../src/features/predict/hubJourney'
import type {
  Match,
  Team,
  TournamentData,
} from '../../../src/services/supabase/tournamentData'

// A compact two-group tournament: the model follows the data's real groups,
// so every journey rule is exercisable without a full 36-match fixture.
const GROUPS = [
  { id: 'group-a', letter: 'A' },
  { id: 'group-b', letter: 'B' },
]

const TEAM_IDS: Record<string, string[]> = {
  'group-a': ['a', 'b', 'c', 'd'],
  'group-b': ['e', 'f', 'g', 'h'],
}

const teams: Team[] = GROUPS.flatMap((group) =>
  TEAM_IDS[group.id].map((id, index) => ({
    id,
    name: `Team ${id.toUpperCase()}`,
    groupId: group.id,
    slot: index + 1,
  })),
)

const PAIRINGS = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
] as const

const matches: Match[] = GROUPS.flatMap((group, groupIndex) =>
  PAIRINGS.map(([home, away], index): Match => {
    const ids = TEAM_IDS[group.id]
    return {
      id: `${group.letter}${index + 1}`,
      matchRef: `G-${group.letter}-${index + 1}`,
      round: 'group',
      groupId: group.id,
      matchday: Math.floor(index / 2) + 1,
      homeSource: ids[home],
      awaySource: ids[away],
      homeTeamId: ids[home],
      awayTeamId: ids[away],
      matchDate: `2028-06-0${groupIndex + 1}`,
      kickoffAt: null,
      venue: 'Test venue',
      homeScore: null,
      awayScore: null,
    }
  }),
)

const data: TournamentData = {
  tournament: {
    id: 'tournament',
    name: 'Test Euros',
    year: 2028,
    startsOn: '2028-06-09',
    endsOn: '2028-07-09',
    lockAt: null,
  },
  groups: GROUPS,
  teams,
  matches,
}

const NONE: Prediction = { homeScore: null, awayScore: null, joker: false }

function getter(predictions: Record<string, Prediction>) {
  return (matchId: string): Prediction => predictions[matchId] ?? NONE
}

// Decisive scores giving distinct points (9/6/3/0) inside a group; the third
// team's goal difference differs between variants so the thirds ranking never
// ties by accident.
function decisiveGroup(letter: string, thirdConceded: number): Record<string, Prediction> {
  const p = (home: number, away: number): Prediction => ({
    homeScore: home,
    awayScore: away,
    joker: false,
  })
  return {
    [`${letter}1`]: p(1, 0),
    [`${letter}2`]: p(thirdConceded, 0),
    [`${letter}3`]: p(3, 0),
    [`${letter}4`]: p(1, 0),
    [`${letter}5`]: p(2, 0),
    [`${letter}6`]: p(1, 0),
  }
}

describe('buildPredictHubModel', () => {
  it('starts at zero with Groups current, Review locked and Continue at Group A', () => {
    const model = buildPredictHubModel(data, getter({}), 0)

    expect(model.entryPercent).toBe(0)
    expect(model.hasAnyEntry).toBe(false)
    expect(model.groupChips.map((chip) => chip.letter)).toEqual(['A', 'B'])
    expect(model.groupChips[0]).toMatchObject({
      predicted: 0,
      total: 6,
      complete: false,
      pendingTies: 0,
    })
    expect(model.stageStates).toEqual({
      groups: 'current',
      standings: 'todo',
      bracket: 'todo',
      jokers: 'todo',
      review: 'locked',
    })
    expect(model.continueTarget).toEqual({
      label: 'Continue Group A',
      route: '/predict/groups/A',
    })
    expect(model.champion).toBeNull()
  })

  it('advances Continue to the first incomplete group', () => {
    const predictions = { ...decisiveGroup('A', 2) }
    const model = buildPredictHubModel(data, getter(predictions), 0)

    expect(model.groupChips[0]).toMatchObject({ complete: true, pendingTies: 0 })
    expect(model.groupChips[1]).toMatchObject({ predicted: 0, complete: false })
    expect(model.continueTarget).toEqual({
      label: 'Continue Group B',
      route: '/predict/groups/B',
    })
    expect(model.hasAnyEntry).toBe(true)
    // 6 of 27 total picks (12 scorelines + 15 winners).
    expect(model.entryPercent).toBe(Math.round((6 / 27) * 100))
  })

  it('turns a group amber and routes Continue to its unresolved tie', () => {
    const allDrawsA = Object.fromEntries(
      PAIRINGS.map((_, index) => [
        `A${index + 1}`,
        { homeScore: 1, awayScore: 1, joker: false } as Prediction,
      ]),
    )
    const predictions = { ...allDrawsA, ...decisiveGroup('B', 2) }
    const model = buildPredictHubModel(data, getter(predictions), 0)

    expect(model.status.groups.complete).toBe(true)
    expect(model.groupChips[0].pendingTies).toBeGreaterThan(0)
    expect(model.stageStates.groups).toBe('attention')
    expect(model.continueTarget).toEqual({
      label: 'Resolve the Group A tie',
      route: '/predict/groups/A',
    })
  })

  it('moves to the bracket once every group is decisive and settled', () => {
    const predictions = {
      ...decisiveGroup('A', 2),
      ...decisiveGroup('B', 4),
    }
    const model = buildPredictHubModel(data, getter(predictions), 0)

    expect(model.stageStates.groups).toBe('done')
    expect(model.stageStates.standings).toBe('done')
    expect(model.stageStates.bracket).toBe('current')
    expect(model.stageStates.review).toBe('locked')
    expect(model.continueTarget).toEqual({
      label: 'Pick your knockout winners',
      route: '/predict/bracket',
    })
    expect(model.entryPercent).toBe(Math.round((12 / 27) * 100))
  })

  it('counts jokers as an entry but never as a Continue target', () => {
    const model = buildPredictHubModel(data, getter({}), 2)

    expect(model.hasAnyEntry).toBe(true)
    expect(model.status.jokers.placed).toBe(2)
    expect(model.continueTarget.route).toBe('/predict/groups/A')
  })
})
