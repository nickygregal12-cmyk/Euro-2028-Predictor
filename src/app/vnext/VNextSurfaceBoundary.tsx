import { Component, useCallback, type ErrorInfo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { correlationReference } from '../fatalRecovery'
import { reportFatalRenderError } from '../../services/observability/fatalRenderError'
import { weeklyRoutes } from '../weeklyRoutes'
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
 * remedy — reload the page that had just failed.
 *
 * That is the right last line of defence and the wrong first one. A player
 * whose Championship bracket throws has not lost Matches, Leagues, Home or
 * their account, and a product that behaves as though they have is telling them
 * something untrue about itself.
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
 * ============================ WHY IT IS A LAYOUT ROUTE ====================
 *
 * Mounted in `VNextSeamLayout` ABOVE `VNextSeamHost` rather than inside it,
 * because the seam's own hosts — the cross-competition attention read and the
 * durable action feed — are code that can throw too, and a boundary underneath
 * them cannot catch them. One boundary above all of it covers every cut-over
 * destination and the chrome they share.
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
 * SAME address, this rethrows and lets `ApplicationErrorBoundary` take it —
 * which is where the reload and local-sign-out escalation already live. So a
 * genuinely broken surface still reaches the remedy that can clear it, and a
 * transient one no longer costs the player their whole session.
 *
 * Navigating anywhere else resets the count, because a different address is a
 * different fault until it proves otherwise.
 *
 * ============================ AND IT REPORTS THE SAME WAY =================
 *
 * Same correlation-reference shape, same sanitising reporter, same rule that the
 * reference shown to the player is the one attached to observability. A second
 * reporting path would be a second answer to "what happened", and the two would
 * disagree the first time either grew a rule.
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
  readonly destination: ShellDestinationId | 'none'
  readonly onIntent: (intent: ShellIntent) => void
  readonly onGoHome: () => void
}

type VNextSurfaceBoundaryState = {
  readonly failed: boolean
  readonly reference: string | null
  /** Consecutive failures at `guarded`. Two is deterministic — see the header. */
  readonly failures: number
  /** The address the counter belongs to, so a navigation resets it. */
  readonly guarded: string
}

/** How many consecutive failures at one address before the fault escalates. */
export const SURFACE_ESCALATION_THRESHOLD = 2

export class VNextSurfaceBoundaryView extends Component<
  VNextSurfaceBoundaryViewProps,
  VNextSurfaceBoundaryState
> {
  public state: VNextSurfaceBoundaryState = {
    failed: false,
    reference: null,
    failures: 0,
    guarded: this.props.pathname,
  }

  public static getDerivedStateFromError(): Partial<VNextSurfaceBoundaryState> {
    return { failed: true }
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
    return { failed: false, reference: null, failures: 0, guarded: props.pathname }
  }

  public componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Generated before anything else, so the reference painted below is provably
    // the one the reporter was given. Same shape and same sanitiser as the
    // application boundary; see the header.
    const reference = correlationReference(new Date(), Math.random())
    reportFatalRenderError(error, reference, info.componentStack)
    this.setState((previous) => ({ reference, failures: previous.failures + 1 }))
  }

  private readonly retry = (): void => {
    // The counter deliberately survives. A retry that also cleared it would let
    // one deterministic fault cycle for ever, which is the loop this escalates
    // out of.
    this.setState({ failed: false, reference: null })
  }

  public render() {
    if (!this.state.failed) return this.props.children

    /**
     * DETERMINISTIC, SO IT GOES UP.
     *
     * Thrown during render on purpose: that is how a boundary hands a fault to
     * the boundary above it, and `ApplicationErrorBoundary` owns the remedies
     * that can clear a fault a re-render cannot.
     *
     * IT CARRIES THE REFERENCE AND NOT THE ORIGINAL ERROR. The original may hold
     * server or player-derived text, which is the same reason
     * `reportFatalRenderError` rebuilds the error it sends rather than
     * forwarding one. The original was already reported under this reference, so
     * nothing is lost by not carrying it a second time.
     */
    if (this.state.failures >= SURFACE_ESCALATION_THRESHOLD) {
      throw new Error(
        `vNext surface failed ${this.state.failures} times at one address: reference=${
          this.state.reference ?? 'unknown'
        }`,
      )
    }

    const { destination, onIntent, onGoHome } = this.props
    const { reference } = this.state

    /**
     * NOTHING TO NAVIGATE TO MEANS NO NAVIGATION PROMISE.
     *
     * On an address outside the four — `/account`, an invite, a not-found — the
     * shell's destinations have no competition to resolve against, so the honest
     * single control is the hub root rather than a "Try again" beside four
     * destinations that would all land in the same place.
     */
    const outsideTheFour = destination === 'none'

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
           */
          body="Your predictions and results are safe. Try again, or use the navigation to go somewhere else."
          onRetry={outsideTheFour ? onGoHome : this.retry}
          retryLabel={outsideTheFour ? 'Go to Home' : 'Try again'}
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
 * A function wrapper because the class cannot call hooks, and the three things
 * it needs — the address, the destination that address belongs to, and a way to
 * navigate — all come from the router.
 */
export function VNextSurfaceBoundary({ children }: { readonly children: ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const onGoHome = useCallback(() => {
    navigate(weeklyRoutes.hub)
  }, [navigate])

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
      destination={shellDestinationFromPath(pathname)}
      onIntent={onIntent}
      onGoHome={onGoHome}
    >
      {children}
    </VNextSurfaceBoundaryView>
  )
}
