import { render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextMatchPredictor } from '../../src/vnext/predictor/VNextMatchPredictor'
import {
  closingPredictorModel,
  completePredictorModel,
  conflictPredictorModel,
  emptyPredictorModel,
  lockedPredictorModel,
  openPredictorModel,
  predictorScenarios,
  reducedPredictorModel,
  rehearsePredictor,
  settledPredictorModel,
  unavailablePredictorModel,
  untouchedPredictorModel,
} from '../../src/vnext/fixtures'
import type { PredictorActions, PredictorModel } from '../../src/vnext/models/predictor'
import { at } from '../support/indexed'

/**
 * WHAT THE vNEXT MATCH PREDICTOR MUST NOT BE ABLE TO GET WRONG.
 *
 * Not a DOM snapshot. Composition, overflow and width behaviour are measured in a
 * real browser by `e2e/vnext-predictor.spec.ts`, because jsdom evaluates no
 * container query and computes no layout, and a frozen render tree would fail on
 * every deliberate improvement.
 *
 * What is held here is the set of promises that must survive any redesign of this
 * page — and the first three are the ones that could cost a player a matchweek:
 *
 *   1. A LOCKED CARD EXPOSES NO EDITABLE CONTROL. Not disabled: absent.
 *   2. THE SERVER'S `editable` IS THE AUTHORITY, and the surface obeys it even
 *      when the calendar disagrees loudly.
 *   3. A SCORE CHANGE CANNOT SILENTLY TARGET THE OPPOSITE TEAM, and a half-entered
 *      prediction is never completed with an invented zero.
 *   4. Consensus does not appear when the read refused it.
 *   5. The Joker cannot be enabled when the authority says it is unavailable.
 *   6. Missing optional enrichment reduces information rather than breaking a row.
 *   7. Nothing on the page recreates a ranking, a score or a lock.
 *   8. State is stated in WORDS and in a SHAPE, never by colour alone.
 *   9. The accessibility floor the foundation set.
 *  10. Reduced motion changes the animation and never the content.
 */

/**
 * jsdom implements no scrolling and does not define the method at all, so it is
 * assigned once here rather than spied on per test. Every assertion in this file is
 * about where FOCUS lands; keeping the row on screen afterwards is the browser
 * suite's business.
 */
HTMLElement.prototype.scrollIntoView = function scrollIntoView() {}

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
/** jsdom has no layout, so it can neither confirm nor deny a contrast ratio. */
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

const SCENARIOS = [
  { name: 'untouched', model: untouchedPredictorModel },
  { name: 'open', model: openPredictorModel },
  { name: 'closing', model: closingPredictorModel },
  { name: 'complete', model: completePredictorModel },
  { name: 'locked', model: lockedPredictorModel },
  { name: 'settled', model: settledPredictorModel },
  { name: 'reduced', model: reducedPredictorModel },
  { name: 'unavailable', model: unavailablePredictorModel },
  { name: 'conflict', model: conflictPredictorModel },
  { name: 'empty', model: emptyPredictorModel },
] as const

function spyActions(): PredictorActions & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    setPrediction: (fixtureId, score) =>
      calls.push(`setPrediction:${fixtureId}:${score.home}-${score.away}`),
    clearPrediction: (fixtureId) => calls.push(`clearPrediction:${fixtureId}`),
    setJoker: (played) => calls.push(`setJoker:${played}`),
    confirmCard: () => calls.push('confirmCard'),
    retrySave: (fixtureId) => calls.push(`retrySave:${fixtureId}`),
    reload: () => calls.push('reload'),
    refreshAfterDeadline: () => calls.push('refreshAfterDeadline'),
  }
}

function renderPredictor(model: PredictorModel, actions: PredictorActions = spyActions()) {
  return render(
    <VNextRoot>
      <VNextMatchPredictor model={model} actions={actions} />
    </VNextRoot>,
  )
}

/**
 * THE PAGE WIRED TO A MODEL THAT ACTUALLY MOVES.
 *
 * Needed for the assertions about what a BOX ends up holding, rather than about
 * which command was issued. The surface treats the model as the truth: it holds a
 * half-entered scoreline locally and otherwise re-seeds from `fixture.prediction`,
 * so against a no-op action a committed edit is correctly reverted on the next
 * render. That is the right behaviour and it means a test about persistence needs
 * something that persists. `rehearsePredictor` is that, and it cannot change
 * editability, the lock, the phase or the Joker's playability.
 */
function Harness({ initial }: { initial: PredictorModel }) {
  const [model, setModel] = useState(initial)
  const actions: PredictorActions = {
    setPrediction: (fixtureId, score) =>
      setModel((current) => rehearsePredictor(current, { kind: 'setPrediction', fixtureId, score })),
    clearPrediction: (fixtureId) =>
      setModel((current) => rehearsePredictor(current, { kind: 'clearPrediction', fixtureId })),
    setJoker: (played) =>
      setModel((current) => rehearsePredictor(current, { kind: 'setJoker', played })),
    confirmCard: () => setModel((current) => rehearsePredictor(current, { kind: 'confirmCard' })),
    retrySave: () => {},
    reload: () => {},
    refreshAfterDeadline: () => {},
  }
  return <VNextMatchPredictor model={model} actions={actions} />
}

function renderLive(model: PredictorModel) {
  return render(
    <VNextRoot>
      <Harness initial={model} />
    </VNextRoot>,
  )
}

async function scan(ui: ReactElement) {
  const { unmount } = render(ui)
  try {
    const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } })
    const failing = [
      ...results.violations,
      ...results.incomplete.filter((result) => !JSDOM_CANNOT_EVALUATE.has(result.id)),
    ].filter((result) => result.impact && FAIL_IMPACTS.has(result.impact))

    expect(
      failing,
      failing
        .map(
          (violation) =>
            `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
              .slice(0, 3)
              .map((node) => node.html.slice(0, 140))
              .join(' | ')}`,
        )
        .join('\n'),
    ).toEqual([])
  } finally {
    unmount()
  }
}

/* ------------------------------------------------------------------------ *
 * 1 and 2 — editability is the application's, and the surface obeys it
 * ------------------------------------------------------------------------ */

describe('editability', () => {
  it('renders no score control at all on a locked card', () => {
    renderPredictor(lockedPredictorModel)

    // ABSENT, NOT DISABLED. A locked matchweek that merely greyed its inputs
    // would still be one keyboard away from a write the server would reject, and
    // this repository removed its last disabled controls on the grounds that a
    // greyed control is a refusal spelled in opacity.
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /add one to/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^clear/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /confirm card/i })).toBeNull()
  })

  it.each([
    ['locked', lockedPredictorModel],
    ['settled', settledPredictorModel],
    ['unavailable', unavailablePredictorModel],
    ['conflict', conflictPredictorModel],
  ] as const)('exposes no editable control in the %s state', (_name, model) => {
    renderPredictor(model)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
  })

  it('obeys the server’s editable flag even when the deadline says otherwise', () => {
    // THE DECISIVE PROOF that this surface consumes a permission rather than
    // computing one. The lock instant is in 1999 and the card says it is open; the
    // page must offer controls, because the application — not the calendar —
    // decides. A page that compared `lock.at` to `generatedAt` would fail here.
    const contradictory: PredictorModel = {
      ...openPredictorModel,
      lock: { ...openPredictorModel.lock, at: '1999-01-01T00:00:00.000Z', urgency: 'urgent' },
    }
    renderPredictor(contradictory)
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
  })

  it('withholds controls when the server says locked even though the deadline is far away', () => {
    // The mirror, which is the direction that actually protects a player: a lock
    // instant in 2099 cannot talk a locked card into offering an input.
    const contradictory: PredictorModel = {
      ...lockedPredictorModel,
      lock: { ...lockedPredictorModel.lock, at: '2099-01-01T00:00:00.000Z' },
    }
    renderPredictor(contradictory)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  })

  it('never offers a jump target on a card it cannot edit', () => {
    renderPredictor(lockedPredictorModel)
    expect(screen.queryByRole('button', { name: /go to the (next|last)/i })).toBeNull()
  })
})

/* ------------------------------------------------------------------------ *
 * 3 — score entry cannot target the wrong club, and never invents a zero
 * ------------------------------------------------------------------------ */

describe('score entry', () => {
  it('names each box after its own club, so ownership is never positional', () => {
    renderPredictor(openPredictorModel)
    const fixture = at(openPredictorModel.fixtures, 0)

    expect(
      screen.getByRole('textbox', { name: `${fixture.home.team.name} score` }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: `${fixture.away.team.name} score` }),
    ).toBeInTheDocument()
    // "Home score" would be distinct and would still make a screen-reader user
    // work out which club is at home from somewhere else on the row.
    expect(screen.queryByRole('textbox', { name: /^home score$/i })).toBeNull()
  })

  it('sends a stepped home goal to the home side and leaves the away side alone', async () => {
    const user = userEvent.setup()
    const actions = spyActions()
    renderPredictor(openPredictorModel, actions)

    // Fixture 0 is entered 2–1 in this scenario, so stepping home reaches 3–1.
    const fixture = at(openPredictorModel.fixtures, 0)
    await user.click(
      screen.getByRole('button', { name: `Add one to ${fixture.home.team.name} score` }),
    )

    expect(actions.calls).toEqual([`setPrediction:${fixture.id}:3-1`])
  })

  it('sends a stepped away goal to the away side and leaves the home side alone', async () => {
    const user = userEvent.setup()
    const actions = spyActions()
    renderPredictor(openPredictorModel, actions)

    const fixture = at(openPredictorModel.fixtures, 0)
    await user.click(
      screen.getByRole('button', { name: `Add one to ${fixture.away.team.name} score` }),
    )

    expect(actions.calls).toEqual([`setPrediction:${fixture.id}:2-2`])
  })

  it('issues no command from half a scoreline, and never completes it with a zero', async () => {
    const user = userEvent.setup()
    const actions = spyActions()
    renderPredictor(openPredictorModel, actions)

    // Fixture 1 is empty in this scenario. Stepping ONE side must leave the other
    // visibly un-entered and must not save: `save_season_prediction` refuses one
    // score without the other, so the only way to complete this command would be
    // to invent the away goal — which is exactly the legacy page's `?? 0`.
    const fixture = at(openPredictorModel.fixtures, 1)
    await user.click(
      screen.getByRole('button', { name: `Add one to ${fixture.home.team.name} score` }),
    )

    expect(actions.calls).toEqual([])
    expect(
      screen.getByRole('textbox', { name: `${fixture.home.team.name} score` }),
    ).toHaveValue('0')
    expect(
      screen.getByRole('textbox', { name: `${fixture.away.team.name} score` }),
    ).toHaveValue('')
  })

  it('says the fixture needs both scores while only one is entered', async () => {
    const user = userEvent.setup()
    renderPredictor(openPredictorModel)

    const fixture = at(openPredictorModel.fixtures, 1)
    await user.click(
      screen.getByRole('button', { name: `Add one to ${fixture.home.team.name} score` }),
    )

    expect(screen.getByText('Needs both scores')).toBeInTheDocument()
  })

  it('commits once both sides are present', async () => {
    const user = userEvent.setup()
    const actions = spyActions()
    renderPredictor(openPredictorModel, actions)

    const fixture = at(openPredictorModel.fixtures, 1)
    await user.click(
      screen.getByRole('button', { name: `Add one to ${fixture.home.team.name} score` }),
    )
    await user.click(
      screen.getByRole('button', { name: `Add one to ${fixture.away.team.name} score` }),
    )

    expect(actions.calls).toEqual([`setPrediction:${fixture.id}:0-0`])
  })

  it('steps an empty box to zero rather than to one', async () => {
    const user = userEvent.setup()
    renderPredictor(openPredictorModel)

    // A nil is the single most predicted score, so it costs one tap rather than
    // two. This is the legacy score input's own decision, kept because it was
    // paid for by a player's complaint.
    const fixture = at(openPredictorModel.fixtures, 1)
    await user.click(
      screen.getByRole('button', { name: `Add one to ${fixture.home.team.name} score` }),
    )
    expect(
      screen.getByRole('textbox', { name: `${fixture.home.team.name} score` }),
    ).toHaveValue('0')
  })

  it('clears the prediction only when both sides go empty', async () => {
    const user = userEvent.setup()
    const actions = spyActions()
    renderPredictor(openPredictorModel, actions)

    const fixture = at(openPredictorModel.fixtures, 0)
    const home = screen.getByRole('textbox', { name: `${fixture.home.team.name} score` })
    const away = screen.getByRole('textbox', { name: `${fixture.away.team.name} score` })

    await user.clear(home)
    // One side emptied is a correction in progress, not a deletion. Throwing the
    // other number away here would be the mirror of the invented zero.
    expect(actions.calls).toEqual([])

    await user.clear(away)
    expect(actions.calls).toEqual([`clearPrediction:${fixture.id}`])
  })

  it('advances a typed digit from the home box to the away box of the same fixture', async () => {
    const user = userEvent.setup()
    renderPredictor(untouchedPredictorModel)

    const fixture = at(untouchedPredictorModel.fixtures, 0)
    const home = screen.getByRole('textbox', { name: `${fixture.home.team.name} score` })
    await user.click(home)
    await user.keyboard('2')

    expect(screen.getByRole('textbox', { name: `${fixture.away.team.name} score` })).toHaveFocus()
  })

  it('clamps a typed score to the two digits the schema allows', async () => {
    const user = userEvent.setup()
    renderLive(openPredictorModel)

    const fixture = at(openPredictorModel.fixtures, 0)
    const home = screen.getByRole('textbox', { name: `${fixture.home.team.name} score` })
    // Typed into a box that ALREADY holds a value, deliberately: no auto-advance
    // fires out of a filled box, which is what protects a two-digit score.
    await user.type(home, '999')

    // `season_predictions.home_score` is checked between 0 and 99, so the box holds
    // two digits and nothing here can ask the server for a third.
    expect(home).toHaveValue('99')
  })

  it('offers a retry on a failed save and never on a conflict', () => {
    renderPredictor(closingPredictorModel)
    // Fixture 8 is in `error` in this scenario and fixture 4 is `saving`.
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.getByText('Not saved')).toBeInTheDocument()
    expect(screen.getByText('Saving')).toBeInTheDocument()
  })

  it('says a row is stale rather than offering to overwrite somebody', () => {
    renderPredictor(conflictPredictorModel)
    expect(screen.getByText('Changed elsewhere')).toBeInTheDocument()
    // A version conflict is terminal. The page-level notice offers the reload.
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
    expect(screen.getByRole('button', { name: /reload this matchweek/i })).toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------------ *
 * 4 — consensus is consumed, never inferred
 * ------------------------------------------------------------------------ */

describe('community consensus', () => {
  it('shows no crowd split anywhere on an open card', () => {
    renderPredictor(openPredictorModel)
    // The server refuses consensus before the matchweek locks, so the model
    // carries none — and the surface must not have a second way to produce one.
    expect(screen.queryByText(/% home/i)).toBeNull()
    expect(screen.queryByText(/community predictions/i)).toBeNull()
  })

  it('shows the crowd split once the read has offered one', () => {
    renderPredictor(lockedPredictorModel)
    expect(screen.getAllByText(/% home/i).length).toBeGreaterThan(0)
  })

  it('never labels the crowd as odds or prices it', () => {
    renderPredictor(lockedPredictorModel)
    // This is a football prediction game. Sportsbook vocabulary is the fastest
    // way to make it look like something it is not.
    const body = document.body.textContent ?? ''
    // WORD BOUNDARIES, NOT SUBSTRINGS. A club called "Tarbeth Moor Academical"
    // contains "bet", and a test that reported that as a sportsbook term would be
    // a test nobody could keep.
    for (const word of ['odds', 'stake', 'stakes', 'bet', 'bets', 'market', 'payout', 'returns']) {
      expect(body, word).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'))
    }
  })

  it('says nothing about a lock when it has no consensus to show', () => {
    renderPredictor(reducedPredictorModel)
    // The reduced scenario has `enrichment.consensus: false`, which is a
    // different sentence from "this fixture has no split" and neither of them
    // mentions a deadline.
    expect(screen.queryByText(/until the matchweek locks/i)).toBeNull()
  })
})

/* ------------------------------------------------------------------------ *
 * 5 — the Joker is the application's decision
 * ------------------------------------------------------------------------ */

describe('the Joker', () => {
  it('is a control when the application permits it', () => {
    renderPredictor(openPredictorModel)
    expect(screen.getByRole('button', { name: /play your joker/i })).toBeInTheDocument()
  })

  it('is a sentence, not a disabled button, when the application refuses it', () => {
    renderPredictor(lockedPredictorModel)
    expect(screen.queryByRole('button', { name: /joker/i })).toBeNull()
    expect(screen.getByText(/joker played on this matchweek/i)).toBeInTheDocument()
    expect(screen.getByText('This matchweek is locked.')).toBeInTheDocument()
  })

  it('cannot be pressed into a state the authority says is unavailable', async () => {
    const user = userEvent.setup()
    const actions = spyActions()
    // The allowance is spent and the application says so. The surface must not
    // find another route to the command.
    const spent: PredictorModel = {
      ...openPredictorModel,
      joker: {
        playedHere: false,
        remainingThisHalf: 0,
        playable: false,
        refusal: 'You have no Jokers left for this half of the season.',
      },
    }
    renderPredictor(spent, actions)

    expect(screen.queryByRole('button', { name: /joker/i })).toBeNull()
    expect(
      screen.getByText('You have no Jokers left for this half of the season.'),
    ).toBeInTheDocument()

    // Nothing anywhere on the page can issue the command.
    for (const button of screen.getAllByRole('button')) await user.click(button)
    expect(actions.calls.filter((call) => call.startsWith('setJoker'))).toEqual([])
  })

  it('reports the played state through the pressed state and the words together', () => {
    renderPredictor(closingPredictorModel)
    const joker = screen.getByRole('button', { name: /joker played/i })
    expect(joker).toHaveAttribute('aria-pressed', 'true')
    // Never the attribute alone: the label changes with it.
    expect(joker).toHaveTextContent(/joker played/i)
  })
})

/* ------------------------------------------------------------------------ *
 * 6 — missing enrichment reduces information rather than breaking a row
 * ------------------------------------------------------------------------ */

describe('degraded data', () => {
  it('renders every fixture with no form, no table and no consensus', () => {
    const { container } = renderPredictor(reducedPredictorModel)
    // Scoped to the fixture lists: the shell renders two navigations and each of
    // them is a list too, so a bare `listitem` query counts the navigation.
    expect(container.querySelectorAll('main ol > li')).toHaveLength(
      reducedPredictorModel.fixtures.length,
    )
    expect(screen.getAllByRole('textbox')).toHaveLength(
      reducedPredictorModel.fixtures.length * 2,
    )
  })

  it('prints no zero where a league position is unknown', () => {
    renderPredictor(reducedPredictorModel)
    expect(screen.queryByText('0th')).toBeNull()
    expect(screen.queryByText(/0 in the table/i)).toBeNull()
  })

  it('keeps "has not played" apart from "could not be read"', () => {
    // Two different silences. The open scenario has a club with nothing settled
    // and a form read that DID answer; the reduced scenario has neither.
    const withForm = render(
      <VNextRoot>
        <VNextMatchPredictor model={openPredictorModel} actions={spyActions()} />
      </VNextRoot>,
    )
    expect(withForm.container.textContent).toContain('W')
    withForm.unmount()

    renderPredictor(reducedPredictorModel)
    expect(screen.queryByRole('img', { name: /recent form/i })).toBeNull()
  })

  it('says a matchweek with no fixtures is empty rather than failing', () => {
    const { container } = renderPredictor(emptyPredictorModel)
    expect(screen.getByText(/no fixtures published yet/i)).toBeInTheDocument()
    expect(container.querySelectorAll('main ol > li')).toHaveLength(0)
  })

  it('shows no countdown when the deadline could not be resolved', () => {
    renderPredictor(unavailablePredictorModel)
    expect(screen.getByText('Deadline unconfirmed')).toBeInTheDocument()
    // An unavailable lock is NOT a deadline, and must never be described as one.
    expect(screen.queryByText(/^locks in/i)).toBeNull()
  })

  it('says a kickoff is unconfirmed rather than formatting nothing', () => {
    renderPredictor(unavailablePredictorModel)
    expect(screen.getByText('Kickoff to be confirmed')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Date to be confirmed' })).toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------------ *
 * 7 — nothing here recreates a rule
 * ------------------------------------------------------------------------ */

describe('rules the surface does not own', () => {
  it('prints no per-fixture points figure, because the application states none', () => {
    renderPredictor(settledPredictorModel)
    // The matchweek's banked total appears once. A per-fixture number would have
    // to come from the rule's own arithmetic, which is the browser stating an
    // awarded point.
    expect(screen.getByText('34')).toBeInTheDocument()
    expect(screen.queryAllByText(/\d+ pts$/)).toHaveLength(0)
  })

  it('shows the settled total from the model and never a sum of the rows', () => {
    const contradictory: PredictorModel = { ...settledPredictorModel, settledPoints: 7 }
    renderPredictor(contradictory)
    // The verdicts still say three exact scores. The total is the server's.
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.queryByText('34')).toBeNull()
  })

  it('calls an unpredicted settled fixture unpredicted rather than missed', () => {
    renderPredictor(settledPredictorModel)
    // `explainFixtureScore`'s `unscored` means the rule neither awarded nor
    // withheld anything. Two fixtures were left blank in this scenario.
    expect(screen.getByText('Not predicted')).toBeInTheDocument()
  })

  it('claims no provisional or projected points anywhere', () => {
    for (const scenario of SCENARIOS) {
      const { container, unmount } = render(
        <VNextRoot>
          <VNextMatchPredictor model={scenario.model} actions={spyActions()} />
        </VNextRoot>,
      )
      const text = (container.textContent ?? '').toLowerCase()
      expect(text, scenario.name).not.toContain('on the pitch')
      expect(text, scenario.name).not.toContain('projected')
      expect(text, scenario.name).not.toContain('provisional')
      unmount()
    }
  })

  it('states no rank and no standing — that is Home’s page, not this one', () => {
    renderPredictor(settledPredictorModel)
    const text = (document.body.textContent ?? '').toLowerCase()
    expect(text).not.toContain('rank')
    expect(text).not.toContain('of 9 players')
  })
})

/* ------------------------------------------------------------------------ *
 * 8 — state is words and shape, never colour alone
 * ------------------------------------------------------------------------ */

describe('state is never carried by colour alone', () => {
  it('writes the prediction state of every fixture out in words', () => {
    renderPredictor(openPredictorModel)
    expect(screen.getAllByText('No prediction').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Your call').length).toBeGreaterThan(0)
  })

  it('writes the locked and settled states out in words', () => {
    renderPredictor(lockedPredictorModel)
    expect(screen.getAllByText('Locked').length).toBeGreaterThan(0)

    renderPredictor(settledPredictorModel)
    expect(screen.getAllByText('Exact score').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Right result').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Missed').length).toBeGreaterThan(0)
  })

  it('states progress as a sentence beside the track', () => {
    renderPredictor(openPredictorModel)
    // The segments are `aria-hidden`; the count carries the state.
    expect(screen.getByText('predicted')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('says the card is complete in words as well as in colour', () => {
    renderPredictor(completePredictorModel)
    expect(screen.getByText(/predicted — card complete/i)).toBeInTheDocument()
  })

  it('tells an untouched card it will bank nothing, rather than "the 0 you entered"', () => {
    renderPredictor(untouchedPredictorModel)
    expect(screen.getByText(/banks nothing and scores nothing/i)).toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------------ *
 * 9 — the landmark and accessibility floor
 * ------------------------------------------------------------------------ */

describe('the page contract', () => {
  it.each(SCENARIOS)('gives $name exactly one h1 and one main', (scenario) => {
    const { container } = renderPredictor(scenario.model)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(container.querySelectorAll('main')).toHaveLength(1)
    expect(container.querySelector('h1')?.textContent).toBe('Match Predictor')
  })

  it('keeps the shell’s skip link pointing at the content region', () => {
    const { container } = renderPredictor(openPredictorModel)
    const skip = container.querySelector('a[href^="#"]')
    const target = skip?.getAttribute('href')?.slice(1)
    expect(skip?.textContent).toBe('Skip to content')
    expect(container.querySelector('main')?.id).toBe(target)
  })

  it('labels the main landmark with the page heading', () => {
    const { container } = renderPredictor(openPredictorModel)
    const main = container.querySelector('main')
    const heading = container.querySelector('h1')
    expect(main?.getAttribute('aria-labelledby')).toBe(heading?.id)
  })

  it.each(SCENARIOS)(
    'has no critical or serious accessibility failure in $name',
    async (scenario) => {
      await scan(
        <VNextRoot>
          <VNextMatchPredictor model={scenario.model} actions={spyActions()} />
        </VNextRoot>,
      )
    },
    15_000,
  )

  it('runs the tab order through one club’s controls before the next club’s', async () => {
    const user = userEvent.setup()
    renderPredictor(untouchedPredictorModel)

    const first = at(untouchedPredictorModel.fixtures, 0)
    const homeName = first.home.team.name
    const awayName = first.away.team.name

    // The order is each club's own group, in full, then the other club's: input
    // then `+` for the home side (its `−` is at the floor and therefore not a stop),
    // then the away side's `+`, then its input. That is the visual order at every
    // width, because the DOM order is the same in both compositions and only the
    // grid placement changes.
    screen.getByRole('textbox', { name: `${homeName} score` }).focus()
    await user.tab()
    expect(screen.getByRole('button', { name: `Add one to ${homeName} score` })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('textbox', { name: `${awayName} score` })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: `Add one to ${awayName} score` })).toHaveFocus()
  })

  it('names the evidence disclosure after the fixture it belongs to', () => {
    renderPredictor(openPredictorModel)
    const fixture = at(openPredictorModel.fixtures, 0)
    const disclosure = screen.getByRole('button', {
      name: `Form and crowd for ${fixture.home.team.name} versus ${fixture.away.team.name}`,
    })
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(disclosure).toHaveAttribute('aria-controls')
  })

  it('exposes the evidence panel only once it is opened', async () => {
    const user = userEvent.setup()
    renderPredictor(lockedPredictorModel)

    const fixture = at(lockedPredictorModel.fixtures, 1)
    const name = `Form and crowd for ${fixture.home.team.name} versus ${fixture.away.team.name}`
    expect(screen.queryByText(/goal difference/i)).toBeNull()

    await user.click(screen.getByRole('button', { name }))
    expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText(/goal difference/i).length).toBeGreaterThan(0)
  })

  it('groups the matchweek into named day regions', () => {
    renderPredictor(openPredictorModel)
    // The grouping a fixture list has always had, and what stops ten rows reading
    // as a wall. Each day is a labelled region.
    const regions = screen.getAllByRole('region')
    expect(regions.length).toBeGreaterThan(1)
    expect(regions.some((region) => /august/i.test(region.getAttribute('aria-label') ?? ''))).toBe(
      true,
    )
  })
})

/* ------------------------------------------------------------------------ *
 * 10 — reduced motion changes the animation and never the content
 * ------------------------------------------------------------------------ */

describe('reduced motion', () => {
  it('renders the same content with the preference set', () => {
    const full = render(
      <VNextRoot motion="full">
        <VNextMatchPredictor model={closingPredictorModel} actions={spyActions()} />
      </VNextRoot>,
    )
    const fullText = full.container.textContent
    full.unmount()

    const reduced = render(
      <VNextRoot motion="reduced">
        <VNextMatchPredictor model={closingPredictorModel} actions={spyActions()} />
      </VNextRoot>,
    )
    expect(reduced.container.textContent).toBe(fullText)
  })
})

/* ------------------------------------------------------------------------ *
 * The Storybook rehearsal — a harness that cannot become an authority
 * ------------------------------------------------------------------------ */

describe('rehearsePredictor', () => {
  it('refuses every command on a card the application says is not editable', () => {
    for (const model of [
      lockedPredictorModel,
      settledPredictorModel,
      unavailablePredictorModel,
      conflictPredictorModel,
    ]) {
      const fixtureId = model.fixtures[0]?.id ?? 'none'
      expect(
        rehearsePredictor(model, { kind: 'setPrediction', fixtureId, score: { home: 9, away: 9 } }),
      ).toBe(model)
      expect(rehearsePredictor(model, { kind: 'setJoker', played: true })).toBe(model)
      expect(rehearsePredictor(model, { kind: 'confirmCard' })).toBe(model)
    }
  })

  it('cannot make an unplayable Joker played', () => {
    const spent: PredictorModel = {
      ...openPredictorModel,
      joker: { playedHere: false, remainingThisHalf: 0, playable: false, refusal: 'none left' },
    }
    expect(rehearsePredictor(spent, { kind: 'setJoker', played: true })).toBe(spent)
  })

  it('never changes editability, the lock or the phase', () => {
    const next = rehearsePredictor(openPredictorModel, {
      kind: 'setPrediction',
      fixtureId: at(openPredictorModel.fixtures, 1).id,
      score: { home: 1, away: 0 },
    })
    expect(next.editable).toBe(openPredictorModel.editable)
    expect(next.lock).toEqual(openPredictorModel.lock)
    expect(next.phase).toBe(openPredictorModel.phase)
    expect(next.joker.playable).toBe(openPredictorModel.joker.playable)
  })

  it('advances the progress count it is asked to advance, and only that', () => {
    const next = rehearsePredictor(openPredictorModel, {
      kind: 'setPrediction',
      fixtureId: at(openPredictorModel.fixtures, 1).id,
      score: { home: 1, away: 0 },
    })
    expect(next.progress.entered).toBe(openPredictorModel.progress.entered + 1)
    expect(next.progress.total).toBe(openPredictorModel.progress.total)
    expect(next.settledPoints).toBeNull()
    expect(next.tally).toBeNull()
  })

  it('moves an untouched card off unbanked once something is entered', () => {
    expect(untouchedPredictorModel.atLock).toBe('unbanked')
    const next = rehearsePredictor(untouchedPredictorModel, {
      kind: 'setPrediction',
      fixtureId: at(untouchedPredictorModel.fixtures, 0).id,
      score: { home: 1, away: 0 },
    })
    expect(next.atLock).toBe('banksEntered')
    expect(next.confirm.state).toBe('available')
  })
})

/* ------------------------------------------------------------------------ *
 * The feedback loop, end to end through the rehearsal
 * ------------------------------------------------------------------------ */

describe('completing a card', () => {
  it('reaches the complete state by entering the last outstanding prediction', () => {
    // The scenario is one short. Entering it must produce the completion state
    // rather than merely filling a bar — the payoff the page is built around.
    let model: PredictorModel = predictorScenarios.closing
    const outstanding = model.fixtures.find((fixture) => fixture.prediction === null)
    expect(outstanding).toBeDefined()

    model = rehearsePredictor(model, {
      kind: 'setPrediction',
      fixtureId: outstanding!.id,
      score: { home: 2, away: 2 },
    })

    expect(model.progress.entered).toBe(model.progress.total)
    renderPredictor(model)
    expect(screen.getByText(/predicted — card complete/i)).toBeInTheDocument()
    // And the jump control is gone, because there is nowhere left to jump to.
    expect(screen.queryByRole('button', { name: /go to the (next|last)/i })).toBeNull()
  })
})

/* ------------------------------------------------------------------------ *
 * Focus travel, which is what makes a card of ten fast
 * ------------------------------------------------------------------------ */

describe('working through the card', () => {
  it('sends the jump control to the first fixture that still needs a decision', async () => {
    const user = userEvent.setup()
    renderPredictor(openPredictorModel)

    await user.click(screen.getByRole('button', { name: /go to the next of 7/i }))

    const first = openPredictorModel.fixtures.find((fixture) => fixture.prediction === null)
    expect(
      screen.getByRole('textbox', { name: `${first!.home.team.name} score` }),
    ).toHaveFocus()
  })

  it('marks exactly one fixture as the next decision', () => {
    const { container } = renderPredictor(openPredictorModel)
    expect(container.querySelectorAll('[data-next]')).toHaveLength(1)
    // And it is the first outstanding one, which is fixture index 1 here.
    const marked = container.querySelector('[data-next]')
    expect(
      within(marked as HTMLElement).getByRole('textbox', {
        name: `${at(openPredictorModel.fixtures, 1).home.team.name} score`,
      }),
    ).toBeInTheDocument()
  })

  it('marks no fixture as next on a complete card', () => {
    const { container } = renderPredictor(completePredictorModel)
    expect(container.querySelectorAll('[data-next]')).toHaveLength(0)
  })
})
