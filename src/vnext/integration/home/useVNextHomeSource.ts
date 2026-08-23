import { useCallback, useEffect, useMemo, useState } from 'react'
import { readLastVisit, writeLastVisit } from '../../../features/hub/lastVisit'
import { presentCard } from '../../../features/season/matchPredictorModel'
import { presentCompetitionWeek } from '../../../features/hub/competitionWeekModel'
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
 *
 * A LOADED PAYLOAD BELONGS TO THE IDENTITY THAT ASKED FOR IT, and that is the
 * strongest rule in this file. Everything Home draws is somebody's private
 * state: their predictions, their rank, their private-league table, their
 * rivals. Holding it in React state means it outlives the inputs that produced
 * it, and an effect cannot help — an effect runs AFTER the render that changed
 * the inputs, so a hook that trusted its own stored payload would, for exactly
 * one render, compose the previous account's answers with the current account's
 * identity and call the result ready. One render is enough to paint.
 *
 * So the payload is stored WITH the identity that addressed the reads, the
 * public state is derived from the CURRENT inputs first, and a payload whose
 * identity no longer matches is not a payload — it is loading. Nothing about
 * that depends on when an effect is scheduled, which is the point: the leak is
 * made unrepresentable rather than merely unlikely. `tests/vnext/
 * homeSourceIdentity.test.tsx` drives all four transitions that could expose it.
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
  /**
   * Who this player is watching in this competition (contract 157), from the
   * shell's own preference read.
   *
   * MERGED AT THE DERIVATION, exactly as `displayName` is, and for the same
   * reason: it addresses no read. Watching somebody writes a preference and
   * asks the shell to re-read it; if this were an effect input, that re-read
   * would refetch every one of Home's dozen reads to reorder one strip.
   */
  watchedRivalIds?: readonly string[] | undefined
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
  /**
   * Whether this player has an ACTIVE Last Man Standing membership here.
   *
   * IT COSTS NO REQUEST. The shell already holds the membership answer —
   * `usePlayerCompetitions` carries every competition's `games` with its
   * membership row, and `useSeasonGameCompetitionId` reads the same context for
   * the Match Predictor id above. Asking the LMS round read for a non-entrant
   * would spend a request to be told what the membership read already said, and
   * `loadCompetitionWeek` declines to do that for the same reason.
   */
  playsLms: boolean
  /**
   * The exact Championship competition this player is in, or null.
   *
   * AN ID RATHER THAN A BOOLEAN, because a season can run several Championships
   * — contract 133's discovery read exists because of it — so "the
   * Championship" is not a thing to look up by game key alone.
   */
  championshipCompetitionId: string | null
}

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null
}

/**
 * WHICH REQUEST A PAYLOAD ANSWERS: the inputs that ADDRESS Home's reads.
 *
 * `userId` addresses the profile and the card, the two slugs address the play
 * context every other read hangs off, `gameCompetitionId` addresses the private
 * leagues, and the two membership inputs address the Last Man Standing round
 * and the Championship view. Change any one of them and every answer already in
 * hand is about somebody else, some other competition, some other set of
 * leagues, or a game the player is no longer in.
 *
 * THE MEMBERSHIP INPUTS ARE PART OF THE ADDRESS AND NOT MERELY OF THE ANSWER.
 * A player who joins Last Man Standing mid-session changes what Home may ask
 * for; leaving them out would keep serving a payload computed when there was no
 * round to read, and the pick would not appear until something else moved.
 *
 * `displayName` is deliberately not part of it — it addresses no read, and it is
 * merged into the source at the end rather than re-fetched for. `authLoading` is
 * not part of it either: it is not an address, it is a reason not to decide yet,
 * and the derivation below handles it before an identity is even computed.
 *
 * JSON rather than a joined string because a slug is user-visible text and a
 * separator can appear inside one. `a|b` and `a` + `|b` must not collide.
 */
type RequestIdentity = string

function requestIdentity(input: {
  userId: string
  competitionSlug: string
  seasonSlug: string
  gameCompetitionId: string | null
  playsLms: boolean
  championshipCompetitionId: string | null
}): RequestIdentity {
  return JSON.stringify([
    input.userId,
    input.competitionSlug,
    input.seasonSlug,
    input.gameCompetitionId,
    input.playsLms,
    input.championshipCompetitionId,
  ])
}

/**
 * What the effect stores: everything the reads returned, the identity that asked
 * for them, and NOT the user.
 *
 * THE USER IS COMPOSED IN AFTERWARDS, AND THAT IS A FIX RATHER THAN A STYLE.
 * `displayName` arrives from `AuthProvider` in two steps — null while the profile
 * read is in flight, then the name — so an effect that depended on it ran twice
 * and issued every one of Home's reads twice. The display name addresses no read
 * and belongs to no payload, so it is merged in below where it costs nothing.
 *
 * `identity` travels WITH the payload rather than beside it, so there is no way
 * to read one without the other and no moment where the pair is half-updated.
 */
type Loaded = {
  status: 'loaded'
  identity: RequestIdentity
  payload: Omit<HomeSource, 'user'>
  unavailable: readonly HomeSourceName[]
  leaguesNotShown: number
}

/**
 * `idle` means NOTHING IS HELD FOR ANY IDENTITY — the honest state before a read
 * lands, and the state this hook returns to the moment its inputs change. There
 * is no internal `loading`, `signedOut` or `noCompetition` any more: those are
 * facts about the CURRENT inputs, not things acquisition discovers, and storing
 * them was what let a payload from a previous identity outlive its inputs.
 */
type InternalState =
  | { status: 'idle' }
  | { status: 'failed'; identity: RequestIdentity }
  | Loaded

const IDLE: InternalState = { status: 'idle' }

export function useVNextHomeSource(input: VNextHomeSourceInput): VNextHomeSourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  /*
   * THE MARKER IS READ ONCE, ON MOUNT, AND THEN FROZEN FOR THIS VISIT.
   *
   * `useState(readLastVisit)` rather than a read inside the effect, and the
   * difference is the whole feature: the marker is written again below as soon
   * as Home has loaded, so an effect that re-read it would find its own write
   * and "since you were last here" would empty itself while the player was
   * looking at it. What they see is measured from the visit BEFORE this one,
   * for as long as this page is open.
   */
  const [lastVisitAt] = useState(readLastVisit)

  const {
    userId,
    displayName,
    watchedRivalIds,
    authLoading,
    competitionSlug,
    seasonSlug,
    gameCompetitionId,
    playsLms,
    championshipCompetitionId,
  } = input

  useEffect(() => {
    // Nothing to acquire, and nothing may be kept: a signed-out surface must not
    // still be holding the last signed-in player's card in memory.
    if (authLoading || !userId || !competitionSlug || !seasonSlug) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = requestIdentity({
      userId,
      competitionSlug,
      seasonSlug,
      gameCompetitionId,
      playsLms,
      championshipCompetitionId,
    })

    let active = true
    // Dropped rather than kept-while-loading. The derivation below would refuse
    // to expose it anyway; releasing it here means it is not retained either.
    setState((current) => (current.status === 'idle' ? current : IDLE))

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
        // WAVE TWO. Eight reads, concurrently, each allowed to fail alone.
        //
        // THE TWO SIDE-GAME READS JOIN THIS WAVE RATHER THAN FOLLOWING IT, so
        // finishing the week costs Home no extra round trip: they need only
        // `context.tournamentId` and the membership ids the shell already
        // holds, which is exactly what wave one produced. A third wave would
        // have added its own latency to every Home load to answer a question
        // the same wave could ask.
        const [
          fixtures,
          card,
          profile,
          leagueList,
          clubForm,
          consensus,
          projection,
          lmsRound,
          championshipView,
        ] = await Promise.allSettled([
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
            // THE LAST MAN STANDING ROUND, only where the player is actually in
            // it. The round read reports `entered: false` for a non-entrant, so
            // this gate is about not spending the request rather than about
            // trusting the answer — `lmsAction` still decides what the payload
            // means.
            playsLms
              ? import('../../../services/supabase/seasonLms').then((module) =>
                  module.createSeasonLmsRpcGateway({
                    tournamentId: context.tournamentId,
                  }).load(),
                )
              : Promise.resolve(null),
            // THE CHAMPIONSHIP THIS PLAYER IS IN, addressed by its own
            // competition id because a season may run several.
            championshipCompetitionId === null
              ? Promise.resolve(null)
              : import('../../../services/supabase/seasonCupPlayer').then((module) =>
                  module.createSeasonCupPlayerViewRpcGateway({
                    competitionId: championshipCompetitionId,
                  }).load(),
                ),
          ])
        if (!active) return

        // The fixtures are core. Without them there is no football to show, and
        // a Home drawn without them would be a confident empty matchweek.
        const fixtureList = settled(fixtures)
        if (fixtureList === null) {
          setState({ status: 'failed', identity })
          return
        }

        const cardPage = settled(card)
        // Each side game is allowed to fail alone. `settled` turns a rejection
        // into `null`, which the week model reads as "this game said nothing" —
        // the same answer as a player who is not in it. That is deliberate for
        // Home: a broken Championship read must cost its own line and nothing
        // else on the page.
        const lmsRoundValue = settled(lmsRound)
        const championshipValue = settled(championshipView)
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
          status: 'loaded',
          identity,
          payload: {
            // ONE INSTANT FOR THE WHOLE MODEL, stamped once here where a clock
            // read is legitimate, and passed down as data. Nothing in the mapper
            // or in any component reads a clock, so every deadline and relative
            // time on the page is measured against the same moment.
            generatedAt: new Date().toISOString(),
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
            // THE WHOLE WEEK, ACROSS EVERY GAME THAT ANSWERED.
            //
            // The Hub's own week model, over the same reads the Hub uses.
            // Reusing it is what keeps Home's "what is outstanding" identical
            // to the Hub's rather than a second count that can disagree — and
            // it is the ONLY thing that orders these three, so Home never
            // decides that one game outranks another.
            //
            // EACH GAME IS INDEPENDENTLY OMITTED, never substituted. A rejected
            // Championship read arrives here as `null` and the week is built
            // without it, so an unreadable side game costs the player its line
            // and never the Match Predictor action beside it. `null` overall
            // means nothing answered at all, which the mapper treats as "we
            // could not ask" rather than "nothing to do".
            week:
              cardPage || lmsRoundValue || championshipValue
                ? presentCompetitionWeek({
                    matchPredictor: cardPage ? { page: cardPage, href: null } : null,
                    lms: lmsRoundValue ? { page: lmsRoundValue, href: null } : null,
                    championship: championshipValue
                      ? { view: championshipValue, href: null }
                      : null,
                    now: new Date(),
                  })
                : null,
            profile: profileValue,
            leagues,
            clubForm: clubFormValue,
            consensus: consensusValue,
            projection: projectionValue,
            lastVisitAt,
          },
          unavailable,
          leaguesNotShown: Math.max(0, allLeagues.length - shown.length),
        })

        // ONLY AFTER HOME ACTUALLY LOADED. Stamping the marker on mount would
        // mean a player whose connection dropped before the football arrived
        // had "been here" — and would lose the recap they never saw. The
        // failure path below deliberately does not write.
        writeLastVisit(new Date())
      } catch {
        // The context read failed, or something threw before the enrichments
        // were reached. Either way Home has no competition to draw.
        if (active) setState({ status: 'failed', identity })
      }
    })()

    return () => {
      active = false
    }
    // `displayName` is DELIBERATELY ABSENT. It addresses no read, and including
    // it made every read fire twice — once before the profile resolved and once
    // after. It is merged into the source below instead.
  }, [
    authLoading,
    userId,
    competitionSlug,
    seasonSlug,
    gameCompetitionId,
    playsLms,
    championshipCompetitionId,
    nonce,
  ])

  /**
   * THE PUBLIC STATE IS DERIVED FROM THE CURRENT INPUTS, IN THIS ORDER, and the
   * order is the safety property. Auth, then the user, then the competition are
   * answered from what is true THIS RENDER — never from what acquisition last
   * stored — so signing out is `signedOut` on the very next render, before any
   * effect has run and while the previous payload is still in state.
   *
   * Only after those does stored state get a say, and only if its identity is
   * the one being asked about now. A mismatch is `loading`: the reads for this
   * identity have not answered yet, which is exactly what is true. The one path
   * to `ready` therefore composes a payload with the identity that produced it,
   * and `old payload + new user` has no expression here at all.
   */
  return useMemo<VNextHomeSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!competitionSlug || !seasonSlug) return { status: 'noCompetition' }

    const identity = requestIdentity({
      userId,
      competitionSlug,
      seasonSlug,
      gameCompetitionId,
      playsLms,
      championshipCompetitionId,
    })
    if (state.status === 'idle' || state.identity !== identity) return { status: 'loading' }
    if (state.status === 'failed') return { status: 'failed', retry }

    return {
      status: 'ready',
      // The user is attached here, so a display name arriving late updates the
      // greeting without re-reading a single fixture. `userId` is the same one
      // the payload's identity was built from — checked immediately above — so
      // this is the account those answers are about, not merely the account
      // signed in now.
      source: {
        ...state.payload,
        user: { id: userId, displayName },
        watchedRivalIds: watchedRivalIds ?? [],
      },
      unavailable: state.unavailable,
      leaguesNotShown: state.leaguesNotShown,
      retry,
    }
  }, [
    state,
    authLoading,
    userId,
    displayName,
    watchedRivalIds,
    competitionSlug,
    seasonSlug,
    gameCompetitionId,
    retry,
  ])
}
