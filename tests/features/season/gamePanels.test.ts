import { describe, expect, it } from 'vitest'
import { presentLmsFormGuide } from '../../../src/features/season/lmsFormGuideModel'
import { presentChampionshipStanding } from '../../../src/features/season/championshipStandingModel'
import type { LmsRoundPage } from '../../../src/features/season/lmsRoundModel'
import type { SeasonClubForm } from '../../../src/services/supabase/seasonClubFormModel'
import type { ChampionshipPlayerView } from '../../../src/services/supabase/seasonCupPlayer'
import type { ClubIdentityTokens } from '../../../src/domain/clubIdentity/clubIdentityTypes'

/**
 * The two game contextual panels (`UI-F01` composition, `UI-F09`, `UI-F10`).
 *
 * BOTH ARE SECOND COLUMNS, AND THE TESTS SAY WHY THEY ARE ALLOWED TO EXIST. A
 * contextual panel earns its place only by answering a question the main column
 * raises without duplicating it. The Last Man Standing pick list is fixtures in
 * kickoff order; the form guide is clubs in form order. The Championship's My
 * Fixture is one tie; the standing panel is three rows of the group. Neither
 * repeats its page, and neither recommends anything.
 */

const TOKENS: ClubIdentityTokens = {
  monogram: 'CEL',
  pattern: 'solid',
  primary: '#0a7',
  secondary: '#fff',
}

function club(name: string, form: readonly ('W' | 'D' | 'L')[]): SeasonClubForm {
  const won = form.filter((letter) => letter === 'W').length
  const drawn = form.filter((letter) => letter === 'D').length
  return {
    teamId: `team-${name}`,
    name,
    tokens: TOKENS,
    played: form.length,
    won,
    drawn,
    lost: form.length - won - drawn,
    goalsFor: won * 2,
    goalsAgainst: form.length - won,
    form,
  }
}

function round(): LmsRoundPage {
  return {
    available: true,
    entered: true,
    entryOutcome: 'active',
    round: {
      windowId: 'w1',
      sequence: 2,
      label: 'Round 2',
      opensAt: null,
      locksAt: '2026-08-15T14:00:00Z',
    },
    fixtures: [
      {
        fixtureId: 'f1',
        kickoffAt: '2026-08-15T14:00:00Z',
        status: 'scheduled',
        home: { teamId: 'team-Celtic', name: 'Celtic', used: false },
        away: { teamId: 'team-Rangers', name: 'Rangers', used: true },
        score: null,
      },
      {
        fixtureId: 'f2',
        kickoffAt: '2026-08-15T14:00:00Z',
        status: 'scheduled',
        home: { teamId: 'team-Hearts', name: 'Hearts', used: false },
        away: { teamId: 'team-Hibernian', name: 'Hibernian', used: false },
        score: null,
      },
    ],
    pick: { teamId: 'team-Hearts' },
    pickOutcome: null,
  }
}

describe('the Last Man Standing form guide', () => {
  it('orders the clubs on offer by how they are playing', () => {
    const guide = presentLmsFormGuide(
      round(),
      [
        club('Celtic', ['W', 'W', 'W']),
        club('Rangers', ['W', 'D', 'L']),
        club('Hearts', ['L', 'L', 'L']),
        club('Hibernian', ['D', 'D', 'D']),
      ],
      'team-Hearts',
    )

    expect(guide?.rows.map((row) => row.name)).toEqual([
      'Celtic',
      'Rangers',
      'Hibernian',
      'Hearts',
    ])
    expect(guide?.empty).toBe(false)
  })

  it('marks a used club and the caller’s pick rather than removing either', () => {
    const guide = presentLmsFormGuide(round(), [club('Celtic', ['W'])], 'team-Hearts')
    const rangers = guide?.rows.find((row) => row.name === 'Rangers')
    const hearts = guide?.rows.find((row) => row.name === 'Hearts')

    // A form guide that dropped a strong club the player cannot pick would be
    // answering a different question from the list beside it.
    expect(rangers?.used).toBe(true)
    expect(hearts?.picked).toBe(true)
  })

  it('names each club’s opponent, so a row is a fixture at a glance', () => {
    const guide = presentLmsFormGuide(round(), [], null)
    expect(guide?.rows.find((row) => row.name === 'Celtic')?.opponent).toBe('Rangers')
    expect(guide?.rows.find((row) => row.name === 'Rangers')?.opponent).toBe('Celtic')
  })

  it('says a club has no form rather than showing it as a run of losses', () => {
    const guide = presentLmsFormGuide(round(), [], null)
    expect(guide?.empty).toBe(true)
    expect(guide?.rows.every((row) => row.summary.letters.length === 0)).toBe(true)
  })

  it('renders nothing at all when the form read has not answered', () => {
    // Null, not empty: a panel of clubs all reading "no form" would say
    // something false about every one of them.
    expect(presentLmsFormGuide(round(), null, null)).toBeNull()
    expect(presentLmsFormGuide(null, [], null)).toBeNull()
  })
})

function view(overrides: Partial<ChampionshipPlayerView> = {}): ChampionshipPlayerView {
  return {
    competitionId: 'c1',
    entered: true,
    phaseReady: true,
    visibility: 'public',
    availabilityStatus: 'active',
    phaseKind: 'initial',
    group: { id: 'g1', ordinal: 1, size: 4, phaseKind: 'initial', parentGroupId: null },
    members: [
      { userId: 'u1', displayName: 'Priya', isYou: false },
      { userId: 'u2', displayName: 'You', isYou: true },
      { userId: 'u3', displayName: 'Jamie', isYou: false },
      { userId: 'u4', displayName: 'Sam', isYou: false },
    ],
    table: [
      { userId: 'u1', isYou: false, groupRank: 1, tablePoints: 9, pointsFor: 40, pointsAgainst: 20, windowPoints: 3, exacts: 2, corrects: 4, scorelineError: 3 },
      { userId: 'u2', isYou: true, groupRank: 2, tablePoints: 6, pointsFor: 33, pointsAgainst: 25, windowPoints: 0, exacts: 1, corrects: 3, scorelineError: 5 },
      { userId: 'u3', isYou: false, groupRank: 3, tablePoints: 4, pointsFor: 30, pointsAgainst: 28, windowPoints: 1, exacts: 1, corrects: 2, scorelineError: 6 },
      { userId: 'u4', isYou: false, groupRank: 4, tablePoints: 1, pointsFor: 21, pointsAgainst: 35, windowPoints: 0, exacts: 0, corrects: 1, scorelineError: 9 },
    ],
    fixtures: [],
    ...overrides,
  }
}

describe('the Championship standing panel', () => {
  it('shows the caller and one row either side, not the whole group', () => {
    const standing = presentChampionshipStanding(view())
    expect(standing.positionLine).toBe('2nd of 4')
    expect(standing.rows.map((row) => row.name)).toEqual(['Priya', 'You', 'Jamie'])
  })

  it('names neighbours from the read’s own members rather than inventing them', () => {
    const anonymous = presentChampionshipStanding(view({ members: [] }))
    // Contract 120's fallback, not a guess: a row with no member is an entrant.
    // The caller's own row is still "You" — that comes from `isYou` on the
    // table row rather than from the members list.
    expect(anonymous.rows.map((row) => row.name)).toEqual(['Entrant', 'You', 'Entrant'])
  })

  it('names the phase from the read, and says nothing when it has none', () => {
    expect(presentChampionshipStanding(view()).phaseLine).toBe('League phase')
    expect(presentChampionshipStanding(view({ phaseKind: 'split' })).phaseLine).toBe('The split')
    expect(presentChampionshipStanding(view({ phaseKind: null })).phaseLine).toBeNull()
  })

  it('reports an empty group as empty rather than as a position', () => {
    const standing = presentChampionshipStanding(view({ table: [] }))
    expect(standing.empty).toBe(true)
    expect(standing.positionLine).toBeNull()
    expect(standing.rows).toHaveLength(0)
  })

  it('states no position for a caller with no row in the table', () => {
    const standing = presentChampionshipStanding(
      view({ table: view().table.map((row) => ({ ...row, isYou: false })) }),
    )
    expect(standing.positionLine).toBeNull()
    // The top of the table is still worth showing; it just is not "yours".
    expect(standing.rows).toHaveLength(3)
  })
})
