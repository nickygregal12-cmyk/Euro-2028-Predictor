import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { inviteUrl } from '../../features/leagues/share'
import { usePlayerCompetitions } from '../providers/PlayerCompetitionsProvider'
import { VNextCreateScreen } from '../../vnext/integration/create/VNextCreateScreen'
import type { CreatedPrivatePlay } from '../../vnext/models/createPrivatePlay'
import {
  competitionGameRoute,
  competitionSectionRoute,
  type CompetitionRouteRef,
} from '../weeklyRoutes'
import { VNextAppRoot } from './VNextAppRoot'
import { useShellIntentNavigation, useViewerFormatting } from './seam'

/**
 * CREATE PRIVATE PLAY, at `/competitions/:c/:s/games/create`.
 *
 * ============================ THE GAP THIS CLOSES =======================
 *
 * The legacy product has a complete create journey and vNext had none, so the
 * only way to start a private league from the new product was to leave it. The
 * Leagues surface says so in its own source, beside the sentence a player
 * reads: *"a button here would be a door onto a corridor that has not been
 * built."*
 *
 * ============================ WHAT THIS FILE DOES =======================
 *
 * Three things, and none of them is a rule: it supplies the membership read the
 * corridor decides from, it turns a finished create into a URL, and it composes
 * the share link. `presentCreateJourney` decides what may be created — the same
 * function the legacy journey calls — and the screen calls the same three
 * creators.
 *
 * ============================ AND THE SHARE LINK IS NOT COMPOSED HERE ===
 *
 * `inviteUrl` is the repository's one answer for "what URL is this code", and
 * the legacy invite panel uses it. A second `${origin}/join/${code}` here would
 * be a second opinion about the invite address, and the first one to drift
 * would be the one somebody had already sent to a friend.
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
      // WHERE A CONTAINER OPENS IS THE GAME'S OWN ANSWER. A private league is a
      // SCOPE inside Leagues — Stage 9's finding, and the reason there is no
      // `/leagues/:id` — while a private Last Man Standing or Championship is a
      // competition of its own and opens at its game.
      switch (created.game) {
        case 'match-predictor':
          navigate(competitionSectionRoute(ref, 'leagues'))
          return
        case 'last-man-standing':
          navigate(competitionGameRoute(ref, 'lms'))
          return
        default:
          navigate(competitionGameRoute(ref, 'championship'))
      }
    },
    [navigate, ref],
  )

  const onJoinCode = useCallback(
    (code: string) => {
      // `/join/:code` OWNS EVERY ANSWER ABOUT A CODE, including the refusals it
      // deliberately makes indistinguishable. Nothing here inspects it.
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
