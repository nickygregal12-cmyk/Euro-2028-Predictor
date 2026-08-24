import { useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { buildAdminSupportHref } from '../../features/account/accountSupport'
import { useHapticsPreference } from '../providers/HapticsProvider'
import { useTheme } from '../providers/ThemeProvider'
import { useSite } from '../site/SiteProvider'
import { useSeasonWeekMemberships } from '../../features/hub/useSeasonWeekMemberships'
import { useSeasonGameCompetitionId } from '../../features/hub/useSeasonGameCompetitionId'
import { useWatchedRivals } from './useWatchedRivals'
import { VNextHomeScreen } from '../../vnext/integration/home/VNextHomeScreen'
import { VNextGamesScreen } from '../../vnext/integration/games/VNextGamesScreen'
import { VNextLeaguesScreen } from '../../vnext/integration/leagues/VNextLeaguesScreen'
import { VNextPlayerProfileScreen } from '../../vnext/integration/playerProfile/VNextPlayerProfileScreen'
import { VNextDiscoveryScreen } from '../../vnext/integration/discovery/VNextDiscoveryScreen'
import { VNextAccountScreen } from '../../vnext/integration/account/VNextAccountScreen'
import type { AccountIntent } from '../../vnext/account/VNextAccount'
import { VNextPredictorScreen } from '../../vnext/integration/predictor/VNextPredictorScreen'
import { VNextLmsScreen } from '../../vnext/integration/lms/VNextLmsScreen'
import { VNextPrivateLmsScreen } from '../../vnext/integration/lms/VNextPrivateLmsScreen'
import { VNextChampionshipScreen } from '../../vnext/integration/championship/VNextChampionshipScreen'
import {
  competitionCreatePrivatePlayRoute,
  competitionGameRoute,
  competitionPlayerRoute,
  competitionRoute,
  competitionSeasonWrappedRoute,
} from '../weeklyRoutes'
import { homeIntentRoute } from './homeNavigation'
import { useShellIntentNavigation, useViewerFormatting } from './seam'
import { VNextAppRoot } from './VNextAppRoot'

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
  const navigate = useNavigate()
  const onShellIntent = useShellIntentNavigation()
  const gameCompetitionId = useSeasonGameCompetitionId(
    competitionSlug,
    seasonSlug,
    'main_predictor',
  )
  // The pins the player set from a league table, so the rival strip leads with
  // the person they chose rather than with an adjacency.
  const { watchedRivalIds } = useWatchedRivals(competitionSlug, seasonSlug)
  // Which side games this player is actually in here, from the membership the
  // shell has already read. Home asks each game's own read only where this says
  // there is something of theirs to ask about.
  const { playsLms, championshipCompetitionId } = useSeasonWeekMemberships(
    competitionSlug,
    seasonSlug,
  )

  return (
    <VNextAppRoot>
      <VNextHomeScreen
        userId={userId}
        displayName={displayName}
        watchedRivalIds={watchedRivalIds}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        gameCompetitionId={gameCompetitionId}
        playsLms={playsLms}
        championshipCompetitionId={championshipCompetitionId}
        onShellIntent={onShellIntent}
        onIntent={(intent) => {
          if (competitionSlug === undefined || seasonSlug === undefined) return
          navigate(homeIntentRoute({ competitionSlug, seasonSlug }, intent))
        }}
      />
    </VNextAppRoot>
  )
}

/*
 * HOME'S PRIMARY ACTION IS PAGE CONTENT, NOT SHELL NAVIGATION.
 *
 * The shell still owns Home / Matches / Games / Leagues and competition
 * switching. Home's own action can promise an exact Match Centre, which needs
 * a canonical fixture id the shell deliberately does not model. The page emits
 * one route-agnostic Home intent and this application adapter turns it into the
 * existing address — the same boundary `VNextMatchesDestination` uses.
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
    <VNextAppRoot>
      <VNextGamesScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        onShellIntent={onShellIntent}
        onIntent={(intent) => {
          if (competitionSlug === undefined || seasonSlug === undefined) return
          if (intent.kind === 'create-private-play') {
            navigate(competitionCreatePrivatePlayRoute({ competitionSlug, seasonSlug }))
            return
          }
          if (intent.kind !== 'open-game') return
          const route = GAME_ADDRESSES[intent.gameKey]
          if (route === undefined) return
          navigate(competitionGameRoute({ competitionSlug, seasonSlug }, route))
        }}
      />
    </VNextAppRoot>
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
  const { watchedRivalIds, watch } = useWatchedRivals(competitionSlug, seasonSlug)

  return (
    <VNextAppRoot>
      <VNextLeaguesScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        gameCompetitionId={gameCompetitionId}
        selectedLeagueId={search.get('league')}
        gameName="Match Predictor"
        watchedRivalIds={watchedRivalIds}
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

          // WATCHING IS A WRITE AND NOT A NAVIGATION, so it is handled before
          // the route guard below: it needs no slugs of its own, because the
          // preference is keyed on the competition the shell already resolved.
          if (intent.kind === 'watch-player') {
            void watch(intent.playerId, intent.watched)
            return
          }

          if (competitionSlug === undefined || seasonSlug === undefined) return

          // THE TWO WAYS OUT OF THE EMPTY STATE, which Stage 9 left as a
          // sentence because the corridor did not exist. Creating is an
          // address; joining is `/join/:code`, and the code is the invite's,
          // so the corridor asks for it rather than this destination guessing.
          if (intent.kind === 'create-private-play') {
            navigate(competitionCreatePrivatePlayRoute({ competitionSlug, seasonSlug }))
            return
          }
          if (intent.kind === 'join-with-code') {
            navigate(competitionCreatePrivatePlayRoute({ competitionSlug, seasonSlug }))
            return
          }

          // THE REF IS THE ADDRESS. Contract 206 made the season reference the
          // identity a profile is opened by, and it is the only one the
          // same-season boundary reveals.
          navigate(
            competitionPlayerRoute({ competitionSlug, seasonSlug }, intent.playerRef) +
              (intent.playerId === null ? '' : `?playerId=${encodeURIComponent(intent.playerId)}`),
          )
        }}
      />
    </VNextAppRoot>
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
    <VNextAppRoot>
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
    </VNextAppRoot>
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
    <VNextAppRoot>
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
    </VNextAppRoot>
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
  const { userId, loading, displayName, signOut, refreshProfile } = useAuth()
  const onShellIntent = useShellIntentNavigation()
  const navigate = useNavigate()
  const site = useSite()
  const { choice, setChoice } = useTheme()
  const { preference, setPreference } = useHapticsPreference()

  // `buildAdminSupportHref` returns null for an unset or malformed address,
  // which is what produces the surface's STATED ABSENCE rather than a dead
  // link. The account's own address is not threaded in: the page reads it for
  // itself and the host does not have it, which is the same shape the `/dev`
  // harness has always had.
  const supportHref = useMemo(
    () => buildAdminSupportHref(import.meta.env.VITE_SUPPORT_EMAIL, null, site.brand.productName),
    [site.brand.productName],
  )

  const onIntent = useCallback(
    (intent: AccountIntent) => {
      switch (intent.kind) {
        case 'set-theme':
          setChoice(intent.theme)
          return
        case 'set-haptics':
          setPreference(intent.haptics)
          return
        case 'open-season':
          navigate(
            competitionRoute({
              competitionSlug: intent.competitionSlug,
              // `seasonKey` IS the season's route segment. Contract 161 names
              // it a key because it is one; the router calls the same value a
              // slug.
              seasonSlug: intent.seasonKey,
            }),
          )
          return
        case 'open-wrapped':
          // THE RECORD OF HOW A SEASON ENDED, which is a different place from
          // the season as it is now.
          navigate(
            competitionSeasonWrappedRoute({
              competitionSlug: intent.competitionSlug,
              seasonSlug: intent.seasonKey,
            }),
          )
          return
        default:
          // NOTHING IS NAVIGATED AFTER SIGN-OUT. Return the command so the
          // Account page can keep a failed cleanup visible and retryable.
          // `AuthProvider` clears the session and `RequireAuth` answers the
          // next render, which is one authority deciding where a signed-out
          // visitor goes rather than two.
          return signOut()
      }
    },
    [navigate, setChoice, setPreference, signOut],
  )

  return (
    <VNextAppRoot>
      <VNextAccountScreen
        userId={userId}
        authLoading={loading}
        displayName={displayName}
        theme={choice}
        haptics={preference}
        supportHref={supportHref}
        onIntent={onIntent}
        // The auth provider caches the display name and holds the session's
        // pending email. A change made here has to reach both, or the shell
        // above goes on greeting the player by the name they just replaced.
        onSaved={refreshProfile}
        onShellIntent={onShellIntent}
      />
    </VNextAppRoot>
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
    <VNextAppRoot>
      <VNextPredictorScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        matchweek={matchweek}
        onShellIntent={onShellIntent}
      />
    </VNextAppRoot>
  )
}

/**
 * LAST MAN STANDING, at `/competitions/:c/:s/games/lms`.
 *
 * The optional `competition=<id>` query is an APPLICATION ADDRESS concern:
 * absent means the public season LMS; present means one caller-addressed
 * private LMS instance. Dispatch happens here, before either connected source
 * hook mounts, so the public read never receives a private competition id.
 */
export function VNextLmsDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug } = useParams()
  const { userId, loading } = useAuth()
  const [search] = useSearchParams()
  const onShellIntent = useShellIntentNavigation()
  const privateCompetitionId = search.get('competition')?.trim() ?? ''

  return (
    <VNextAppRoot>
      {privateCompetitionId.length > 0 ? (
        <VNextPrivateLmsScreen
          userId={userId}
          authLoading={loading}
          competitionSlug={competitionSlug}
          seasonSlug={seasonSlug}
          privateCompetitionId={privateCompetitionId}
          onShellIntent={onShellIntent}
        />
      ) : (
        <VNextLmsScreen
          userId={userId}
          authLoading={loading}
          competitionSlug={competitionSlug}
          seasonSlug={seasonSlug}
          gameName="Last Man Standing"
          onShellIntent={onShellIntent}
        />
      )}
    </VNextAppRoot>
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
    <VNextAppRoot>
      <VNextChampionshipScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        championshipId={championshipId}
        gameName="Predictor Championship"
        onShellIntent={onShellIntent}
      />
    </VNextAppRoot>
  )
}
