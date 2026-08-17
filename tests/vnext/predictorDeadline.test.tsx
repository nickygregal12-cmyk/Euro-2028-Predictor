import { act, render, screen, within } from '@testing-library/react'
import { Profiler, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextMatchPredictor } from '../../src/vnext/predictor/VNextMatchPredictor'
import { closingPredictorModel, openPredictorModel } from '../../src/vnext/fixtures'
import type { PredictorActions, PredictorModel } from '../../src/vnext/models/predictor'

/**
 * THE DEADLINE THAT MUST STAY TRUE WHILE NOBODY TOUCHES THE PAGE.
 *
 * THE DEFECT THESE TESTS WERE WRITTEN AGAINST. Stage 7 stamped one instant into
 * the model when the connected model was built and drew every countdown against
 * it. The model rebuilds only when its React inputs change, so a player who
 * opened the card and then did nothing kept "Locks in 1 hr 25 min" on screen an
 * hour later — and, worse, nothing asked the application for a fresh answer when
 * wall-clock time crossed the deadline, so a tab left open across kickoff went on
 * drawing the last authoritative `open` state.
 *
 * WHAT IS BEING HELD, AND IT IS TWO THINGS THAT PULL AGAINST EACH OTHER:
 *
 *   1. browser time MAY refresh presentation, and MAY decide it is time to ask
 *      the application again;
 *   2. browser time MAY NEVER decide whether a player can edit.
 *
 * The second is the one that could cost somebody a matchweek, so it is asserted
 * in its own section over every control on the page — and asserted after the
 * clock has been driven hours past the lock, which is precisely the state a
 * `Date.now() >= lockAt` shortcut would have broken.
 *
 * FAKE TIMERS THROUGHOUT, and `vi.setSystemTime` where a BACKGROUND tab is being
 * simulated: a throttled or frozen tab is exactly the case where the clock moves
 * and the interval callback does not, and `advanceTimersByTime` cannot express
 * that because it fires everything it passes.
 */

/** jsdom implements no scrolling and does not define the method at all. */
HTMLElement.prototype.scrollIntoView = function scrollIntoView() {}

/** The fixture matchweek's deadline: its own earliest kickoff. */
const LOCK_AT = '2027-08-21T11:30:00.000Z'
/** Eighty-five minutes before it, which is `closing`'s own instant. */
const URGENT_NOW = '2027-08-21T10:05:00.000Z'

const MINUTE = 60_000

function recorder() {
  const calls: string[] = []
  const actions: PredictorActions = {
    setPrediction: (fixtureId, score) =>
      calls.push(`setPrediction:${fixtureId}:${score.home}-${score.away}`),
    clearPrediction: (fixtureId) => calls.push(`clearPrediction:${fixtureId}`),
    setJoker: (played) => calls.push(`setJoker:${played}`),
    confirmCard: () => calls.push('confirmCard'),
    retrySave: (fixtureId) => calls.push(`retrySave:${fixtureId}`),
    reload: () => calls.push('reload'),
  }
  return { calls, actions }
}

function renderPredictor(model: PredictorModel, actions: PredictorActions) {
  return render(
    <VNextRoot>
      <VNextMatchPredictor model={model} actions={actions} />
    </VNextRoot>,
  )
}

/** The brief's own headline, which is where the countdown a player reads lives. */
function briefCountdown(): string {
  const brief = screen.getByRole('complementary', { name: /summary$/i })
  const headline = within(brief).getByText(
    /min$|hr$|hr \d+ min$|days?$|Open for predictions|Locked|Deadline unconfirmed/,
  )
  return headline.textContent ?? ''
}

/** The masthead chip, which must never disagree with the brief. */
function chipCountdown(): string {
  const chip = document.querySelector('[data-kind]')
  return chip?.textContent ?? ''
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

/** What a tab returning to the foreground actually emits. */
function returnToForeground() {
  setVisibility('visible')
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.setSystemTime(new Date(URGENT_NOW))
  setVisibility('visible')
})

afterEach(() => {
  vi.useRealTimers()
})

/* ------------------------------------------------------------------------ *
 * 1 — the countdown stays true without the player doing anything
 * ------------------------------------------------------------------------ */

describe('the countdown while the page is simply open', () => {
  it('advances without a prediction, a save or a reload', () => {
    const { actions } = recorder()
    renderPredictor(closingPredictorModel, actions)

    // Eighty-five minutes out, from the model's own instant.
    expect(briefCountdown()).toBe('1 hr 25 min')

    act(() => {
      vi.advanceTimersByTime(10 * MINUTE)
    })

    // THE ASSERTION THE OLD IMPLEMENTATION FAILED. No command was issued, no
    // model was rebuilt and nothing was clicked — the only thing that happened is
    // that ten minutes passed.
    expect(briefCountdown()).toBe('1 hr 15 min')
  })

  it('keeps the masthead chip and the brief on the same instant', () => {
    const { actions } = recorder()
    renderPredictor(closingPredictorModel, actions)

    act(() => {
      vi.advanceTimersByTime(20 * MINUTE)
    })

    // ONE MECHANISM, so the two cannot drift. Two intervals would eventually
    // print two different numbers for one deadline.
    expect(briefCountdown()).toBe('1 hr 5 min')
    expect(chipCountdown()).toContain('1 hr 5 min')
  })

  it('does not rebuild the page every second to do it', () => {
    // COMMITS, counted by React itself. The display instant lives inside the page,
    // so a wrapper component would never re-render and would measure nothing; the
    // profiler sees the subtree actually being re-committed.
    let commits = 0
    const { actions } = recorder()

    render(
      <VNextRoot>
        <Profiler
          id="predictor"
          onRender={() => {
            commits += 1
          }}
        >
          <VNextMatchPredictor model={closingPredictorModel} actions={actions} />
        </Profiler>
      </VNextRoot>,
    )
    const initial = commits

    act(() => {
      vi.advanceTimersByTime(MINUTE)
    })

    // A minute of a minute-granularity countdown is a handful of commits, not
    // sixty. The exact cadence is an implementation decision; that it is coarse is
    // not — this page holds ten live score inputs and re-rendering them per second
    // to change a number once is the churn the correction was told not to add.
    expect(commits).toBeGreaterThan(initial)
    expect(commits - initial).toBeLessThanOrEqual(8)
  })

  it('stops when the page goes away, so an unmounted card cannot tick', () => {
    const { actions } = recorder()
    const view = renderPredictor(closingPredictorModel, actions)
    view.unmount()

    // A timer surviving an unmount would set state on a dead tree; the failure
    // mode is a warning today and a leak in every case after it.
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(60 * MINUTE)
      })
    }).not.toThrow()
  })
})

/* ------------------------------------------------------------------------ *
 * 2 — reaching the authoritative boundary asks the authority
 * ------------------------------------------------------------------------ */

describe('crossing the lock instant', () => {
  it('asks the application to reload rather than locking the card itself', () => {
    const { calls, actions } = recorder()
    renderPredictor(closingPredictorModel, actions)

    expect(calls).toEqual([])

    act(() => {
      vi.advanceTimersByTime(86 * MINUTE)
    })

    // THE EXISTING RECOVERY COMMAND, and nothing else.
    expect(calls).toEqual(['reload'])
  })

  it('manufactures no locked state while it waits for the answer', () => {
    const { actions } = recorder()
    renderPredictor(closingPredictorModel, actions)

    act(() => {
      vi.advanceTimersByTime(120 * MINUTE)
    })

    // The card the application last described is still an OPEN card, so the page
    // still draws an open card. The countdown has run out and says so in the one
    // way that is not a claim about permission — it stops being a number.
    expect(screen.queryByText(/^Locked$/)).toBeNull()
    expect(screen.queryByText(/padlock/i)).toBeNull()
    expect(briefCountdown()).toBe('Open for predictions')
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
  })

  it('asks nothing of a card the application has already closed', () => {
    const { calls, actions } = recorder()
    // A closed card has an outcome, not a deadline. Asking again on a timer would
    // be polling for one.
    renderPredictor(
      {
        ...closingPredictorModel,
        lock: { ...closingPredictorModel.lock, kind: 'closed', urgency: null },
      },
      actions,
    )

    act(() => {
      vi.advanceTimersByTime(300 * MINUTE)
    })

    expect(calls).toEqual([])
  })

  it('asks nothing where the application resolved no instant at all', () => {
    const { calls, actions } = recorder()
    renderPredictor(
      { ...closingPredictorModel, lock: { ...closingPredictorModel.lock, at: null } },
      actions,
    )

    act(() => {
      vi.advanceTimersByTime(300 * MINUTE)
    })

    // A fail-closed lock has no boundary to cross, and inventing one would be the
    // browser giving a deadline to a card the domain refused to give one.
    expect(calls).toEqual([])
  })
})

/* ------------------------------------------------------------------------ *
 * 3 — the authority is allowed to say "still open", and be believed
 * ------------------------------------------------------------------------ */

describe('when the reload comes back still open', () => {
  it('does not ask again for the same boundary, however long the page stays up', () => {
    /**
     * THE REFRESH LOOP THIS SECTION EXISTS TO RULE OUT. A server may legitimately
     * still report an open card after its stated instant — a rule of its own,
     * changed fixture data, a lock it resolves differently, clock skew. A page
     * that re-asked on every tick would then hammer the card read for as long as
     * the tab stayed open.
     */
    const { calls, actions } = recorder()

    function StillOpen() {
      const [model, setModel] = useState(closingPredictorModel)
      return (
        <VNextMatchPredictor
          model={model}
          actions={{
            ...actions,
            reload: () => {
              actions.reload()
              // The authority answers, and its answer is the same open card at the
              // same instant — freshly stamped, which is what a real reload does.
              setModel((current) => ({ ...current, generatedAt: new Date().toISOString() }))
            },
          }}
        />
      )
    }

    render(
      <VNextRoot>
        <StillOpen />
      </VNextRoot>,
    )

    act(() => {
      vi.advanceTimersByTime(86 * MINUTE)
    })
    expect(calls).toEqual(['reload'])

    act(() => {
      vi.advanceTimersByTime(240 * MINUTE)
    })

    // Exactly one, four hours later. The watch re-arms only when the AUTHORITY
    // supplies a different instant.
    expect(calls).toEqual(['reload'])

    // And the page still reflects the authoritative answer rather than a local
    // opinion about it.
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
    expect(briefCountdown()).toBe('Open for predictions')
  })

  it('arms exactly once more when the authority supplies a new deadline', () => {
    const { calls, actions } = recorder()
    const LATER = '2027-08-21T13:00:00.000Z'

    function Rescheduled() {
      const [model, setModel] = useState(closingPredictorModel)
      return (
        <VNextMatchPredictor
          model={model}
          actions={{
            ...actions,
            reload: () => {
              actions.reload()
              // The postponement case, and the one that makes a single-slot memory
              // correct rather than merely cheap: the same card, a new instant.
              setModel((current) => ({
                ...current,
                generatedAt: new Date().toISOString(),
                lock: { ...current.lock, at: LATER },
              }))
            },
          }}
        />
      )
    }

    render(
      <VNextRoot>
        <Rescheduled />
      </VNextRoot>,
    )

    // Exactly to the boundary, so the instant the rebuilt model is stamped with is
    // the deadline itself and the new countdown is arithmetic a reader can check:
    // 13:00 minus 11:30 is an hour and a half.
    act(() => {
      vi.advanceTimersByTime(85 * MINUTE)
    })
    expect(calls).toEqual(['reload'])

    // The new deadline is the active one, counted from the new instant.
    expect(briefCountdown()).toBe('1 hr 30 min')

    act(() => {
      vi.advanceTimersByTime(30 * MINUTE)
    })
    expect(calls).toEqual(['reload'])

    act(() => {
      vi.advanceTimersByTime(70 * MINUTE)
    })

    // One more, for the new boundary. Not two, and not a stream.
    expect(calls).toEqual(['reload', 'reload'])
  })
})

/* ------------------------------------------------------------------------ *
 * 4 — a timer belongs to the predictor that armed it
 * ------------------------------------------------------------------------ */

describe('identity', () => {
  /**
   * THE SCREEN'S OWN CONSTRUCTION, reproduced.
   *
   * `VNextPredictorScreen` renders the component that owns the card with a `key`
   * of the request identity — account, competition, season, matchweek — precisely
   * so a change of any of them REMOUNTS rather than recomposing. That is Stage 7's
   * accepted protection and this correction leans on it rather than adding a
   * second mechanism: every timer and every listener lives in the keyed subtree,
   * so the identity that armed a timer is the only identity that can still be
   * there when it fires.
   */
  function Keyed({
    identity,
    model,
    actions,
  }: {
    identity: string
    model: PredictorModel
    actions: PredictorActions
  }) {
    return (
      <VNextRoot>
        <VNextMatchPredictor key={identity} model={model} actions={actions} />
      </VNextRoot>
    )
  }

  it('cannot reload a different matchweek than the one it was armed for', () => {
    const mw4 = { calls: [] as string[] }
    const mw5 = { calls: [] as string[] }
    const actionsFor = (sink: { calls: string[] }): PredictorActions => ({
      setPrediction: () => {},
      clearPrediction: () => {},
      setJoker: () => {},
      confirmCard: () => {},
      retrySave: () => {},
      reload: () => sink.calls.push('reload'),
    })

    const view = render(
      <Keyed
        identity='["player-a","caledonian-premiership","2027-28",4]'
        model={closingPredictorModel}
        actions={actionsFor(mw4)}
      />,
    )

    // Eighty minutes in: armed, five minutes from its boundary, nothing fired.
    act(() => {
      vi.advanceTimersByTime(80 * MINUTE)
    })
    expect(mw4.calls).toEqual([])

    // Matchweek 5, whose card is a different card with its own deadline nineteen
    // hours out. The identity changed, so the subtree is a new subtree.
    view.rerender(
      <Keyed
        identity='["player-a","caledonian-premiership","2027-28",5]'
        model={openPredictorModel}
        actions={actionsFor(mw5)}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(60 * MINUTE)
    })

    // MATCHWEEK 4's BOUNDARY PASSED WHILE MATCHWEEK 5 WAS ON SCREEN, and neither
    // predictor was reloaded: the old timer is gone, and the new one is not due.
    expect(mw4.calls).toEqual([])
    expect(mw5.calls).toEqual([])
  })

  it('cannot reload a different account than the one it was armed for', () => {
    const playerA = { calls: [] as string[] }
    const playerB = { calls: [] as string[] }
    const actionsFor = (sink: { calls: string[] }): PredictorActions => ({
      setPrediction: () => {},
      clearPrediction: () => {},
      setJoker: () => {},
      confirmCard: () => {},
      retrySave: () => {},
      reload: () => sink.calls.push('reload'),
    })

    const view = render(
      <Keyed
        identity='["player-a","caledonian-premiership","2027-28",4]'
        model={closingPredictorModel}
        actions={actionsFor(playerA)}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(80 * MINUTE)
    })

    // A different account, and — as the identity says — a different competition
    // and matchweek with it, which is the switch a shared device actually makes.
    view.rerender(
      <Keyed
        identity='["player-b","scottish-premiership","2027-28",5]'
        model={openPredictorModel}
        actions={actionsFor(playerB)}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(60 * MINUTE)
    })

    expect(playerA.calls).toEqual([])
    expect(playerB.calls).toEqual([])
  })
})

/* ------------------------------------------------------------------------ *
 * 5 — a background tab catches up rather than staying wrong
 * ------------------------------------------------------------------------ */

describe('a tab that was in the background', () => {
  it('catches the countdown up when it comes back', () => {
    const { calls, actions } = recorder()
    renderPredictor(closingPredictorModel, actions)
    expect(briefCountdown()).toBe('1 hr 25 min')

    // HIDDEN, AND THE INTERVAL DOES NOT FIRE. `setSystemTime` moves the clock
    // without running a timer, which is what a throttled or frozen tab looks
    // like — and the reason the fix cannot rely on a well-timed callback.
    setVisibility('hidden')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    vi.setSystemTime(new Date(Date.parse(URGENT_NOW) + 40 * MINUTE))

    // Nothing has been re-read, so the page is still showing what it was.
    expect(briefCountdown()).toBe('1 hr 25 min')

    returnToForeground()

    // The current clock, not the next scheduled tick.
    expect(briefCountdown()).toBe('45 min')
    expect(calls).toEqual([])
  })

  it('asks the authority for a card whose deadline passed while it was hidden', () => {
    const { calls, actions } = recorder()
    renderPredictor(closingPredictorModel, actions)

    setVisibility('hidden')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    // Three hours in another tab, straight across kickoff, with no interval
    // callback having fired at all.
    vi.setSystemTime(new Date(Date.parse(URGENT_NOW) + 180 * MINUTE))
    expect(calls).toEqual([])

    returnToForeground()

    // THE CASE THE FINDING WAS ACTUALLY ABOUT. The player is back, the matchweek
    // kicked off while they were away, and the page's first act is to ask.
    expect(calls).toEqual(['reload'])
    // And still not to decide: the card on screen is the one the application last
    // described, until it describes another.
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
  })

  it('catches up on a window focus as well, for the browsers that send that instead', () => {
    const { actions } = recorder()
    renderPredictor(closingPredictorModel, actions)

    vi.setSystemTime(new Date(Date.parse(URGENT_NOW) + 30 * MINUTE))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(briefCountdown()).toBe('55 min')
  })
})

/* ------------------------------------------------------------------------ *
 * 6 — THE REGRESSION THAT MATTERS MOST: time is not an authority
 * ------------------------------------------------------------------------ */

describe('browser time is never a permission', () => {
  /**
   * READ THIS SECTION BEFORE CHANGING ANYTHING ABOVE IT.
   *
   * The cheap fix for a stale countdown is `if (Date.now() >= lockAt) editable =
   * false`, and it is wrong in the direction that costs a player their matchweek:
   * the lock instant is the domain's under a policy with a buffer, the server can
   * legitimately still accept a save after it, a device clock can be minutes fast,
   * and a page that closed itself would refuse an edit the application would have
   * taken. Editability, the lock, the Joker and settlement are the application's
   * answers. The clock may make a countdown current and may ask for a new answer.
   * It may not answer.
   */
  const passed = () =>
    act(() => {
      // A full day and an hour, which puts the display instant past the fixture
      // matchweek's deadline from EITHER scenario's anchor — `closing` sits eighty
      // five minutes out and `open` nineteen hours — and past every kickoff on the
      // card either way.
      vi.advanceTimersByTime(25 * 60 * MINUTE)
    })

  it('leaves every score control on an open card exactly where it was', () => {
    const { actions } = recorder()
    renderPredictor(closingPredictorModel, actions)

    const boxesBefore = screen.getAllByRole('textbox').length
    const steppersBefore = screen.getAllByRole('button', { name: /add one to|take one off/i }).length
    expect(boxesBefore).toBeGreaterThan(0)

    passed()

    expect(screen.getAllByRole('textbox')).toHaveLength(boxesBefore)
    expect(screen.getAllByRole('button', { name: /add one to|take one off/i })).toHaveLength(
      steppersBefore,
    )
  })

  it('leaves the Joker and the confirm command exactly as the authority stated them', () => {
    const { actions } = recorder()
    // `open` is the scenario whose Joker has not been played and whose card can
    // still be confirmed, so both controls are present to be taken away.
    renderPredictor(openPredictorModel, actions)

    const joker = screen.getByRole('button', { name: /joker/i })
    const confirm = screen.getByRole('button', { name: /confirm card/i })
    expect(joker).toBeInTheDocument()
    expect(confirm).toBeInTheDocument()

    passed()

    expect(screen.getByRole('button', { name: /joker/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm card/i })).toBeInTheDocument()
  })

  it('commands still go out after the instant has passed, because the server decides', () => {
    const { calls, actions } = recorder()
    renderPredictor(openPredictorModel, actions)

    passed()

    // The boundary refresh was requested; that is the only thing the clock did.
    expect(calls).toEqual(['reload'])

    screen.getByRole('button', { name: /confirm card/i }).click()

    // A page that had locked itself would have swallowed this. The command is
    // issued and the server refuses it or does not — which is where that decision
    // has always belonged.
    expect(calls).toEqual(['reload', 'confirmCard'])
  })

  it('does not talk a locked card into offering controls either', () => {
    const { actions } = recorder()
    // The mirror direction. A lock instant far in the future cannot make a closed
    // card editable, and the display instant advancing towards it cannot either.
    renderPredictor(
      {
        ...openPredictorModel,
        editable: false,
        phase: 'locked',
        lock: { ...openPredictorModel.lock, kind: 'closed', urgency: null, at: LOCK_AT },
        fixtures: openPredictorModel.fixtures.map((fixture) => ({
          ...fixture,
          editable: false,
          state: 'locked' as const,
        })),
      },
      actions,
    )

    passed()

    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /^clear/i })).toBeNull()
  })
})
