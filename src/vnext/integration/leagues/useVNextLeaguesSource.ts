import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LeaguesSource } from './leaguesSource'

/**
 * ACQUIRE THE STANDINGS vNEXT LEAGUES NEEDS, through the reads that own them.
 *
 * This hook fetches and nothing else. `buildLeaguesModel` is the only thing that
 * turns an answer into something a page can draw, which is what makes every
 * mapping case testable with no Supabase, no auth and no network.
 *
 * ============================ ONE TABLE PER VISIT ========================
 *
 * The page shows ONE table, so this reads one. Global scope reads contract
 * 191's season table; a selected league reads contract 128's own table and
 * contract 150's movement beside it. Reading both tables every time would
 * double the cost of a surface whose entire job is to show the one the player
 * chose — and the two are different enough that there is no sense in which the
 * unused one is a useful fallback.
 *
 * ============================ NO PER-ROW READ ============================
 *
 * A table of fifty costs the same as a table of five. Nothing here loops over
 * rows, and `LeaguePlayer` has no field a per-player read would fill — contract
 * 191 already carries the reach and the id that decide whether a row opens, and
 * contract 128 already carries `isYou`, `isOwner` and `hasEntry`. The N+1 is
 * prevented by the shape rather than by discipline.
 *
 * ============================ THREE WAVES, AND THE ONE DEPENDENCY ========
 *
 *   1. the play context, because every read below is addressed by its id;
 *   2. the private-league list, because a league id comes from it;
 *   3. the chosen table, and — for a league — its movement, concurrently.
 *
 * The league LIST is read in both scopes, and deliberately: the switcher has to
 * exist on the global table too, or a player looking at the season standings
 * has no way to reach their own league.
 *
 * ============================ EVERY READ BELOW WAVE ONE FAILS ALONE ======
 *
 * ONLY THE PLAY CONTEXT CAN FAIL THE WHOLE PAGE. Without it there is no
 * competition name, no season and no id to address anything with, so there is
 * genuinely nothing to draw. Everything after it resolves to `null` instead,
 * and `buildLeaguesModel` names what is missing.
 *
 * A FAILED TABLE IS NOT A FAILED PAGE, and getting that wrong is how a player
 * gets stranded: `docs/product/vnext-leagues.md` §9 requires the chooser to
 * survive a table that did not answer, because a whole-page notice takes away
 * the only control that could have got them out of the league that failed. An
 * earlier revision of this hook returned `failed` here and made that promise
 * false — and made two of the mapper's `unavailable` sentences unreachable.
 *
 * IT ALSO MEANT A SUPERSEDED REQUEST COULD HANG THE PAGE. That `setState` was
 * the one write in this file with no `active` guard: switch from league A to
 * league B, let B resolve and A then reject, and the stale closure stored
 * `failed` under A's identity. The memo below reads an identity that is no
 * longer current as `loading`, the effect deps have not changed, and nothing
 * refetches — a skeleton with no chooser and no retry until a reload. Every
 * write in this file is now behind the same guard, which is the property that
 * makes that class of bug impossible rather than absent.
 *
 * ============================ A PAYLOAD BELONGS TO ITS REQUEST ===========
 *
 * Everything here is somebody's private standing. The identity that addressed
 * the reads travels WITH the payload, and a payload whose identity no longer
 * matches is not a payload — it is loading. Without that, one render composes
 * the previous league's table with the current league's name, and one render is
 * enough to paint.
 */

export type VNextLeaguesSourceState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'noCompetition' }
  | { status: 'failed'; retry: () => void }
  | { status: 'ready'; source: LeaguesSource; retry: () => void }

export type VNextLeaguesSourceInput = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly competitionSlug: string | undefined
  readonly seasonSlug: string | undefined
  /**
   * The game competition id private leagues hang off. Null where the player has
   * not joined the game — an ordinary state, and the reason the league list can
   * legitimately be empty.
   */
  readonly gameCompetitionId: string | null
  /** Which table to show. Null is the season table. */
  readonly selectedLeagueId: string | null
  /** The game's own name, as the host states it. */
  readonly gameName: string
}

type RequestIdentity = string

function requestIdentity(input: {
  userId: string
  competitionSlug: string
  seasonSlug: string
  gameCompetitionId: string | null
  selectedLeagueId: string | null
}): RequestIdentity {
  // Every input that ADDRESSES a read is in here, including the selected
  // league: switching league changes which table the answer is about, and a
  // stored payload from the previous one is about somebody else's standings.
  return JSON.stringify([
    input.userId,
    input.competitionSlug,
    input.seasonSlug,
    input.gameCompetitionId,
    input.selectedLeagueId,
  ])
}

type InternalState =
  | { status: 'idle' }
  | { status: 'failed'; identity: RequestIdentity }
  | { status: 'loaded'; identity: RequestIdentity; payload: LeaguesSource }

const IDLE: InternalState = { status: 'idle' }

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null
}

export function useVNextLeaguesSource(
  input: VNextLeaguesSourceInput,
): VNextLeaguesSourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  const {
    userId,
    authLoading,
    competitionSlug,
    seasonSlug,
    gameCompetitionId,
    selectedLeagueId,
    gameName,
  } = input

  useEffect(() => {
    if (authLoading || !userId || !competitionSlug || !seasonSlug) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = requestIdentity({
      userId,
      competitionSlug,
      seasonSlug,
      gameCompetitionId,
      selectedLeagueId,
    })

    let active = true
    setState((current) => (current.status === 'idle' ? current : IDLE))

    void (async () => {
      try {
        const { createSeasonPlayContextGateway } = await import(
          '../../../services/supabase/seasonPlayContext'
        )

        // WAVE ONE. Every read below is addressed by the id this returns.
        const context = await createSeasonPlayContextGateway().load(competitionSlug, seasonSlug)
        if (!active) return

        // WAVE TWO. The league list, which the switcher needs in BOTH scopes.
        const leagues =
          gameCompetitionId === null
            ? []
            : await import('../../../services/supabase/gameLeagues')
                .then((module) => module.fetchMyGameLeagues(gameCompetitionId))
                .catch(() => null)
        if (!active) return

        // WAVE THREE. The one table the player asked for, and — for a league —
        // its movement beside it rather than after it.
        let global: LeaguesSource['global'] = null
        let league: LeaguesSource['league'] = null
        let movement: LeaguesSource['movement'] = null

        if (selectedLeagueId === null) {
          global = await import('../../../services/supabase/seasonLeaderboard')
            .then((module) => module.fetchSeasonLeaderboardPage(context.tournamentId))
            .catch(() => null)
        } else {
          const [standings, moved] = await Promise.allSettled([
            import('../../../services/supabase/seasonLeagueStandings').then((module) =>
              module.fetchSeasonLeagueStandingsPage(selectedLeagueId),
            ),
            import('../../../services/supabase/seasonLeagueMovement').then((module) =>
              module.fetchSeasonLeagueMovement(selectedLeagueId),
            ),
          ])
          league = settled(standings)
          movement = settled(moved)
        }
        if (!active) return

        setState({
          status: 'loaded',
          identity,
          payload: {
            // The one legitimate clock read on this path, stamped once here and
            // passed down as data.
            generatedAt: new Date().toISOString(),
            context: {
              tournamentId: context.tournamentId,
              competitionName: context.competitionName,
              seasonLabel: context.seasonLabel,
              gameName,
              gameCompetitionId,
            },
            selectedLeagueId,
            global,
            leagues,
            league,
            movement,
          },
        })
      } catch {
        if (active) setState({ status: 'failed', identity })
      }
    })()

    return () => {
      active = false
    }
  }, [
    authLoading,
    userId,
    competitionSlug,
    seasonSlug,
    gameCompetitionId,
    selectedLeagueId,
    gameName,
    nonce,
  ])

  /**
   * DERIVED FROM THE CURRENT INPUTS, IN THIS ORDER, and the order is the safety
   * property: auth, then the user, then the competition are answered from what
   * is true THIS RENDER. Only then does stored state get a say, and only if its
   * identity is the one being asked about now.
   */
  return useMemo<VNextLeaguesSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!competitionSlug || !seasonSlug) return { status: 'noCompetition' }

    const identity = requestIdentity({
      userId,
      competitionSlug,
      seasonSlug,
      gameCompetitionId,
      selectedLeagueId,
    })
    if (state.status === 'idle' || state.identity !== identity) return { status: 'loading' }
    if (state.status === 'failed') return { status: 'failed', retry }

    return { status: 'ready', source: state.payload, retry }
  }, [
    state,
    authLoading,
    userId,
    competitionSlug,
    seasonSlug,
    gameCompetitionId,
    selectedLeagueId,
    retry,
  ])
}
