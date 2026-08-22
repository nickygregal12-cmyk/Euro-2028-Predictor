import { useMemo } from 'react'
import { VNextHome, type HomeIntent } from '../../home/VNextHome'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { HomeModel } from '../../models/home'
import type { VNextNavigationIntent } from '../shell/navigationIntent'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { buildHomeModel } from './buildHomeModel'
import { useVNextHomeSource, type VNextHomeSourceInput } from './useVNextHomeSource'
import { VNextHomeLoading, VNextHomeNotice } from './VNextHomeStates'

/** Connected vNext Home. Presentation emits intentions; the app seam owns URLs. */
export type VNextHomeScreenProps = VNextHomeSourceInput & {
  readonly onShellIntent?: ((intent: VNextNavigationIntent) => void) | undefined
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
}

export function shellIntentForHome(
  intent: HomeIntent,
  contextId: string,
): VNextNavigationIntent {
  switch (intent.kind) {
    case 'primary-action':
      if (intent.action === 'joinLeague') {
        return { kind: 'destination', destination: 'leagues', contextId }
      }
      if (intent.action === 'watchLive') {
        // This action has no single fixture identity, so Matches is exact.
        return { kind: 'destination', destination: 'matches', contextId }
      }
      return { kind: 'game', contextId, game: 'match-predictor' }
    case 'prediction':
      return { kind: 'game', contextId, game: 'match-predictor' }
    case 'match-centre':
      // The fixture card already owns the canonical fixture id. Match Centre is
      // a connected-page intent rather than a fifth permanent shell destination.
      return { kind: 'match-centre', contextId, fixtureId: intent.fixtureId }
    default:
      return { kind: 'destination', destination: 'home', contextId }
  }
}

export function VNextHomeScreen(props: VNextHomeScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const state = useVNextHomeSource(props)

  const model = useMemo(
    () => (state.status === 'ready' ? buildHomeModel(state.source) : null),
    [state],
  )

  const shell = useMemo(
    () =>
      state.status === 'ready' && model
        ? buildShellModel({
            competition: {
              tournamentId: state.source.competition.tournamentId,
              name: state.source.competition.name,
              seasonLabel: state.source.competition.seasonLabel,
              colours: model.competition.colours,
            },
            playerName: state.source.user.displayName,
            outstandingPredictions: model.primaryAction.progress
              ? model.primaryAction.progress.total - model.primaryAction.progress.completed
              : null,
            canNavigateAway: props.onShellIntent !== undefined,
            elsewhere,
          })
        : null,
    [state, model, props.onShellIntent, elsewhere],
  )

  const onHomeIntent =
    state.status === 'ready' && props.onShellIntent
      ? (intent: HomeIntent) =>
          props.onShellIntent?.(
            shellIntentForHome(intent, state.source.competition.tournamentId),
          )
      : undefined

  return shell === null ? (
    <VNextHomeBody state={state} model={model} onIntent={onHomeIntent} />
  ) : (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      <VNextHomeBody state={state} model={model} onIntent={onHomeIntent} />
    </VNextShellProvider>
  )
}

function VNextHomeBody({
  state,
  model,
  onIntent,
}: {
  readonly state: ReturnType<typeof useVNextHomeSource>
  readonly model: HomeModel | null
  readonly onIntent?: ((intent: HomeIntent) => void) | undefined
}) {
  switch (state.status) {
    case 'loading':
      return <VNextHomeLoading />

    case 'signedOut':
      return (
        <VNextHomeNotice
          title="Sign in to see your matchweek"
          body="Your predictions, your rank and your leagues are tied to your account."
        />
      )

    case 'noCompetition':
      return (
        <VNextHomeNotice
          title="No competition to show"
          body="Pick a competition and season, and this is where its matchweek will be."
        />
      )

    case 'failed':
      return (
        <VNextHomeNotice
          title="We could not load your matchweek"
          body="The football and your standing are both fine — we just could not read them just now. Trying again usually works."
          onRetry={state.retry}
        />
      )

    default:
      return model ? (
        <VNextHome model={model} onIntent={onIntent} />
      ) : (
        <VNextHomeLoading />
      )
  }
}
