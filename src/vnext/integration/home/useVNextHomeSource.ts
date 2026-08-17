import { useCallback, useEffect, useState } from 'react'
import { presentCard } from '../../../features/season/matchPredictorModel'
import { presentCompetitionWeek, weekActionForGame } from '../../../features/hub/competitionWeekModel'
import type { HomeSource, HomeSourceLeague } from './homeSource'

/**
 * ACQUIRE THE REAL STATE vNEXT HOME NEEDS, through the reads that already own it.
 *
 * This hook fetches and nothing else. It holds no presentation decision, no
 * mapping and no rule: every value it returns is some existing read's own answer,
 * and `buildHomeModel` is the only thing that turns those answers into something
 * Home can draw. Keeping the two apart is what makes the mapping testable without
 * Supabase, auth or a network — the split §10 asks for, and the reason the twelve
 * mapping cases in `tests/vnext/homeIntegration.test.ts` need no mocking at all.
 *
 * ONE REQUIRED CORE, THEN INDEPENDENT ENRICHMENTS.
 *
 *   The core is the play context and its fixtures. Without a competition and its
 *   football there is no Home, so a failure of either fails the surface — the
 *   same "empty versus failed" line `useCompetitionWeek` draws, and for the same
 *   reason: a Home that quietly showed no fixtures would tell a player there is
 *   no football on while a lock passed.
 *
 *   Everything else settles on its own. The card, the profile, the leagues, club
 *   form, consensus and the projection are fetched together and each one's
 *   rejection becomes `null` for that source alone. A failed club-form read costs
 *   Home its form strings; it does not cost it the matchweek. This is §29 as
 *   code, and it is why the enrichments are `Promise.allSettled` rather than
 *   `Promise.all` — one rejection in an `all` would discard five good answers.
 *
 * THE READS RUN IN PARALLEL, IN TWO WAVES. The context has to land first because
 * every other read is addressed by the tournament id it returns, and the card
 * needs the matchweek it opens on. After that, six reads go out at once rather
 * than in a chain. The league tables are a third wave for the same structural
 * reason — a league id comes from the league list — and they are bounded, see
 * below.
 *
 * SUPABASE IS IMPORTED LAZILY, INSIDE THE EFFECT, copying
 * `PlayerCompetitionsProvider`'s reasoning exactly: `services/supabase/client`
 * throws at module load without configuration, so importing it at module scope
 * would drag credentials into the module graph of anything that renders Home —
 * including Storybook and the deterministic tests. The visual tree must stay
 * renderable without a database, and this is what keeps it that way.
 */

/** How many private leagues Home will read a table for. */
const LEAGUE_LIMIT = 2

/**
 * WHY TWO, AND WHY THE CAP IS VISIBLE. Home shows a league race, not a league
 * directory, and each league costs a standings read plus a movement read. A
 * player in nine leagues must not make Home issue eighteen requests on a surface
 * this heavily trafficked. Two is what the approved design draws.
 *
 * The Hub's Rival Watch caps at one and states the same rule in its own words: a
 * cap nobody can see reads as "we covered everything". This one is reported in
 * the returned state so the surface — and the PR — can say so.
 */
export type VNextHomeSourceState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** Signed in, but no competition season to show. Not a failure. */
  | { status: 'noCompetition' }
  | { status: 'failed'; retry: () => void }
  | {
      status: 'ready'
      source: HomeSource
      /** Enrichments that did not answer, for the surface to be honest about. */
      unavailable: readonly HomeSourceName[]
      /** Leagues beyond `LEAGUE_LIMIT` that Home did not read a table for. */
      leaguesNotShown: number
      retry: () => void
    }

export type HomeSourceName =
  | 'card'
  | 'profile'
  | 'leagues'
  | 'clubForm'
  | 'consensus'
  | 'projection'

export type VNextHomeSourceInput = {
  /** From the existing auth authority. Null means signed out. */
  userId: string | null
  displayName: string | null
  /** True while auth is still resolving; Home must not decide anything yet. */
  authLoading: boolean
  /**
   * Which competition season to show, as route slugs — exactly what
   * `get_season_play_context` is addressed by.
   */
  competitionSlug: string | undefined
  seasonSlug: string | undefined
  /**
   * The game competition id for the Match Predictor in this season, which is
   * what private leagues hang off. Null where the player has not joined it.
   */
  gameCompetitionId: string | null
}

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null
}

export function useVNextHomeSource(input: VNextHomeSourceInput): VNextHomeSourceState {
  const [state, setState] = useState<VNextHomeSourceState>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  const { userId, displayName, authLoading, competitionSlug, seasonSlug, gameCompetitionId } = input

  useEffect(() => {
    if (authLoading) {
      setState({ status: 'loading' })
      return
    }
    if (!userId) {
      setState({ status: 'signedOut' })
      return
    }
    if (!competitionSlug || !seasonSlug) {
      setState({ status: 'noCompetition' })
      return
    }

    let active = true
    setState({ status: 'loading' })

    void (async () => {
      try {
        const [
          { createSeasonPlayContextGateway },
          { createSeasonMatchPredictorRpcGateway },
          { fetchSeasonFixtureList },
        ] = await Promise.all([
          import('../../../services/supabase/seasonPlayContext'),
          import('../../../services/supabase/seasonMatchPredictor'),
          import('../../../services/supabase/seasonFixtureList'),
        ])

        // WAVE ONE. Every id below comes from here, so nothing else can start.
        const context = await createSeasonPlayContextGateway().load(competitionSlug, seasonSlug)
        if (!active) return

        const matchweek = context.matchweek

        // WAVE TWO. Six reads, concurrently, each allowed to fail alone.
        const [fixtures, card, profile, leagueList, clubForm, consensus, projection] =
          await Promise.allSettled([
            fetchSeasonFixtureList(context.tournamentId),
            matchweek === null
              ? Promise.resolve(null)
              : createSeasonMatchPredictorRpcGateway({
                  tournamentId: context.tournamentId,
                  competitionName: context.competitionName,
                  seasonLabel: context.seasonLabel,
                  timeZone: context.timeZone,
                  // The gateway's own clock, for its own deadline resolution.
                  // Nothing downstream of it reads this.
                  now: () => new Date(),
                }).load(matchweek),
            import('../../../services/supabase/seasonPlayerProfile').then((module) =>
              module.fetchSeasonPlayerProfile(context.tournamentId, userId),
            ),
            gameCompetitionId === null
              ? Promise.resolve([])
              : import('../../../services/supabase/gameLeagues').then((module) =>
                  module.fetchMyGameLeagues(gameCompetitionId),
                ),
            import('../../../services/supabase/seasonClubForm').then((module) =>
              module.fetchSeasonClubForm(context.tournamentId),
            ),
            matchweek === null
              ? Promise.resolve(null)
              : import('../../../services/supabase/seasonConsensus').then((module) =>
                  // A `ConsensusHiddenError` lands here as a rejection and is
                  // treated as any other unavailable enrichment. That is
                  // correct: the server refuses consensus before the matchweek
                  // locks, and "you may not see this yet" and "we could not read
                  // it" both mean Home shows no consensus. Distinguishing them
                  // would be the browser holding an opinion about a reveal rule.
                  module.fetchSeasonConsensus(context.tournamentId, matchweek),
                ),
            matchweek === null
              ? Promise.resolve(null)
              : import('../../../services/supabase/seasonMatchweekProjection').then((module) =>
                  module.fetchSeasonMatchweekProjection(context.tournamentId, matchweek),
                ),
          ])
        if (!active) return

        // The fixtures are core. Without them there is no football to show, and
        // a Home drawn without them would be a confident empty matchweek.
        const fixtureList = settled(fixtures)
        if (fixtureList === null) {
          setState({ status: 'failed', retry })
          return
        }

        const cardPage = settled(card)
        const allLeagues = settled(leagueList) ?? []
        const shown = allLeagues.slice(0, LEAGUE_LIMIT)

        // WAVE THREE. One table and one movement read per shown league, all
        // concurrent — never a loop that awaits inside itself, which is the N+1
        // the existing Home's own league loop still has.
        const leagueSources = await Promise.all(
          shown.map(async (league): Promise<HomeSourceLeague | null> => {
            const [standings, movement] = await Promise.allSettled([
              import('../../../services/supabase/seasonLeagueStandings').then((module) =>
                module.fetchSeasonLeagueStandingsPage(league.id),
              ),
              import('../../../services/supabase/seasonLeagueMovement').then((module) =>
                module.fetchSeasonLeagueMovement(league.id),
              ),
            ])
            const table = settled(standings)
            // No table, no league. A league name with no race behind it is a
            // heading over nothing.
            if (table === null) return null
            const moved = settled(movement)
            return {
              id: league.id,
              name: league.name,
              memberCount: league.memberCount,
              standings: table,
              // Only a SETTLED matchweek has moved anybody. Contract 150 says so
              // and forbids rendering movement otherwise, so an unsettled answer
              // is discarded here rather than carried and re-checked downstream.
              movement: moved && moved.settled ? moved : null,
            }
          }),
        )
        if (!active) return

        const leagues = leagueSources.filter((league): league is HomeSourceLeague => league !== null)

        const profileValue = settled(profile)
        const clubFormValue = settled(clubForm)
        const consensusValue = settled(consensus)
        const projectionValue = settled(projection)

        const unavailable: HomeSourceName[] = []
        if (cardPage === null && matchweek !== null) unavailable.push('card')
        if (profileValue === null) unavailable.push('profile')
        if (leagueList.status === 'rejected') unavailable.push('leagues')
        if (clubFormValue === null) unavailable.push('clubForm')
        if (consensusValue === null && matchweek !== null) unavailable.push('consensus')
        if (projectionValue === null && matchweek !== null) unavailable.push('projection')

        setState({
          status: 'ready',
          source: {
            // ONE INSTANT FOR THE WHOLE MODEL, stamped once here where a clock
            // read is legitimate, and passed down as data. Nothing in the mapper
            // or in any component reads a clock, so every deadline and relative
            // time on the page is measured against the same moment.
            generatedAt: new Date().toISOString(),
            user: { id: userId, displayName },
            competition: {
              tournamentId: context.tournamentId,
              name: context.competitionName,
              seasonLabel: context.seasonLabel,
              matchweek,
              matchweekCount: context.matchweekCount,
            },
            fixtures: fixtureList.fixtures,
            card: cardPage,
            // `presentCard` is the application's authority on editability, and
            // it is called here rather than in the mapper so the mapper only ever
            // reads the answer. `false` for the conflict flag: Home issues no
            // commands, so it can hold no stale version.
            cardPresentation: cardPage ? presentCard(cardPage, false) : null,
            weekAction: cardPage
              ? weekActionForGame(
                  // The Hub's own week model, over the same card. Reusing it is
                  // what keeps Home's "what is outstanding" identical to the
                  // Hub's, rather than a second count that can disagree.
                  presentCompetitionWeek({
                    matchPredictor: { page: cardPage, href: null },
                    now: new Date(),
                  }),
                  'main_predictor',
                )
              : null,
            profile: profileValue,
            leagues,
            clubForm: clubFormValue,
            consensus: consensusValue,
            projection: projectionValue,
          },
          unavailable,
          leaguesNotShown: Math.max(0, allLeagues.length - shown.length),
          retry,
        })
      } catch {
        // The context read failed, or something threw before the enrichments
        // were reached. Either way Home has no competition to draw.
        if (active) setState({ status: 'failed', retry })
      }
    })()

    return () => {
      active = false
    }
  }, [
    authLoading,
    userId,
    displayName,
    competitionSlug,
    seasonSlug,
    gameCompetitionId,
    retry,
    nonce,
  ])

  return state
}
