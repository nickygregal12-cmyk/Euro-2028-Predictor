import { useMemo } from 'react'
import { VNextPrivateLms, type PrivateLmsNotice } from '../../lms/VNextPrivateLms'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { ShellIntent } from '../../models/shell'
import { VNextNotice } from '../../states/VNextStates'
import { buildShellModel } from '../shell/buildShellModel'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { buildPrivateLmsModel } from './buildPrivateLmsModel'
import {
  useVNextPrivateLmsSource,
  type VNextPrivateLmsSourceInput,
} from './useVNextPrivateLmsSource'

export type VNextPrivateLmsScreenProps = VNextPrivateLmsSourceInput & {
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
}

export function VNextPrivateLmsScreen(props: VNextPrivateLmsScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const state = useVNextPrivateLmsSource(props)
  const model = useMemo(
    () => (state.status === 'ready' ? buildPrivateLmsModel(state.source) : null),
    [state],
  )
  const shell = useMemo(
    () =>
      state.status === 'ready'
        ? buildShellModel({
            competition: {
              tournamentId: state.source.context.tournamentId,
              name: state.source.context.competitionName,
              seasonLabel: state.source.context.seasonLabel,
              colours: null,
            },
            playerName: null,
            outstandingPredictions: null,
            canNavigateAway: props.onShellIntent !== undefined,
            elsewhere,
          })
        : null,
    [state, props.onShellIntent, elsewhere],
  )

  const notice: PrivateLmsNotice | undefined =
    state.status !== 'ready' || state.picking.kind === 'idle' || state.picking.kind === 'saving'
      ? undefined
      : state.picking.kind === 'refused'
        ? { kind: 'refused', reason: state.picking.reason }
        : { kind: state.picking.kind }

  const body =
    state.status === 'loading' ? (
      <VNextNotice
        destination="games"
        heading="Private Last Man Standing"
        title="Loading your competition"
        body="Checking this private round and who is entered."
      />
    ) : state.status === 'signedOut' ? (
      <VNextNotice
        destination="games"
        heading="Private Last Man Standing"
        title="Sign in to play"
        body="This private competition belongs to an account."
      />
    ) : state.status === 'noCompetition' ? (
      <VNextNotice
        destination="games"
        heading="Private Last Man Standing"
        title="No private competition to show"
        body="Open this from a private Last Man Standing invitation or from the competition you created."
      />
    ) : state.status === 'failed' ? (
      <VNextNotice
        destination="games"
        heading="Private Last Man Standing"
        title="We could not load this private competition"
        body="Nothing has been changed. Try reading the competition again."
        onRetry={state.retry}
      />
    ) : model ? (
      <VNextPrivateLms
        model={model}
        onPick={state.pick}
        busy={state.picking.kind === 'saving' || state.refreshing}
        notice={notice}
      />
    ) : null

  return shell === null ? (
    body
  ) : (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextShellProvider>
  )
}
