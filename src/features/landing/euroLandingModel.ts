import {
  EURO_PUBLICATION_STATES,
  type EuroPublicationState,
} from '../../services/supabase/euroPublicationModel'

/**
 * What the Euro deployment's public landing page says, for each publication
 * state the server may report.
 *
 * THE SERVER OWNS THE STATE; THIS OWNS ONLY THE WORDS. Contract 143's
 * `euro_publication_state()` is the single authority, and it is the second
 * function an anonymous visitor may execute precisely so this page can fail
 * closed from server truth rather than from a frontend constant. Nothing here
 * decides whether Euro 2028 is published, and no state below unlocks a route:
 * `TournamentJourney` is still the guard.
 *
 * FAIL CLOSED MEANS ONE THING HERE — never imply registration is open. A read
 * that fails, times out or returns a shape this build does not recognise
 * resolves to `unknown`, which reads as "not yet" and offers the Hub. The
 * failure mode of an outage must be a visitor who signs up for the weekly
 * platform, never a visitor told to register for a tournament the owner has
 * not opened.
 *
 * WHAT IS DELIBERATELY NOT HERE. No draw, no teams, no fixtures, no countdown
 * to a date nobody has fixed, and no "coming soon" control that does nothing.
 * The tournament's own surfaces return in January 2028 and are parked; a
 * landing page that mocked them would be the placeholder the design authority
 * forbids.
 */

/** The states this page renders, plus the one it uses when it cannot read. */
export type EuroLandingState = EuroPublicationState | 'unknown'

/**
 * Every state this page must answer for, derived from the lifecycle authority
 * rather than restated. A state added to Contract 143 and not to the table
 * below fails the coverage assertion instead of silently falling back to
 * `unknown` — which would be safe, but silently wrong.
 */
export const EURO_LANDING_STATES: readonly EuroLandingState[] = [
  ...EURO_PUBLICATION_STATES,
  'unknown',
] as const

/** Where a call to action leads. Kept apart from its label so both are tested. */
export type EuroLandingActionTarget =
  /** This deployment's own signup route. */
  | 'signup'
  /** This deployment's own sign-in route. */
  | 'signin'
  /**
   * The weekly Prediction Hub, on its own domain. Rendered only when a sibling
   * origin is configured; otherwise the action is dropped rather than pointed
   * at a dead link.
   */
  | 'siblingSite'

export type EuroLandingAction = {
  readonly label: string
  readonly target: EuroLandingActionTarget
}

export type EuroLandingPresentation = {
  readonly state: EuroLandingState
  /** A short, honest label for where the tournament is in its lifecycle. */
  readonly status: string
  readonly headline: string
  readonly body: string
  /**
   * Whether this state offers Euro 2028 registration at all.
   *
   * FALSE IS THE DEFAULT AND THE SAFE ANSWER. `EURO-003` requires that nothing
   * imply registration is open when the server says it is closed, so only the
   * two states that genuinely are open set this.
   */
  readonly registrationOpen: boolean
  readonly primary: EuroLandingAction
  readonly secondary: EuroLandingAction | null
}

/**
 * A tournament that has finished still has a season's worth of football in it,
 * but only where authoritative data exists. Today the tournament's own history
 * surfaces are parked, so the completed and archived states send a player
 * somewhere that works rather than to a results page that is not built.
 */
const PRESENTATIONS: Record<EuroLandingState, EuroLandingPresentation> = {
  unknown: {
    state: 'unknown',
    status: 'Not open yet',
    headline: 'Euro 2028 is on its way.',
    body: 'The tournament game is not open yet. In the meantime the weekly Prediction Hub runs every matchweek of the Premier League and the Scottish Premiership — same account, no second sign-up when Euro 2028 opens.',
    registrationOpen: false,
    primary: { label: 'Play every matchweek', target: 'siblingSite' },
    secondary: { label: 'Sign in', target: 'signin' },
  },
  hidden: {
    state: 'hidden',
    status: 'Not open yet',
    headline: 'Euro 2028 is on its way.',
    body: 'The tournament game is not open yet. In the meantime the weekly Prediction Hub runs every matchweek of the Premier League and the Scottish Premiership — same account, no second sign-up when Euro 2028 opens.',
    registrationOpen: false,
    primary: { label: 'Play every matchweek', target: 'siblingSite' },
    secondary: { label: 'Sign in', target: 'signin' },
  },
  prelaunch: {
    state: 'prelaunch',
    status: 'Coming soon',
    headline: 'Predict Euro 2028, from the group stage to the final.',
    body: 'Score predictions on every match, call the bracket before a ball is kicked, and settle it in a private league with your mates. Registration is not open yet — and the weekly Prediction Hub is running now on the same account.',
    registrationOpen: false,
    primary: { label: 'Play every matchweek', target: 'siblingSite' },
    secondary: { label: 'Sign in', target: 'signin' },
  },
  'registration-open': {
    state: 'registration-open',
    status: 'Registration open',
    headline: 'Euro 2028 registration is open.',
    body: 'Create your account, get your predictions in before the first kick-off, and start a private league for the people you want to beat.',
    registrationOpen: true,
    primary: { label: 'Create your account', target: 'signup' },
    secondary: { label: 'Sign in', target: 'signin' },
  },
  live: {
    state: 'live',
    status: 'Tournament live',
    headline: 'Euro 2028 is under way.',
    body: 'Predictions lock at each kick-off. Sign in to get yours in for the next round of matches, or create an account and join a private league.',
    registrationOpen: true,
    primary: { label: 'Sign in and predict', target: 'signin' },
    secondary: { label: 'Create your account', target: 'signup' },
  },
  completed: {
    state: 'completed',
    status: 'Tournament complete',
    headline: 'Euro 2028 is done.',
    body: 'Sign in to see how your tournament finished. The weekly Prediction Hub keeps going every matchweek on the same account.',
    registrationOpen: false,
    primary: { label: 'Sign in', target: 'signin' },
    secondary: { label: 'Keep playing every matchweek', target: 'siblingSite' },
  },
  archived: {
    state: 'archived',
    status: 'Archived',
    headline: 'Euro 2028 is in the archive.',
    body: 'Sign in to look back at your tournament. The weekly Prediction Hub keeps going every matchweek on the same account.',
    registrationOpen: false,
    primary: { label: 'Sign in', target: 'signin' },
    secondary: { label: 'Keep playing every matchweek', target: 'siblingSite' },
  },
}

export function euroLandingPresentation(
  state: EuroLandingState,
): EuroLandingPresentation {
  return PRESENTATIONS[state] ?? PRESENTATIONS.unknown
}

/**
 * Drop an action this deployment cannot honour.
 *
 * The Hub's permanent domain is not purchased, so `siblingSiteOrigin` is
 * routinely null — and a "Play every matchweek" button that goes nowhere is
 * worse than one fewer button. When the PRIMARY action is dropped the secondary
 * is promoted rather than the page being left with only a quiet link.
 */
export function resolveActions(
  presentation: EuroLandingPresentation,
  siblingSiteOrigin: string | null,
): { primary: EuroLandingAction | null; secondary: EuroLandingAction | null } {
  const usable = (action: EuroLandingAction | null): EuroLandingAction | null => {
    if (!action) return null
    if (action.target === 'siblingSite' && !siblingSiteOrigin) return null
    return action
  }

  const primary = usable(presentation.primary)
  const secondary = usable(presentation.secondary)
  return primary ? { primary, secondary } : { primary: secondary, secondary: null }
}

/** The href for an action, given this deployment's sibling origin. */
export function actionHref(
  action: EuroLandingAction,
  siblingSiteOrigin: string | null,
): string | null {
  switch (action.target) {
    case 'signup':
      return '/auth/signup'
    case 'signin':
      return '/auth/login'
    case 'siblingSite':
      return siblingSiteOrigin
  }
}
