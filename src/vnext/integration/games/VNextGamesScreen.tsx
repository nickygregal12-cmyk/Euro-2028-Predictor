import { useMemo } from 'react'
import { VNextGames, type GamesIntent } from '../../games/VNextGames'
import { VNextConnectedShell } from '../shell/VNextConnectedShell'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { VNextNotice } from '../../states/VNextStates'
import { buildGamesModel } from './buildGamesModel'
import { useVNextGamesSource } from './useVNextGamesSource'

/**
 * THE CONNECTED GAMES HUB.
 *
 * `useVNextGamesSource` acquires and classifies; `buildGamesModel` maps,
 * purely; `VNextGames` draws. This file only chooses which of those to show,
 * which is why it holds no registration logic at all — that rule belongs to
 * `lmsRegistrationModel`, which the mapper calls and nothing here restates.
 *
 * ============================ FAILING TO READ IS NOT AN EMPTY SEASON ====
 *
 * The failed-read notice never says the competition runs no games. This is the
 * catalogue surface, so "there is nothing here" is precisely the sentence a
 * broken read must not produce — the Hub's whole defect history is plausible
 * emptiness standing in for a broken read, which is why the decoder throws on a
 * malformed payload rather than returning none.
 */

export type VNextGamesScreenProps = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly competitionSlug: string | undefined
  readonly seasonSlug: string | undefined
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  /**
   * The player's OTHER competitions and what is waiting in them, where the host
   * loads them. `undefined` is the one-competition shape: the shell states this
   * page's competition and says nothing about any other, which is what a
   * page-scoped host should pass. The inbox costs reads per competition, so it
   * belongs to a host that mounts it once above the pages.
   */
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
  readonly onIntent?: ((intent: GamesIntent) => void) | undefined
  /** A join is in flight, named per game so one row's work does not disable the rest. */
  readonly joiningGameId?: string | null
}

export function VNextGamesScreen(props: VNextGamesScreenProps) {
  const state = useVNextGamesSource({
    userId: props.userId,
    authLoading: props.authLoading,
    competitionSlug: props.competitionSlug,
    seasonSlug: props.seasonSlug,
  })

  const model = useMemo(
    () => (state.status === 'ready' ? buildGamesModel(state.source) : null),
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
            // The hub does not count outstanding predictions — that is the Main
            // Predictor's own fact. `null` is "this page cannot say".
            outstandingPredictions: null,
            canNavigateAway: props.onShellIntent !== undefined,
            elsewhere: props.shellElsewhere ?? null,
          })
        : null,
    [state, props.onShellIntent, props.shellElsewhere],
  )

  const body =
    state.status === 'signedOut' ? (
      <VNextNotice
        destination="games"
        heading="Games"
        title="Sign in to see this season’s games"
        body="A season’s games belong to the competition, and a competition is reached from your account."
      />
    ) : state.status === 'noCompetition' ? (
      <VNextNotice
        destination="games"
        heading="Games"
        title="No season to show"
        body="Pick a competition and a season, and this is where its games will be."
      />
    ) : state.status === 'failed' ? (
      <VNextNotice
        destination="games"
        heading="Games"
        title="We could not open this season"
        // IT SAYS NOTHING ABOUT THE CATALOGUE BEING EMPTY. The season exists;
        // the read did not answer.
        body="The season is there — we just could not read it just now. Trying again usually works."
        onRetry={state.retry}
      />
    ) : model === null ? (
      <VNextNotice
        destination="games" heading="Games" title="Loading this season’s games" body="One moment." />
    ) : (
      <VNextGames
        model={model}
        onRetry={state.status === 'ready' ? state.retry : undefined}
        refreshing={state.status === 'ready' ? state.refreshing : false}
        onIntent={props.onIntent}
        joiningGameId={props.joiningGameId ?? null}
      />
    )

  return shell === null ? (
    body
  ) : (
    <VNextConnectedShell model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextConnectedShell>
  )
}
