import { useMemo } from 'react'
import { VNextGames, type GamesIntent } from '../../games/VNextGames'
import { VNextConnectedShell } from '../shell/VNextConnectedShell'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
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
 * ============================ THE JOIN IS THE SERVER'S, AND IT IS WIRED ==
 *
 * `join-game` used to leave this file and stop: the surface emitted it, the
 * harness reported it, and nothing joined anything. It now goes to
 * `join_competition_game` through the acquisition hook — which adds no rule to
 * it. Every registration boundary is the server's, the Join control is only
 * drawn from the SERVER's own registration outlook, and a success is proved by
 * a re-read rather than by patching the row.
 *
 * `onIntent` still exists and still receives `open-game`. A host that wants to
 * see the join intent rather than act on it gets it too — but the write no
 * longer depends on a host remembering to perform it, which is how a control
 * ends up looking real and doing nothing.
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
}

export function VNextGamesScreen(props: VNextGamesScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
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
            elsewhere,
          })
        : null,
    [state, props.onShellIntent, elsewhere],
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
        onIntent={(intent: GamesIntent) => {
          // THE HOST STILL SEES EVERY INTENT, including the join — a host that
          // routes on `open-game` needs one seam, not two.
          props.onIntent?.(intent)
          if (intent.kind === 'join-game' && state.status === 'ready') {
            state.join(intent.gameId)
          }
        }}
        joiningGameId={
          state.status === 'ready' && state.write.kind === 'joining'
            ? state.write.gameId
            : null
        }
        joinFailure={
          // CARRIED WHOLE, so the write's own sentence travels with it rather
          // than this file re-choosing copy the error authority already chose.
          state.status === 'ready' && state.write.kind === 'failed'
            ? { gameId: state.write.gameId, message: state.write.message }
            : null
        }
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
