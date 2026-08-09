import { describe, expect, it } from 'vitest'
import { presentFixtureList } from '../../../src/features/season/fixtureListModel'
import { presentLmsStake } from '../../../src/features/season/lmsStakeModel'
import { mapSeasonFixtureList } from '../../../src/services/supabase/seasonFixtureListModel'
import type { LmsRoundPage } from '../../../src/features/season/lmsRoundModel'

const ZONE = 'Europe/London'

function row(id = 'f1') {
  const page = mapSeasonFixtureList({
    competition: { id: 'season-1', name: 'Scottish Premiership', season_key: '2026-27', time_zone: ZONE },
    window: { from: '2026-08-01T00:00:00Z', to: '2026-08-22T00:00:00Z' },
    server_now: '2026-08-08T09:00:00Z',
    fixtures: [
      {
        id,
        kickoff_at: '2026-08-08T14:00:00Z',
        status: 'scheduled',
        round: { id: 'r5', ordinal: 5, label: 'Matchweek 5' },
        home: { name: 'Dundee', short_code: 'DUN', club_colours: 'Navy / White' },
        away: { name: 'Aberdeen', short_code: 'ABE', club_colours: 'Red / White' },
        result: null,
        live: null,
      },
    ],
  })
  const found = presentFixtureList(page, ZONE).days[0]?.rows[0]
  if (!found) throw new Error('the fixture list dropped the fixture under test')
  return found
}

const club = (teamId: string, name: string) => ({ teamId, name, used: false })

function round(overrides: Partial<LmsRoundPage> = {}): LmsRoundPage {
  return {
    available: true,
    entered: true,
    entryOutcome: 'active',
    round: {
      windowId: 'w3',
      sequence: 3,
      label: 'Round 3',
      opensAt: '2026-08-05T09:00:00Z',
      locksAt: '2026-08-08T13:30:00Z',
    },
    fixtures: [
      {
        fixtureId: 'f1',
        kickoffAt: '2026-08-08T14:00:00Z',
        status: 'scheduled',
        home: club('t-dundee', 'Dundee'),
        away: club('t-aberdeen', 'Aberdeen'),
        score: null,
      },
      {
        fixtureId: 'f2',
        kickoffAt: '2026-08-08T14:00:00Z',
        status: 'scheduled',
        home: club('t-celtic', 'Celtic'),
        away: club('t-hibs', 'Hibernian'),
        score: null,
      },
    ],
    pick: null,
    pickOutcome: null,
    ...overrides,
  }
}

describe('what a fixture means for a Last Man Standing entry', () => {
  it('names the club and says the entry is riding on the match', () => {
    const view = presentLmsStake(row(), round({ pick: { teamId: 't-aberdeen' } }))

    expect(view?.stake).toEqual({ kind: 'my_pick', club: 'Aberdeen', opponent: 'Dundee' })
    expect(view?.line).toContain('Aberdeen')
    expect(view?.line).toContain('riding on this match')
  })

  it('never says what a result would do, because that rule is not readable here', () => {
    // Whether a draw eliminates is stored, and `lmsRoundModel` already declines
    // to guess it. The verdict stays the settlement authority's.
    const view = presentLmsStake(row(), round({ pick: { teamId: 't-dundee' } }))

    expect(view?.line).not.toMatch(/eliminat|knocked out|survive|through/i)
  })

  it('says the fixture is in the round when the pick is another match', () => {
    const view = presentLmsStake(row(), round({ pick: { teamId: 't-celtic' } }))

    expect(view?.stake.kind).toBe('in_my_round')
    expect(view?.line).toContain('another match')
  })

  it('says the round is unpicked when it is', () => {
    const view = presentLmsStake(row(), round())

    expect(view?.stake.kind).toBe('in_my_round')
    expect(view?.line).toContain('not picked yet')
  })

  it('says nothing about a fixture outside the current round', () => {
    // The read takes no round argument, so a fixture from six weeks ago cannot
    // be told what it did to an entry. Silence rather than a guess.
    expect(presentLmsStake(row('f-elsewhere'), round({ pick: { teamId: 't-dundee' } }))).toBeNull()
  })

  it('says nothing to a player who is not in the game', () => {
    expect(presentLmsStake(row(), round({ entered: false }))).toBeNull()
    expect(presentLmsStake(row(), null)).toBeNull()
  })

  it('says nothing to an eliminated player', () => {
    // They have no stake in any fixture, and "your club is playing" to somebody
    // who is out is worse than saying nothing.
    expect(
      presentLmsStake(row(), round({ entryOutcome: 'eliminated', pick: { teamId: 't-dundee' } })),
    ).toBeNull()
  })

  it('says nothing when there is no open round', () => {
    expect(presentLmsStake(row(), round({ round: null }))).toBeNull()
  })
})
