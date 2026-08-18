import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import {
  useVNextPlayerProfileSource,
  type VNextPlayerProfileSourceInput,
  type VNextPlayerProfileSourceState,
} from '../../src/vnext/integration/playerProfile/useVNextPlayerProfileSource'
import type { SeasonPlayerProfile } from '../../src/services/supabase/seasonPlayerProfileModel'
import type { SeasonRankHistory } from '../../src/services/supabase/seasonRankHistoryModel'
import type { SeasonRivalry } from '../../src/services/supabase/seasonRivalryModel'
import { last } from '../support/indexed'

/**
 * THE ACQUISITION LIFECYCLE FOR A PLAYER PROFILE.
 *
 * `tests/vnext/buildPlayerProfileModel.test.ts` drives the pure mapper and
 * `tests/vnext/playerProfile.test.tsx` hands the page a finished model. Neither
 * can see this hook at all — and Stage 9's independent review found the two
 * worst defects of that stage living in exactly that gap. This file is written
 * first rather than after.
 *
 * WHAT IT HOLDS:
 *
 *   1. THREE READS, CLASSIFIED SEPARATELY. A refusal from one must not become a
 *      refusal, a failure or an absence in another — that divergence is the
 *      whole Stage 10 architecture, and only this layer produces it.
 *   2. A REFUSAL IS NOT A FAILURE. The three classifiers decide whether a retry
 *      is even offered, so getting one backwards puts a button in front of a
 *      permission that will never change.
 *   3. A SUPERSEDED REQUEST NEVER WRITES. Somebody else's private standing
 *      arriving late must not be stored under the player now on screen.
 *   4. ONLY THE PLAY CONTEXT FAILS THE WHOLE PAGE.
 *   5. THE SELF AND UNADDRESSABLE CASES ARE DECIDED WITHOUT A CALL, because the
 *      only possible reply is an error.
 *
 * Nothing here touches Supabase; the service modules are mocked at their own
 * boundary.
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
    // import resolves.
    promise.catch(() => {})
    return { promise, resolve, reject }
  }

  /** Pending profile reads, one per account id, so one can be held open. */
  const profiles = new Map<string, Deferred<SeasonPlayerProfile>>()

  const calls = { profile: 0, rankHistory: 0, rivalry: 0 }

  const state = {
    contextFails: false,
    /** 'ok' | 'refused' | 'failed' */
    profileMode: 'ok' as 'ok' | 'refused' | 'failed' | 'pending',
    rankMode: 'ok' as 'ok' | 'refused' | 'not-entered' | 'failed',
    rivalryMode: 'ok' as 'ok' | 'refused' | 'not-entered' | 'failed',
  }

  /*
   * THE REAL CLASSES' SHAPE, because the hook now checks with `instanceof`
   * against the module's own exports — the convention `SeasonHeadToHead.tsx`
   * already uses for contract 129's two refusals. A mock that only set
   * `error.name` would let a name-matching implementation pass and an
   * `instanceof` one fail, which is the wrong way round.
   */
  class RankHistoryNotPermittedError extends Error {}
  class RivalryNotPermittedError extends Error {}
  class OpponentNotEnteredError extends Error {}

  return {
    state,
    calls,
    profiles,
    defer,
    RankHistoryNotPermittedError,
    RivalryNotPermittedError,
    OpponentNotEnteredError,

    profileFor(playerId: string) {
      const pending = profiles.get(playerId) ?? defer<SeasonPlayerProfile>()
      profiles.set(playerId, pending)
      return pending
    },

    profile(playerId: string): SeasonPlayerProfile {
      return {
        player: { userId: playerId, displayName: `Player ${playerId}`, isSelf: false },
        entered: true,
        serverNow: null,
        season: { points: 100, matchweeksPlayed: 10, rank: 3, fieldSize: 40 },
        accuracy: { fixturesPredicted: 80, exactScores: 8, correctOutcomes: 40 },
        jokers: { played: 1, pointsFromJokerMatchweeks: 20 },
        history: [],
      }
    },

    history(playerRef: string): SeasonRankHistory {
      return {
        playerRef,
        reach: 'compare',
        displayName: `Ref ${playerRef}`,
        playerId: null,
        serverNow: null,
        matchweeks: [
          {
            matchweekId: 'mw-1',
            ordinal: 1,
            label: 'Matchweek 1',
            // A RUNNING SEASON TOTAL, not this matchweek's score.
            cumulativePoints: 10,
            rank: 3,
            fieldSize: 40,
          },
        ],
      }
    },

    rivalry(playerRef: string): SeasonRivalry {
      const side = {
        playerRef: 'entry-me',
        displayName: 'You',
        reach: 'self' as const,
        playerId: 'user-1',
        points: 90,
        matchweeksPlayed: 10,
        standing: { rank: 5, fieldSize: 40 },
        accuracy: { fixturesCompared: 80, exactScores: 6, correctOutcomes: 38 },
      }
      return {
        serverNow: null,
        matchweeksCompared: 10,
        you: side,
        opponent: { ...side, playerRef, displayName: `Ref ${playerRef}`, reach: 'compare', playerId: null },
        pointsGap: 10,
        record: { yourWins: 4, theirWins: 5, draws: 1 },
        recent: [],
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

vi.mock('../../src/services/supabase/seasonPlayerProfile', () => ({
  // THE PREDICATE IS THE REAL ONE'S RULE, restated here because the module is
  // mocked wholesale. `insufficient_privilege` is what contract 151 raises.
  seasonProfileRefused: (error: unknown) =>
    (error as { code?: unknown } | null)?.code === 'insufficient_privilege',
  fetchSeasonPlayerProfile: async (_tournamentId: string, playerId: string) => {
    server.calls.profile += 1
    if (server.state.profileMode === 'pending') return server.profileFor(playerId).promise
    if (server.state.profileMode === 'refused') {
      throw Object.assign(new Error('no shared league'), { code: 'insufficient_privilege' })
    }
    if (server.state.profileMode === 'failed') throw new Error('read failed')
    return server.profile(playerId)
  },
}))

vi.mock('../../src/services/supabase/seasonRankHistory', () => ({
  RankHistoryNotPermittedError: server.RankHistoryNotPermittedError,
  OpponentNotEnteredError: server.OpponentNotEnteredError,
  fetchSeasonRankHistory: async (_tournamentId: string, playerRef: string) => {
    server.calls.rankHistory += 1
    if (server.state.rankMode === 'refused') throw new server.RankHistoryNotPermittedError('no')
    if (server.state.rankMode === 'not-entered') throw new server.OpponentNotEnteredError('no')
    if (server.state.rankMode === 'failed') throw new Error('read failed')
    return server.history(playerRef)
  },
}))

vi.mock('../../src/services/supabase/seasonRivalry', () => ({
  RivalryNotPermittedError: server.RivalryNotPermittedError,
  OpponentNotEnteredError: server.OpponentNotEnteredError,
  fetchSeasonRivalry: async (_tournamentId: string, playerRef: string) => {
    server.calls.rivalry += 1
    if (server.state.rivalryMode === 'refused') throw new server.RivalryNotPermittedError('no')
    if (server.state.rivalryMode === 'not-entered') throw new server.OpponentNotEnteredError('no')
    if (server.state.rivalryMode === 'failed') throw new Error('read failed')
    return server.rivalry(playerRef)
  },
}))

/* ------------------------------------------------------------------ *
 * The probe.
 * ------------------------------------------------------------------ */

function Probe({
  input,
  onState,
}: {
  readonly input: VNextPlayerProfileSourceInput
  readonly onState: (state: VNextPlayerProfileSourceState) => void
}) {
  onState(useVNextPlayerProfileSource(input))
  return null
}

const BASE: VNextPlayerProfileSourceInput = {
  userId: 'user-1',
  authLoading: false,
  competitionSlug: 'caledonian-premiership',
  seasonSlug: '2027-28',
  playerId: 'user-callum',
  playerRef: 'entry-callum',
  gameName: 'Match Predictor',
}

function mount(input: VNextPlayerProfileSourceInput) {
  const seen: VNextPlayerProfileSourceState[] = []
  const view = render(<Probe input={input} onState={(state) => seen.push(state)} />)
  return {
    seen,
    rerender: (next: VNextPlayerProfileSourceInput) =>
      view.rerender(<Probe input={next} onState={(state) => seen.push(state)} />),
    unmount: view.unmount,
  }
}

function reset() {
  server.profiles.clear()
  server.calls.profile = 0
  server.calls.rankHistory = 0
  server.calls.rivalry = 0
  server.state.contextFails = false
  server.state.profileMode = 'ok'
  server.state.rankMode = 'ok'
  server.state.rivalryMode = 'ok'
}

async function ready(probe: ReturnType<typeof mount>) {
  await waitFor(() => expect(last(probe.seen).status).toBe('ready'))
  const state = last(probe.seen)
  if (state.status !== 'ready') throw new Error('expected ready')
  return state.source
}

/* ------------------------------------------------------------------ *
 * 1. Three reads, classified separately
 * ------------------------------------------------------------------ */

describe('the three reads are classified independently', () => {
  it('reports a refused profile beside two answered contract-192 reads', async () => {
    reset()
    server.state.profileMode = 'refused'

    const source = await ready(mount(BASE))

    expect(source.profile.kind).toBe('refused')
    expect(source.rankHistory.kind).toBe('ok')
    expect(source.rivalry.kind).toBe('ok')
  })

  it('reports a refused rivalry beside an answered profile', async () => {
    reset()
    server.state.rivalryMode = 'refused'

    const source = await ready(mount(BASE))

    expect(source.rivalry.kind).toBe('refused')
    expect(source.profile.kind).toBe('ok')
    expect(source.rankHistory.kind).toBe('ok')
  })

  it('reports all three separately when all three go wrong differently', async () => {
    reset()
    server.state.profileMode = 'refused'
    server.state.rankMode = 'failed'
    server.state.rivalryMode = 'not-entered'

    const source = await ready(mount(BASE))

    expect(source.profile.kind).toBe('refused')
    expect(source.rankHistory.kind).toBe('failed')
    expect(source.rivalry.kind).toBe('not-entered')
  })
})

/* ------------------------------------------------------------------ *
 * 2. A refusal is not a failure
 * ------------------------------------------------------------------ */

describe('a refusal and a fault are told apart', () => {
  it('reads contract 151`s privilege error as a refusal', async () => {
    reset()
    server.state.profileMode = 'refused'
    expect((await ready(mount(BASE))).profile.kind).toBe('refused')
  })

  it('reads any other profile error as a fault', async () => {
    // A network fault reported as a privacy boundary would tell the reader they
    // may not see something they may, and would offer no retry for something a
    // retry would fix.
    reset()
    server.state.profileMode = 'failed'
    expect((await ready(mount(BASE))).profile.kind).toBe('failed')
  })

  it('reads a rivalry`s two typed refusals as two different states', async () => {
    reset()
    server.state.rivalryMode = 'not-entered'
    expect((await ready(mount(BASE))).rivalry.kind).toBe('not-entered')

    reset()
    server.state.rivalryMode = 'refused'
    expect((await ready(mount(BASE))).rivalry.kind).toBe('refused')
  })

  it('reads an untyped rivalry error as a fault rather than as a refusal', async () => {
    reset()
    server.state.rivalryMode = 'failed'
    expect((await ready(mount(BASE))).rivalry.kind).toBe('failed')
  })

  it('tells the rank history`s two refusals apart as well', async () => {
    // The read raises both, and a stale link is enough to reach the second: a
    // reference that names nobody in this season is about THEM, not about a
    // permission the reader lacks.
    reset()
    server.state.rankMode = 'refused'
    expect((await ready(mount(BASE))).rankHistory.kind).toBe('refused')

    reset()
    server.state.rankMode = 'not-entered'
    expect((await ready(mount(BASE))).rankHistory.kind).toBe('not-entered')

    reset()
    server.state.rankMode = 'failed'
    expect((await ready(mount(BASE))).rankHistory.kind).toBe('failed')
  })

  it('never reports the page as failed when only a panel did', async () => {
    reset()
    server.state.profileMode = 'failed'
    server.state.rankMode = 'failed'
    server.state.rivalryMode = 'failed'

    const probe = mount(BASE)
    // READY, WITH THREE UNAVAILABLE PANELS. A whole-page failure here would
    // take away three separate sentences and replace them with one.
    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))
  })
})

/* ------------------------------------------------------------------ *
 * 3. Reads that are decided rather than made
 * ------------------------------------------------------------------ */

describe('two states are decided without a call', () => {
  it('does not ask for a rivalry with yourself', async () => {
    reset()
    const source = await ready(mount({ ...BASE, playerId: 'user-1' }))

    expect(source.rivalry.kind).toBe('self')
    // The RPC refuses a self-comparison in terms, so the call could only ever
    // have returned an error.
    expect(server.calls.rivalry).toBe(0)
  })

  it('does not ask either contract-192 read without a season reference', async () => {
    reset()
    const source = await ready(mount({ ...BASE, playerRef: null }))

    expect(source.rankHistory.kind).toBe('unaddressable')
    expect(source.rivalry.kind).toBe('unaddressable')
    expect(server.calls.rankHistory).toBe(0)
    expect(server.calls.rivalry).toBe(0)
    // The profile is addressed by the ACCOUNT id and is unaffected.
    expect(source.profile.kind).toBe('ok')
    expect(server.calls.profile).toBe(1)
  })

  it('never substitutes the account id for the missing reference', async () => {
    reset()
    await ready(mount({ ...BASE, playerRef: null }))
    // If it did, the two reads would have been made with a wrong address and
    // would have answered about somebody else's entry — or nobody's.
    expect(server.calls.rankHistory).toBe(0)
  })
})

/* ------------------------------------------------------------------ *
 * 4. The page costs three calls
 * ------------------------------------------------------------------ */

describe('the page is bounded at three reads', () => {
  it('makes exactly one call per contract', async () => {
    reset()
    await ready(mount(BASE))
    expect(server.calls).toEqual({ profile: 1, rankHistory: 1, rivalry: 1 })
  })

  it('does not read again on a re-render with the same address', async () => {
    reset()
    const probe = mount(BASE)
    await ready(probe)
    probe.rerender({ ...BASE })
    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))
    expect(server.calls).toEqual({ profile: 1, rankHistory: 1, rivalry: 1 })
  })

  it('reads again when the player changes, because it is a different question', async () => {
    reset()
    const probe = mount(BASE)
    await ready(probe)

    probe.rerender({ ...BASE, playerId: 'user-other', playerRef: 'entry-other' })
    await waitFor(() => expect(server.calls.profile).toBe(2))
  })
})

/* ------------------------------------------------------------------ *
 * 5. A superseded request never writes
 * ------------------------------------------------------------------ */

describe('a request the reader has moved on from', () => {
  it('cannot store one player`s season under another player`s identity', async () => {
    reset()
    server.state.profileMode = 'pending'
    const probe = mount(BASE)

    await waitFor(() => expect(server.profiles.has('user-callum')).toBe(true))

    // The reader opens somebody else before the first profile answers.
    probe.rerender({ ...BASE, playerId: 'user-other', playerRef: 'entry-other' })
    await waitFor(() => expect(server.profiles.has('user-other')).toBe(true))
    server.profiles.get('user-other')?.resolve(server.profile('user-other'))
    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))

    // NOW the first one answers. A write here stores Callum's private standing
    // under the identity of the player currently on screen.
    server.profiles.get('user-callum')?.resolve(server.profile('user-callum'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    for (const state of probe.seen) {
      if (state.status !== 'ready') continue
      expect(state.source.target.playerId).toBe('user-other')
      if (state.source.profile.kind === 'ok') {
        expect(state.source.profile.profile.player.userId).toBe('user-other')
      }
    }
  })

  it('cannot strand the page when a superseded read rejects late', async () => {
    reset()
    server.state.profileMode = 'pending'
    const probe = mount(BASE)
    await waitFor(() => expect(server.profiles.has('user-callum')).toBe(true))

    probe.rerender({ ...BASE, playerId: 'user-other', playerRef: 'entry-other' })
    await waitFor(() => expect(server.profiles.has('user-other')).toBe(true))
    server.profiles.get('user-other')?.resolve(server.profile('user-other'))
    await waitFor(() => expect(last(probe.seen).status).toBe('ready'))

    server.profiles.get('user-callum')?.reject(new Error('too late'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Still ready. A stale write would be stored under an identity the memo no
    // longer asks about, which reads as `loading` with nothing left to refetch.
    expect(last(probe.seen).status).toBe('ready')
  })

  it('writes nothing at all after unmount', async () => {
    reset()
    server.state.profileMode = 'pending'
    const probe = mount(BASE)
    await waitFor(() => expect(server.profiles.has('user-callum')).toBe(true))

    probe.unmount()
    server.profiles.get('user-callum')?.resolve(server.profile('user-callum'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(probe.seen.every((state) => state.status !== 'ready')).toBe(true)
  })
})

/* ------------------------------------------------------------------ *
 * 6. Only the play context fails the whole page
 * ------------------------------------------------------------------ */

describe('the states above the reads', () => {
  it('fails the page when there is no play context to address anything with', async () => {
    reset()
    server.state.contextFails = true
    const probe = mount(BASE)
    await waitFor(() => expect(last(probe.seen).status).toBe('failed'))
  })

  it('reports a signed-out reader rather than a failure', () => {
    reset()
    const probe = mount({ ...BASE, userId: null })
    expect(last(probe.seen).status).toBe('signedOut')
    expect(server.calls.profile).toBe(0)
  })

  it('reports a missing competition rather than a failure', () => {
    reset()
    const probe = mount({ ...BASE, competitionSlug: undefined })
    expect(last(probe.seen).status).toBe('noCompetition')
  })

  it('reports a missing player rather than reading about nobody', () => {
    reset()
    const probe = mount({ ...BASE, playerId: undefined })
    expect(last(probe.seen).status).toBe('noPlayer')
    expect(server.calls.profile).toBe(0)
  })

  it('waits while auth is resolving rather than deciding it is signed out', () => {
    reset()
    const probe = mount({ ...BASE, authLoading: true, userId: null })
    expect(last(probe.seen).status).toBe('loading')
  })

  it('keeps the page mounted while a retry re-reads', async () => {
    // THE PANEL RETRY MUST NOT TAKE THE PAGE DOWN. Three panels each offer one,
    // and clearing state on every effect run swapped the whole surface for the
    // skeleton — unmounting the panels that succeeded, the live region the
    // reader just heard, and the button they were standing on.
    //
    // THE REFETCH IS HELD OPEN ON PURPOSE. An earlier version of this test let
    // the retry resolve and then looked for a `loading` render; React batched
    // the clear and the reload into one commit, so the intermediate state never
    // rendered and the test passed against the very defect it names. Holding
    // the profile read pending freezes the surface in whatever the effect left
    // it in, which is the thing being asserted.
    reset()
    const probe = mount(BASE)
    await ready(probe)

    const current = last(probe.seen)
    if (current.status !== 'ready') throw new Error('expected ready')

    server.state.profileMode = 'pending'
    current.retry()
    await waitFor(() => expect(server.profiles.has('user-callum')).toBe(true))

    const during = last(probe.seen)
    expect(during.status, 'a retry must not drop the page to loading').toBe('ready')
    // AND IT MUST STILL SAY SOMETHING IS HAPPENING. Keeping the page mounted
    // removed the only signal the press did anything — no skeleton, and a
    // `role="status"` whose text never changes never announces.
    if (during.status !== 'ready') throw new Error('expected ready')
    expect(during.refreshing, 'a retry in flight must be visible').toBe(true)
  })

  it('clears the in-flight flag when the retry lands', async () => {
    reset()
    const probe = mount(BASE)
    await ready(probe)

    const current = last(probe.seen)
    if (current.status !== 'ready') throw new Error('expected ready')
    current.retry()
    await waitFor(() => expect(server.calls.profile).toBe(2))

    const settled = last(probe.seen)
    if (settled.status !== 'ready') throw new Error('expected ready')
    expect(settled.refreshing).toBe(false)
  })

  it('does not claim to be refreshing when the page cleared instead', async () => {
    // A new player clears the surface, so the skeleton is already saying it and
    // a second "trying" signal on top would be noise.
    reset()
    const probe = mount(BASE)
    await ready(probe)

    probe.rerender({ ...BASE, playerId: 'user-other', playerRef: 'entry-other' })
    await waitFor(() => expect(server.calls.profile).toBe(2))

    for (const state of probe.seen) {
      if (state.status === 'ready' && state.source.target.playerId === 'user-other') {
        expect(state.refreshing).toBe(false)
      }
    }
  })

  it('re-reads when the retry is taken', async () => {
    reset()
    server.state.profileMode = 'failed'
    const probe = mount(BASE)
    const state = await ready(probe)
    expect(state.profile.kind).toBe('failed')

    const current = last(probe.seen)
    if (current.status !== 'ready') throw new Error('expected ready')
    server.state.profileMode = 'ok'
    current.retry()

    await waitFor(() => expect(server.calls.profile).toBe(2))
  })
})
