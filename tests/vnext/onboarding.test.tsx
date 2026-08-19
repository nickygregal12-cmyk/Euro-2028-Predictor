import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from './vnextAxe'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { VNextOnboarding, type OnboardingIntent } from '../../src/vnext/onboarding/VNextOnboarding'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import {
  onboardingScenarioNames,
  onboardingScenarioPremises,
  onboardingScenarios,
  shellScenarios,
} from '../../src/vnext/fixtures'
import type { OnboardingView } from '../../src/vnext/models/onboarding'

/**
 * THE ONBOARDING SURFACE, ASSERTED WHERE STAGE 13'S PREDICATE BITES.
 *
 *   1. IT IS ONE PAGE IN THE vNEXT SHELL in every world — the coherence claim
 *      the predicate makes about onboarding is exactly this.
 *   2. NOTHING IS PRE-TICKED, and an ALREADY-JOINED game carries NO CONTROL.
 *   3. SKIP EXISTS ON EVERY STEP AFTER THE FIRST, as a real button.
 *   4. THERE IS NO PROGRESS METER and no score — "Step 2 of 4" and nothing
 *      that fills up.
 *   5. A PARTIAL SAVE STILL LETS THE PLAYER LEAVE.
 *   6. THE FIXTURES CANNOT DEPICT AN IMPOSSIBLE STATE: no game is both joined
 *      and chosen, and no world claims a summary is both empty and populated.
 */

function renderOnboarding(view: OnboardingView, onIntent?: (intent: OnboardingIntent) => void) {
  return render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <VNextOnboarding view={view} {...(onIntent ? { onIntent } : {})} />
    </VNextShellProvider>,
  )
}

const readyWorlds = onboardingScenarioNames.filter(
  (name) => onboardingScenarios[name].kind === 'ready',
)

describe('every world is a page in the vNext shell', () => {
  it.each(onboardingScenarioNames)('%s has one main and one h1', (name) => {
    renderOnboarding(onboardingScenarios[name])
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it.each(onboardingScenarioNames)('%s has a premise a reviewer can read', (name) => {
    expect(onboardingScenarioPremises[name].length).toBeGreaterThan(20)
  })
})

describe('the fixtures cannot depict a state the surface cannot reach', () => {
  it.each(readyWorlds)('%s never has a game both joined and chosen', (name) => {
    const view = onboardingScenarios[name]
    if (view.kind !== 'ready') return
    const panel = view.model.panel
    if (panel.step !== 'games' && panel.step !== 'competitions') return
    for (const offer of panel.offers) {
      for (const game of offer.games) {
        expect(game.joined && game.chosen).toBe(false)
      }
    }
  })

  it.each(readyWorlds)('%s agrees with itself about being empty', (name) => {
    const view = onboardingScenarios[name]
    if (view.kind !== 'ready') return
    const panel = view.model.panel
    if (panel.step !== 'review') return
    const populated =
      panel.summary.follows.length + panel.summary.clubs.length + panel.summary.games.length
    expect(panel.summary.empty).toBe(populated === 0)
  })

  it.each(readyWorlds)('%s places the step where the position says it is', (name) => {
    const view = onboardingScenarios[name]
    if (view.kind !== 'ready') return
    const model = view.model
    expect(model.isLast).toBe(model.position === model.total)
    expect(model.back).toBe(model.position > 1)
  })
})

describe('the step is not a score', () => {
  it('says which step, and shows no meter', () => {
    renderOnboarding(onboardingScenarios.clubs)
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it.each(readyWorlds)('%s never shows a percentage', (name) => {
    const { container } = renderOnboarding(onboardingScenarios[name])
    expect(container.textContent).not.toMatch(/\d+\s?%/)
  })
})

describe('following a competition is not entering its games', () => {
  it('offers an unticked box for every competition on a new account', () => {
    renderOnboarding(onboardingScenarios.firstStep)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    expect(boxes.every((box) => !(box as HTMLInputElement).checked)).toBe(true)
  })

  it('says so on the step, rather than only in the model', () => {
    renderOnboarding(onboardingScenarios.firstStep)
    expect(screen.getByText(/does not enter you into any of its games/i)).toBeInTheDocument()
  })

  it('brings a resumed follow back already ticked', () => {
    renderOnboarding(onboardingScenarios.resumed)
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })

  it('emits the competition key rather than an index', () => {
    const onIntent = vi.fn()
    renderOnboarding(onboardingScenarios.firstStep, onIntent)
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement)
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'toggle-follow',
      key: 'Caledonian Premiership 2027/28',
    })
  })
})

describe('a game already joined is a fact, not a choice', () => {
  const row = (gameKey: string) =>
    document.querySelector(`[data-vnext-game="${gameKey}"]`) as HTMLElement

  it('offers no control at all for it — not a ticked box, not a disabled one', () => {
    renderOnboarding(onboardingScenarios.games)
    const joined = row('last_man_standing')
    expect(within(joined).queryByRole('checkbox')).toBeNull()
    expect(within(joined).queryByRole('button')).toBeNull()
    expect(joined.textContent).toMatch(/already joined/i)
  })

  it('offers no control for a game the competition has not opened, and says which', () => {
    renderOnboarding(onboardingScenarios.games)
    const unopened = row('predictor_cup')
    expect(within(unopened).queryByRole('checkbox')).toBeNull()
    expect(unopened.textContent).toMatch(/has not opened this game yet/i)
  })

  it('offers exactly one control for the game that can be chosen', () => {
    const onIntent = vi.fn()
    renderOnboarding(onboardingScenarios.games, onIntent)
    const choosable = row('main_predictor')
    fireEvent.click(within(choosable).getByRole('checkbox'))
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'toggle-game',
      key: 'Caledonian Premiership 2027/28',
      gameKey: 'main_predictor',
    })
  })
})

describe('the favourite club', () => {
  it('draws a waiting group differently from an empty one', () => {
    renderOnboarding(onboardingScenarios.clubs)
    expect(screen.getByText(/loading clubs/i)).toBeInTheDocument()
  })

  it('clears the favourite when the chosen club is pressed again', () => {
    const onIntent = vi.fn()
    renderOnboarding(onboardingScenarios.clubs, onIntent)
    fireEvent.click(screen.getByRole('button', { name: 'Ardrossan Athletic' }))
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'choose-club',
      key: 'Caledonian Premiership 2027/28',
      teamId: null,
    })
  })

  it('sets it when an unchosen club is pressed', () => {
    const onIntent = vi.fn()
    renderOnboarding(onboardingScenarios.clubs, onIntent)
    fireEvent.click(screen.getByRole('button', { name: 'Barrahead Rovers' }))
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'choose-club',
      key: 'Caledonian Premiership 2027/28',
      teamId: 'club-2',
    })
  })

  it('marks the chosen club to assistive technology, not only in colour', () => {
    renderOnboarding(onboardingScenarios.clubs)
    expect(screen.getByRole('button', { name: 'Ardrossan Athletic' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

describe('skipping is a real control', () => {
  it('is offered on both optional steps', () => {
    for (const name of ['clubs', 'games'] as const) {
      const { unmount } = renderOnboarding(onboardingScenarios[name])
      expect(screen.getByRole('button', { name: 'Skip this' })).toBeInTheDocument()
      unmount()
    }
  })

  it('is not offered on the first step, where there is nothing yet to skip', () => {
    renderOnboarding(onboardingScenarios.firstStep)
    expect(screen.queryByRole('button', { name: 'Skip this' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('is not offered on the review, where it would discard the answers', () => {
    // The review is the commitment point. A control there reading "Skip this"
    // would look like skipping a summary and would actually throw away
    // everything the player had just chosen. Their way out is Back, or Finish
    // — and finishing with nothing chosen is a complete outcome the page says
    // so in as many words.
    renderOnboarding(onboardingScenarios.review)
    expect(screen.queryByRole('button', { name: 'Skip this' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Finish setup' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('advances rather than leaving when an optional step is skipped', () => {
    const onIntent = vi.fn()
    renderOnboarding(onboardingScenarios.clubs, onIntent)
    fireEvent.click(screen.getByRole('button', { name: 'Skip this' }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'continue' })
  })
})

describe('choosing nothing is a complete outcome', () => {
  it('says so without disappointment, and still offers Finish', () => {
    renderOnboarding(onboardingScenarios.reviewEmpty)
    expect(screen.getByText(/perfectly good way to start/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finish setup' })).toBeInTheDocument()
  })

  it('says there is nothing to follow rather than drawing an empty list', () => {
    renderOnboarding(onboardingScenarios.nothingPublished)
    expect(screen.getByText(/no competitions published to follow yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('the review keeps the three choices apart', () => {
  it('lists follows, clubs and games under their own headings', () => {
    renderOnboarding(onboardingScenarios.review)
    expect(screen.getByRole('heading', { name: 'Following' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your clubs' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Joining' })).toBeInTheDocument()
  })

  it('refuses to claim any of it is saved yet', () => {
    renderOnboarding(onboardingScenarios.review)
    expect(screen.getByText(/nothing above has been saved yet/i)).toBeInTheDocument()
  })
})

describe('what the host reports back', () => {
  it('shows one busy control while the commit is in flight', () => {
    renderOnboarding(onboardingScenarios.saving)
    const button = screen.getByRole('button', { name: 'Saving…' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('names what was refused and still lets the player leave', () => {
    const onIntent = vi.fn()
    renderOnboarding(onboardingScenarios.partial, onIntent)
    expect(screen.getByText('Match Predictor in Caledonian Premiership')).toBeInTheDocument()
    expect(screen.getByText(/everything else was saved/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Carry on' }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'leave' })
  })

  it('offers no second Finish while a partial result is on screen', () => {
    renderOnboarding(onboardingScenarios.partial)
    expect(screen.queryByRole('button', { name: 'Finish setup' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Skip this' })).toBeNull()
  })

  it('states a failed commit once, as an alert', () => {
    renderOnboarding(onboardingScenarios.failed)
    expect(screen.getByRole('alert')).toHaveTextContent(/could not finish your setup/i)
    expect(screen.getByRole('button', { name: 'Finish setup' })).toBeInTheDocument()
  })
})

describe('before the catalogue answers', () => {
  it('says what it is loading rather than drawing four empty steps', () => {
    renderOnboarding(onboardingScenarios.loading)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByText(/loading the competitions/i)).toBeInTheDocument()
  })

  it('offers a retry when the read failed, and does not blame the account', () => {
    const onIntent = vi.fn()
    renderOnboarding(onboardingScenarios.unavailable, onIntent)
    expect(screen.getByText(/your account is fine/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'retry' })
  })
})


describe('every world passes the accessibility scan', () => {
  it.each(onboardingScenarioNames)('%s has no critical or serious violation', async (name) => {
    await expectNoAxeViolations(
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextOnboarding view={onboardingScenarios[name]} />
      </VNextShellProvider>,
    )
  })
})
