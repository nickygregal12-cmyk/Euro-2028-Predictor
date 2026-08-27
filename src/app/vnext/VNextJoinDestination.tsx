import { Navigate, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { AuthSplash } from '../../features/auth/AuthSplash'
import { useInviteLanding } from '../../features/leagues/useInviteLanding'
import type { InviteJoinResult } from '../../features/leagues/useInviteCode'
import { fetchHubMembership } from '../../services/supabase/competitionGames'
import { isActiveMembership } from '../../services/supabase/competitionGamesModel'
import { fetchMyGameLeagues } from '../../services/supabase/gameLeagues'
import { fetchPublishedWeeklySeasons } from '../../services/supabase/weeklyCatalogue'
import { VNextInviteScreen } from '../../vnext/integration/invite/VNextInviteScreen'
import { competitionSectionRoute, weeklyRoutes } from '../weeklyRoutes'
import { resolvePrivateCompetitionHref } from './privateCompetitionRoute'
import { useViewerFormatting } from './seam'
import { VNextAppRoot } from './VNextAppRoot'
import { VNextSurfaceBoundary } from './VNextSurfaceBoundary'

/**
 * THE INVITE DEEP LINK, `/join/:code`, IN THE PRODUCT IT LEADS INTO.
 *
 * The join itself remains wholly `useInviteCode`'s: the server decides whether
 * a code is a league or private competition and which write accepts it. This
 * destination only answers the post-success routing question for shipping
 * vNext. Private containers are rediscovered after the write before any exact
 * instance address is used; if the authoritative reads cannot answer, the
 * established conservative landing remains the fallback.
 *
 * IT CARRIES ITS OWN BOUNDARY BECAUSE IT IS OUTSIDE THE SEAM. `VNextSeamLayout`
 * holds one `VNextSurfaceBoundary` above the twelve competition destinations,
 * and this address is registered outside it — handling the signed-out case is
 * the whole job here, so it cannot sit under `RequireWelcome`. Without one, a
 * throw on the address that is most new players' FIRST contact with this product
 * would take the whole application down rather than one page of it.
 *
 * The boundary is the OUTER component and the work is the inner one,
 * deliberately: `useInviteLanding` runs before any element is returned, so a
 * boundary rendered from inside that function could not catch the hook that
 * produced the failure.
 */
export function VNextJoinDestination() {
  return (
    <VNextSurfaceBoundary>
      <VNextJoinDestinationContent />
    </VNextSurfaceBoundary>
  )
}

function VNextJoinDestinationContent() {
  useViewerFormatting()
  const { code } = useParams<{ code: string }>()
  const { userId, loading } = useAuth()
  const navigate = useNavigate()
  const landing = useInviteLanding(code)

  if (landing.kind === 'checking') return <AuthSplash />
  if (landing.kind === 'sign-up') return <Navigate to="/auth/signup" replace />

  const landOn = landing.landOn
  const onJoined = (joined: InviteJoinResult) => {
    if (joined.kind === 'league') {
      // DO NOT USE THE SHELL CACHE AS POST-WRITE PROOF. A player may have joined
      // Match Predictor seconds earlier while following this invite, and the
      // long-lived shell provider can still hold its pre-join membership answer.
      // Re-read the published seasons and their server-owned game memberships,
      // then use the same game-scoped league read as vNext Leagues. The exact
      // route is therefore derived from current server state, never from invite
      // display copy and never from mutation optimism.
      void (async () => {
        try {
          const published = await fetchPublishedWeeklySeasons()
          const memberships = await fetchHubMembership(
            published.map((season) => season.seasonName),
          )
          const publishedBySeasonId = new Map(
            published.map((season) => [season.seasonId, season] as const),
          )
          const candidates = memberships.flatMap((membership) => {
            const season = publishedBySeasonId.get(membership.tournamentId)
            if (!season) return []
            return membership.seasonGames.games
              .filter(
                (game) =>
                  game.gameKey === 'main_predictor' && isActiveMembership(game),
              )
              .map((game) => ({ gameId: game.id, season }))
          })

          const results = await Promise.allSettled(
            candidates.map(async (candidate) => ({
              candidate,
              leagues: await fetchMyGameLeagues(candidate.gameId),
            })),
          )
          const match = results.find(
            (result) =>
              result.status === 'fulfilled' &&
              result.value.leagues.some((league) => league.id === joined.leagueId),
          )
          if (!match || match.status !== 'fulfilled') {
            landOn(joined)
            return
          }

          const href = competitionSectionRoute(
            {
              competitionSlug: match.value.candidate.season.competitionSlug,
              seasonSlug: match.value.candidate.season.seasonKey,
            },
            'leagues',
          )
          navigate(`${href}?league=${encodeURIComponent(joined.leagueId)}`, {
            replace: true,
          })
        } catch {
          landOn(joined)
        }
      })()
      return
    }

    if (joined.competitionId === null) {
      landOn(joined)
      return
    }

    void resolvePrivateCompetitionHref(joined.competitionId)
      .then((href) => {
        if (href === null) landOn(joined)
        else navigate(href, { replace: true })
      })
      .catch(() => landOn(joined))
  }

  return (
    <VNextAppRoot>
      <VNextInviteScreen
        userId={userId}
        authLoading={loading}
        code={code}
        // A pre-join LEAGUE invite deliberately exposes no competition id or
        // slug (contract 159), so this route cannot truthfully manufacture a
        // Match Predictor address. Discovery is the existing public authority
        // that lets the player choose the season the invite names, join its
        // game, then reopen the same code. This keeps the prerequisite control
        // useful without leaking or guessing private addressing state.
        onOpenGame={() => navigate(weeklyRoutes.competitions)}
        // THE ATTENTION LAYER IS DELIBERATELY ABSENT. This address is commonly
        // a new player's first signed-in page and should not pay every
        // cross-competition attention read before the invitation itself lands.
        onJoined={onJoined}
        onGoHome={() => navigate(weeklyRoutes.hub, { replace: true })}
      />
    </VNextAppRoot>
  )
}
