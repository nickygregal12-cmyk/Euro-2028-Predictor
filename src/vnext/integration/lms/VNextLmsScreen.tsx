import { useMemo } from 'react'
import { VNextLms, type LmsIntent } from '../../lms/VNextLms'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import { VNextNotice } from '../states/VNextStates'
import { buildLmsModel } from './buildLmsModel'
import { useVNextLmsSource, type VNextLmsSourceInput } from './useVNextLmsSource'
import { VNextLmsLoading } from './VNextLmsStates'

/**
 * THE CONNECTED vNEXT LAST MAN STANDING SURFACE.
 *
 * Its whole job is the three lines in the middle: resolve the state, build the
 * model, render `VNextLms`. It holds no layout, no club and no copy about
 * picking — everything visible in the ready state belongs to the page.
 *
 * `VNextLms({ model })` STAYS USABLE WITHOUT ANY OF THIS, which is the point of
 * the split and is enforced by `tests/vnext/vnextProductionBoundary.test.ts`.
 *
 * ============================ IT IS THE ONLY PLACE A PICK IS SENT =========
 *
 * The page emits an INTENTION — one team id, from the option that carried it —
 * and this screen hands it to the hook, which hands it to the one write. There
 * is no other path, and the page cannot reach a gateway even if it tried: it
 * imports models, not services.
 *
 * ============================ THE WRITE'S OUTCOME IS A PROP, NOT A THROW ==
 *
 * `picking` becomes `busy` and `notice`, so a conflict, a refusal and a fault
 * reach the player as three different sentences rather than as an exception
 * nobody catches. A landed pick produces no notice at all — the model already
 * shows the club as chosen, and a banner repeating it would be a second place
 * to look.
 *
 * ============================ WHY THE STATES ARE A SWITCH ================
 *
 * Loading, signed out, no competition and failed are four different sentences
 * and three of them are not errors. NONE of them says anything about the game:
 * "you are not entered" and "this season does not run it" are the server's to
 * say, and the ready state says them.
 */
export type VNextLmsScreenProps = VNextLmsSourceInput & {
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
}

export function VNextLmsScreen(props: VNextLmsScreenProps) {
  const state = useVNextLmsSource(props)

  // Pure, so memoised on the source rather than re-run per render — rebuilding
  // would restamp nothing and hand React a new identity for every club.
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
              // No palette of its own to state; inventing one would be a second
              // source for a colour.
              colours: null,
            },
            playerName: null,
            // A survival game counts no outstanding predictions. `null` is
            // "this page cannot say", never zero.
            outstandingPredictions: null,
            canNavigateAway: props.onShellIntent !== undefined,
          })
        : null,
    [state, props.onShellIntent],
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
        // IT DOES NOT SAY THE GAME IS OVER. The round exists; the read did not
        // answer. Turning that into "you are eliminated" would be the worst
        // sentence this surface could produce.
        body="The round is there — we just could not read it just now. Trying again usually works."
        onRetry={state.retry}
      />
    ) : model ? (
      <VNextLms
        model={model}
        onIntent={(intent: LmsIntent) => {
          // NAMED RATHER THAN INFERRED, so the one intent this page can emit is
          // visible at the seam that acts on it.
          if (state.status === 'ready') state.pick(intent.teamId)
        }}
        onRetry={state.status === 'ready' ? state.retry : undefined}
        busy={picking.kind === 'saving'}
        notice={
          // CARRIED WHOLE, so the refusal's own sentence travels with it. A
          // `picking.kind` alone would force the surface to re-choose copy the
          // write contract already chose.
          picking.kind === 'idle' || picking.kind === 'saving' ? undefined : picking
        }
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
