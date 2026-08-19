import { useMemo } from 'react'
import { VNextDiscovery, type DiscoveryIntent } from '../../discovery/VNextDiscovery'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { VNextNotice } from '../../states/VNextStates'
import { buildDiscoveryModel } from './buildDiscoveryModel'
import { useVNextDiscoverySource } from './useVNextDiscoverySource'

/**
 * THE CONNECTED DISCOVERY SURFACE.
 *
 * Like Account, it is NOT inside a competition — a player discovering one is by
 * definition not in it yet — so the shell is built with no competition and the
 * page renders with `destination="none"`.
 *
 * The follow write lives in the hook and the decision about whether a control
 * may be drawn at all lives in the model. This file only chooses which state to
 * show, and passes the write's failure through as a notice rather than
 * re-wording it.
 */

export type VNextDiscoveryScreenProps = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  /**
   * The player's OTHER competitions and what is waiting in them, where the host
   * loads them. `undefined` is the one-competition shape: the shell states this
   * page's competition and says nothing about any other, which is what a
   * page-scoped host should pass. The inbox costs reads per competition, so it
   * belongs to a host that mounts it once above the pages.
   */
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
  readonly onOpenSeason?:
    | ((route: { competitionSlug: string; seasonKey: string }) => void)
    | undefined
}

export function VNextDiscoveryScreen(props: VNextDiscoveryScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const state = useVNextDiscoverySource({
    userId: props.userId,
    authLoading: props.authLoading,
  })

  const model = useMemo(
    () => (state.status === 'ready' ? buildDiscoveryModel(state.source) : null),
    [state],
  )

  const shell = useMemo(
    () =>
      buildShellModel({
        competition: null,
        playerName: null,
        outstandingPredictions: null,
        canNavigateAway: props.onShellIntent !== undefined,
            elsewhere,
      }),
    [props.onShellIntent, elsewhere],
  )

  const body =
    state.status === 'signedOut' ? (
      <VNextNotice
        destination="none"
        heading="Competitions"
        title="Sign in to browse competitions"
        body="Following a competition keeps it on your Home. It does not enter you into any of its games."
      />
    ) : model === null ? (
      <VNextNotice
        destination="none"
        heading="Competitions"
        title="Loading competitions"
        body="One moment."
      />
    ) : (
      <VNextDiscovery
        model={model}
        onRetry={state.status === 'ready' ? state.retry : undefined}
        refreshing={state.status === 'ready' ? state.refreshing : false}
        busyTournamentId={
          state.status === 'ready' && state.write.kind === 'saving'
            ? state.write.tournamentId
            : null
        }
        onIntent={(intent: DiscoveryIntent) => {
          if (state.status !== 'ready') return
          switch (intent.kind) {
            case 'open-season':
              props.onOpenSeason?.({
                competitionSlug: intent.competitionSlug,
                seasonKey: intent.seasonKey,
              })
              return
            case 'follow':
              state.setFollowing(intent.tournamentId, true)
              return
            default:
              state.setFollowing(intent.tournamentId, false)
          }
        }}
      />
    )

  return (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextShellProvider>
  )
}
