import { useMemo } from 'react'
import { VNextHome, type HomeIntent } from '../../home/VNextHome'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { HomeModel } from '../../models/home'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { buildHomeModel } from './buildHomeModel'
import { useVNextHomeSource, type VNextHomeSourceInput } from './useVNextHomeSource'
import { VNextHomeLoading, VNextHomeNotice } from './VNextHomeStates'

/**
 * THE CONNECTED vNEXT HOME.
 *
 * Its whole job is the four lines in the middle of this file: resolve the state,
 * build the model, render `VNextHome`. It holds no layout, no zone, no copy about
 * football and no presentation decision — everything visible in the ready state
 * belongs to the Gold Standard Home, and this file could not change how Home
 * looks without importing something it does not import.
 *
 * `VNextHome({ model })` STAYS USABLE WITHOUT ANY OF THIS, which is the point of
 * the split and the reason it is enforced by a test. Storybook, the deterministic
 * visual matrix and every focused render test still hand Home a model directly.
 * The approved surface never became network-dependent: it gained a caller.
 *
 * WHY THE STATES ARE A SWITCH AND NOT A `??`. Loading, signed out, no
 * competition and failed are four different sentences, and three of them are not
 * errors. Collapsing them — the temptation, since three of them draw the same
 * component — would put "something went wrong" in front of a player who is
 * merely signed out, and would offer a retry button to a player whose season has
 * no competition. The acquisition hook keeps them apart; this keeps them apart.
 *
 * WHY IT SUPPLIES A SHELL MODEL — STAGE 7.6. The shell around Home now owns the
 * active football context, competition switching, discovery and the primary
 * destinations, and Home owns none of them. Something has to hand the shell the
 * world, and this is the only file on the connected path that knows both the
 * competition and the player. It states the ONE competition the application
 * answered for and nothing more; see `../shell/shellSource.ts` for exactly what
 * the application cannot say yet and why nothing is invented to fill it.
 *
 * The provider wraps the WHOLE switch, including the notices, because every one
 * of those states renders `VNextShell` too — a signed-out player looking at a
 * shell with no competition in it is the honest picture, and so is a loading one.
 */

export type VNextHomeScreenProps = VNextHomeSourceInput & {
  /**
   * What the host does with a shell intent. Supplying it is what makes Explore
   * and the account control appear at all: a host with nowhere to send the
   * player gets no control rather than an inert one.
   */
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  /**
   * What the host does with Home's own content action.
   *
   * THIS IS DELIBERATELY SEPARATE FROM `onShellIntent`. The shell can say
   * "Matches" or "Games" without knowing a fixture; Home can promise an exact
   * "Match centre" and therefore has to carry the fixture id. The application
   * adapter owns the final URL, exactly as the Matches screen does.
   */
  readonly onIntent?: ((intent: HomeIntent) => void) | undefined
  /**
   * The player's OTHER competitions and what is waiting in them, where the host
   * loads them. `undefined` is the one-competition shape: the shell states this
   * page's competition and says nothing about any other, which is what a
   * page-scoped host should pass. The inbox costs reads per competition, so it
   * belongs to a host that mounts it once above the pages.
   */
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
}

export function VNextHomeScreen(props: VNextHomeScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const state = useVNextHomeSource(props)

  // The mapping is pure, so it is memoised on the source rather than re-run on
  // every render. Home reads `generatedAt` for every relative time on the page,
  // and rebuilding the model would restamp nothing — the instant lives in the
  // source — but it would rebuild every match object and give React a new
  // identity for each one on each render.
  const model = useMemo(
    () => (state.status === 'ready' ? buildHomeModel(state.source) : null),
    [state],
  )

  // ONE CONTEXT, FROM THE READ THE PAGE WAS ADDRESSED BY. It exists only in the
  // ready state; every other state has no competition to state, which is what
  // the shell's own no-competition shape is for.
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
            // The same number Home's own banner prints, from the model that
            // already decided it. It rides on Games, which is where the Match
            // Predictor lives under the selected architecture.
            outstandingPredictions: model.primaryAction.progress
              ? model.primaryAction.progress.total - model.primaryAction.progress.completed
              : null,
            canNavigateAway: props.onShellIntent !== undefined,
            elsewhere,
          })
        : null,
    [state, model, props.onShellIntent, elsewhere],
  )

  return shell === null ? (
    <VNextHomeBody state={state} model={model} onIntent={props.onIntent} />
  ) : (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      <VNextHomeBody state={state} model={model} onIntent={props.onIntent} />
    </VNextShellProvider>
  )
}

/** The four sentences and the surface, unchanged by Stage 7.6. */
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
      // A ready state with no model is unreachable: the memo builds one for
      // exactly this branch. The guard exists so the type narrows without a
      // non-null assertion, which would be the one place this file could lie.
      return model ? <VNextHome model={model} onIntent={onIntent} /> : <VNextHomeLoading />
  }
}
