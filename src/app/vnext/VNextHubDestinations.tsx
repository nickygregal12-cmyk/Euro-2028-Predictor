import { useSearchParams, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { useSeasonGameCompetitionId } from '../../features/hub/useSeasonGameCompetitionId'
import { VNextRoot } from '../../vnext/foundations/VNextRoot'
import { VNextHomeScreen } from '../../vnext/integration/home/VNextHomeScreen'
import { VNextGamesScreen } from '../../vnext/integration/games/VNextGamesScreen'
import { VNextLeaguesScreen } from '../../vnext/integration/leagues/VNextLeaguesScreen'
import { VNextPlayerProfileScreen } from '../../vnext/integration/playerProfile/VNextPlayerProfileScreen'
import { VNextDiscoveryScreen } from '../../vnext/integration/discovery/VNextDiscoveryScreen'
import { VNextAccountScreen } from '../../vnext/integration/account/VNextAccountScreen'
import { VNextPredictorScreen } from '../../vnext/integration/predictor/VNextPredictorScreen'
import { VNextLmsScreen } from '../../vnext/integration/lms/VNextLmsScreen'
import { VNextChampionshipScreen } from '../../vnext/integration/championship/VNextChampionshipScreen'
import {
  competitionGameRoute,
  competitionPlayerRoute,
  competitionRoute,
} from '../weeklyRoutes'
import { useShellIntentNavigation, useViewerFormatting } from './seam'

/**
 * THE REST OF THE COMPETITION DECK, AT ITS REAL ADDRESSES.
 *
 * ============================ WHAT THIS IS, AND IS NOT ====================
 *
 * `VNextMatchesDestination.tsx` did this for Matches and stated the shape: the
 * gap between a `/dev` harness and a route is that a route gets its competition
 * from `useParams` and has to turn an intent into a URL. These are the other
 * destinations, on exactly those terms.
 *
 * NO READS, NO MAPPING, NO PRESENTATION. The screens own all three. If a rule
 * about Home, Games, Leagues, a profile, discovery or an account appears in
 * this file, it is in the wrong file.
 *
 * ============================ WHY IT LIVES IN `src/app` ==================
 *
 * `tests/vnext/vnextProductionBoundary.test.ts` forbids a vNext presentation
 * module from importing `/src/features/`, and these import `AuthProvider`, the
 * player's competition list and the application's route helpers. That is not a
 * loophole — it is the direction the boundary is drawn in. The application may
 * know about vNext; vNext may not know about the application.
 *
 * ============================ THE ATTENTION LAYER IS SUPPLIED ============
 *
 * Every screen below resolves `shellElsewhere` from `VNextSeamHost`, which
 * `src/App.tsx` mounts once above the routes. That is the seam the Matches
 * change named as an open follow-up, and it is why switching destination does
 * not remount the cross-competition inbox.
 */

/**
 * HOME — the competition's own front door, at `/competitions/:c/:s`.
 *
 * The route matrix's concept-defining row: this address and `/` are ONE visible
 * destination under the Competition Deck, and Home is the home of the
 * competition you are in rather than of the platform.
 */
export function VNextHomeDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug } = useParams()
  const { userId, loading, displayName } = useAuth()
  const onShellIntent = useShellIntentNavigation()
  const gameCompetitionId = useSeasonGameCompetitionId(
    competitionSlug,
    seasonSlug,
    'main_predictor',
  )

  return (
    <VNextRoot>
      <VNextHomeScreen
        userId={userId}
        displayName={displayName}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        gameCompetitionId={gameCompetitionId}
        onShellIntent={onShellIntent}
      />
    </VNextRoot>
  )
}

/*
 * HOME TAKES NO `onIntent`, AND THAT IS THE SURFACE RATHER THAN AN OVERSIGHT.
 * `VNextHomeScreen` exposes only the shell's intents: Home's own primary action
 * is drawn from the model and its navigation is the shell's. There is no
 * page-level intent to route, so this adapter passes none.
 */

/**
 * GAMES — the one surface where the three games are peers.
 *
 * `onIntent` is not passed a join. `VNextGamesScreen` performs the write itself
 * through `join_competition_game`, because the registration rules are the
 * server's and a host re-deciding them is how a Join control ends up drawn
 * against one answer and pressed against another.
 */
export function VNextGamesDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug } = useParams()
  const { userId, loading } = useAuth()
  const navigate = useNavigate()
  const onShellIntent = useShellIntentNavigation()

  return (
    <VNextRoot>
      <VNextGamesScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        onShellIntent={onShellIntent}
        onIntent={(intent) => {
          if (intent.kind !== 'open-game') return
          if (competitionSlug === undefined || seasonSlug === undefined) return
          const route = GAME_ADDRESSES[intent.gameKey]
          if (route === undefined) return
          navigate(competitionGameRoute({ competitionSlug, seasonSlug }, route))
        }}
      />
    </VNextRoot>
  )
}

/**
 * The game keys the catalogue uses, as the addresses the router knows.
 *
 * A GAME THE ROUTER DOES NOT KNOW NAVIGATES NOWHERE rather than to a guessed
 * URL. The catalogue is server-owned and can name a game this build has no page
 * for; a template string would send a player to a 404 instead of leaving them
 * where they are.
 */
const GAME_ADDRESSES: Readonly<Record<string, 'match-predictor' | 'lms' | 'championship'>> = {
  main_predictor: 'match-predictor',
  last_man_standing: 'lms',
  predictor_cup: 'championship',
}

/**
 * LEAGUES — people, inside a game, inside a competition.
 *
 * The selected league travels as `?league=`, which is what makes a private
 * table linkable and survives a refresh. Absent is the season table, which is
 * the destination's own landing scope.
 */
export function VNextLeaguesDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug } = useParams()
  const { userId, loading } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const onShellIntent = useShellIntentNavigation()
  const gameCompetitionId = useSeasonGameCompetitionId(
    competitionSlug,
    seasonSlug,
    'main_predictor',
  )

  return (
    <VNextRoot>
      <VNextLeaguesScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        gameCompetitionId={gameCompetitionId}
        selectedLeagueId={search.get('league')}
        gameName="Match Predictor"
        onShellIntent={onShellIntent}
        onIntent={(intent) => {
          if (intent.kind === 'scope') {
            // REPLACE RATHER THAN PUSH. Changing which table you are looking at
            // is not a place you should have to press "back" through five times
            // to leave the page.
            const next = new URLSearchParams(search)
            if (intent.scope.kind === 'private') next.set('league', intent.scope.leagueId)
            else next.delete('league')
            setSearch(next, { replace: true })
            return
          }
          if (competitionSlug === undefined || seasonSlug === undefined) return
          // THE REF IS THE ADDRESS. Contract 206 made the season reference the
          // identity a profile is opened by, and it is the only one the
          // same-season boundary reveals.
          navigate(
            competitionPlayerRoute({ competitionSlug, seasonSlug }, intent.playerRef) +
              (intent.playerId === null ? '' : `?playerId=${encodeURIComponent(intent.playerId)}`),
          )
        }}
      />
    </VNextRoot>
  )
}

/**
 * ONE PLAYER'S SEASON, reached from Leagues.
 *
 * The path segment is the SEASON REFERENCE rather than the account id, which is
 * contract 206's change and not a cosmetic one: the same-season boundary
 * reveals no account id at all, so a ref-addressed URL is the only one every
 * openable row can produce. Where the older shared-private-league boundary also
 * gave an account id it rides along as `?playerId=`, because contract 151's
 * profile is the fuller of the two reads and the page should use it when it may.
 */
export function VNextPlayerProfileDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug, playerId: playerRef } = useParams()
  const { userId, loading } = useAuth()
  const [search] = useSearchParams()
  const onShellIntent = useShellIntentNavigation()

  return (
    <VNextRoot>
      <VNextPlayerProfileScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        playerId={search.get('playerId') ?? undefined}
        playerRef={playerRef ?? null}
        gameName="Match Predictor"
        onShellIntent={onShellIntent}
      />
    </VNextRoot>
  )
}

/**
 * DISCOVERY — the published catalogue, at `/competitions`.
 *
 * Outside the four destinations by design: it is how a player reaches a
 * competition they are not in, which is a platform question rather than a
 * competition-scoped one.
 */
export function VNextDiscoveryDestination() {
  useViewerFormatting()
  const { userId, loading } = useAuth()
  const navigate = useNavigate()
  const onShellIntent = useShellIntentNavigation()

  return (
    <VNextRoot>
      <VNextDiscoveryScreen
        userId={userId}
        authLoading={loading}
        onShellIntent={onShellIntent}
        onOpenSeason={(season) =>
          navigate(
            competitionRoute({
              competitionSlug: season.competitionSlug,
              // `seasonKey` IS the season's route segment. The read names it a
              // key because it is one; the router calls the same value a slug.
              seasonSlug: season.seasonKey,
            }),
          )
        }
      />
    </VNextRoot>
  )
}

/**
 * ACCOUNT — the player's platform identity, deliberately outside the four.
 *
 * The migration matrix keeps it outside the tournament boundary, so it is
 * reached from the avatar rather than from the navigation and lights no
 * destination while a player is there.
 */
export function VNextAccountDestination() {
  useViewerFormatting()
  const { userId, loading, displayName } = useAuth()
  const onShellIntent = useShellIntentNavigation()

  return (
    <VNextRoot>
      <VNextAccountScreen
        userId={userId}
        authLoading={loading}
        displayName={displayName}
        onShellIntent={onShellIntent}
      />
    </VNextRoot>
  )
}

/**
 * THE MATCH PREDICTOR, at `/competitions/:c/:s/games/match-predictor`.
 *
 * The matchweek is a QUERY rather than a segment and this adapter reads it
 * exactly as the legacy route does: it is an opening position, not an identity,
 * so an absent or unparseable value opens the matchweek the application says is
 * playable rather than answering Not Found.
 */
export function VNextPredictorDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug } = useParams()
  const { userId, loading } = useAuth()
  const [search] = useSearchParams()
  const onShellIntent = useShellIntentNavigation()

  const requested = Number.parseInt(search.get('matchweek') ?? '', 10)
  const matchweek = Number.isInteger(requested) && requested > 0 ? requested : undefined

  return (
    <VNextRoot>
      <VNextPredictorScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        matchweek={matchweek}
        onShellIntent={onShellIntent}
      />
    </VNextRoot>
  )
}

/** LAST MAN STANDING, at `/competitions/:c/:s/games/lms`. */
export function VNextLmsDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug } = useParams()
  const { userId, loading } = useAuth()
  const onShellIntent = useShellIntentNavigation()

  return (
    <VNextRoot>
      <VNextLmsScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        gameName="Last Man Standing"
        onShellIntent={onShellIntent}
      />
    </VNextRoot>
  )
}

/**
 * THE PREDICTOR CHAMPIONSHIP, at `/competitions/:c/:s/games/championship/*`.
 *
 * FOUR LEGACY ADDRESSES BECAME TWO, and from the data rather than a preference:
 * the index is its own read (`get_my_season_cup_instances`) and everything
 * inside one championship comes from a SINGLE player view, so three addresses
 * over one read was a navigation habit. The wildcard's first segment is the
 * championship id; absent is the index.
 */
export function VNextChampionshipDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug, '*': rest } = useParams()
  const { userId, loading } = useAuth()
  const onShellIntent = useShellIntentNavigation()

  const championshipId = (rest ?? '').split('/').filter(Boolean)[0]

  return (
    <VNextRoot>
      <VNextChampionshipScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        championshipId={championshipId}
        gameName="Predictor Championship"
        onShellIntent={onShellIntent}
      />
    </VNextRoot>
  )
}
