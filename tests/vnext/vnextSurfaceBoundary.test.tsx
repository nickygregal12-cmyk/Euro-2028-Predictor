import { Component, type ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reportFatalRenderError = vi.hoisted(() => vi.fn())
vi.mock('../../src/services/observability/fatalRenderError', () => ({
  reportFatalRenderError,
}))

import { VNextSurfaceBoundary } from '../../src/app/vnext/VNextSurfaceBoundary'
import {
  competitionGameRoute,
  competitionSectionRoute,
  weeklyRoutes,
} from '../../src/app/weeklyRoutes'

/**
 * ONE DESTINATION FAILING MUST NOT WITHDRAW THE PRODUCT — AND MUST NOT TAKE
 * OVER A PAGE THAT IS NOT ITS OWN.
 *
 * ============================ THE GAP THIS CLOSES ========================
 *
 * The Football Hub cutover repointed fourteen journeys at vNext screens, and the
 * only error boundary in the application was `ApplicationErrorBoundary` around
 * the whole tree. `vnextCutoverRouting` proves which element each route mounts;
 * nothing proved what a player SEES when one of those elements throws, and the
 * answer was: the entire document replaced by the fatal fallback, navigation
 * included.
 *
 * The rejected-read path is a different thing and is already covered per surface
 * — `leaguesSourceLifecycle` and its siblings prove an adapter that rejects
 * resolves to a notice rather than a blank. This file covers the case an adapter
 * cannot represent, because it is not a value: code that threw.
 *
 * ============================ AND THE BLAST RADIUS =======================
 *
 * The boundary is mounted in `VNextSeamLayout`, which sits above `AppShell` —
 * every route under `RequireWelcome`, not the fourteen cut-over ones. So the
 * cases below prove BOTH halves: it answers for an address a vNext surface owns,
 * and it gets out of the way at an address one does not, where painting the
 * Football Hub's chrome would be a regression on the Euro deployment, on the
 * Matchday TV screen, on `/admin`, and on any destination whose flag has been
 * rolled back.
 *
 * ============================ WHY IT RENDERS THE REAL SHELL ==============
 *
 * The whole claim is about what survives, so stubbing the shell would remove the
 * thing under test. These cases assert the navigation is present, is not inert,
 * and names the destination the failed address belonged to.
 *
 * THE FLAGS ARE STUBBED RATHER THAN THE OWNERSHIP PREDICATE. `vNextOwnsFrame`
 * is the authority the boundary consults and `AppShell` consults; mocking it
 * would leave the boundary's most important decision proved against a stand-in.
 * Setting the same environment variables the application sets exercises it for
 * real.
 *
 * React logs a caught error to `console.error` by design. It is silenced per
 * test rather than globally so an UNEXPECTED error still fails the run loudly.
 */

/** A child that throws on demand, so a retry can be given something to succeed at. */
function Boom({ throwing, label }: { throwing: boolean; label: string }) {
  if (throwing) throw new Error('surface exploded')
  return <div>{label}</div>
}

/** Catches the escalation, so a rethrow is observable instead of failing the test run. */
class Escalation extends Component<{ children: ReactNode }, { caught: string | null }> {
  public state = { caught: null as string | null }
  public static getDerivedStateFromError(error: unknown) {
    return { caught: error instanceof Error ? error.message : String(error) }
  }
  public render() {
    return this.state.caught === null ? (
      this.props.children
    ) : (
      <div data-testid="escalated">{this.state.caught}</div>
    )
  }
}

/** Prints the address, so a navigation is provable without inspecting history. */
function Address() {
  const { pathname } = useLocation()
  return <div data-testid="address">{pathname}</div>
}

/**
 * A destination that works, and a way back to the one that does not.
 *
 * It carries its own control rather than borrowing the shell's, because the
 * shell belongs to the FAILURE state here — a working page in this file is a
 * stub, and giving it a real shell would test `VNextShell` twice and the
 * boundary once.
 */
function Working({ to }: { to: string }) {
  const navigate = useNavigate()
  return (
    <div>
      <div>a working destination</div>
      <button type="button" onClick={() => navigate(to)}>
        back to the broken one
      </button>
    </div>
  )
}

const REF = { competitionSlug: 'scottish-premiership', seasonSlug: '2026-27' }
const CHAMPIONSHIP = competitionGameRoute(REF, 'championship')
const MATCHES = competitionSectionRoute(REF, 'matches')

/** The flags the addresses above need, so `vNextOwnsFrame` answers for real. */
const OWNED_FLAGS = [
  'VITE_UI_FOOTBALL_HUB_CHAMPIONSHIP',
  'VITE_UI_FOOTBALL_HUB_MATCHES',
  'VITE_UI_FOOTBALL_HUB_HOME',
  'VITE_UI_FOOTBALL_HUB_ACCOUNT',
] as const

function renderAt(path: string, node: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Address />
      <Escalation>
        <Routes>
          <Route path="*" element={<VNextSurfaceBoundary>{node}</VNextSurfaceBoundary>} />
        </Routes>
      </Escalation>
    </MemoryRouter>,
  )
}

/**
 * The seam as the route tree actually has it: ONE boundary, as a layout, over
 * several addresses — one of which is broken and the rest of which are not.
 *
 * The single-address helper above cannot show what the reset is for, because
 * with the same child at every address every address fails. This is the shape
 * that can: a player who breaks the Championship and presses Matches must get
 * Matches.
 */
function renderSeam(path: string, broken: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Address />
      <Escalation>
        <Routes>
          <Route
            element={
              <VNextSurfaceBoundary>
                <Outlet />
              </VNextSurfaceBoundary>
            }
          >
            <Route path={broken} element={<Boom throwing label="never" />} />
            <Route path="*" element={<Working to={broken} />} />
          </Route>
        </Routes>
      </Escalation>
    </MemoryRouter>,
  )
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  for (const flag of OWNED_FLAGS) vi.stubEnv(flag, 'true')
})

afterEach(() => {
  consoleError.mockRestore()
  reportFatalRenderError.mockClear()
  vi.unstubAllEnvs()
})

describe('a vNext surface that throws', () => {
  it('keeps the shell and the navigation instead of withdrawing the product', () => {
    renderAt(CHAMPIONSHIP, <Boom throwing label="championship" />)

    // The page is still a page: one main, one h1, and the failure stated rather
    // than the document replaced.
    //
    // THE LANDMARK COUNT PROVES LESS THAN IT LOOKS AND THE COMMENT SHOULD SAY SO.
    // `Boom` throws before rendering anything, so the failed subtree never held a
    // `<main>` and this cannot detect a doubled landmark. React unmounts the
    // failed subtree before committing the fallback, so the case does not arise —
    // this asserts the fallback is a well-formed page, not that the unmount
    // happened.
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText('This part of the app stopped working')).toBeTruthy()

    // And every way out is still one press away. Two of each because the bar and
    // the rail both render, with CSS showing one — see `VNextShell`.
    for (const label of ['Home', 'Matches', 'Games', 'Leagues']) {
      expect(
        screen.getAllByRole('button', { name: label }).length,
        `${label} must survive the failure`,
      ).toBeGreaterThan(0)
    }
  })

  it('names the destination the failed address belonged to', () => {
    renderAt(CHAMPIONSHIP, <Boom throwing label="championship" />)
    // The Championship lives under Games, so Games is where the player is —
    // `VNextStates` records why lighting the wrong one is the defect worth
    // avoiding: a failed page is exactly when a player reads the navigation.
    const current = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-current') === 'page')
    expect(current.length).toBeGreaterThan(0)
    for (const button of current) expect(button.textContent).toContain('Games')
  })

  it('tells the player their predictions are safe, and quotes a reference', () => {
    renderAt(CHAMPIONSHIP, <Boom throwing label="championship" />)
    expect(screen.getByText(/Your predictions and results are safe/)).toBeTruthy()

    // The reference shown must be the one observability was given. Same rule the
    // application boundary follows, and the reason it is minted before the
    // report rather than after it.
    expect(reportFatalRenderError).toHaveBeenCalledTimes(1)
    const reference = reportFatalRenderError.mock.calls[0]?.[1] as string
    expect(reference).toMatch(/^FPH-\d{14}-[0-9A-F]{4}$/)

    // IT IS ITS OWN ELEMENT, NOT A FRAGMENT OF THE BODY SENTENCE. Written into
    // the prose it wrapped between the timestamp and the suffix, so the one
    // string a player has to read back exactly was the one broken across two
    // lines. `getByText` with an exact match is what holds it whole: a reference
    // split across nodes, or padded into a sentence, fails this.
    const shown = screen.getByText(reference)
    expect(shown.tagName).toBe('CODE')
    expect(shown.textContent).toBe(reference)
    // And it must not ALSO be in the body, or a screen reader announces it twice.
    expect(
      screen.getByText(/Your predictions and results are safe/).textContent,
    ).not.toContain(reference)
  })

  it('reports exactly once, with the raw error handed to the sanitising reporter', () => {
    renderAt(CHAMPIONSHIP, <Boom throwing label="championship" />)
    // `reportFatalRenderError` is the module that strips a message which may
    // hold server or player text. This asserts the boundary uses it rather than
    // reaching past it — the value handed over is the raw error, and the
    // sanitising is that module's own tested job.
    expect(reportFatalRenderError).toHaveBeenCalledTimes(1)
    expect(reportFatalRenderError.mock.calls[0]?.[0]).toBeInstanceOf(Error)
  })

  it('promises only the control it actually draws', () => {
    // THE DEFECT THIS PINS. The body said "Try again" unconditionally while the
    // control on an outside-the-four address read "Go to Home", so the copy
    // named a button the page did not have. The retry is now offered everywhere,
    // because re-rendering can succeed at any address — whether a destination
    // lights up in the navigation is a different question from whether a page
    // can be retried.
    for (const path of [CHAMPIONSHIP, '/account']) {
      const view = renderAt(path, <Boom throwing label="anything" />)
      const body = screen.getByText(/Your predictions and results are safe/).textContent ?? ''
      const retry = screen.getByRole('button', { name: 'Try again' })
      expect(retry, `${path} must draw the control its copy names`).toBeTruthy()
      expect(body).toContain('Try again')
      expect(screen.queryByRole('button', { name: 'Go to Home' })).toBeNull()
      view.unmount()
    }
  })

  it('navigates when a surviving destination is pressed', () => {
    renderAt(CHAMPIONSHIP, <Boom throwing label="championship" />)
    // The destination that threw took its `VNextShellProvider` with it, so
    // without the boundary supplying its own handler these controls would be
    // focusable, named and inert — worse than absent.
    fireEvent.click(screen.getAllByRole('button', { name: 'Matches' })[0] as HTMLElement)
    expect(screen.getByTestId('address').textContent).toBe(MATCHES)
  })

  it('sends a destination press to its real global address from outside a competition', () => {
    // `/account` holds no competition, so the four destinations cannot resolve
    // to a competition section. They must still go where their LABEL says:
    // sending Matches to Home is a control that lies, which is the same lesson
    // as an inert one.
    renderAt('/account', <Boom throwing label="account" />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Matches' })[0] as HTMLElement)
    expect(screen.getByTestId('address').textContent).toBe(weeklyRoutes.matches)
  })

  it('recovers on retry when the fault was transient', () => {
    let throwing = true
    function Flaky() {
      return <Boom throwing={throwing} label="recovered" />
    }
    renderAt(CHAMPIONSHIP, <Flaky />)
    expect(screen.getByText('This part of the app stopped working')).toBeTruthy()

    throwing = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('recovered')).toBeTruthy()
    expect(screen.queryByText('This part of the app stopped working')).toBeNull()
  })

  it('forgets the count once a render has succeeded, so a later fault is not escalated', () => {
    // THE DEFECT THIS PINS. The counter was only ever cleared by navigating
    // away, so a page that failed, recovered on the retry and then worked for
    // ten minutes would escalate STRAIGHT to the whole-document fallback the
    // next time anything went wrong — the exact outcome this component exists to
    // prevent. "Threw twice in a row" and "threw twice today" are different
    // evidence about determinism, and only the first justifies giving up.
    //
    // The page throws on mount, recovers on the retry, and then fails again at
    // the SAME address with a successful render in between. Nothing navigates,
    // so the pathname reset cannot be what saves it — only the successful render
    // can.
    let throwing = true
    function Flaky() {
      return <Boom throwing={throwing} label="working again" />
    }

    const view = renderAt(CHAMPIONSHIP, <Flaky />)
    expect(screen.getByText('This part of the app stopped working')).toBeTruthy()

    throwing = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('working again')).toBeTruthy()

    // A later render of the same page, which throws. Driven from the top rather
    // than from an event handler so it is the same kind of render pass as the
    // first failure was — the property under test is the counter, not React's
    // handling of a throw during an update.
    throwing = true
    view.rerender(
      <MemoryRouter initialEntries={[CHAMPIONSHIP]}>
        <Address />
        <Escalation>
          <Routes>
            <Route
              path="*"
              element={
                <VNextSurfaceBoundary>
                  <Flaky />
                </VNextSurfaceBoundary>
              }
            />
          </Routes>
        </Escalation>
      </MemoryRouter>,
    )

    expect(screen.queryByTestId('escalated'), 'a later fault is not a deterministic one').toBeNull()
    expect(screen.getByText('This part of the app stopped working')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('escalates rather than looping when the retry throws again immediately', () => {
    renderAt(CHAMPIONSHIP, <Boom throwing label="never" />)
    expect(screen.getByText('This part of the app stopped working')).toBeTruthy()

    // The retry throws again with nothing having rendered in between, which is
    // evidence the fault is deterministic. Repeating the same remedy is the loop
    // `UX-004` records, so the boundary hands it up to the one that can clear a
    // fault a re-render cannot.
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    // IT GOES UP AS THE ORIGINAL ERROR, so the boundary above files the real
    // stack rather than a stand-in this one invented.
    expect(screen.getByTestId('escalated').textContent).toBe('surface exploded')
    expect(screen.queryByText('This part of the app stopped working')).toBeNull()
  })

  it('lets the player leave a broken destination and USE the working one', () => {
    // THE WHOLE CLAIM, IN ONE CASE. One layout boundary over several addresses:
    // the Championship throws and Matches does not. Pressing Matches must show
    // Matches, not the Championship's failure wearing a new label.
    //
    // Without the reset in `getDerivedStateFromProps` the boundary stays failed
    // across the navigation and paints its notice over a destination that works
    // perfectly well — which is the same defect one level down as the one this
    // whole component exists to remove.
    renderSeam(CHAMPIONSHIP, CHAMPIONSHIP)
    expect(screen.getByText('This part of the app stopped working')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Matches' })[0] as HTMLElement)

    expect(screen.getByTestId('address').textContent).toBe(MATCHES)
    expect(screen.getByText('a working destination')).toBeTruthy()
    expect(screen.queryByText('This part of the app stopped working')).toBeNull()
    expect(screen.queryByTestId('escalated')).toBeNull()
  })

  it('forgives the count on the way back, so history cannot escalate a transient fault', () => {
    // Matches is the broken one this time, so the shell's own navigation can
    // leave it and return to it.
    //
    // Fail at Matches, go to Home (which works), come back. That second failure
    // is the FIRST at this address since the player left it, so it must get the
    // notice and a retry — not the escalation a running total would produce.
    renderSeam(MATCHES, MATCHES)
    expect(screen.getByText('This part of the app stopped working')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Home' })[0] as HTMLElement)
    expect(screen.getByText('a working destination')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'back to the broken one' }))
    expect(screen.getByTestId('address').textContent).toBe(MATCHES)
    expect(screen.queryByTestId('escalated')).toBeNull()
    expect(screen.getByText('This part of the app stopped working')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})

/**
 * THE HALF THAT IS ABOUT RESTRAINT.
 *
 * The boundary sits above `AppShell`, which holds every signed-in route — not
 * the fourteen cut-over ones. Answering for all of them would paint the Football
 * Hub's chrome over the Euro tournament's own pages, over the Matchday TV
 * screen, over `/admin`, and — worst — over a destination whose flag has been
 * rolled back, which is the one place the legacy chrome is the whole point of
 * the rollback.
 */
describe('an address a vNext surface does not own', () => {
  it('is not caught: the failure goes up with the original error', () => {
    // No flag stubbed for it, so `vNextOwnsFrame` answers false exactly as it
    // would in a build where this destination was never cut over.
    vi.unstubAllEnvs()
    renderAt(CHAMPIONSHIP, <Boom throwing label="championship" />)

    expect(screen.getByTestId('escalated').textContent).toBe('surface exploded')
    expect(screen.queryByText('This part of the app stopped working')).toBeNull()
    // And no navigation of any kind: the vNext shell must not appear at all.
    expect(screen.queryByRole('button', { name: 'Matches' })).toBeNull()
  })

  it('files no report of its own, leaving one event for the boundary above', () => {
    vi.unstubAllEnvs()
    renderAt(CHAMPIONSHIP, <Boom throwing label="championship" />)
    // `ApplicationErrorBoundary` reports this one with the real stack. Reporting
    // here as well would put two events in observability for one fault.
    expect(reportFatalRenderError).not.toHaveBeenCalled()
  })

  it('gets out of the way for a ROLLED BACK destination specifically', () => {
    // The case worth naming on its own, because it is the one that would have
    // broken a promise rather than merely looked wrong. `frameOwnership.ts`:
    // "turning a destination's flag off restores that one journey AND its legacy
    // chrome together." A boundary that painted vNext chrome over a rolled-back
    // page would have withdrawn exactly what the rollback restored.
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_CHAMPIONSHIP', 'false')
    renderAt(CHAMPIONSHIP, <Boom throwing label="championship" />)

    expect(screen.getByTestId('escalated').textContent).toBe('surface exploded')
    expect(screen.queryByText('This part of the app stopped working')).toBeNull()
  })
})

describe('a vNext surface that works', () => {
  it('is rendered untouched, and nothing is reported', () => {
    renderAt(CHAMPIONSHIP, <Boom throwing={false} label="the real page" />)
    expect(screen.getByText('the real page')).toBeTruthy()
    expect(screen.queryByText('This part of the app stopped working')).toBeNull()
    expect(reportFatalRenderError).not.toHaveBeenCalled()
  })
})
