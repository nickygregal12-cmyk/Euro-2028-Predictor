import { useMemo } from 'react'
import { VNextHome } from '../../home/VNextHome'
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
 */

export type VNextHomeScreenProps = VNextHomeSourceInput

export function VNextHomeScreen(props: VNextHomeScreenProps) {
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
      return model ? <VNextHome model={model} /> : <VNextHomeLoading />
  }
}
