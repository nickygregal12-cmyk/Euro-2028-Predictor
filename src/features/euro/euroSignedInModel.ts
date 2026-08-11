import { euroLandingPresentation, type EuroLandingState } from '../landing/euroLandingModel'

/**
 * What a SIGNED-IN visitor to the Euro deployment is shown at each of the four
 * global destinations.
 *
 * THE DEFECT THIS CLOSES. ADR 0026 puts two products on one commit, and PR #702
 * built the seam: brand, navigation wording, public metadata and the anonymous
 * landing page all differ by build. The signed-in product did not. A player who
 * signed in on the Euro domain was handed the DOMESTIC Hub — its action-led home
 * across followed weekly competitions, its joined-game inbox, its followed-
 * competition calendar and its private weekly leagues — with Euro labels on the
 * navigation. That is not the Euro Predictor with a different logo; it is the
 * other product, mislabelled, and every link in it leads further into the wrong
 * one.
 *
 * WHAT THIS IS NOT. It is not the Euro tournament's own journeys. Those exist in
 * this repository — prediction entry, groups, third place, the bracket, jokers,
 * review, matches, the Match Centre, leagues, the Bonus Games — and `MASTER-TODO.md`
 * parks them for a January 2028 return, with `tests/app/parkedEuroBoundary.test.ts`
 * holding them out of the production bundle. Wiring them back in is that parked
 * programme's work and an owner decision, not a side effect of fixing the labels.
 * This is the honest thing to show until then, and it is honest precisely because
 * it invents no fixture, no draw, no group, no entrant and no countdown.
 *
 * THE STATE IS THE SERVER'S. Contract 143's `euro_publication_state()` is the one
 * authority. A read that fails, times out or answers a shape this build does not
 * recognise resolves to `unknown`, which reads exactly as the closed states do —
 * so an outage produces a player who is told the tournament is not open, never one
 * shown a tournament nobody published. Nothing here unlocks a route: the route
 * gates are `TournamentJourney`'s and are unchanged.
 *
 * PURE. No network, no storage, no clock. The state and the destination come in;
 * words come out.
 */

/** The four global destinations, as this deployment answers them. */
export type EuroDestination = 'home' | 'play' | 'matches' | 'leagues'

export const EURO_DESTINATIONS: readonly EuroDestination[] = [
  'home',
  'play',
  'matches',
  'leagues',
]

/**
 * The three shapes the tournament's lifecycle takes for a signed-in player.
 *
 * Grouped rather than written out per state because the DESTINATION is what
 * changes the words, and the state changes only whether the tournament is ahead of
 * the player, around them, or behind them. Writing twenty-eight cells would create
 * twenty-eight things to keep consistent and would not say anything the three do
 * not.
 */
type Openness = 'closed' | 'open' | 'finished'

function openness(state: EuroLandingState): Openness {
  switch (state) {
    case 'registration-open':
    case 'live':
      return 'open'
    case 'completed':
    case 'archived':
      return 'finished'
    // `hidden`, `prelaunch` and `unknown` all mean the same thing to a player:
    // there is nothing here yet. Failing closed is the default rather than a
    // branch, so a state added to contract 143 and not handled lands here.
    default:
      return 'closed'
  }
}

export type EuroSignedInPanel = {
  readonly destination: EuroDestination
  /** The publication state's own short label, from the one place that owns it. */
  readonly status: string
  readonly heading: string
  readonly body: string
  /**
   * What will be at this address, stated as a future fact rather than rendered as
   * an empty version of itself. A greyed-out fixture list is a fabricated fixture
   * list.
   */
  readonly awaiting: string
  /**
   * Whether this panel should offer the weekly games on the sibling site.
   *
   * Never true when the tournament itself is open: at that point the player came
   * here to play Euro 2028, and sending them to the other product would be the
   * mirror image of the defect this file exists to fix.
   */
  readonly offerSiblingSite: boolean
}

const HEADINGS: Record<Openness, Record<EuroDestination, string>> = {
  closed: {
    home: 'Euro 2028 is not open yet.',
    play: 'There is nothing to predict yet.',
    matches: 'There are no Euro 2028 matches yet.',
    leagues: 'Euro 2028 leagues open with the tournament.',
  },
  open: {
    home: 'Euro 2028 is open.',
    play: 'Your Euro 2028 predictions.',
    matches: 'Euro 2028 matches.',
    leagues: 'Your Euro 2028 leagues.',
  },
  finished: {
    home: 'Euro 2028 is over.',
    play: 'Predictions are closed.',
    matches: 'Euro 2028 is over.',
    leagues: 'Your Euro 2028 leagues have finished.',
  },
}

const BODIES: Record<Openness, Record<EuroDestination, string>> = {
  closed: {
    home: 'Your account is ready and it is the same account on both sites. Nothing here needs doing yet — the tournament has not opened.',
    play: 'The draw has not been made, so there are no groups, no fixtures and nothing to enter. Predictions open when the tournament does.',
    matches: 'The fixture list follows the draw. Nothing is being held back from you here — it does not exist yet.',
    leagues: 'A Euro 2028 league is played over the tournament, so leagues open with it. Any private league you already run on the weekly platform is unaffected.',
  },
  open: {
    home: 'You are signed in and entered wherever you have joined. Each game is joined separately, and joining one never joins another.',
    play: 'Predictions lock at each kick-off, and the server decides that instant — never this page.',
    matches: 'Every match, with results confirmed by the platform rather than by a live feed.',
    leagues: 'A private league is its own table. Being in one is not entry to a game, and entering a game does not put you in a league.',
  },
  finished: {
    home: 'Your tournament is finished and your history stays yours.',
    play: 'The tournament has finished, so nothing can be entered or changed.',
    matches: 'Every match has been played and confirmed.',
    leagues: 'Final tables stand as they finished.',
  },
}

/**
 * The one sentence that keeps this honest.
 *
 * It states that the tournament's own surfaces are not on this deployment yet, at
 * every destination and in every state, rather than letting an empty page imply
 * that the player has nothing rather than that the product has nothing.
 */
const AWAITING =
  'The tournament’s own prediction, matches and league surfaces return with Euro 2028 itself. They are not hidden from you — they are not built here yet.'

export function euroSignedInPanel(
  state: EuroLandingState,
  destination: EuroDestination,
): EuroSignedInPanel {
  const shape = openness(state)
  return {
    destination,
    // Reused rather than restated, so the signed-in surface and the public
    // landing page cannot describe the same server state differently.
    status: euroLandingPresentation(state).status,
    heading: HEADINGS[shape][destination],
    body: BODIES[shape][destination],
    awaiting: AWAITING,
    offerSiblingSite: shape !== 'open',
  }
}
