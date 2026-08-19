import { useMemo } from 'react'
import { VNextChampionship, type ChampionshipIntent } from '../../championship/VNextChampionship'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { VNextNotice } from '../../states/VNextStates'
import { buildChampionshipModel } from './buildChampionshipModel'
import { useVNextChampionshipSource } from './useVNextChampionshipSource'
import { VNextChampionshipLoading } from './VNextChampionshipStates'

/**
 * THE CONNECTED PREDICTOR CHAMPIONSHIP.
 *
 * ============================ THE SEAM, AND ALL OF IT ====================
 *
 * `useVNextChampionshipSource` acquires and classifies; `buildChampionshipModel`
 * maps, purely; `VNextChampionship` draws. This file only chooses which of
 * those to show, which is why it holds no bracket logic at all.
 *
 * ============================ FAILING TO READ IS NOT LOSING ==============
 *
 * The failed-read notice deliberately does not mention the competition being
 * over, and never says the reader is out. On a survival-shaped surface the
 * worst available sentence is the one that turns a network fault into a
 * verdict, and a Championship page has two ways to reach it — "you are
 * eliminated" and "you did not qualify". Neither appears on any read failure.
 */

export type VNextChampionshipScreenProps = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly competitionSlug: string | undefined
  readonly seasonSlug: string | undefined
  readonly championshipId: string | undefined
  readonly gameName: string
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  /**
   * The player's OTHER competitions and what is waiting in them, where the host
   * loads them. `undefined` is the one-competition shape: the shell states this
   * page's competition and says nothing about any other, which is what a
   * page-scoped host should pass. The inbox costs reads per competition, so it
   * belongs to a host that mounts it once above the pages.
   */
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
}

export function VNextChampionshipScreen(props: VNextChampionshipScreenProps) {
  const state = useVNextChampionshipSource({
    userId: props.userId,
    authLoading: props.authLoading,
    competitionSlug: props.competitionSlug,
    seasonSlug: props.seasonSlug,
    championshipId: props.championshipId,
    gameName: props.gameName,
  })

  const model = useMemo(
    () => (state.status === 'ready' ? buildChampionshipModel(state.source) : null),
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
              // No palette of its own to state; inventing one would be a second
              // source for a colour.
              colours: null,
            },
            playerName: null,
            // A Championship counts no outstanding predictions of its own.
            // `null` is "this page cannot say", never zero.
            outstandingPredictions: null,
            canNavigateAway: props.onShellIntent !== undefined,
            elsewhere: props.shellElsewhere ?? null,
          })
        : null,
    [state, props.onShellIntent, props.shellElsewhere],
  )

  const write = state.status === 'ready' ? state.penaltyNumber : { kind: 'idle' as const }

  const body =
    state.status === 'loading' ? (
      <VNextChampionshipLoading />
    ) : state.status === 'signedOut' ? (
      <VNextNotice
        destination="games"
        heading="Predictor Championship"
        title="Sign in to see your Championship"
        body="A Championship belongs to a competition season, and a season is reached from your account."
      />
    ) : state.status === 'noCompetition' ? (
      <VNextNotice
        destination="games"
        heading="Predictor Championship"
        title="No Championship to show"
        body="Pick a competition, a season and a Championship, and this is where its draw will be."
      />
    ) : state.status === 'failed' ? (
      <VNextNotice
        destination="games"
        heading="Predictor Championship"
        title="We could not load this Championship"
        // IT SAYS NOTHING ABOUT THE COMPETITION BEING OVER, and nothing about
        // the reader being out. The draw exists; the read did not answer.
        body="The draw is there — we just could not read it just now. Trying again usually works."
        onRetry={state.retry}
      />
    ) : model ? (
      <VNextChampionship
        model={model}
        onRetry={state.status === 'ready' ? state.retry : undefined}
        refreshing={state.status === 'ready' ? state.refreshing : false}
        onIntent={(intent: ChampionshipIntent) => {
          // NAMED RATHER THAN INFERRED, so the one intent this page can emit is
          // visible at the seam that acts on it.
          if (state.status === 'ready') state.submitPenaltyNumber(intent.value)
        }}
        busy={write.kind === 'saving'}
        notice={
          // CARRIED WHOLE, so the refusal's own sentence travels with it rather
          // than the surface re-choosing copy the write contract already chose.
          write.kind === 'refused' || write.kind === 'failed'
            ? write.message
            : write.kind === 'conflict'
              ? 'Your Penalty Number was changed somewhere else, so we have reloaded this round.'
              : undefined
        }
      />
    ) : (
      <VNextChampionshipLoading />
    )

  return shell === null ? (
    body
  ) : (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextShellProvider>
  )
}
