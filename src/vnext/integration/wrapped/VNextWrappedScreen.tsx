import { useMemo } from 'react'
import { VNextSeasonWrapped } from '../../wrapped/VNextSeasonWrapped'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { VNextLoadingRows, VNextNotice } from '../../states/VNextStates'
import { buildWrappedModel } from './buildWrappedModel'
import {
  useVNextWrappedSource,
  type VNextWrappedSourceInput,
} from './useVNextWrappedSource'

/**
 * THE CONNECTED SEASON WRAPPED SURFACE.
 *
 * ============================ IT IS INSIDE A COMPETITION, AND LIGHTS NONE
 * OF THE FOUR ============================================================
 *
 * The shell states which competition and season this is — a Wrapped is
 * meaningless without one — while the page itself renders with no destination
 * selected. A finished season is not this week's football, not a game that can
 * be played and not a table that can still move; lighting one of the four would
 * say a player was somewhere they are not.
 *
 * ============================ THE ARCHIVE'S "NOT YET" IS NOT A FAILURE ===
 *
 * This file distinguishes three things the obvious implementation would merge:
 * the CONTEXT read failing (there is no season, so there is no page), the
 * ARCHIVE read failing (there is a season and we could not read its record),
 * and the archive answering that the season has not ended. Only the first is a
 * page-level notice; the other two are states of the page itself, because the
 * page can say which competition and season it is about in both.
 */

export type VNextWrappedScreenProps = VNextWrappedSourceInput & {
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  /**
   * The player's OTHER competitions and what is waiting in them, where the host
   * loads them. `undefined` is the one-competition shape.
   */
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
}

export function VNextWrappedScreen(props: VNextWrappedScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const state = useVNextWrappedSource(props)

  // Pure, so it is memoised on the source rather than rebuilt each render.
  const model = useMemo(
    () => (state.status === 'ready' ? buildWrappedModel(state.source) : null),
    [state],
  )

  const shell = useMemo(
    () =>
      buildShellModel({
        competition:
          state.status === 'ready'
            ? {
                // A COMPETITION WITHOUT A TOURNAMENT ID, and that is honest:
                // this page never needed one to draw and the shell only uses
                // it to identify the active context. The name and season are
                // what a reader sees.
                tournamentId: '',
                name: state.source.competitionName,
                seasonLabel: state.source.seasonLabel,
                // No competition palette is read on this path; the shell falls
                // back to its own atmosphere rather than this file inventing a
                // second source for a colour.
                colours: null,
              }
            : null,
        playerName: props.playerName,
        // A finished season carries no prediction, so it cannot count what is
        // outstanding. `null` is "this page cannot say", never zero.
        outstandingPredictions: null,
        canNavigateAway: props.onShellIntent !== undefined,
        elsewhere,
      }),
    [state, props.playerName, props.onShellIntent, elsewhere],
  )

  const body =
    state.status === 'loading' ? (
      <VNextLoadingRows heading="Your season" destination="none" label="Loading your season" />
    ) : state.status === 'signedOut' ? (
      <VNextNotice
        destination="none"
        heading="Your season"
        title="Sign in to see your season"
        body="A Wrapped is written for one player at the end of one season, and it is only ever your own."
      />
    ) : state.status === 'noCompetition' ? (
      <VNextNotice
        destination="none"
        heading="Your season"
        title="No season to look back on"
        body="Pick a competition and season, and this is where its finished record will be."
      />
    ) : state.status === 'failed' ? (
      <VNextNotice
        destination="none"
        heading="Your season"
        title="We could not open this season"
        body="The competition itself did not answer, so there is nothing to look back on yet."
        onRetry={state.retry}
      />
    ) : model === null ? (
      // Unreachable: `ready` is the only remaining status and it always builds
      // a model. Written as a branch rather than an assertion so the day the
      // status set grows, this file fails to compile instead of throwing.
      <VNextLoadingRows heading="Your season" destination="none" label="Loading your season" />
    ) : (
      <VNextSeasonWrapped model={model} onRetry={state.retry} />
    )

  return (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextShellProvider>
  )
}
