import { Component, useCallback, type ErrorInfo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { correlationReference } from '../fatalRecovery'
import { reportFatalRenderError } from '../../services/observability/fatalRenderError'
import { weeklyRoutes } from '../weeklyRoutes'
import { useSite } from '../site/SiteProvider'
import { vNextOwnsFrame } from './frameOwnership'
import { VNextNotice } from '../../vnext/states/VNextStates'
import { VNextAppRoot } from './VNextAppRoot'
import { destinationRouteFromPath, shellDestinationFromPath } from './surfaceDestination'
import type { ShellDestinationId, ShellIntent } from '../../vnext/models/shell'

/**
 * ONE DESTINATION FAILING MUST NOT WITHDRAW THE PRODUCT.
 *
 * ============================ THE DEFECT THIS EXISTS FOR ==================
 *
 * Before this, the only error boundary in the application was
 * `ApplicationErrorBoundary`, mounted around the whole tree in `src/main.tsx`.
 * So a throw anywhere inside a cut-over Football Hub destination replaced the
 * ENTIRE document with the fatal fallback: the shell gone, the navigation gone,
 * every destination that was working perfectly well gone with it, and one
 * remedy, reload the page that had just failed.
 *
 * That is the right last line of defence and the wrong first one. A player
 * whose Championship bracket throws has not lost Matches, Leagues, Home or
 * their account.
 *
 * It also contradicted the rule the vNext lane had already written down for its
 * own failure states, in `src/vnext/states/VNextStates.tsx`: *"Every one renders
 * `VNextShell`, so a player who cannot see the content can still see where they
 * are and can still navigate."* Every state that lane designed honoured it. A
 * thrown render was the one that did not, because nothing caught it near enough
 * to the surface to keep the shell.
 *
 * A REJECTED READ IS A DIFFERENT THING AND IS ALREADY RIGHT. The integration
 * adapters resolve a rejection to a `failed` status and the screens draw
 * `VNextNotice` from it — that path is built, tested per surface, and untouched
 * here. This is only for the case an adapter cannot represent: code that threw.
 *
 * ============================ IT ONLY ANSWERS FOR ITS OWN FRAME ===========
 *
 * THE FIRST VERSION OF THIS GOT ITS BLAST RADIUS WRONG, AND THE CORRECTION IS
 * THE MOST IMPORTANT THING ON THIS PAGE. It is mounted in `VNextSeamLayout`,
 * which sits above `AppShell` — and `AppShell` holds EVERY route under
 * `RequireWelcome`. That is not the fourteen cut-over destinations. It is also
 * `/admin/*`, the Matchday TV screen, the Euro tournament's own `/h2h/:rivalId`
 * and `/tournament/profile`, and every destination whose flag has been turned
 * OFF and is therefore serving its legacy journey again.
 *
 * Catching those and painting the Football Hub's vNext chrome over them would
 * have been four separate regressions: the Euro deployment showing Hub
 * navigation on a tournament page, a brand-new Euro account meeting the Hub's
 * shell at `/welcome`, a wall-mounted TV screen acquiring a phone's bottom
 * navigation bar, and — worst — a ROLLED-BACK destination failing into the very
 * chrome the rollback existed to withdraw. `frameOwnership.ts` states that last
 * rule in its own words: *"turning a destination's flag off restores that one
 * journey AND its legacy chrome together. A rollback that returned the page but
 * not the navigation around it would not be the rollback the stage contract
 * asks for."*
 *
 * So the boundary asks the same authority `AppShell` asks — `vNextOwnsFrame`,
 * which already answers "is a vNext surface rendering here", already consults
 * the per-destination flag, and already knows which rows are domestic-only. If
 * vNext does not own the frame at this address, this rethrows and
 * `ApplicationErrorBoundary` takes it, correctly branded for whichever site the
 * player is on. A second opinion about which routes are vNext's would be the
 * exact drift `frameOwnership.ts` exists to prevent.
 *
 * ============================ WHY IT IS A LAYOUT ROUTE ====================
 *
 * Mounted ABOVE `VNextSeamHost` rather than inside it, because the seam's own
 * hosts — the cross-competition attention read and the durable action feed —
 * are code that can throw too, and a boundary underneath them cannot catch
 * them.
 *
 * The address is what tells it which destination it is standing in front of;
 * see `surfaceDestination.ts` for why that is derived from the application's own
 * route authority rather than written out again.
 *
 * ============================ IT ESCALATES RATHER THAN LOOPING ============
 *
 * `UX-004`'s lesson, applied one level down: retrying a deterministic failure is
 * a loop. The first failure at an address gets a shell, a navigation and a "Try
 * again", because most faults are transient. If the retry throws again at the
 * SAME address before anything has rendered successfully, this rethrows and
 * lets `ApplicationErrorBoundary` take it — which is where the reload and
 * local-sign-out escalation already live.
 *
 * TWO THINGS CLEAR THE COUNT, and the second was missing from the first
 * version. Navigating to another address clears it, because a different address
 * is a different fault until it proves otherwise. And a SUCCESSFUL RENDER
 * clears it — without that, a page that failed once, recovered on the retry and
 * then worked for ten minutes would escalate straight to the full-page fallback
 * the next time anything went wrong, which is the outcome this whole component
 * exists to prevent. "Threw twice in a row" and "threw twice today" are
 * different evidence about determinism and only the first one justifies giving
 * up.
 *
 * ============================ AND IT REPORTS THE SAME WAY =================
 *
 * Same correlation-reference shape, same sanitising reporter, same rule that the
 * reference shown to the player is the one attached to observability. A second
 * reporting path would be a second answer to "what happened", and the two would
 * disagree the first time either grew a rule.
 *
 * It reports ONLY where it owns the frame. Where it does not, it reports
 * nothing and rethrows the original error, so `ApplicationErrorBoundary` files
 * the one event with the real stack rather than two events about one fault.
 */

type VNextSurfaceBoundaryViewProps = {
  readonly children: ReactNode
  /**
   * The address this boundary is guarding. A change resets it — see
   * `getDerivedStateFromProps`.
   *
   * Passed in rather than read here so the class stays free of router hooks,
   * which a class cannot call.
   */
  readonly pathname: string
  /**
   * Whether a vNext surface owns the frame at `pathname`. `false` means this
   * boundary is standing over somebody else's page and must get out of the way.
   */
  readonly ownsFrame: boolean
  readonly destination: ShellDestinationId | 'none'
  readonly onIntent: (intent: ShellIntent) => void
}

type VNextSurfaceBoundaryState = {
  readonly failed: boolean
  /** Kept so the original can be rethrown rather than a fabricated stand-in. */
  readonly error: unknown
  readonly reference: string | null
  /**
   * Consecutive failures at `guarded`, counted by `componentDidCatch`.
   *
   * IT LAGS THE RENDER BY ONE COMMIT AND THAT IS UNAVOIDABLE. `componentDidCatch`
   * runs AFTER the fallback has painted, so on the failure that escalates, the
   * notice commits once and is then replaced. A counter that tried to include
   * the current failure in `render` would have to be incremented in
   * `getDerivedStateFromError`, which is static and cannot see prior state. The
   * cost is one frame on the rarest path; the alternative — an instance field
   * read during render — makes the escalation depend on mutation order rather
   * than on state.
   */
  readonly failures: number
  /** The address the counter belongs to, so a navigation resets it. */
  readonly guarded: string
}

/** How many consecutive failures at one address before the fault escalates. */
const ESCALATION_THRESHOLD = 2

class VNextSurfaceBoundaryView extends Component<
  VNextSurfaceBoundaryViewProps,
  VNextSurfaceBoundaryState
> {
  public state: VNextSurfaceBoundaryState = {
    failed: false,
    error: null,
    reference: null,
    failures: 0,
    guarded: this.props.pathname,
  }

  /**
   * THE REFERENCE IS MINTED HERE RATHER THAN IN `componentDidCatch`.
   *
   * `componentDidCatch` runs after the fallback has painted, so setting it there
   * rendered the notice once without the reference and once with it — and the
   * notice is inside a `role="status"` region, whose implicit `aria-atomic`
   * makes that a SECOND full announcement of the title, the body and the button
   * to a screen-reader user. Minting it here means the first paint is the only
   * paint. `componentDidCatch` reads it back off state to report under it, so
   * the reference the player sees is still provably the one observability got.
   */
  public static getDerivedStateFromError(
    error: unknown,
  ): Partial<VNextSurfaceBoundaryState> {
    return {
      failed: true,
      error,
      reference: correlationReference(new Date(), Math.random()),
    }
  }

  /**
   * A NEW ADDRESS IS A NEW FAULT.
   *
   * Derived rather than done in an effect, because the reset has to happen in
   * the same render that shows the new address — an effect would paint the
   * previous surface's failure over the new one for a frame first.
   */
  public static getDerivedStateFromProps(
    props: VNextSurfaceBoundaryViewProps,
    state: VNextSurfaceBoundaryState,
  ): Partial<VNextSurfaceBoundaryState> | null {
    if (props.pathname === state.guarded) return null
    return {
      failed: false,
      error: null,
      reference: null,
      failures: 0,
      guarded: props.pathname,
    }
  }

  public componentDidCatch(error: unknown, info: ErrorInfo): void {
    // NOT OURS, NOT OUR REPORT. `render` is about to rethrow this to the
    // application boundary, which files it with the real stack. Reporting here
    // as well would put two events in observability for one fault.
    if (!this.props.ownsFrame) return

    reportFatalRenderError(error, this.state.reference ?? 'FPH-INVALID-REFERENCE', info.componentStack)
    this.setState((previous) => ({ failures: previous.failures + 1 }))
  }

  /**
   * A SUCCESSFUL RENDER IS EVIDENCE THE FAULT WAS TRANSIENT.
   *
   * This only runs when the children COMMITTED — a retry that throws again is
   * caught during render, so the update never reaches here and the count
   * survives to escalate. That is the distinction the counter needs and the
   * first version of this component did not have.
   */
  public componentDidUpdate(): void {
    if (!this.state.failed && this.state.failures > 0) {
      this.setState({ failures: 0 })
    }
  }

  private readonly retry = (): void => {
    this.setState({ failed: false, error: null, reference: null })
  }

  public render() {
    if (!this.state.failed) return this.props.children

    /**
     * SOMEBODY ELSE'S PAGE, OR A FAULT A RE-RENDER CANNOT CLEAR. Either way it
     * goes up, and it goes up as the ORIGINAL error so the boundary above files
     * the real stack rather than a stand-in this one invented.
     *
     * Thrown during render on purpose: that is how a boundary hands a fault to
     * the boundary above it.
     */
    if (!this.props.ownsFrame || this.state.failures >= ESCALATION_THRESHOLD) {
      throw this.state.error
    }

    const { destination, onIntent } = this.props
    const { reference } = this.state

    return (
      <VNextAppRoot>
        <VNextNotice
          heading="Something went wrong"
          destination={destination}
          title="This part of the app stopped working"
          /**
           * IT SAYS WHAT SURVIVED, WHICH IS THE USEFUL HALF. A player looking at
           * a failure needs to know whether they have lost anything, and the
           * answer is no: a screen that failed to draw has not touched a
           * prediction, an entry or a result.
           *
           * IT NAMES THE CONTROL THAT IS ACTUALLY THERE. The first version said
           * "Try again" unconditionally while the control on some addresses read
           * "Go to Home", so the copy promised a button the page did not have.
           * The retry is now offered everywhere — re-rendering can succeed at any
           * address, and whether a destination lights up in the navigation is a
           * different question from whether a page can be retried.
           */
          body="Your predictions and results are safe. Try again, or use the navigation to go somewhere else."
          onRetry={this.retry}
          onIntent={onIntent}
          /**
           * A SEPARATE PROP RATHER THAN A SENTENCE, and looking at the rendered
           * page is what decided it: written into `body` the reference wrapped
           * between its timestamp and its suffix, so the one string a player has
           * to read back exactly was the one broken across two lines.
           *
           * It is safe to show — derived from the clock, never from the error —
           * and it is the only thing that lets a person match this moment to a
           * recorded event.
           */
          reference={reference ?? undefined}
        />
      </VNextAppRoot>
    )
  }
}

/**
 * The boundary as the route tree mounts it.
 *
 * A function wrapper because the class cannot call hooks, and everything it
 * needs — the address, whether vNext owns the frame there, the destination that
 * address belongs to, and a way to navigate — comes from the router and the
 * site.
 */
export function VNextSurfaceBoundary({
  children,
  ownsFrame,
}: {
  readonly children: ReactNode
  /**
   * Force ownership on, for a mount point where the question is already settled.
   *
   * `/welcome` and `/join/:code` are registered OUTSIDE `AppShell`, so
   * `frameOwnership.ts` deliberately keeps them out of `VNEXT_FRAMED` and names
   * them in `OUTSIDE_THE_LEGACY_FRAME` instead — there is no frame there to
   * surrender. The vNext elements at those two addresses mount this boundary
   * themselves and only exist when their own flag is on, so at those mount
   * points ownership is a fact rather than a lookup.
   */
  readonly ownsFrame?: boolean
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const site = useSite()

  /**
   * A SHELL INTENT, RESOLVED FROM THE FAILED ADDRESS.
   *
   * Only the intents a crashed surface can honestly answer. A `context`, `game`
   * or `league` intent names a competition by IDENTITY, and resolving one needs
   * the player's competition list — a read this boundary must not assume
   * survived, since it may well be what threw. Those navigate nowhere rather
   * than to a guess, which is the same answer `useShellIntentNavigation` gives
   * for an identity it cannot resolve.
   *
   * The shell reaches those three only through the competition switcher and the
   * attention layer, and neither is drawn without a shell model — so on this
   * page they are unreachable rather than inert.
   */
  const onIntent = useCallback(
    (intent: ShellIntent) => {
      switch (intent.kind) {
        case 'discover':
          navigate(weeklyRoutes.competitions)
          return
        case 'account':
          navigate('/account')
          return
        case 'about':
          navigate('/about')
          return
        case 'destination':
          navigate(destinationRouteFromPath(pathname, intent.destination))
          return
        default:
          return
      }
    },
    [navigate, pathname],
  )

  return (
    <VNextSurfaceBoundaryView
      pathname={pathname}
      ownsFrame={
        ownsFrame ??
        vNextOwnsFrame(pathname, {
          servesDomesticCompetitions: site.servesDomesticCompetitions,
        })
      }
      destination={shellDestinationFromPath(pathname)}
      onIntent={onIntent}
    >
      {children}
    </VNextSurfaceBoundaryView>
  )
}
