import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import {
  useVNextLeaguesSource,
  type VNextLeaguesSourceInput,
  type VNextLeaguesSourceState,
} from '../../src/vnext/integration/leagues/useVNextLeaguesSource'
import type { SeasonLeaderboardPage } from '../../src/services/supabase/seasonLeaderboardModel'
import type { SeasonLeagueStandingsPage } from '../../src/services/supabase/seasonLeagueStandingsModel'
import type { SeasonLeagueMovement } from '../../src/services/supabase/seasonLeagueMovementModel'
import type { GameLeague } from '../../src/services/supabase/gameLeagues'
import { first, last } from '../support/indexed'

/**
 * THE ACQUISITION LIFECYCLE FOR LEAGUES.
 *
 * `tests/vnext/leaguesIntegration.test.ts` drives the pure mapper and
 * `tests/vnext/leagues.test.tsx` hands the page a finished model. Neither can
 * see this hook at all, and an independent review found two defects living in
 * exactly that gap — one of which could leave a player on a skeleton with no
 * chooser and no retry until they reloaded. This file is the missing half.
 *
 * WHAT IT HOLDS:
 *
 *   1. A SUPERSEDED REQUEST NEVER WRITES. The rejection path for a slow league
 *      that has already been switched away from must not store anything, or the
 *      memo reads an identity that is no longer current as `loading` forever
 *      while the effect deps sit unchanged and nothing refetches.
 *   2. A FAILED TABLE IS NOT A FAILED PAGE. `docs/product/vnext-leagues.md` §9
 *      requires the chooser to survive a table that did not answer — a
 *      whole-page notice takes away the only control that could get the reader
 *      out of the league that failed.
 *   3. ONLY THE PLAY CONTEXT FAILS THE WHOLE PAGE, because without it there is
 *      no id to address anything with.
 *
 * Nothing here touches Supabase; the service modules are mocked at their own
 * boundary. The mapper and the page are deliberately absent — this is a test
 * about acquisition.
 */

const server = vi.hoisted(() => {
  type Deferred<T> = {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (reason: unknown) => void
  }

  function defer<T>(): Deferred<T> {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    // A rejection nobody has attached a handler to yet is an unhandled
    // rejection in Node; the hook attaches one, but not until its dynamic
    // import resolves. This keeps the process quiet without swallowing it.
    promise.catch(() => {})
    return { promise, resolve, reject }
  }

  /**
   * Pending standings reads, one per league id, so a test can hold league A
   * open, let league B answer, and only then fail A. That ordering is the whole
   * point: it is what a real slow read followed by a chooser press produces.
   */
  const standings = new Map<string, Deferred<SeasonLeagueStandingsPage>>()

  const state = {
    contextFails: false,
    leaguesFail: false,
    leaderboardFails: false,
    movementFails: false,
    movementNamesNobody: false,
  }

  return {
    state,
    standings,
    defer,

    standingsFor(leagueId: string) {
      const pending = standings.get(leagueId) ?? defer<SeasonLeagueStandingsPage>()
      standings.set(leagueId, pending)
      return pending
    },

    /** Contract 128's shape, annotated with the real read model. */
    page(leagueId: string): SeasonLeagueStandingsPage {
      return {
        rows: [
          {
            userId: `user-of-${leagueId}`,
            displayName: `Member of ${leagueId}`,
            points: 100,
            rank: 1,
            matchweeksPlayed: 10,
            tied: false,
            position: 1,
            isYou: false,
            isOwner: true,
            hasEntry: true,
          },
        ],
        totalCount: 1,
        pageSize: 25,
        hasMore: false,
        nextCursor: null,
        you: null,
      }
    },

    leaderboard(): SeasonLeaderboardPage {
      return {
        rows: [
          {
            displayName: 'Rhona Buchanan',
            points: 214,
            rank: 1,
            matchweeksPlayed: 12,
            tied: false,
            position: 1,
            isYou: false,
            playerRef: 'ref-rhona',
            reach: 'compare',
            playerId: null,
          },
        ],
        totalCount: 1,
        pageSize: 25,
        hasMore: false,
        nextCursor: null,
        you: null,
      }
    },

    leagues(): GameLeague[] {
      return [
        {
          id: 'league-a',
          name: 'League A',
          inviteCode: 'AAAA11',
          memberCount: 4,
          isOwner: false,
          ownerName: 'Someone',
          lastActivityAt: null,
        },
        {
          id: 'league-b',
          name: 'League B',
          inviteCode: 'BBBB22',
          memberCount: 6,
          isOwner: true,
          ownerName: 'You',
          lastActivityAt: null,
        },
      ]
    },

    movement(leagueId: string): SeasonLeagueMovement {
      return {
        leagueId,
        matchweek: { id: 'mw-12', ordinal: 12, label: 'Matchweek 12' },
        settled: true,
        serverNow: null,
        members: state.movementNamesNobody
          ? []
          : [
              {
                userId: `user-of-${leagueId}`,
                displayName: `Member of ${leagueId}`,
                isSelf: false,
                pointsBefore: 90,
                pointsAfter: 100,
                pointsThisMatchweek: 10,
                rankBefore: 3,
                rankAfter: 1,
                movement: 2,
                gapToLeaderBefore: 12,
                gapToLeaderAfter: 0,
              },
            ],
      }
    },
  }
})

vi.mock('../../src/services/supabase/seasonPlayContext', () => ({
  createSeasonPlayContextGateway: () => ({
    load: async (competitionSlug: string, seasonSlug: string) => {
      if (server.state.contextFails) throw new Error('no play context')
      return {
        tournamentId: `${competitionSlug}/${seasonSlug}`,
        competitionName: 'Caledonian Premiership',
        seasonLabel: '2027/28',
      }
    },
  }),
}))

vi.mock('../../src/services/supabase/gameLeagues', () => ({
  fetchMyGameLeagues: async () => {
    if (server.state.leaguesFail) throw new Error('no league list')
    return server.leagues()
  },
}))

vi.mock('../../src/services/supabase/seasonLeaderboard', () => ({
  fetchSeasonLeaderboardPage: async () => {
    if (server.state.leaderboardFails) throw new Error('no season table')
    return server.leaderboard()
  },
}))

vi.mock('../../src/services/supabase/seasonLeagueStandings', () => ({
  fetchSeasonLeagueStandingsPage: (leagueId: string) => server.standingsFor(leagueId).promise,
}))

vi.mock('../../src/services/supabase/seasonLeagueMovement', () => ({
  fetchSeasonLeagueMovement: async (leagueId: string) => {
    if (server.state.movementFails) throw new Error('no movement')
    return server.movement(leagueId)
  },
}))

/* ------------------------------------------------------------------ *
 * The probe.
 * ------------------------------------------------------------------ */

function Probe({
  input,
  onState,
}: {
  readonly input: VNextLeaguesSourceInput
  readonly onState: (state: VNextLeaguesSourceState) => void
}) {
  onState(useVNextLeaguesSource(input))
  return null
}

const BASE: VNextLeaguesSourceInput = {
  userId: 'user-1',
  authLoading: false,
  competitionSlug: 'caledonian-premiership',
  seasonSlug: '2027-28',
  gameCompetitionId: 'game-competition-1',
  selectedLeagueId: null,
  gameName: 'Match Predictor',
}

function mount(input: VNextLeaguesSourceInput) {
  const seen: VNextLeaguesSourceState[] = []
  const view = render(<Probe input={input} onState={(state) => seen.push(state)} />)
  return {
    seen,
    rerender: (next: VNextLeaguesSourceInput) =>
      view.rerender(<Probe input={next} onState={(state) => seen.push(state)} />),
    unmount: view.unmount,
  }
}

function reset() {
  server.standings.clear()
  server.state.contextFails = false
  server.state.leaguesFail = false
  server.state.leaderboardFails = false
  server.state.movementFails = false
}

/* ------------------------------------------------------------------ *
 * 1. A superseded request never writes
 * ------------------------------------------------------------------ */

describe('a request the player has moved on from', () => {
  it('cannot strand the page when it rejects after a later one answered', async () => {
    reset()
    const probe = mount({ ...BASE, selectedLeagueId: 'league-a' })

    // League A is asked for and does not answer.
    await waitFor(() => expect(server.standings.has('league-a')).toBe(true))

    // The player presses league B before A comes back.
    probe.rerender({ ...BASE, selectedLeagueId: 'league-b' })
    await waitFor(() => expect(server.standings.has('league-b')).toBe(true))
    server.standings.get('league-b')?.resolve(server.page('league-b'))
    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))

    // NOW league A fails. A write here would be stored under A's identity, and
    // the memo reads a stale identity as `loading` — with nothing left to
    // trigger a refetch, because the effect deps have not changed.
    server.standings.get('league-a')?.reject(new Error('too late'))
    await new Promise((resolve) => setTimeout(resolve, 20))
    probe.rerender({ ...BASE, selectedLeagueId: 'league-b' })

    const final = last(probe.seen)
    expect(final.status, 'a superseded rejection stranded the page').toBe('ready')
    if (final.status !== 'ready') throw new Error('unreachable')
    expect(final.source.selectedLeagueId).toBe('league-b')
    expect(final.source.league?.rows[0]?.userId).toBe('user-of-league-b')

    probe.unmount()
  })

  it('starts from loading whenever the chosen league changes', async () => {
    reset()
    const probe = mount({ ...BASE, selectedLeagueId: 'league-a' })
    await waitFor(() => expect(server.standings.has('league-a')).toBe(true))
    server.standings.get('league-a')?.resolve(server.page('league-a'))
    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))

    const before = probe.seen.length
    probe.rerender({ ...BASE, selectedLeagueId: 'league-b' })

    // ONE LEAGUE'S TABLE IS NEVER SHOWN UNDER ANOTHER LEAGUE'S NAME.
    //
    // ASSERTED OVER EVERY RENDER AFTER THE SWITCH, not just the last one. The
    // render the request identity actually protects is the one BETWEEN the prop
    // change and the effect that reacts to it — and reading only the final
    // state passes even with `selectedLeagueId` removed from the identity,
    // because the effect's own synchronous reset produces `loading` a moment
    // later. That is the window a stale table would be painted in.
    const after = probe.seen.slice(before)
    expect(after.length).toBeGreaterThan(0)
    for (const state of after) {
      if (state.status !== 'ready') continue
      expect(
        state.source.selectedLeagueId,
        'league A`s table was returned as ready under league B`s request',
      ).toBe('league-b')
    }

    probe.unmount()
  })
})

/* ------------------------------------------------------------------ *
 * 2. A failed table is not a failed page
 * ------------------------------------------------------------------ */

describe('a table that did not answer', () => {
  it('still produces a page, so the chooser survives it', async () => {
    reset()
    const probe = mount({ ...BASE, selectedLeagueId: 'league-a' })
    await waitFor(() => expect(server.standings.has('league-a')).toBe(true))
    server.standings.get('league-a')?.reject(new Error('no standings'))

    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))
    const final = last(probe.seen)
    if (final.status !== 'ready') throw new Error('unreachable')

    // The table is missing and everything else survived — which is what makes
    // the mapper's "this league's table" sentence reachable at all.
    expect(final.source.league).toBeNull()
    expect(final.source.leagues?.map((entry) => entry.id)).toEqual(['league-a', 'league-b'])
    expect(final.source.context.competitionName).toBe('Caledonian Premiership')

    probe.unmount()
  })

  it('does the same when the season table does not answer', async () => {
    reset()
    server.state.leaderboardFails = true
    const probe = mount(BASE)

    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))
    const final = last(probe.seen)
    if (final.status !== 'ready') throw new Error('unreachable')

    expect(final.source.global).toBeNull()
    expect(final.source.leagues).not.toBeNull()

    probe.unmount()
  })

  it('loses only the arrows when movement does not answer', async () => {
    reset()
    server.state.movementFails = true
    const probe = mount({ ...BASE, selectedLeagueId: 'league-a' })
    await waitFor(() => expect(server.standings.has('league-a')).toBe(true))
    server.standings.get('league-a')?.resolve(server.page('league-a'))

    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))
    const final = last(probe.seen)
    if (final.status !== 'ready') throw new Error('unreachable')

    expect(final.source.movement).toBeNull()
    expect(final.source.league).not.toBeNull()

    probe.unmount()
  })

  it('draws no movement column for a settled matchweek that named nobody', async () => {
    reset()
    server.state.movementNamesNobody = true
    const probe = mount({ ...BASE, selectedLeagueId: 'league-a' })
    await waitFor(() => expect(server.standings.has('league-a')).toBe(true))
    server.standings.get('league-a')?.resolve(server.page('league-a'))

    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))
    const final = last(probe.seen)
    if (final.status !== 'ready') throw new Error('unreachable')

    // `settled: true`, a labelled matchweek, and no members. A column drawn
    // from this is a column in which every row is a dash.
    const { buildLeaguesModel } = await import(
      '../../src/vnext/integration/leagues/buildLeaguesModel'
    )
    expect(buildLeaguesModel(final.source).private?.movementSettled).toBe(false)

    probe.unmount()
  })

  it('reports an unread league list rather than an empty one', async () => {
    reset()
    server.state.leaguesFail = true
    const probe = mount(BASE)

    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))
    const final = last(probe.seen)
    if (final.status !== 'ready') throw new Error('unreachable')

    // `null`, NOT `[]`. The mapper turns this into `leaguesKnown: false`, which
    // is the only thing standing between a failed read and the page telling a
    // player they are in no private league.
    expect(final.source.leagues).toBeNull()

    probe.unmount()
  })
})

/* ------------------------------------------------------------------ *
 * 3. Only the play context fails the whole page
 * ------------------------------------------------------------------ */

describe('the play context', () => {
  it('fails the whole page, because nothing below it can be addressed', async () => {
    reset()
    server.state.contextFails = true
    const probe = mount(BASE)

    await waitFor(() => expect(last(probe.seen).status).toBe('failed'))
    probe.unmount()
  })

  it('offers a retry when it does', async () => {
    reset()
    server.state.contextFails = true
    const probe = mount(BASE)

    await waitFor(() => expect(last(probe.seen).status).toBe('failed'))
    const final = last(probe.seen)
    if (final.status !== 'failed') throw new Error('unreachable')
    expect(typeof final.retry).toBe('function')

    probe.unmount()
  })
})

/* ------------------------------------------------------------------ *
 * The states that are answered from the inputs alone
 * ------------------------------------------------------------------ */

describe('the states derived from this render`s inputs', () => {
  it('is loading while auth is', () => {
    reset()
    const probe = mount({ ...BASE, authLoading: true })
    expect(first(probe.seen).status).toBe('loading')
    probe.unmount()
  })

  it('is signed out with no user, whatever is in state', () => {
    reset()
    const probe = mount({ ...BASE, userId: null })
    expect(first(probe.seen).status).toBe('signedOut')
    probe.unmount()
  })

  it('has no competition without both slugs', () => {
    reset()
    const probe = mount({ ...BASE, seasonSlug: undefined })
    expect(first(probe.seen).status).toBe('noCompetition')
    probe.unmount()
  })
})
