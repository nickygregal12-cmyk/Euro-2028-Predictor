import { describe, expect, it } from 'vitest'
import { buildGamesModel } from '../../src/vnext/integration/games/buildGamesModel'
import type { GamesSource } from '../../src/vnext/integration/games/gamesSource'
import { offersEntry, partitionByPlaying } from '../../src/vnext/models/games'

/**
 * `GamesSource` → `GamesPageModel`, TESTED WHERE THE PREDICATE BITES.
 *
 *   1. THE ENTRY RULE IS NOT RESTATED. Registration state comes from
 *      `lmsRegistrationModel`, which is game-neutral by design.
 *   2. REJOIN IS NEVER DECIDED. `allow_rejoin` is refused only once the
 *      competition is RUNNING, and `competition_is_running` is revoked from
 *      `authenticated` — so the mapper reports the rule, not a verdict.
 *   3. THE CLOCK IS THE SERVER'S. A device clock would offer a registration
 *      that has closed or hide one that has opened.
 *   4. NOTHING IS SORTED and no game is promoted above its peers.
 */

const HOST_NOW = '2027-08-01T12:00:00.000Z'
const SERVER_NOW = '2027-08-01T12:00:00.000Z'

function game(over: Record<string, unknown> = {}) {
  return {
    id: 'g-1',
    gameKey: 'main_predictor' as const,
    active: true,
    displayName: 'Match Predictor',
    registrationOpensAt: '2027-07-01T00:00:00.000Z',
    registrationClosesAt: '2027-09-01T00:00:00.000Z',
    completedAt: null,
    allowRejoin: true,
    membership: null,
    ...over,
  }
}

function membership(over: Record<string, unknown> = {}) {
  return { status: 'active', joinedAt: null, leftAt: null, disqualifiedAt: null, ...over }
}

function source(over: Partial<GamesSource> = {}): GamesSource {
  return {
    generatedAt: HOST_NOW,
    context: { tournamentId: 't-1', competitionName: 'Caledonian Premiership', seasonLabel: '2027/28' },
    games: {
      kind: 'ok',
      games: { competitionMember: true, serverNow: SERVER_NOW, games: [game()] },
    },
    ...over,
  } as GamesSource
}

function entries(model: ReturnType<typeof buildGamesModel>) {
  if (model.games.kind !== 'games') throw new Error('expected games')
  return model.games.entries
}

describe('the entry rule is the shared authority’s', () => {
  it('says `open` inside the registration window', () => {
    expect(entries(buildGamesModel(source()))[0]?.standing).toEqual({
      kind: 'never-joined',
      registration: 'open',
    })
  })

  it('says `not-open` before it opens, which is not the same as closed', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: {
            competitionMember: true,
            serverNow: SERVER_NOW,
            games: [game({ registrationOpensAt: '2027-12-01T00:00:00.000Z' })],
          },
        },
      }),
    )
    const standing = entries(model)[0]?.standing
    expect(standing?.kind === 'never-joined' && standing.registration).toBe('not-open')
  })

  it('says `closed` after it closes', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: {
            competitionMember: true,
            serverNow: SERVER_NOW,
            games: [game({ registrationClosesAt: '2027-07-15T00:00:00.000Z' })],
          },
        },
      }),
    )
    const standing = entries(model)[0]?.standing
    expect(standing?.kind === 'never-joined' && standing.registration).toBe('closed')
  })

  it('lets `finished` outrank an open window, which is the authority’s own order', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: {
            competitionMember: true,
            serverNow: SERVER_NOW,
            games: [game({ completedAt: '2027-07-20T00:00:00.000Z' })],
          },
        },
      }),
    )
    const standing = entries(model)[0]?.standing
    expect(standing?.kind === 'never-joined' && standing.registration).toBe('finished')
  })

  it('fails closed on an absent opening instant, as the server does', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: {
            competitionMember: true,
            serverNow: SERVER_NOW,
            games: [game({ registrationOpensAt: null })],
          },
        },
      }),
    )
    const standing = entries(model)[0]?.standing
    expect(standing?.kind === 'never-joined' && standing.registration).toBe('not-open')
  })
})

describe('the clock is the server’s', () => {
  it('resolves the window against `server_now`, not the host instant', () => {
    // The host thinks it is December — after this window closes. The server
    // says August. A device clock deciding would hide an open registration.
    const model = buildGamesModel(
      source({
        generatedAt: '2027-12-25T00:00:00.000Z',
        games: {
          kind: 'ok',
          games: { competitionMember: true, serverNow: SERVER_NOW, games: [game()] },
        },
      }),
    )
    const standing = entries(model)[0]?.standing
    expect(standing?.kind === 'never-joined' && standing.registration).toBe('open')
    expect(model.generatedAt).toBe(SERVER_NOW)
  })

  it('falls back to the host instant only when the read supplied no clock', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: { competitionMember: true, serverNow: null, games: [game()] },
        },
      }),
    )
    expect(model.generatedAt).toBe(HOST_NOW)
  })
})

describe('a rejoin is never decided here', () => {
  it('reports `allowed` where the game permits it whatever has happened', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: {
            competitionMember: true,
            serverNow: SERVER_NOW,
            games: [game({ allowRejoin: true, membership: membership({ status: 'left', leftAt: SERVER_NOW }) })],
          },
        },
      }),
    )
    expect(entries(model)[0]?.standing).toEqual({ kind: 'left', rejoin: 'allowed' })
  })

  it('reports the RULE, not a verdict, where rejoining depends on running-ness', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: {
            competitionMember: true,
            serverNow: SERVER_NOW,
            games: [game({ allowRejoin: false, membership: membership({ status: 'left', leftAt: SERVER_NOW }) })],
          },
        },
      }),
    )
    // `competition_is_running` is revoked from `authenticated`, so a verdict
    // here could only be a guess.
    expect(entries(model)[0]?.standing).toEqual({
      kind: 'left',
      rejoin: 'only-before-it-starts',
    })
  })

  it('never offers entry to a player who left, whatever the game allows', () => {
    for (const allowRejoin of [true, false]) {
      const model = buildGamesModel(
        source({
          games: {
            kind: 'ok',
            games: {
              competitionMember: true,
              serverNow: SERVER_NOW,
              games: [game({ allowRejoin, membership: membership({ status: 'left', leftAt: SERVER_NOW }) })],
            },
          },
        }),
      )
      expect(offersEntry(entries(model)[0]!)).toBe(false)
    }
  })

  it('states disqualified absolutely, without consulting `allow_rejoin`', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: {
            competitionMember: true,
            serverNow: SERVER_NOW,
            games: [
              game({
                allowRejoin: true,
                membership: membership({ status: 'disqualified', disqualifiedAt: SERVER_NOW }),
              }),
            ],
          },
        },
      }),
    )
    // The server refuses a disqualified rejoin above the flag, so the model
    // carries no rejoin outlook at all here.
    expect(entries(model)[0]?.standing).toEqual({ kind: 'disqualified' })
  })

  it('does not read an unknown status as playing', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: {
            competitionMember: true,
            serverNow: SERVER_NOW,
            games: [game({ membership: membership({ status: 'something_new' }) })],
          },
        },
      }),
    )
    expect(entries(model)[0]?.standing.kind).not.toBe('playing')
    expect(offersEntry(entries(model)[0]!)).toBe(false)
  })
})

describe('the panel answers about the caller before the games', () => {
  it('says `not-a-member` rather than showing an empty catalogue', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: { competitionMember: false, serverNow: SERVER_NOW, games: [] },
        },
      }),
    )
    expect(model.games).toEqual({ kind: 'not-a-member' })
  })

  it('says `not-a-member` even when the catalogue has games in it', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: { competitionMember: false, serverNow: SERVER_NOW, games: [game()] },
        },
      }),
    )
    expect(model.games).toEqual({ kind: 'not-a-member' })
  })

  it('says `empty` for a member of a competition that runs no games', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: { competitionMember: true, serverNow: SERVER_NOW, games: [] },
        },
      }),
    )
    expect(model.games).toEqual({ kind: 'empty' })
  })

  it('says `unavailable` when the read failed', () => {
    expect(buildGamesModel(source({ games: { kind: 'failed' } })).games).toEqual({
      kind: 'unavailable',
    })
  })
})

describe('no game is promoted above its peers', () => {
  it('keeps the catalogue’s order', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: {
            competitionMember: true,
            serverNow: SERVER_NOW,
            games: [
              game({ id: 'c', gameKey: 'predictor_cup', displayName: 'Championship' }),
              game({ id: 'a', gameKey: 'main_predictor', displayName: 'Match Predictor' }),
              game({ id: 'b', gameKey: 'last_man_standing', displayName: 'Last Man Standing' }),
            ],
          },
        },
      }),
    )
    expect(entries(model).map((e) => e.id)).toEqual(['c', 'a', 'b'])
  })

  it('partitions by playing without reordering either group', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: {
            competitionMember: true,
            serverNow: SERVER_NOW,
            games: [
              game({ id: 'x' }),
              game({ id: 'y', membership: membership() }),
              game({ id: 'z' }),
            ],
          },
        },
      }),
    )
    const { playing, rest } = partitionByPlaying(entries(model))
    expect(playing.map((e) => e.id)).toEqual(['y'])
    expect(rest.map((e) => e.id)).toEqual(['x', 'z'])
  })

  it('never invents a name from a key', () => {
    const model = buildGamesModel(
      source({
        games: {
          kind: 'ok',
          games: {
            competitionMember: true,
            serverNow: SERVER_NOW,
            games: [game({ displayName: null })],
          },
        },
      }),
    )
    expect(entries(model)[0]?.displayName).toBeNull()
  })
})
