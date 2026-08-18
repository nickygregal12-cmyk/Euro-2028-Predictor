import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { VNextMatches } from '../../src/vnext/matches/VNextMatches'
import { VNextMatchCentre } from '../../src/vnext/matches/VNextMatchCentre'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import {
  matchCentreScenarioNames,
  matchCentreScenarios,
  matchesScenarioNames,
  matchesScenarios,
  shellScenarios,
} from '../../src/vnext/fixtures'
import type { MatchesModel } from '../../src/vnext/models/matches'
import { first } from '../support/indexed'

/**
 * WHAT IS WORTH GUARDING ABOUT THE STAGE 8 SURFACES.
 *
 * Not a DOM snapshot. Composition, overflow, column counts and target sizes are
 * measured in a real browser by `e2e/vnext-matches.spec.ts`, because jsdom
 * evaluates no container query and computes no layout — and a frozen render
 * tree would fail on every deliberate improvement.
 *
 * What is held here is the set of promises that must survive any redesign:
 *
 *   1. FOOTBALL IS NOT A GAME. A fixture list contains no way to predict.
 *   2. A LIVE MATCH WITH NO MINUTE SHOWS NO MINUTE — not "0'", not "1'", and
 *      not a number derived from anything.
 *   3. A postponed match draws no live furniture and no score.
 *   4. A provisional score says the word, so colour is never the only signal.
 *   5. A module appears only where its data exists — no empty cards.
 *   6. Every state is stated in WORDS.
 *   7. One `<main>`, one `<h1>`, in every world.
 *   8. The accessibility floor the foundation set.
 *   9. Reduced motion changes the animation and never the content.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
/** jsdom has no layout, so it can neither confirm nor deny a contrast ratio. */
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

async function scan(ui: ReactElement) {
  const { unmount } = render(ui)
  try {
    const results = await axe.run(document.body, {
      runOnly: { type: 'tag', values: TAGS },
    })
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

/**
 * THE PAGE INSIDE A WORLD, AND NEVER A SECOND SHELL.
 *
 * `VNextMatches` renders `VNextShell` itself, so wrapping it in another one
 * gives the document two `<main>` landmarks and two navigations — a mistake
 * that looks entirely plausible until something counts them. The world reaches
 * the page's own shell through the provider, exactly as the connected
 * integration does.
 */
function renderMatches(
  model: MatchesModel,
  onIntent?: (intent: { kind: string }) => void,
) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextMatches
          model={model}
          onIntent={onIntent as never}
        />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

/* ------------------------------------------------------------------------ *
 * Football is not a game
 * ------------------------------------------------------------------------ */

describe('football and prediction games stay apart', () => {
  it('offers no way to enter a prediction anywhere in a fixture list', () => {
    renderMatches(matchesScenarios.upcomingMatchweek)

    // §14's boundary, held where it could most easily erode. A fixture list may
    // SHOW a prediction status; it may not collect one.
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /predict|save|submit|joker/i })).toBeNull()
  })

  it('marks Matches as the current destination and not Games', () => {
    renderMatches(matchesScenarios.upcomingMatchweek)

    const current = screen
      .getAllByRole('link', { hidden: true })
      .concat(screen.getAllByRole('button', { hidden: true }))
      .filter((node) => node.getAttribute('aria-current') === 'page')

    // The hierarchy working: real football is Matches, a prediction format is
    // Games, and the shell says which one the player is in.
    expect(current.length).toBeGreaterThan(0)
    for (const node of current) {
      expect(node.textContent).toContain('Matches')
      expect(node.textContent).not.toContain('Games')
    }
  })

  it('shows a prediction status as text and never as a control', () => {
    renderMatches(matchesScenarios.upcomingMatchweek)

    // The badge is inside the row's button, so it is not separately focusable —
    // one row, one target, one destination.
    const rows = screen.getAllByRole('button').filter((node) => node.hasAttribute('data-vnext-match-row'))
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(within(row).queryByRole('button')).toBeNull()
    }
  })
})

/* ------------------------------------------------------------------------ *
 * The live-data rule, as a picture
 * ------------------------------------------------------------------------ */

describe('live state is honest', () => {
  it('shows LIVE with no minute where the model supplies no clock', () => {
    renderMatches(matchesScenarios.severalLive)

    const row = screen
      .getAllByRole('button')
      .filter((node) => node.getAttribute('data-vnext-match-row') === 'fixture-live-3')
    const live = first(row)

    expect(live.getAttribute('data-live')).toBe('true')
    expect(live.textContent).toContain('Live')
    // NOT "0'", NOT "1'", NOT ANY NUMBER FOLLOWED BY AN APOSTROPHE. A minute
    // here would have been invented, because the model does not carry one.
    expect(live.textContent).not.toMatch(/\d+['′]/)
  })

  it('shows the provider’s minute where the model does supply one', () => {
    renderMatches(matchesScenarios.severalLive)

    const live = first(
      screen
        .getAllByRole('button')
        .filter((node) => node.getAttribute('data-vnext-match-row') === 'fixture-live-1'),
    )

    expect(live.textContent).toContain("67'")
  })

  it('draws no live furniture and no score on a postponed fixture', () => {
    renderMatches(matchesScenarios.postponedDay)

    const row = first(
      screen
        .getAllByRole('button')
        .filter((node) => node.getAttribute('data-vnext-match-row') === 'fixture-pp-1'),
    )

    expect(row.getAttribute('data-vnext-match-state')).toBe('postponed')
    expect(row.getAttribute('data-live')).toBeNull()
    expect(row.textContent).toContain('Postponed')
    // The kickoff time is NOT shown beside "Postponed": "15:00" there reads as
    // a match that is about to start.
    expect(row.textContent).not.toContain('15:00')
  })

  it('says "provisional" in words rather than only in colour', () => {
    renderMatches(matchesScenarios.severalLive)

    const live = first(
      screen
        .getAllByRole('button')
        .filter((node) => node.getAttribute('data-vnext-match-row') === 'fixture-live-1'),
    )

    expect(live.textContent).toContain('provisional score')
  })

  it('states an official result as full time with no provisional wording', () => {
    renderMatches(matchesScenarios.allFinished)

    const row = first(
      screen
        .getAllByRole('button')
        .filter((node) => node.getAttribute('data-vnext-match-row') === 'fixture-fin-1'),
    )

    expect(row.textContent).toContain('full time')
    expect(row.textContent).not.toContain('provisional')
  })
})

/* ------------------------------------------------------------------------ *
 * Competition scope
 * ------------------------------------------------------------------------ */

describe('the competition is the root', () => {
  it('offers no scope control to a one-competition player', () => {
    renderMatches(matchesScenarios.singleCompetition)

    // THE BINDING PRODUCT TEST, as a picture. Nothing on the page suggests a
    // platform exists.
    expect(screen.queryByRole('group', { name: /which football/i })).toBeNull()
    expect(screen.queryByText(/across your/i)).toBeNull()
  })

  it('names the competition on every fixture in combined scope', () => {
    renderMatches(matchesScenarios.combinedTonight)

    const rows = screen
      .getAllByRole('button')
      .filter((node) => node.hasAttribute('data-vnext-match-row'))

    expect(rows.length).toBe(4)
    // The condition the mode exists under: a reader always knows which
    // competition a match is in.
    for (const row of rows) {
      const named = [
        'Caledonian Premiership',
        'Northern Isles Champions Trophy',
        'Caledonian Cup',
      ].some((name) => row.textContent?.includes(name))
      expect(named, `a combined row did not name its competition: ${row.textContent}`).toBe(true)
    }
  })

  it('lets a host act on a scope change without the page deciding for it', async () => {
    const onIntent = vi.fn()
    renderMatches(matchesScenarios.combinedTonight, onIntent)

    await userEvent.click(screen.getByRole('button', { name: /in premiership/i }))

    // The page says what the player asked for; the host decides what it means.
    expect(onIntent).toHaveBeenCalledWith({ kind: 'scope', scope: 'competition' })
  })
})

/* ------------------------------------------------------------------------ *
 * Browsing
 * ------------------------------------------------------------------------ */

describe('browsing', () => {
  it('filters to live football without touching the model', async () => {
    renderMatches(matchesScenarios.mixedMatchday)

    await userEvent.click(screen.getByRole('button', { name: /^Live/ }))

    const rows = screen
      .getAllByRole('button')
      .filter((node) => node.hasAttribute('data-vnext-match-row'))
    expect(rows).toHaveLength(1)
    expect(first(rows).getAttribute('data-vnext-match-state')).toBe('live')
  })

  it('drops a day that has nothing left in it rather than leaving the heading', async () => {
    renderMatches(matchesScenarios.mixedMatchday)

    // Friday has one finished match and Saturday has the rest.
    expect(screen.getByText('Friday 20 August')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /^Live/ }))

    // A Saturday drawn with nothing under it reads as football that vanished.
    expect(screen.queryByText('Friday 20 August')).toBeNull()
  })

  it('disables a filter with nothing behind it rather than hiding it', () => {
    renderMatches(matchesScenarios.allFinished)

    const live = screen.getByRole('button', { name: /^Live/ })
    // The control row must not change shape under the player's thumb as
    // football happens, and a disabled tab still answers "is anything live?".
    expect(live).toBeDisabled()
    expect(live.textContent).toContain('0')
  })

  it('tells an empty FILTER apart from an empty WINDOW', async () => {
    // `allFinished` has three matches and none of them upcoming, so the
    // Upcoming tab is disabled and cannot be pressed. `mixedMatchday` has one
    // of each, so the filter that empties is a real interaction.
    renderMatches(matchesScenarios.allFinished)

    // Both are empty states and they are different sentences. A window with
    // three matches in it must never say the competition has none.
    expect(screen.getByRole('button', { name: /^Upcoming/ })).toBeDisabled()
    expect(screen.queryByText(/no matches in this window/i)).toBeNull()

    const empty = render(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextMatches model={matchesScenarios.noMatches} />
        </VNextShellProvider>
      </VNextRoot>,
    )
    // The window really is empty here, and the sentence is about the
    // competition rather than about a control the player pressed.
    expect(
      within(empty.container).getByText(/no matches in this window/i),
    ).toBeTruthy()
    expect(
      empty.container.querySelector('[data-vnext-matches-empty="window"]'),
    ).toBeTruthy()
    empty.unmount()
  })

  it('says an empty window is the competition’s and invents no fixture', () => {
    renderMatches(matchesScenarios.noMatches)

    expect(screen.getByText(/no matches in this window/i)).toBeTruthy()
    expect(
      screen.queryAllByRole('button').filter((node) => node.hasAttribute('data-vnext-match-row')),
    ).toHaveLength(0)
  })

  it('hands a host the canonical fixture id and nothing else', async () => {
    const onIntent = vi.fn()
    renderMatches(matchesScenarios.upcomingMatchweek, onIntent)

    const row = first(
      screen
        .getAllByRole('button')
        .filter((node) => node.getAttribute('data-vnext-match-row') === 'fixture-upc-1'),
    )
    await userEvent.click(row)

    // §29: not the clubs, not the date, not a position in a list.
    expect(onIntent).toHaveBeenCalledWith({ kind: 'openMatch', matchId: 'fixture-upc-1' })
  })
})

/* ------------------------------------------------------------------------ *
 * Landmarks and accessibility, in every world
 * ------------------------------------------------------------------------ */

describe('every Matches world', () => {
  it.each(matchesScenarioNames)('gives %s exactly one main and one h1', (name) => {
    const { container } = renderMatches(matchesScenarios[name])

    expect(container.querySelectorAll('main')).toHaveLength(1)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(first(Array.from(container.querySelectorAll('h1'))).textContent).toBe('Matches')
  })

  it.each(matchesScenarioNames)('names every fixture in %s as one sentence', (name) => {
    renderMatches(matchesScenarios[name])

    const rows = screen
      .queryAllByRole('button')
      .filter((node) => node.hasAttribute('data-vnext-match-row'))

    for (const row of rows) {
      const label = row.textContent ?? ''
      // The counter-example §31 gives is "2 1 Glenmore Porthaven": a row
      // assembled from separate visible nodes with nobody writing a sentence.
      expect(label).toMatch(/ against | \d+, /)
    }
  })

  it.each(matchesScenarioNames)('has no axe violation in %s', async (name) => {
    await scan(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextMatches model={matchesScenarios[name]} />
        </VNextShellProvider>
      </VNextRoot>,
    )
  })
})

describe('reduced motion', () => {
  it('changes the animation and never the content', () => {
    const full = render(
      <VNextRoot motion="full">
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextMatches model={matchesScenarios.severalLive} />
        </VNextShellProvider>
      </VNextRoot>,
    )
    const fullText = full.container.textContent
    full.unmount()

    const reduced = render(
      <VNextRoot motion="reduced">
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextMatches model={matchesScenarios.severalLive} />
        </VNextShellProvider>
      </VNextRoot>,
    )

    expect(reduced.container.textContent).toBe(fullText)
  })
})

/* ------------------------------------------------------------------------ *
 * The Match Centre
 * ------------------------------------------------------------------------ */

function renderCentre(name: (typeof matchCentreScenarioNames)[number]) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextMatchCentre model={matchCentreScenarios[name]} />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

describe('the Match Centre', () => {
  it('names the match itself in the page heading', () => {
    const { container } = renderCentre('richContext')

    // A Match Centre whose heading says "Match Centre" is a page named after
    // its own file. The reader came here for one fixture.
    expect(first(Array.from(container.querySelectorAll('h1'))).textContent).toBe(
      'Glenmore Athletic v Strathkelvin United',
    )
  })

  it('renders no optional module at all when only core data exists', () => {
    renderCentre('coreOnly')

    // §17: absent rather than empty. No heading over nothing, no zeroed
    // statistics, no "coming soon".
    expect(screen.queryByRole('heading', { name: /recent form/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /meetings/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /in the table/i })).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('renders the context modules when the data is there', () => {
    renderCentre('richContext')

    expect(screen.getByRole('heading', { name: /recent form/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /meetings/i })).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
  })

  it('never renders a timeline, statistics or a lineup, in any world', () => {
    for (const name of matchCentreScenarioNames) {
      const view = renderCentre(name)
      // The three §18/§19 forbid fabricating. Not one world draws them, because
      // no read on this platform supplies them.
      expect(screen.queryByRole('heading', { name: /timeline|events/i })).toBeNull()
      expect(screen.queryByRole('heading', { name: /statistics|possession|shots/i })).toBeNull()
      expect(screen.queryByRole('heading', { name: /line-?ups?/i })).toBeNull()
      view.unmount()
    }
  })

  it('shows LIVE with no minute where the provider gave none', () => {
    const { container } = renderCentre('liveWithoutMinute')

    expect(container.textContent).toContain('Live')
    expect(container.textContent).not.toMatch(/\d+['′]/)
    // The freshness a surface may report is the SERVER's observation instant.
    expect(container.textContent).toContain('observed at')
  })

  it('draws no live affordance and no score in the hero of a postponed match', () => {
    const { container } = renderCentre('postponed')

    expect(container.querySelector('[data-vnext-match-state="postponed"]')).toBeTruthy()
    expect(container.textContent).toContain('Postponed')
    expect(container.textContent).not.toContain('Live')

    // SCOPED TO THE HERO ON PURPOSE. Previous meetings legitimately carry
    // scorelines — those are settled results of other matches — and asserting
    // over the whole page would make this test about the head-to-head module.
    // What must not exist is a score for THIS fixture, which has not been
    // played.
    const hero = container.querySelector('[data-vnext-zone="match-hero"]')
    expect(hero).toBeTruthy()
    expect(hero?.textContent ?? '').not.toMatch(/\d+–\d+/)

    // The original slot is kept — it is how a reader recognises which fixture
    // this is — but it is said as a slot that HAS PASSED rather than as a
    // kick-off that is still going to happen.
    expect(hero?.textContent ?? '').toContain('Was due Saturday 21 August, 15:00')
  })

  it('keeps a provider’s final score provisional until the platform settles it', () => {
    const { container } = renderCentre('awaitingResult')

    expect(container.textContent).toContain('Not yet confirmed')
    expect(container.textContent).toContain('provisional score')
  })

  it('renders no league table for a knockout tie', () => {
    renderCentre('extraTime')

    // §21: a table over a cup tie is meaningless, so it is not drawn.
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('says how a knockout was decided rather than leaving the score bare', () => {
    const { container } = renderCentre('penalties')

    expect(container.textContent).toContain('penalties')
    expect(container.textContent).toContain('on aggregate')
  })

  it('uses a real table with real semantics', () => {
    renderCentre('richContext')

    const table = screen.getByRole('table')
    // §31: a grid of divs is what a screen-reader user cannot navigate.
    expect(within(table).getAllByRole('columnheader').length).toBeGreaterThan(3)
    expect(within(table).getAllByRole('rowheader').length).toBeGreaterThan(3)
  })

  it.each(matchCentreScenarioNames)('gives %s exactly one main and one h1', (name) => {
    const { container } = renderCentre(name)

    expect(container.querySelectorAll('main')).toHaveLength(1)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
  })

  it.each(matchCentreScenarioNames)('has no axe violation in %s', async (name) => {
    await scan(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextMatchCentre model={matchCentreScenarios[name]} />
        </VNextShellProvider>
      </VNextRoot>,
    )
  })
})
