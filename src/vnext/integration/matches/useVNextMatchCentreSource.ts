import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MatchCentreSource } from './matchCentreSource'
import type {
  SeasonFixtureCompetition,
  SeasonListFixture,
} from '../../../services/supabase/seasonFixtureListModel'

/**
 * ACQUIRE ONE FIXTURE AND ITS CONTEXT, ADDRESSED BY THE FIXTURE ID ALONE.
 *
 * ============================ THE ADDRESSABILITY PROPERTY =================
 *
 * The fixture read starts from the FIXTURE ID and nothing else, and it does not
 * wait for the season context: contract 148 needs no tournament, no date and no
 * window. That is what makes a deep refresh resolve the same fixture, and what
 * makes a shared link work for a match outside any default window.
 *
 * The season context is fetched IN PARALLEL, and only for the season LABEL and
 * for whether the player can be sent to the Match Predictor. If it fails, the
 * page still draws the match — a Match Centre that could not open because a
 * second read failed would have thrown away the whole point of contract 148.
 *
 * ============================ FOUR READS, AND THE ONE DEPENDENCY ==========
 *
 *   1. contract 148, the fixture              — required, starts immediately
 *   1. contract 121, the play context         — parallel, optional
 *   2. contract 141, the season's club form   — needs the tournament id
 *   2. contract 160, the competition's table  — needs the tournament id
 *   3. contract 141, this pair's meetings     — needs BOTH team ids
 *
 * The meetings read is the only genuine chain, and the reason is structural
 * rather than lazy: `get_season_club_head_to_head` is addressed by two TEAM
 * IDS, and contract 148 sends club NAMES. The ids come from the form read, so
 * the join is by name on `public.teams.name` — the same column of the same
 * rows, which is why it is an equality on one source of truth rather than a
 * fuzzy match. `SeasonMatchCentreRoute` records the same reasoning for the same
 * join.
 *
 * ONE FIXTURE, ONE HEAD-TO-HEAD REQUEST. §20 permits exactly that here and
 * forbids it in a list, and the list's model has no field for it.
 *
 * ============================ EVERY ENRICHMENT FAILS ALONE ================
 *
 * `Promise.allSettled`, not `Promise.all`: one rejection in an `all` would
 * discard three good answers. A failed table costs the page its table and
 * nothing else.
 */

export type VNextMatchCentreSourceState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** The server refused the fixture, or it does not exist. A real answer. */
  | { status: 'notFound' }
  | { status: 'failed'; retry: () => void }
  | { status: 'ready'; source: MatchCentreSource; retry: () => void }

export type VNextMatchCentreSourceInput = {
  readonly userId: string | null
  readonly authLoading: boolean
  /** THE CANONICAL FIXTURE ID. The only thing this page is addressed by. */
  readonly fixtureId: string | undefined
  /**
   * The competition the player navigated from, for the season label and the
   * predictor link. OPTIONAL, because the fixture resolves without it.
   */
  readonly competitionSlug?: string | undefined
  readonly seasonSlug?: string | undefined
  /** Whether the host can act on a Match Predictor link at all. */
  readonly predictorReachable?: boolean | undefined
  /**
   * The Match Predictor's `game_competition_id` in this season, which is what
   * private leagues hang off. Null where the reader has not joined the game.
   *
   * THE THREE SOCIAL MODULES ARE OFF WITHOUT IT, and that is correct rather
   * than degraded: a reader who is not in the Match Predictor has no card, no
   * leagues inside it and nothing to compare. The page is still the fixture.
   */
  readonly gameCompetitionId?: string | null | undefined
}

type RequestIdentity = string

/**
 * WHICH REQUEST A PAYLOAD ANSWERS — every input that ADDRESSES one of the reads.
 *
 * The fixture id addresses contract 148, the two slugs address the play context
 * that supplies the season label, and `predictorReachable` decides whether the
 * Match Predictor link is produced. It used to key on the user and the fixture
 * alone, so a competition-context change left the stored payload's identity
 * still matching: for exactly one render the memo returned `ready` with the
 * PREVIOUS season label and predictor link. An effect cannot help — it runs
 * after the render that changed the inputs — and one render is enough to paint.
 *
 * `useVNextMatchesSource` states the same rule at length and follows it; this
 * one now does too.
 *
 * JSON rather than a joined string, because a slug is user-visible text and a
 * separator can appear inside one: `a|b` and `a` + `|b` must not collide.
 */
function requestIdentity(input: {
  userId: string
  fixtureId: string
  competitionSlug: string | undefined
  seasonSlug: string | undefined
  predictorReachable: boolean
}): RequestIdentity {
  return JSON.stringify([
    input.userId,
    input.fixtureId,
    input.competitionSlug ?? null,
    input.seasonSlug ?? null,
    input.predictorReachable,
  ])
}

type InternalState =
  | { status: 'idle' }
  | { status: 'failed'; identity: RequestIdentity }
  | { status: 'notFound'; identity: RequestIdentity }
  | { status: 'loaded'; identity: RequestIdentity; payload: MatchCentreSource }

const IDLE: InternalState = { status: 'idle' }

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null
}

export function useVNextMatchCentreSource(
  input: VNextMatchCentreSourceInput,
): VNextMatchCentreSourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  const { userId, authLoading, fixtureId, competitionSlug, seasonSlug } = input
  const gameCompetitionId = input.gameCompetitionId ?? null
  const predictorReachable = input.predictorReachable ?? false

  useEffect(() => {
    if (authLoading || !userId || !fixtureId) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = requestIdentity({
      userId,
      fixtureId,
      competitionSlug,
      seasonSlug,
      predictorReachable,
    })
    let active = true
    setState((current) => (current.status === 'idle' ? current : IDLE))

    void (async () => {
      try {
        const [{ fetchSeasonFixture }, { createSeasonPlayContextGateway }] = await Promise.all([
          import('../../../services/supabase/seasonFixtureList'),
          import('../../../services/supabase/seasonPlayContext'),
        ])

        // THE FIXTURE AND THE CONTEXT GO OUT TOGETHER. The fixture does not
        // wait for a season it does not need.
        const [answer, context] = await Promise.allSettled([
          fetchSeasonFixture(fixtureId),
          competitionSlug && seasonSlug
            ? createSeasonPlayContextGateway().load(competitionSlug, seasonSlug)
            : Promise.resolve(null),
        ])
        if (!active) return

        // The server REFUSES a fixture that does not exist or belongs to the
        // tournament shape, so a rejection here is a real answer: this match
        // cannot be opened. It is not "something went wrong".
        if (answer.status === 'rejected') {
          setState({ status: 'notFound', identity })
          return
        }
        const fixture = answer.value.fixture
        if (fixture === null) {
          setState({ status: 'notFound', identity })
          return
        }

        const tournamentId = settled(context)?.tournamentId ?? null
        const seasonLabel = settled(context)?.seasonLabel ?? null

        // WAVE TWO. Both addressed by the tournament id, both allowed to fail.
        const [form, table] = await Promise.allSettled([
          tournamentId === null
            ? Promise.resolve(null)
            : import('../../../services/supabase/seasonClubForm').then((module) =>
                module.fetchSeasonClubForm(tournamentId),
              ),
          tournamentId === null
            ? Promise.resolve(null)
            : import('../../../services/supabase/competitionTable').then((module) =>
                module.fetchCompetitionTable(tournamentId),
              ),
        ])
        if (!active) return

        const clubForm = settled(form)
        const homeId = clubForm?.clubs.find((club) => club.name === fixture.home.name)?.teamId ?? null
        const awayId = clubForm?.clubs.find((club) => club.name === fixture.away.name)?.teamId ?? null

        // WAVE THREE. ONE call, for this pair, on this page only.
        const headToHead =
          tournamentId === null || homeId === null || awayId === null
            ? null
            : await import('../../../services/supabase/seasonClubForm')
                .then((module) =>
                  module.fetchSeasonClubHeadToHead(tournamentId, homeId, awayId),
                )
                .catch(() => null)
        if (!active) return

        /* ------------------------------------------------------------------
           WAVE FOUR — THE THREE SOCIAL SCOPES.
           ------------------------------------------------------------------

           LAST, AND ALL SETTLED INDEPENDENTLY. The fixture, its table and its
           head-to-head are what the page is ABOUT; these are what it means for
           the reader. Ordering them after means a slow league read cannot hold
           up the match itself, and settling them independently means a failed
           one costs its own module and nothing else.

           NOTHING RUNS AT ALL WITHOUT A GAME COMPETITION. A reader who has not
           joined the Match Predictor has no card, no leagues inside it and
           nothing to compare — so the reads are not issued rather than issued
           and refused.

           THE LEAGUE FAN-OUT IS BOUNDED BY THE READER'S OWN LEAGUES, which is
           the same bound the production Match Centre uses. It is a page about
           one fixture, so this is per-page and never per-row: `MatchListItem`
           has no field for any of it, which is what stops a list starting.
        */
        const social = await loadSocialScopes({
          gameCompetitionId: gameCompetitionId ?? null,
          tournamentId,
          fixture,
          competition: answer.value.competition,
          seasonLabel,
        })
        if (!active) return

        setState({
          status: 'loaded',
          identity,
          payload: {
            // The one legitimate clock read on this path, stamped once.
            generatedAt: new Date().toISOString(),
            fixture,
            competition: answer.value.competition,
            seasonLabel,
            colours: null,
            serverNow: answer.value.serverNow,
            clubForm,
            table: settled(table),
            headToHead,
            // Offered only where the host can act on it, and only for a player
            // whose competition context actually resolved.
            predictorReachable: predictorReachable && tournamentId !== null,
            you: social.you,
            leagues: social.leagues,
            everyone: social.everyone,
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
    fixtureId,
    competitionSlug,
    seasonSlug,
    predictorReachable,
    gameCompetitionId,
    nonce,
  ])

  return useMemo<VNextMatchCentreSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }
    if (!fixtureId) return { status: 'notFound' }

    const identity = requestIdentity({
      userId,
      fixtureId,
      competitionSlug,
      seasonSlug,
      predictorReachable,
    })
    if (state.status === 'idle' || state.identity !== identity) return { status: 'loading' }
    if (state.status === 'failed') return { status: 'failed', retry }
    if (state.status === 'notFound') return { status: 'notFound' }

    return { status: 'ready', source: state.payload, retry }
  }, [
    state,
    authLoading,
    userId,
    fixtureId,
    competitionSlug,
    seasonSlug,
    predictorReachable,
    retry,
  ])
}

/* ==========================================================================
   THE THREE SOCIAL SCOPES, ACQUIRED
   ==========================================================================

   ONE FUNCTION, THREE INDEPENDENT ANSWERS, AND NO SHARED FAILURE. Every read
   here is caught on its own, and none of them can reject the whole page: the
   fixture has already resolved by the time this runs, and it is what the page
   is about.

   EVERY PRESENTATION DECISION IS THE EXISTING AUTHORITY'S. `presentMatchCentre`
   and `presentLeagueFixture` are imported rather than reimplemented, so vNext
   and the surface it replaces cannot disagree about what a fixture was worth,
   what a co-member predicted or whether the server revealed it.
   ========================================================================== */

type SocialScopes = {
  readonly you: MatchCentreSource['you']
  readonly leagues: MatchCentreSource['leagues']
  readonly everyone: MatchCentreSource['everyone']
}

const NO_SOCIAL: SocialScopes = { you: null, leagues: null, everyone: null }

/** The server's refusal for a caller who has not joined the game. */
function isNotAnEntrant(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === '42501' || code === 'insufficient_privilege'
}

async function loadSocialScopes(options: {
  readonly gameCompetitionId: string | null
  readonly tournamentId: string | null
  readonly fixture: SeasonListFixture
  readonly competition: SeasonFixtureCompetition
  readonly seasonLabel: string | null
}): Promise<SocialScopes> {
  const { gameCompetitionId, tournamentId, fixture } = options
  // NOT ISSUED RATHER THAN ISSUED AND REFUSED. Without a game competition there
  // is no card, no league inside it and nothing to compare.
  if (gameCompetitionId === null || tournamentId === null) return NO_SOCIAL

  const [{ presentMatchCentre }, { presentLeagueFixture }, { presentFixture }] = await Promise.all([
    import('../../../features/season/matchCentreModel'),
    import('../../../features/season/leagueFixtureModel'),
    import('../../../features/season/fixtureListModel'),
  ])

  const matchweek = fixture.round.ordinal
  const row = presentFixture(fixture, options.competition.timeZone).row

  const [card, leagues, consensus] = await Promise.allSettled([
    import('../../../services/supabase/seasonMatchPredictor').then((module) =>
      module
        .createSeasonMatchPredictorRpcGateway({
          tournamentId,
          competitionName: options.competition.name,
          seasonLabel: options.seasonLabel ?? '',
          timeZone: options.competition.timeZone ?? 'UTC',
          // THE GATEWAY'S CLOCK IS FOR ITS OWN OPTIMISTIC BOOKKEEPING AND
          // DECIDES NOTHING HERE: this page reads the card and writes nothing,
          // and every lock, reveal and settlement on it is the server's.
          now: () => new Date(),
        })
        .load(matchweek),
    ),
    import('../../../services/supabase/gameLeagues').then((module) =>
      module.fetchMyGameLeagues(gameCompetitionId),
    ),
    import('../../../services/supabase/seasonConsensus').then((module) =>
      module.fetchSeasonConsensus(tournamentId, matchweek),
    ),
  ])

  const you: MatchCentreSource['you'] =
    card.status === 'fulfilled'
      ? { kind: 'ok', view: presentMatchCentre(row, card.value) }
      : isNotAnEntrant(card.reason)
        ? { kind: 'not-playing' }
        : { kind: 'failed' }

  // THE ROUND ID THE LEAGUE READ IS ADDRESSED BY. Contract 149 takes a league
  // and a competition round, and the fixture already carries its own round.
  const roundId = fixture.round.id

  const leaguePanels: MatchCentreSource['leagues'] =
    leagues.status !== 'fulfilled'
      ? // THE LIST ITSELF FAILED, so there is nothing to name. `null` is "the
        // module did not load", which the surface draws as nothing rather than
        // as "you are in no leagues" — a sentence that would be a claim.
        null
      : await Promise.all(
          leagues.value.map(async (league) => {
            const view = await import('../../../services/supabase/seasonLeaguePredictions')
              .then((module) =>
                module.fetchSeasonLeagueMatchweekPredictions(league.id, roundId),
              )
              .then((page) => presentLeagueFixture(page, fixture.id))
              .catch(() => null)
            return { leagueId: league.id, leagueName: league.name, view }
          }),
        )

  const everyone: MatchCentreSource['everyone'] =
    consensus.status !== 'fulfilled'
      ? { kind: 'failed' }
      : {
          kind: 'ok',
          suppressed: consensus.value.suppressed,
          minimumEntries: consensus.value.minimumEntries,
          submittedEntries: consensus.value.submittedEntries,
          fixture:
            consensus.value.fixtures.find((entry) => entry.id === fixture.id) ?? null,
        }

  return { you, leagues: leaguePanels, everyone }
}
