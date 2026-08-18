import { useMemo } from 'react'
import { VNextLeagues } from '../../leagues/VNextLeagues'
import type { LeaguesIntent } from '../../leagues/VNextLeagues'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import { buildLeaguesModel } from './buildLeaguesModel'
import {
  useVNextLeaguesSource,
  type VNextLeaguesSourceInput,
} from './useVNextLeaguesSource'
import { VNextLeaguesLoading, VNextLeaguesNotice } from './VNextLeaguesStates'

/**
 * THE CONNECTED vNEXT LEAGUES SURFACE.
 *
 * Its whole job is the three lines in the middle: resolve the state, build the
 * model, render `VNextLeagues`. It holds no layout, no column and no copy about
 * standings — everything visible in the ready state belongs to the page, and
 * this file could not change how a table looks without importing something it
 * does not import.
 *
 * `VNextLeagues({ model })` STAYS USABLE WITHOUT ANY OF THIS, which is the
 * point of the split and is enforced by `tests/vnext/vnextProductionBoundary.
 * test.ts`. Storybook and every render test hand the page a model directly.
 *
 * ============================ THE SCOPE LIVES ABOVE THIS FILE ============
 *
 * `selectedLeagueId` is an INPUT rather than state held here, and that is the
 * whole reason the page has no local scope state either: switching table is a
 * different READ, so the only place that decision can honestly live is the
 * place that owns the request. This screen forwards the intent and the host
 * changes the input; a new model then arrives with the new table already in it.
 *
 * Holding it here instead would look tidier and would introduce exactly one
 * render in which the chooser says "Sunday Club" above the season's rows.
 *
 * ============================ WHY THE STATES ARE A SWITCH ================
 *
 * Loading, signed out, no competition and failed are four different sentences
 * and three of them are not errors. Collapsing them would put "something went
 * wrong" in front of a player who is merely signed out.
 *
 * NONE OF THEM SAYS ANYTHING ABOUT WHO IS PLAYING. A failed read is a fact
 * about the request. "You are not in any league" is a fact about the player and
 * only the server can state it — when it does, the ready state draws an
 * ordinary table with no chooser and one honest sentence.
 */
export type VNextLeaguesScreenProps = VNextLeaguesSourceInput & {
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  readonly onIntent?: ((intent: LeaguesIntent) => void) | undefined
}

export function VNextLeaguesScreen(props: VNextLeaguesScreenProps) {
  const state = useVNextLeaguesSource(props)

  // The mapping is pure, so it is memoised on the source rather than re-run on
  // every render — rebuilding would restamp nothing (the instant lives in the
  // source) but would give React a new identity for every row each render.
  const model = useMemo(
    () => (state.status === 'ready' ? buildLeaguesModel(state.source) : null),
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
              // Leagues has no competition palette of its own to state. The
              // shell paints the competition from whatever the host gives it,
              // and inventing one here would be a second source for a colour.
              colours: null,
            },
            // Standings are about a table, not about the reader's account name.
            // The shell's account control names them where a host supplied a
            // name; here there is none to supply.
            playerName: null,
            // A standings table carries no prediction, so it cannot count what
            // is outstanding. `null` is "this page cannot say", never zero.
            outstandingPredictions: null,
            canNavigateAway: props.onShellIntent !== undefined,
          })
        : null,
    [state, props.onShellIntent],
  )

  const body =
    state.status === 'loading' ? (
      <VNextLeaguesLoading />
    ) : state.status === 'signedOut' ? (
      <VNextLeaguesNotice
        title="Sign in to see the standings"
        body="A league ranks the people playing a game inside a competition season, and a season is reached from your account."
      />
    ) : state.status === 'noCompetition' ? (
      <VNextLeaguesNotice
        title="No competition to show"
        body="Pick a competition and season, and this is where its standings will be."
      />
    ) : state.status === 'failed' ? (
      <VNextLeaguesNotice
        title="We could not load these standings"
        // IT DOES NOT DENY THE PLAYERS. The table exists; the read did not
        // answer. Saying "you are not in any league" here would be the page
        // turning its own failure into a fact about the reader.
        body="The table is there — we just could not read it just now. Trying again usually works."
        onRetry={state.retry}
      />
    ) : model ? (
      <VNextLeagues model={model} onIntent={props.onIntent} />
    ) : (
      <VNextLeaguesLoading />
    )

  return shell === null ? (
    body
  ) : (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextShellProvider>
  )
}
