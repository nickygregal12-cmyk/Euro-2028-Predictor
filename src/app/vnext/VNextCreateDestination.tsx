import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { inviteUrl } from '../../features/leagues/share'
import { usePlayerCompetitions } from '../providers/PlayerCompetitionsProvider'
import { VNextCreateScreen } from '../../vnext/integration/create/VNextCreateScreen'
import type { CreatedPrivatePlay } from '../../vnext/models/createPrivatePlay'
import {
  competitionChampionshipInstanceRoute,
  competitionSectionRoute,
  type CompetitionRouteRef,
} from '../weeklyRoutes'
import { competitionPrivateLmsRoute } from './privateCompetitionRoute'
import { VNextAppRoot } from './VNextAppRoot'
import { useShellIntentNavigation, useViewerFormatting } from './seam'

/**
 * CREATE PRIVATE PLAY, at `/competitions/:c/:s/games/create`.
 *
 * The screen owns no routing rules. This boundary turns an authoritatively
 * verified create into the destination the application already has for that
 * storage model and composes invite links through the shared invite authority.
 */
export function VNextCreateDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug } = useParams()
  const { userId, loading } = useAuth()
  const { status, player, reload } = usePlayerCompetitions()
  const onShellIntent = useShellIntentNavigation()
  const navigate = useNavigate()

  const ref: CompetitionRouteRef | null =
    competitionSlug === undefined || seasonSlug === undefined
      ? null
      : { competitionSlug, seasonSlug }

  const shareUrlFor = useCallback((code: string) => inviteUrl(code), [])

  const onOpenCreated = useCallback(
    (created: CreatedPrivatePlay) => {
      if (ref === null) return
      switch (created.game) {
        case 'match-predictor': {
          // An ordinary private league is a scope inside the competition's
          // Leagues surface; it has no standalone `/leagues/:id` route. Carry
          // the server-confirmed id as the scope query so "Open it" opens the
          // thing the player just made rather than merely the season table.
          const href = competitionSectionRoute(ref, 'leagues')
          navigate(`${href}?league=${encodeURIComponent(created.containerId)}`)
          return
        }
        case 'last-man-standing':
          // The public LMS reader deliberately resolves only the public season
          // instance. The private id therefore travels in the canonical LMS
          // route query and is consumed by the integration adapter, which uses
          // the caller-addressed private workspace instead.
          navigate(competitionPrivateLmsRoute(ref, created.containerId))
          return
        default:
          // Championship already has an instance-addressed route, so retain the
          // id that the authoritative reread confirmed and open that instance.
          navigate(competitionChampionshipInstanceRoute(ref, created.containerId))
      }
    },
    [navigate, ref],
  )

  const onJoinCode = useCallback(
    (code: string) => {
      // `/join/:code` owns every answer about a code, including deliberately
      // indistinguishable refusals. Nothing here inspects it.
      navigate(`/join/${encodeURIComponent(code)}`)
    },
    [navigate],
  )

  const onLeave = useCallback(() => {
    if (ref === null) return
    navigate(competitionSectionRoute(ref, 'games'))
  }, [navigate, ref])

  const onRetry = useCallback(() => reload(), [reload])

  return (
    <VNextAppRoot>
      <VNextCreateScreen
        userId={userId}
        authLoading={loading}
        player={player}
        loading={status === 'loading'}
        failed={status === 'failed'}
        onRetry={onRetry}
        onShellIntent={onShellIntent}
        onLeave={onLeave}
        onOpenCreated={onOpenCreated}
        shareUrlFor={shareUrlFor}
        onJoinCode={onJoinCode}
      />
    </VNextAppRoot>
  )
}
