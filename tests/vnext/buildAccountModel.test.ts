import { describe, expect, it } from 'vitest'
import { buildAccountModel } from '../../src/vnext/integration/account/buildAccountModel'
import type { AccountSource } from '../../src/vnext/integration/account/accountSource'
import { partitionByCompletion, seasonIsOpenable } from '../../src/vnext/models/account'

/**
 * `AccountSource` → `AccountPageModel`, TESTED WHERE THE PREDICATE BITES.
 *
 * The compiler covers field copying. These are the answers that would be WRONG:
 *
 *   1. A FOLLOW IS NEVER NAMED FROM NOTHING. Two reads can name one and neither
 *      is guaranteed to hold it; a uuid must not reach the page and a name must
 *      not be guessed.
 *   2. A ROUTE IS NEVER BUILT. A slug is server-owned. Half an address is no
 *      address.
 *   3. A RESULT IS NEVER COMPUTED. Contract 156's snapshot or nothing.
 *   4. ONE READ FAILING NEVER EMPTIES ANOTHER READ'S PANEL.
 */

const NOW = '2027-06-01T12:00:00.000Z'

function catalogueSeason(over: Record<string, unknown> = {}) {
  return {
    competitionSlug: 'caledonian',
    seasonKey: '2027-28',
    competitionId: 'c-1',
    competitionName: 'Caledonian Premiership',
    seasonId: 't-1',
    seasonName: 'Caledonian Premiership 2027/28',
    status: 'active' as const,
    timeZone: 'Europe/London',
    ...over,
  }
}

function historySeason(over: Record<string, unknown> = {}) {
  return {
    tournamentId: 't-1',
    seasonName: 'Caledonian Premiership 2027/28',
    seasonKey: '2027-28',
    kind: 'league_season',
    status: 'active',
    displayTimeZone: 'Europe/London',
    competitionId: 'c-1',
    competitionName: 'Caledonian Premiership',
    competitionSlug: 'caledonian',
    inPublishedCatalogue: true,
    complete: false,
    wrappedAvailable: false,
    final: null,
    games: [{ gameKey: 'predictor', gameName: 'Match Predictor', competitionId: 'c-1', competitionName: 'Caledonian Premiership', visibility: 'public', membershipStatus: 'active', outcome: null, joinedAt: null, leftAt: null }],
    ...over,
  }
}

function source(over: Partial<AccountSource> = {}): AccountSource {
  return {
    generatedAt: NOW,
    displayName: 'Ada Lovelace',
    preferences: {
      kind: 'ok',
      preferences: {
        onboarding: { step: null, completedAt: '2027-01-01T00:00:00.000Z' },
        follows: [{ tournamentId: 't-1', favouriteTeamId: null, followedAt: null }],
        pinnedRivals: [],
      },
    },
    history: {
      kind: 'ok',
      history: { total: 1, limit: 20, offset: 0, hasMore: false, seasons: [historySeason()] },
    },
    catalogue: { kind: 'ok', seasons: [catalogueSeason()] },
    ...over,
  } as AccountSource
}

describe('a follow is named only where a read supplies a name', () => {
  it('names it from the catalogue, with the route the catalogue stores', () => {
    const model = buildAccountModel(source())
    if (model.follows.kind !== 'follows') throw new Error('expected follows')
    expect(model.follows.competitions[0]?.identity).toEqual({
      kind: 'named',
      competitionName: 'Caledonian Premiership',
      seasonName: 'Caledonian Premiership 2027/28',
      route: { competitionSlug: 'caledonian', seasonKey: '2027-28' },
    })
  })

  it('PREFERS the catalogue when both reads can name the same follow', () => {
    // THE PRECEDENCE IS THE POINT, AND IT NEEDS THE TWO READS TO DISAGREE.
    // Both fixtures used to carry identical names and slugs, so this assertion
    // passed from either branch and deleting the catalogue branch entirely left
    // the suite green. The catalogue wins because it is the read that also
    // carries a ROUTE, and a name from one read beside a route from another is
    // how a player is sent to the wrong season.
    const model = buildAccountModel(
      source({
        history: {
          kind: 'ok',
          history: {
            total: 1,
            limit: 20,
            offset: 0,
            hasMore: false,
            seasons: [
              historySeason({
                competitionName: 'The history read’s name',
                seasonName: 'The history read’s season',
                competitionSlug: 'history-slug',
                seasonKey: 'history-key',
              }),
            ],
          },
        },
      }),
    )
    if (model.follows.kind !== 'follows') throw new Error('expected follows')
    expect(model.follows.competitions[0]?.identity).toEqual({
      kind: 'named',
      competitionName: 'Caledonian Premiership',
      seasonName: 'Caledonian Premiership 2027/28',
      route: { competitionSlug: 'caledonian', seasonKey: '2027-28' },
    })
  })

  it('falls back to the participation history when the catalogue no longer lists it', () => {
    const model = buildAccountModel(source({ catalogue: { kind: 'ok', seasons: [] } }))
    if (model.follows.kind !== 'follows') throw new Error('expected follows')
    const identity = model.follows.competitions[0]?.identity
    expect(identity?.kind).toBe('named')
    expect(identity?.kind === 'named' && identity.competitionName).toBe('Caledonian Premiership')
  })

  it('says `unnamed` for a follow neither read holds, rather than showing an id', () => {
    const model = buildAccountModel(
      source({
        catalogue: { kind: 'ok', seasons: [] },
        history: { kind: 'ok', history: { total: 0, limit: 20, offset: 0, hasMore: false, seasons: [] } },
      }),
    )
    if (model.follows.kind !== 'follows') throw new Error('expected follows')
    expect(model.follows.competitions[0]?.identity).toEqual({ kind: 'unnamed' })
    // The uuid must not have leaked into any presented field.
    expect(JSON.stringify(model.follows.competitions[0]?.identity)).not.toContain('t-1')
  })

  it('still names follows when the catalogue read FAILED', () => {
    const model = buildAccountModel(source({ catalogue: { kind: 'failed' } }))
    if (model.follows.kind !== 'follows') throw new Error('expected follows')
    // The history answered, so a failed decoration does not empty the panel.
    expect(model.follows.competitions[0]?.identity.kind).toBe('named')
  })
})

describe('a route is carried, never constructed', () => {
  it('has no route when the season is no longer routable', () => {
    const model = buildAccountModel(
      source({
        catalogue: { kind: 'ok', seasons: [] },
        history: {
          kind: 'ok',
          history: {
            total: 1, limit: 20, offset: 0, hasMore: false,
            seasons: [historySeason({ competitionSlug: null, inPublishedCatalogue: false })],
          },
        },
      }),
    )
    if (model.history.kind !== 'seasons') throw new Error('expected seasons')
    expect(model.history.seasons[0]?.route).toBeNull()
    expect(seasonIsOpenable(model.history.seasons[0]!)).toBe(false)
  })

  it('refuses half an address, because half an address resolves to nothing', () => {
    const model = buildAccountModel(
      source({
        history: {
          kind: 'ok',
          history: {
            total: 1, limit: 20, offset: 0, hasMore: false,
            seasons: [historySeason({ seasonKey: null })],
          },
        },
      }),
    )
    if (model.history.kind !== 'seasons') throw new Error('expected seasons')
    expect(model.history.seasons[0]?.route).toBeNull()
  })
})

describe('a result is the stored snapshot or nothing', () => {
  it('carries contract 156’s figures unchanged', () => {
    const model = buildAccountModel(
      source({
        history: {
          kind: 'ok',
          history: {
            total: 1, limit: 20, offset: 0, hasMore: false,
            seasons: [historySeason({ complete: true, final: { points: 412, rank: 3, fieldSize: 28, matchweeksPlayed: 38, finalisedAt: NOW } })],
          },
        },
      }),
    )
    if (model.history.kind !== 'seasons') throw new Error('expected seasons')
    expect(model.history.seasons[0]?.result).toEqual({
      points: 412, rank: 3, fieldSize: 28, matchweeksPlayed: 38,
    })
  })

  it('leaves an unfinalised season with no result at all', () => {
    const model = buildAccountModel(source())
    if (model.history.kind !== 'seasons') throw new Error('expected seasons')
    expect(model.history.seasons[0]?.result).toBeNull()
  })

  it('keeps a null rank null rather than making it a last place', () => {
    const model = buildAccountModel(
      source({
        history: {
          kind: 'ok',
          history: {
            total: 1, limit: 20, offset: 0, hasMore: false,
            seasons: [historySeason({ final: { points: 100, rank: null, fieldSize: null, matchweeksPlayed: 4, finalisedAt: null } })],
          },
        },
      }),
    )
    if (model.history.kind !== 'seasons') throw new Error('expected seasons')
    expect(model.history.seasons[0]?.result?.rank).toBeNull()
  })
})

describe('the panels resolve independently', () => {
  it('keeps the history when preferences failed', () => {
    const model = buildAccountModel(source({ preferences: { kind: 'failed' } }))
    expect(model.follows).toEqual({ kind: 'unavailable' })
    expect(model.history.kind).toBe('seasons')
  })

  it('keeps the follows when the history failed', () => {
    const model = buildAccountModel(source({ history: { kind: 'failed' } }))
    expect(model.history).toEqual({ kind: 'unavailable' })
    expect(model.follows.kind).toBe('follows')
  })

  it('distinguishes following nothing from not having found out', () => {
    const empty = buildAccountModel(
      source({
        preferences: {
          kind: 'ok',
          preferences: { onboarding: { step: null, completedAt: null }, follows: [], pinnedRivals: [] },
        },
      }),
    )
    expect(empty.follows).toEqual({ kind: 'empty' })
    expect(buildAccountModel(source({ preferences: { kind: 'failed' } })).follows).toEqual({
      kind: 'unavailable',
    })
  })
})

describe('the favourite club is a fact, not a name', () => {
  it('says a favourite is set without claiming which club', () => {
    const model = buildAccountModel(
      source({
        preferences: {
          kind: 'ok',
          preferences: {
            onboarding: { step: null, completedAt: null },
            follows: [{ tournamentId: 't-1', favouriteTeamId: 'team-9', followedAt: null }],
            pinnedRivals: [],
          },
        },
      }),
    )
    if (model.follows.kind !== 'follows') throw new Error('expected follows')
    expect(model.follows.competitions[0]?.favourite).toEqual({ kind: 'set' })
    // The team id is not a name and must not travel to the surface as one.
    expect(JSON.stringify(model.follows.competitions[0])).not.toContain('team-9')
  })
})

describe('order and paging are the server’s', () => {
  it('keeps the server’s season order', () => {
    const model = buildAccountModel(
      source({
        history: {
          kind: 'ok',
          history: {
            total: 3, limit: 2, offset: 0, hasMore: true,
            seasons: [
              historySeason({ tournamentId: 'b', seasonName: 'B' }),
              historySeason({ tournamentId: 'a', seasonName: 'A' }),
            ],
          },
        },
      }),
    )
    if (model.history.kind !== 'seasons') throw new Error('expected seasons')
    expect(model.history.seasons.map((s) => s.seasonName)).toEqual(['B', 'A'])
    expect(model.history.total).toBe(3)
    expect(model.history.hasMore).toBe(true)
  })

  it('partitions by completion without reordering either group', () => {
    const finishedFirst = historySeason({ tournamentId: 'x', seasonName: 'X', complete: true, final: { points: 1, rank: 1, fieldSize: 2, matchweeksPlayed: 1, finalisedAt: null } })
    const model = buildAccountModel(
      source({
        history: {
          kind: 'ok',
          history: {
            total: 3, limit: 20, offset: 0, hasMore: false,
            seasons: [historySeason({ tournamentId: 'p', seasonName: 'P' }), finishedFirst, historySeason({ tournamentId: 'q', seasonName: 'Q' })],
          },
        },
      }),
    )
    if (model.history.kind !== 'seasons') throw new Error('expected seasons')
    const { finished, ongoing } = partitionByCompletion(model.history.seasons)
    expect(finished.map((s) => s.seasonName)).toEqual(['X'])
    expect(ongoing.map((s) => s.seasonName)).toEqual(['P', 'Q'])
  })

  it('files a FINISHED season with no Wrapped under Finished, not Still going', () => {
    // Contract 161 makes `complete` and `final` independent: `complete` is
    // `season.status in ('complete','archived')`, and `final` is null whenever
    // `season_wrapped` holds no row. Partitioning on the result told a player a
    // season they finished months ago was still running, because nobody had
    // generated their Wrapped.
    const model = buildAccountModel(
      source({
        history: {
          kind: 'ok',
          history: {
            total: 1, limit: 20, offset: 0, hasMore: false,
            seasons: [
              historySeason({
                tournamentId: 'w',
                seasonName: 'Wrapped never ran',
                complete: true,
                wrappedAvailable: false,
                final: null,
              }),
            ],
          },
        },
      }),
    )
    if (model.history.kind !== 'seasons') throw new Error('expected seasons')
    const { finished, ongoing } = partitionByCompletion(model.history.seasons)
    expect(finished.map((s) => s.seasonName)).toEqual(['Wrapped never ran'])
    expect(ongoing).toEqual([])
    // And it still prints no result, because there is none to print. Being
    // finished and having a banked total are different facts.
    expect(finished[0]?.result).toBeNull()
  })

  it('drops a game with no name rather than rendering a blank row', () => {
    const model = buildAccountModel(
      source({
        history: {
          kind: 'ok',
          history: {
            total: 1, limit: 20, offset: 0, hasMore: false,
            seasons: [historySeason({ games: [{ gameKey: 'x', gameName: null, competitionId: null, competitionName: null, visibility: null, membershipStatus: null, outcome: null, joinedAt: null, leftAt: null }] })],
          },
        },
      }),
    )
    if (model.history.kind !== 'seasons') throw new Error('expected seasons')
    expect(model.history.seasons[0]?.games).toEqual([])
  })
})
