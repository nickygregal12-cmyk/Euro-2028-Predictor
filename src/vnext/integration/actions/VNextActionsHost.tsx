import { useMemo, type ReactNode } from 'react'
import { usePlayerCompetitions } from '../../../app/providers/PlayerCompetitionsProvider'
import {
  VNextActionsProvider,
  type VNextShellActions,
} from '../../app/VNextActionsProvider'
import type { ActionsSourceCompetition } from './actionsSource'
import { buildActionsModel } from './buildActionsModel'
import { useVNextActionsSource } from './useVNextActionsSource'

/**
 * WHERE THE ACTION FEED IS ACTUALLY MOUNTED.
 *
 * ============================ ONCE, ABOVE THE PAGES ======================
 *
 * The read is one bounded round trip, but it is one round trip PER MOUNT — so a
 * host inside a page would re-read it on every navigation between Home, Matches,
 * Games and Leagues. This is the persistent boundary, exactly as
 * `VNextShellElsewhereHost` is for the cross-competition inbox, and for the same
 * reason.
 *
 * ============================ IT ADDS NO READ BEYOND ITS OWN =============
 *
 * `usePlayerCompetitions` is the application's existing one-read-for-the-shell
 * provider, already mounted. This host consumes it for the competition NAMES
 * rather than issuing a second membership read — the feed identifies a
 * competition by id and correctly carries no caption.
 *
 * ============================ AND EVERY SCREEN MAY IGNORE IT =============
 *
 * The value travels by context because a host cannot hand a prop to a page it
 * does not construct. A screen mounted with neither prop nor provider gets
 * `undefined`, which draws no control and no panel — the ordinary shape for a
 * story, a render test or a `/dev` harness, and not a degraded one.
 */

export type VNextActionsHostProps = {
  readonly children: ReactNode
  /**
   * Take the player to what an item is about.
   *
   * OPTIONAL, AND ABSENT IS HONEST. Where a host cannot build destinations the
   * rows draw as plain information rather than as dead controls — the same rule
   * the legacy inbox followed for a game behind a flag whose route answers Not
   * Found.
   */
  readonly onOpenItem?: VNextShellActions['onOpenItem']
}

export function VNextActionsHost({ children, onOpenItem }: VNextActionsHostProps) {
  const { player } = usePlayerCompetitions()
  // SIGNED IN IS "THE PLAYER'S COMPETITIONS HAVE RESOLVED". `get_my_actions`
  // raises on an anonymous caller, so reading before that is a guaranteed
  // failure reported as one.
  const { feed, status, markSeen, dismiss, reload } = useVNextActionsSource(player !== null)

  const competitions = useMemo<readonly ActionsSourceCompetition[]>(
    () =>
      (player?.mine ?? []).map((entry) => ({
        // THE ID THE FEED ADDRESSES A COMPETITION BY, and the name as a caption
        // beside it. Never the other way round: `tournamentId` is the join key
        // and `name` is only what the row is allowed to say.
        tournamentId: entry.competition.tournamentId,
        name: entry.competition.name,
      })),
    [player],
  )

  const value = useMemo<VNextShellActions>(
    () => ({
      model: buildActionsModel({ feed, competitions }),
      status,
      onOpen: markSeen,
      onDismiss: dismiss,
      onRetry: reload,
      onOpenItem,
    }),
    [feed, competitions, status, markSeen, dismiss, reload, onOpenItem],
  )

  return <VNextActionsProvider value={value}>{children}</VNextActionsProvider>
}
