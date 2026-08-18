import { useMemo } from 'react'
import { VNextMatches } from '../../matches/VNextMatches'
import type { MatchesIntent, MatchesView } from '../../matches/VNextMatches'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import { buildMatchesModel } from './buildMatchesModel'
import {
  useVNextMatchesSource,
  type VNextMatchesSourceInput,
} from './useVNextMatchesSource'
import { VNextMatchesLoading, VNextMatchesNotice } from './VNextMatchesStates'

/**
 * THE CONNECTED vNEXT MATCHES SURFACE.
 *
 * Its whole job is the three lines in the middle: resolve the state, build the
 * model, render `VNextMatches`. It holds no layout, no zone and no copy about
 * football — everything visible in the ready state belongs to the page, and
 * this file could not change how Matches looks without importing something it
 * does not import.
 *
 * `VNextMatches({ model })` STAYS USABLE WITHOUT ANY OF THIS, which is the
 * point of the split and is enforced by `tests/vnext/vnextProductionBoundary.
 * test.ts`. Storybook and every render test hand the page a model directly; the
 * approved surface never became network-dependent, it gained a caller.
 *
 * WHY THE STATES ARE A SWITCH AND NOT A `??`. Loading, signed out, no
 * competition and failed are four different sentences and three of them are not
 * errors. Collapsing them would put "something went wrong" in front of a player
 * who is merely signed out, and would offer a retry to one whose season does
 * not exist.
 *
 * IT SUPPLIES A SHELL MODEL, exactly as `VNextHomeScreen` does and through the
 * same pure mapper. It states the ONE competition the application answered for
 * and nothing else — see `../shell/shellSource.ts` for what the application
 * cannot say yet and why nothing is invented to fill it.
 */
export type VNextMatchesScreenProps = VNextMatchesSourceInput & {
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  readonly onIntent?: ((intent: MatchesIntent) => void) | undefined
  readonly initialView?: MatchesView | undefined
}

export function VNextMatchesScreen(props: VNextMatchesScreenProps) {
  const state = useVNextMatchesSource(props)

  // The mapping is pure, so it is memoised on the source rather than re-run on
  // every render — rebuilding would restamp nothing (the instant lives in the
  // source) but would give React a new identity for every fixture each render.
  const model = useMemo(
    () => (state.status === 'ready' ? buildMatchesModel(state.source) : null),
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
            // Matches is football and knows nothing about the player beyond
            // their session. The shell's account control names them where a
            // host supplied a name; here there is none to supply, and a
            // fabricated one would be worse than the generic label.
            playerName: null,
            // A fixture list carries no prediction, so it cannot count what is
            // outstanding. `null` is "this page cannot say" and is never zero.
            outstandingPredictions: null,
            canNavigateAway: props.onShellIntent !== undefined,
          })
        : null,
    [state, model, props.onShellIntent],
  )

  const body =
    state.status === 'loading' ? (
      <VNextMatchesLoading />
    ) : state.status === 'signedOut' ? (
      <VNextMatchesNotice
        title="Sign in to see the football"
        body="Fixtures belong to a competition season, and a season is reached from your account."
      />
    ) : state.status === 'noCompetition' ? (
      <VNextMatchesNotice
        title="No competition to show"
        body="Pick a competition and season, and this is where its matches will be."
      />
    ) : state.status === 'failed' ? (
      <VNextMatchesNotice
        title="We could not load these matches"
        // IT DOES NOT DENY THE FOOTBALL. The fixtures exist; the read did not
        // answer. Saying "there are no matches" here would be the page turning
        // its own failure into a fact about the competition.
        body="The fixtures are there — we just could not read them just now. Trying again usually works."
        onRetry={state.retry}
      />
    ) : model ? (
      <VNextMatches
        model={model}
        initialView={props.initialView}
        onIntent={props.onIntent}
      />
    ) : (
      <VNextMatchesLoading />
    )

  return shell === null ? (
    body
  ) : (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextShellProvider>
  )
}
