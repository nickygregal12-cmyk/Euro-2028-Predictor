import { useEffect, useState, type ReactElement } from 'react'
import { Link, Outlet } from 'react-router'
import { useSite } from '../../app/site/SiteProvider'
import { AuthSplash } from './AuthSplash'
import {
  fetchEuroPublicationState,
  type EuroPublicationSnapshot,
} from '../../services/supabase/euroPublication'
import {
  euroLandingPresentation,
  type EuroLandingState,
} from '../landing/euroLandingModel'
import s from './auth.module.css'

/**
 * Whether this deployment may create an account at all.
 *
 * WHY A ROUTE GUARD AND NOT A HIDDEN BUTTON. `EURO-003` requires that nothing on
 * the Euro deployment imply registration is open while the server says it is
 * closed, and PR #702 delivered half of that: the landing page's "Create account"
 * control appears only in the two open states. `/auth/signup` remained directly
 * reachable the whole time — by typing it, by a bookmark, by a link shared before
 * the state changed, by any search engine that indexed it — and it rendered a
 * working form that created a real account. A hidden control is not a control; the
 * refusal has to be where the route is.
 *
 * THE HUB IS UNAFFECTED, AND DELIBERATELY SO. Weekly signup is open and must stay
 * open, so this gate reads nothing and refuses nothing on the Hub build. That is
 * also why the fix is not "disable signup in Supabase": one project serves both
 * deployments, and turning signup off there would close the Hub to close Euro.
 *
 * WHAT COUNTS AS OPEN IS THE LANDING PAGE'S OWN ANSWER. `registrationOpen` comes
 * from `euroLandingModel`, which is the same table the landing page's header
 * button reads, so the control and the route cannot disagree about a state — a
 * visible "Create account" leading to a refusal, or a hidden one guarding a route
 * that would have worked, are both the drift this reuse removes.
 *
 * IT FAILS CLOSED IN EVERY DIRECTION. While the read is in flight the route shows
 * the neutral splash rather than the form; a read that throws, times out or returns
 * an unrecognised shape resolves to `unknown`, which is closed. The failure mode of
 * an outage is a visitor who cannot register on the tournament site, never one who
 * registers for a tournament nobody has published.
 *
 * LOG IN IS NEVER GATED. An existing player must always be able to reach their own
 * account, and this guard wraps signup alone.
 */

export type EuroSignupGateProps = {
  /** Injectable so every lifecycle state is provable without a network. */
  readPublicationState?: () => Promise<EuroPublicationSnapshot>
}

export function EuroSignupGate({
  readPublicationState = fetchEuroPublicationState,
}: EuroSignupGateProps = {}): ReactElement {
  const site = useSite()
  const isEuro = site.variant === 'euro'
  const [state, setState] = useState<EuroLandingState | null>(null)

  useEffect(() => {
    if (!isEuro) return
    let active = true
    setState(null)
    readPublicationState()
      .then((snapshot) => {
        if (active) setState(snapshot.state)
      })
      .catch(() => {
        if (active) setState('unknown')
      })
    return () => {
      active = false
    }
  }, [isEuro, readPublicationState])

  // The Hub, before any read: weekly signup is open and asks the tournament
  // nothing, so it also pays no round trip for an answer that cannot change it.
  if (!isEuro) return <Outlet />

  if (state === null) return <AuthSplash />
  if (euroLandingPresentation(state).registrationOpen) return <Outlet />

  return <EuroSignupClosed state={state} />
}

/**
 * What a visitor sees instead of the form.
 *
 * IT EXPLAINS RATHER THAN REDIRECTS. Bouncing to `/` would be indistinguishable
 * from a broken link, and someone who deliberately opened the signup page has a
 * question this can answer: registration is not open, here is where you can play
 * now, and here is how to get in if you already have an account. It offers the
 * Hub's signup only where the sibling origin is configured, because a create-
 * account button pointing nowhere is worse than one fewer button.
 */
function EuroSignupClosed({ state }: { state: EuroLandingState }): ReactElement {
  const site = useSite()
  const presentation = euroLandingPresentation(state)
  const sibling = site.routes.siblingSiteOrigin

  return (
    <div className={s.closedPanel}>
      <p className={s.closedEyebrow}>{presentation.status}</p>
      <h1 className={s.closedHeading}>Euro 2028 registration is not open.</h1>
      <p className={s.closedBody}>
        Accounts for {site.brand.productName} open when the tournament does. Nothing
        is being withheld from you — there is nothing to enter yet.
      </p>

      {sibling ? (
        <p className={s.closedBody}>
          {site.routes.siblingSiteName} is running now and uses the same account, so
          signing up there is enough for both sites when this one opens.{' '}
          <a className={s.closedLink} href={`${sibling}/auth/signup`} rel="noreferrer">
            Create an account on {site.routes.siblingSiteName}
          </a>
          .
        </p>
      ) : null}

      <p className={s.closedBody}>
        Already have an account?{' '}
        <Link className={s.closedLink} to="/auth/login">
          Sign in
        </Link>
        .
      </p>
    </div>
  )
}
