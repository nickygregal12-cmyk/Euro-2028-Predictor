import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import {
  useVNextHomeSource,
  type VNextHomeSourceInput,
  type VNextHomeSourceState,
} from '../../src/vnext/integration/home/useVNextHomeSource'
import type { MatchPredictorPage } from '../../src/features/season/matchPredictorModel'
import type { SeasonPlayContext } from '../../src/features/season/seasonPlayContextModel'
import type { SeasonClubFormTable } from '../../src/services/supabase/seasonClubFormModel'
import type { SeasonFixtureList } from '../../src/services/supabase/seasonFixtureListModel'
import type { GameLeague } from '../../src/services/supabase/gameLeagues'
import type { SeasonLeagueMovement } from '../../src/services/supabase/seasonLeagueMovementModel'
import type { SeasonLeagueStandingsPage } from '../../src/services/supabase/seasonLeagueStandingsModel'
import type { SeasonPlayerProfile } from '../../src/services/supabase/seasonPlayerProfileModel'

/**
 * THE ACQUISITION LIFECYCLE BOUNDARY: A LOADED PAYLOAD BELONGS TO ONE IDENTITY.
 *
 * `useVNextHomeSource` holds a loaded payload in React state, and everything in
 * that payload is somebody's private state — their predictions, their rank,
 * their private-league table. React state outlives the inputs that produced it,
 * and an effect runs AFTER the render that changed them, so a hook that trusted
 * its own stored payload would compose the previous account's answers with the
 * current account's identity and call the result ready. For one render. One
 * render is enough to paint.
 *
 * These tests exist to make that unrepresentable rather than unlikely, so they
 * are deliberately not written as "the status is loading after a switch". They
 * RECORD EVERY RENDER — the inputs it was given and the state it returned — and
 * then assert, over the whole recording, that no `ready` state ever crossed a
 * payload with inputs that did not address it. A future refactor that reorders
 * an effect, adds a transition or memoises differently is caught by the same
 * assertion, because the assertion is about the invariant rather than about a
 * particular render's status.
 *
 * WHY THE CONTEXT READ IS THE GATE. Every other read is addressed by the
 * tournament id the play context returns, so leaving one context load pending
 * holds a whole acquisition open at a known point. That is the window the finding
 * is about: the new identity's reads have not answered, and the previous
 * identity's answers are still in state.
 *
 * Nothing here touches Supabase. The service modules are mocked at their own
 * boundary, which is also what keeps `VNextHome` and the mapper out of this file
 * entirely — this is a test about acquisition, not about anything Home draws.
 */

const server = vi.hoisted(() => {
  type ContextCall = {
    competitionSlug: string
    seasonSlug: string
    resolve: (context: unknown) => void
    reject: (reason: unknown) => void
  }

  const contextCalls: ContextCall[] = []

  /** The season a pair of slugs names. One tournament id, derived, never guessed. */
  const tournamentFor = (competitionSlug: string, seasonSlug: string) =>
    `${competitionSlug}/${seasonSlug}`

  /**
   * The builders are annotated with the REAL read models. A mock factory is not
   * type-checked against the module it replaces, so without these the fake
   * server could drift from the reads it stands in for and this file would go on
   * passing. Type-only imports erase, so naming them inside a hoisted factory
   * costs nothing at runtime.
   */
  return {
    contextCalls,
    tournamentFor,

    /** A season profile that is unmistakably ONE player's, in ONE season. */
    profileFor: (tournamentId: string, playerId: string): SeasonPlayerProfile => ({
      player: { userId: playerId, displayName: `Name of ${playerId}`, isSelf: true },
      entered: true,
      serverNow: null,
      season: {
        points: playerId.length * 10,
        matchweeksPlayed: 4,
        rank: playerId.length,
        fieldSize: 500,
      },
      accuracy: { fixturesPredicted: 40, exactScores: 6, correctOutcomes: 21 },
      jokers: { played: 1, pointsFromJokerMatchweeks: 24 },
      // Real per-player predictions, from the read that really carries them.
      history: [
        {
          matchweekId: `${tournamentId}-mw-5`,
          ordinal: 5,
          label: 'Matchweek 5',
          points: 12,
          jokerPlayed: false,
          predictions: {
            [`${tournamentId}-fx-1`]: { home: playerId.length, away: 0 },
          },
        },
      ],
    }),

    fixtureListFor: (tournamentId: string): SeasonFixtureList => ({
      competition: {
        id: tournamentId,
        name: `Competition ${tournamentId}`,
        seasonKey: '2027-28',
        timeZone: 'Europe/London',
        slug: null,
      },
      window: { from: '2027-08-14T00:00:00.000Z', to: '2027-09-04T00:00:00.000Z' },
      serverNow: null,
      fixtures: [
        {
          id: `${tournamentId}-fx-1`,
          kickoffAt: '2027-08-21T14:00:00.000Z',
          status: 'scheduled',
          round: { id: `${tournamentId}-r-5`, ordinal: 5, label: 'Matchweek 5' },
          schedule: { kickoffConfirmed: true, rescheduled: false, originalKickoffAt: null },
          home: { name: 'Porthaven City', tokens: { monogram: 'POR', primary: '#123456' } },
          away: { name: 'Balmorral Athletic', tokens: { monogram: 'BAL', primary: '#654321' } },
          result: null,
          live: null,
        },
      ],
    }),

    cardFor: (tournamentId: string): MatchPredictorPage => ({
      competition: {
        name: `Competition ${tournamentId}`,
        seasonLabel: '2027/28',
        timeZone: 'Europe/London',
      },
      matchweek: { number: 5, of: 38 },
      fixtures: [
        {
          fixtureId: `${tournamentId}-fx-1`,
          kickoffAt: '2027-08-21T14:00:00.000Z',
          home: {
            name: 'Porthaven City',
            shortName: 'Porthaven',
            tokens: { monogram: 'POR', primary: '#123456' },
          },
          away: {
            name: 'Balmorral Athletic',
            shortName: 'Balmorral',
            tokens: { monogram: 'BAL', primary: '#654321' },
          },
          prediction: { home: 2, away: 1 },
          result: null,
          points: null,
        },
      ],
      cardStatus: 'confirmed',
      lock: {
        status: 'open',
        locked: false,
        lockAt: '2027-08-21T13:45:00.000Z',
        reason: 'before_scope_lock',
      },
      joker: { playedHere: false, remainingThisHalf: 1, playable: true },
      settledPoints: null,
    }),

    leaguesFor: (gameCompetitionId: string): GameLeague[] => [
      {
        id: `${gameCompetitionId}-league`,
        name: `League of ${gameCompetitionId}`,
        inviteCode: 'ABC123',
        memberCount: 8,
        isOwner: false,
        ownerName: 'Someone Else',
        lastActivityAt: null,
      },
    ],

    standingsFor: (leagueId: string): SeasonLeagueStandingsPage => ({
      rows: [
        {
          userId: 'member-1',
          displayName: `Rival in ${leagueId}`,
          points: 210,
          rank: 1,
          matchweeksPlayed: 4,
          tied: false,
          position: 1,
          isYou: false,
          isOwner: true,
          hasEntry: true,
        },
      ],
      totalCount: 8,
      pageSize: 25,
      hasMore: false,
      nextCursor: null,
      you: {
        userId: 'you',
        displayName: `You in ${leagueId}`,
        points: 190,
        rank: 3,
        matchweeksPlayed: 4,
        tied: false,
        position: 3,
        isOwner: false,
        hasEntry: true,
      },
    }),

    clubFormFor: (): SeasonClubFormTable => ({ serverNow: null, matches: 5, clubs: [] }),

    movementFor: (leagueId: string): SeasonLeagueMovement => ({
      leagueId,
      matchweek: null,
      // Unsettled, so the hook discards it. Contract 150, and not this file's
      // subject — it keeps the payload honest without adding a fourth read to
      // reason about.
      settled: false,
      serverNow: null,
      members: [],
    }),
  }
})

vi.mock('../../src/services/supabase/seasonPlayContext', () => ({
  createSeasonPlayContextGateway: () => ({
    load: (competitionSlug: string, seasonSlug: string) =>
      new Promise((resolve, reject) => {
        server.contextCalls.push({ competitionSlug, seasonSlug, resolve, reject })
      }),
  }),
}))

vi.mock('../../src/services/supabase/seasonMatchPredictor', () => ({
  createSeasonMatchPredictorRpcGateway: (options: { tournamentId: string }) => ({
    load: async () => server.cardFor(options.tournamentId),
  }),
}))

vi.mock('../../src/services/supabase/seasonFixtureList', () => ({
  fetchSeasonFixtureList: async (tournamentId: string) => server.fixtureListFor(tournamentId),
}))

vi.mock('../../src/services/supabase/seasonPlayerProfile', () => ({
  fetchSeasonPlayerProfile: async (tournamentId: string, playerId: string) =>
    server.profileFor(tournamentId, playerId),
}))

vi.mock('../../src/services/supabase/gameLeagues', () => ({
  fetchMyGameLeagues: async (gameCompetitionId: string) => server.leaguesFor(gameCompetitionId),
}))

vi.mock('../../src/services/supabase/seasonLeagueStandings', () => ({
  fetchSeasonLeagueStandingsPage: async (leagueId: string) => server.standingsFor(leagueId),
}))

vi.mock('../../src/services/supabase/seasonLeagueMovement', () => ({
  fetchSeasonLeagueMovement: async (leagueId: string) => server.movementFor(leagueId),
}))

vi.mock('../../src/services/supabase/seasonClubForm', () => ({
  fetchSeasonClubForm: async () => server.clubFormFor(),
}))

// Both are enrichments the hook is already required to survive without, and
// neither carries an identity this file is about. Refusing them keeps the mock
// surface to the reads that do.
vi.mock('../../src/services/supabase/seasonConsensus', () => ({
  fetchSeasonConsensus: async () => {
    throw new Error('consensus is not readable in this test')
  },
}))

vi.mock('../../src/services/supabase/seasonMatchweekProjection', () => ({
  fetchSeasonMatchweekProjection: async () => {
    throw new Error('projection is not readable in this test')
  },
}))

/* ------------------------------------------------------------------ *
 * The recording probe.
 * ------------------------------------------------------------------ */

type Observation = {
  readonly input: VNextHomeSourceInput
  readonly state: VNextHomeSourceState
}

function Probe({ input, log }: { input: VNextHomeSourceInput; log: Observation[] }) {
  const state = useVNextHomeSource(input)
  // Recorded in the RENDER PHASE deliberately. The leak this file is about
  // happens in a render that an effect has not caught up with yet, so a
  // recording taken after effects flush would not see it.
  log.push({ input, state })
  return <span data-testid="status">{state.status}</span>
}

function input(over: Partial<VNextHomeSourceInput> = {}): VNextHomeSourceInput {
  return {
    userId: 'user-a',
    displayName: 'Alex',
    authLoading: false,
    competitionSlug: 'premier-league',
    seasonSlug: '2027-28',
    gameCompetitionId: 'game-a',
    ...over,
  }
}

function latest(log: Observation[]): Observation {
  const last = log.at(-1)
  if (!last) throw new Error('nothing rendered')
  return last
}

/**
 * THE INVARIANT, ASSERTED OVER EVERY RENDER THAT HAPPENED.
 *
 * A ready state is only allowed to exist if the payload inside it was addressed
 * by the inputs that same render was given. This checks all four addresses
 * independently, so `old payload + new user` and `old competition payload + new
 * competition inputs` are separate failures rather than one.
 */
function expectNoCrossedIdentity(log: Observation[]) {
  for (const [index, observation] of log.entries()) {
    if (observation.state.status !== 'ready') continue

    const { source } = observation.state
    const where = `render ${index}`
    const expectedTournament = server.tournamentFor(
      observation.input.competitionSlug ?? '',
      observation.input.seasonSlug ?? '',
    )

    // The account the payload is about, from the read that names it.
    expect(source.user.id, where).toBe(observation.input.userId)
    expect(source.profile?.player.userId, where).toBe(observation.input.userId)

    // The competition season the payload is about.
    expect(source.competition.tournamentId, where).toBe(expectedTournament)
    expect(source.fixtures[0]?.id, where).toBe(`${expectedTournament}-fx-1`)
    expect(source.card?.fixtures[0]?.fixtureId, where).toBe(`${expectedTournament}-fx-1`)

    // The private leagues, which hang off the game competition and nothing else.
    for (const league of source.leagues) {
      expect(league.id, where).toBe(`${observation.input.gameCompetitionId}-league`)
    }
  }
}

/** Answer the pending context load at `index`, and let the acquisition finish. */
async function answerContext(index: number, over: Partial<SeasonPlayContext> = {}) {
  const call = server.contextCalls[index]
  if (!call) throw new Error(`no context load at index ${index}`)
  await act(async () => {
    call.resolve({
      tournamentId: server.tournamentFor(call.competitionSlug, call.seasonSlug),
      competitionName: `Competition ${call.competitionSlug}`,
      seasonLabel: '2027/28',
      timeZone: 'Europe/London',
      status: 'in_progress',
      matchweek: 5,
      matchweekCount: 38,
      locksAt: null,
      ...over,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function failContext(index: number) {
  const call = server.contextCalls[index]
  if (!call) throw new Error(`no context load at index ${index}`)
  await act(async () => {
    call.reject(new Error('FetchError: the play context could not be read'))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/* ------------------------------------------------------------------ *
 * The cases.
 * ------------------------------------------------------------------ */

describe('useVNextHomeSource acquisition identity', () => {
  // The pending-call queue is the fake server's whole state, and every case
  // below addresses it by index.
  beforeEach(() => {
    server.contextCalls.length = 0
  })

  it('does not expose the previous account payload when the user changes', async () => {
    const log: Observation[] = []
    const { rerender } = render(<Probe input={input()} log={log} />)

    await waitFor(() => expect(server.contextCalls).toHaveLength(1))
    await answerContext(0)
    await waitFor(() => expect(latest(log).state.status).toBe('ready'))

    // User A really is loaded, so what follows is a switch away from a payload
    // rather than a switch away from nothing.
    const ready = latest(log).state
    expect(ready.status === 'ready' && ready.source.profile?.player.userId).toBe('user-a')

    const before = log.length
    rerender(<Probe input={input({ userId: 'user-b', displayName: 'Blake' })} log={log} />)

    // THE RENDER THE FINDING IS ABOUT: the first one under user B, before any
    // effect for user B has run and while user A's payload is still in state.
    expect(log[before]?.state.status).toBe('loading')

    // Nothing of user A's survives anywhere in the recording under user B.
    const underB = log.slice(before)
    expect(underB.some((entry) => entry.state.status === 'ready')).toBe(false)
    expect(JSON.stringify(underB)).not.toContain('Name of user-a')
    expect(JSON.stringify(underB)).not.toContain('user-a')

    // And B's own reads then answer normally, addressed as B.
    await waitFor(() => expect(server.contextCalls).toHaveLength(2))
    await answerContext(1)
    await waitFor(() => expect(latest(log).state.status).toBe('ready'))
    const loaded = latest(log).state
    expect(loaded.status === 'ready' && loaded.source.profile?.player.userId).toBe('user-b')

    expectNoCrossedIdentity(log)
  })

  it('does not expose the previous competition payload when the season changes', async () => {
    const log: Observation[] = []
    const { rerender } = render(<Probe input={input()} log={log} />)

    await waitFor(() => expect(server.contextCalls).toHaveLength(1))
    await answerContext(0)
    await waitFor(() => expect(latest(log).state.status).toBe('ready'))

    const before = log.length
    rerender(
      <Probe
        input={input({ competitionSlug: 'la-liga', seasonSlug: '2028-29' })}
        log={log}
      />,
    )

    expect(log[before]?.state.status).toBe('loading')

    const underSecond = log.slice(before)
    expect(underSecond.some((entry) => entry.state.status === 'ready')).toBe(false)
    // The first season's fixtures, card and matchweek are all addressed by its
    // tournament id, so its absence is the absence of all of them.
    expect(JSON.stringify(underSecond)).not.toContain('premier-league/2027-28')

    await waitFor(() => expect(server.contextCalls).toHaveLength(2))
    await answerContext(1)
    await waitFor(() => expect(latest(log).state.status).toBe('ready'))
    const loaded = latest(log).state
    expect(loaded.status === 'ready' && loaded.source.competition.tournamentId).toBe(
      'la-liga/2028-29',
    )

    expectNoCrossedIdentity(log)
  })

  it('is signed out on the very next render, holding nothing back', async () => {
    const log: Observation[] = []
    const { rerender } = render(<Probe input={input()} log={log} />)

    await waitFor(() => expect(server.contextCalls).toHaveLength(1))
    await answerContext(0)
    await waitFor(() => expect(latest(log).state.status).toBe('ready'))

    const before = log.length
    rerender(<Probe input={input({ userId: null, displayName: null })} log={log} />)

    // Not "loading, then signed out once an effect runs". Signed out, now.
    expect(log[before]?.state.status).toBe('signedOut')

    const afterSignOut = log.slice(before)
    expect(afterSignOut.some((entry) => entry.state.status === 'ready')).toBe(false)
    expect(JSON.stringify(afterSignOut)).not.toContain('Name of user-a')
    expect(JSON.stringify(afterSignOut)).not.toContain('game-a-league')

    expectNoCrossedIdentity(log)
  })

  it('does not expose the previous game competition leagues when it changes', async () => {
    const log: Observation[] = []
    const { rerender } = render(<Probe input={input()} log={log} />)

    await waitFor(() => expect(server.contextCalls).toHaveLength(1))
    await answerContext(0)
    await waitFor(() => expect(latest(log).state.status).toBe('ready'))

    const ready = latest(log).state
    expect(ready.status === 'ready' && ready.source.leagues[0]?.id).toBe('game-a-league')

    const before = log.length
    rerender(<Probe input={input({ gameCompetitionId: 'game-b' })} log={log} />)

    expect(log[before]?.state.status).toBe('loading')

    const underB = log.slice(before)
    expect(underB.some((entry) => entry.state.status === 'ready')).toBe(false)
    expect(JSON.stringify(underB)).not.toContain('game-a-league')
    expect(JSON.stringify(underB)).not.toContain('League of game-a')

    await waitFor(() => expect(server.contextCalls).toHaveLength(2))
    await answerContext(1)
    await waitFor(() => expect(latest(log).state.status).toBe('ready'))
    const loaded = latest(log).state
    expect(loaded.status === 'ready' && loaded.source.leagues[0]?.id).toBe('game-b-league')

    expectNoCrossedIdentity(log)
  })

  it('does not report the previous identity failure against new inputs', async () => {
    const log: Observation[] = []
    const { rerender } = render(<Probe input={input()} log={log} />)

    await waitFor(() => expect(server.contextCalls).toHaveLength(1))
    await failContext(0)
    await waitFor(() => expect(latest(log).state.status).toBe('failed'))

    const before = log.length
    rerender(
      <Probe input={input({ competitionSlug: 'la-liga', seasonSlug: '2028-29' })} log={log} />,
    )

    // A competition whose reads have not been issued has not failed. Saying it
    // had would offer a retry button for something nobody tried.
    expect(log[before]?.state.status).toBe('loading')

    await waitFor(() => expect(server.contextCalls).toHaveLength(2))
    await answerContext(1)
    await waitFor(() => expect(latest(log).state.status).toBe('ready'))

    expectNoCrossedIdentity(log)
  })
})
