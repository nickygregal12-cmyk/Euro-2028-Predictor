import { describe, expect, it } from 'vitest'
import { presentTvMode } from '../../../src/features/season/tvModeModel'
import type { FixtureListRow } from '../../../src/features/season/fixtureListModel'

/**
 * `INNOV-006`. The properties that matter on a screen nobody is holding: no
 * fabricated live state, no empty panels in the rotation, and no panel that
 * needs a control to be understood.
 */

const club = (name: string) => ({
  name,
  shortName: name.slice(0, 3).toUpperCase(),
  tokens: { monogram: name.slice(0, 3).toUpperCase(), primary: '#000000' },
})

function fixtureOf(overrides: Partial<FixtureListRow> = {}): FixtureListRow {
  return {
    id: 'fx-1',
    home: club('Celtic'),
    away: club('Rangers'),
    kickoff: '15:00',
    kickoffAt: '2026-08-15T14:00:00Z',
    roundLabel: null,
    round: { ordinal: 5, name: 'Matchweek 5' },
    abnormal: null,
    scheduleNote: null,
    score: null,
    provisional: null,
    provisionalAt: null,
    played: false,
    accessibleSummary: 'Celtic against Rangers',
    ...overrides,
  }
}

const today = '2026-08-15'

describe('presentTvMode', () => {
  it('shows nothing at all when there is no football', () => {
    expect(
      presentTvMode({
        competitionName: 'SPFL',
        seasonLabel: '2026/27',
        fixtures: [],
        today,
        league: null,
      }),
    ).toEqual([])
  })

  it('calls a fixture live only where a provider score exists and no result does', () => {
    const panels = presentTvMode({
      competitionName: 'SPFL',
      seasonLabel: '2026/27',
      fixtures: [
        fixtureOf({ id: 'live', provisional: '1 - 1' }),
        fixtureOf({ id: 'settled', score: '2 - 0', provisional: '2 - 0', played: true }),
        fixtureOf({ id: 'upcoming' }),
      ],
      today,
      league: null,
    })
    const live = panels.find((panel) => panel.kind === 'live')
    expect(live?.kind === 'live' && live.fixtures.map((fixture) => fixture.id)).toEqual(['live'])
  })

  it('never puts a live fixture in the Today panel as well', () => {
    const panels = presentTvMode({
      competitionName: 'SPFL',
      seasonLabel: '2026/27',
      fixtures: [fixtureOf({ id: 'live', provisional: '1 - 1' }), fixtureOf({ id: 'later' })],
      today,
      league: null,
    })
    const todayPanel = panels.find((panel) => panel.kind === 'today')
    expect(todayPanel?.kind === 'today' && todayPanel.fixtures.map((f) => f.id)).toEqual(['later'])
  })

  it('drops a panel with nothing in it rather than rotating through a blank', () => {
    const panels = presentTvMode({
      competitionName: 'SPFL',
      seasonLabel: '2026/27',
      fixtures: [fixtureOf({ id: 'later' })],
      today,
      league: { name: 'The Office', rows: [], fieldSize: 0 },
    })
    expect(panels.map((panel) => panel.kind)).toEqual(['today'])
  })

  it('caps the table and reports the real field size', () => {
    const rows = Array.from({ length: 14 }, (_, index) => ({
      userId: `u-${index}`,
      displayName: `Player ${index}`,
      points: 100 - index,
      rank: index + 1,
      matchweeksPlayed: 5,
      tied: false,
      position: index + 1,
      isYou: index === 3,
      isOwner: false,
      hasEntry: true,
    }))
    const panels = presentTvMode({
      competitionName: 'SPFL',
      seasonLabel: '2026/27',
      fixtures: [],
      today,
      league: { name: 'The Office', rows, fieldSize: 14 },
    })
    const table = panels.find((panel) => panel.kind === 'table')
    expect(table?.kind === 'table' && table.rows).toHaveLength(10)
    expect(table?.kind === 'table' && table.fieldSize).toBe(14)
    expect(table?.kind === 'table' && table.rows.some((row) => row.isYou)).toBe(true)
  })

  it('puts only future days in Coming up, and bounds it', () => {
    const later = Array.from({ length: 9 }, (_, index) =>
      fixtureOf({ id: `next-${index}`, kickoffAt: `2026-08-2${index}T14:00:00Z` }),
    )
    const panels = presentTvMode({
      competitionName: 'SPFL',
      seasonLabel: '2026/27',
      fixtures: [fixtureOf({ id: 'today' }), ...later],
      today,
      league: null,
    })
    const next = panels.find((panel) => panel.kind === 'next')
    expect(next?.kind === 'next' && next.fixtures).toHaveLength(6)
    expect(
      next?.kind === 'next' && next.fixtures.every((fixture) => fixture.id !== 'today'),
    ).toBe(true)
  })

  it('orders live first, so the room sees the match it is watching', () => {
    const panels = presentTvMode({
      competitionName: 'SPFL',
      seasonLabel: '2026/27',
      fixtures: [
        fixtureOf({ id: 'later', kickoffAt: '2026-08-22T14:00:00Z' }),
        fixtureOf({ id: 'today-2' }),
        fixtureOf({ id: 'live', provisional: '0 - 0' }),
      ],
      today,
      league: {
        name: 'The Office',
        rows: [
          {
            userId: 'u-1',
            displayName: 'Ann',
            points: 10,
            rank: 1,
            matchweeksPlayed: 1,
            tied: false,
            position: 1,
            isYou: true,
            isOwner: true,
            hasEntry: true,
          },
        ],
        fieldSize: 1,
      },
    })
    expect(panels.map((panel) => panel.kind)).toEqual(['live', 'today', 'table', 'next'])
  })
})
