import { useMemo } from 'react'
import { VNextLms, type LmsIntent } from '../../lms/VNextLms'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { VNextNotice } from '../../states/VNextStates'
import { buildLmsModel } from './buildLmsModel'
import { useVNextLmsSource, type VNextLmsSourceInput } from './useVNextLmsSource'
import { VNextLmsLoading } from './VNextLmsStates'

/**
 * THE CONNECTED PUBLIC vNEXT LAST MAN STANDING SURFACE.
 *
 * This screen owns only the public season LMS authority. Selecting a private
 * `competition=<id>` instance is application routing state, so the non-dev app
 * route owner chooses between this screen and `VNextPrivateLmsScreen` before
 * either source hook is mounted. That keeps the public read unable to accept a
 * private id and keeps connected integration screens out of one another.
 *
 * Presentation remains route-free: this page receives a typed source input and
 * emits typed intentions only.
 */
export type VNextLmsScreenProps = VNextLmsSourceInput & {
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
}

export function VNextLmsScreen(props: VNextLmsScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const state = useVNextLmsSource(props)

  const model = useMemo(
    () => (state.status === 'ready' ? buildLmsModel(state.source) : null),
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

  const picking = state.status === 'ready' ? state.picking : { kind: 'idle' as const }

  const body =
    state.status === 'loading' ? (
      <VNextLmsLoading />
    ) : state.status === 'signedOut' ? (
      <VNextNotice
        destination="games"
        heading="Last Man Standing"
        title="Sign in to play"
        body="A round belongs to a competition season, and a season is reached from your account."
      />
    ) : state.status === 'noCompetition' ? (
      <VNextNotice
        destination="games"
        heading="Last Man Standing"
        title="No competition to show"
        body="Pick a competition and season, and this is where its round will be."
      />
    ) : state.status === 'failed' ? (
      <VNextNotice
        destination="games"
        heading="Last Man Standing"
        title="We could not load this round"
        body="The round is there — we just could not read it just now. Trying again usually works."
        onRetry={state.retry}
      />
    ) : model ? (
      <VNextLms
        model={model}
        onIntent={(intent: LmsIntent) => {
          if (state.status === 'ready') state.pick(intent.teamId)
        }}
        onRetry={state.status === 'ready' ? state.retry : undefined}
        busy={picking.kind === 'saving'}
        notice={picking.kind === 'idle' || picking.kind === 'saving' ? undefined : picking}
      />
    ) : (
      <VNextLmsLoading />
    )

  return shell === null ? (
    body
  ) : (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextShellProvider>
  )
}
