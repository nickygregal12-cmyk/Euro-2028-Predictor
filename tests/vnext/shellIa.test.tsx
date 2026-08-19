import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { VNextShell } from '../../src/vnext/app/VNextShell'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { VNextPageHeader } from '../../src/vnext/app/VNextPageHeader'
import { VNextHome } from '../../src/vnext/home/VNextHome'
import { VNextMatchPredictor } from '../../src/vnext/predictor/VNextMatchPredictor'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import {
  SHELL_SHORTCUT_LIMIT,
  attentionElsewhere,
  shellJumpAvailable,
  shellJumpGroups,
  shellSwitchable,
} from '../../src/vnext/models/shell'
import type { ShellIntent, VNextShellModel } from '../../src/vnext/models/shell'
import {
  homeScenarios,
  openPredictorModel,
  shellScenarioNames,
  shellScenarioPremises,
  shellScenarios,
} from '../../src/vnext/fixtures'
import type { PredictorActions } from '../../src/vnext/models/predictor'
import { at } from '../support/indexed'

/**
 * THE SELECTED INFORMATION ARCHITECTURE, AS A PRODUCT CONTRACT.
 *
 * Stage 7.6 turned a human decision into code: **Concept A, the Competition
 * Deck**, is the primary vNext IA; Concept B's cross-competition attention is a
 * SECONDARY layer over it; Concept C's Jump is an OPTIONAL accelerator past it.
 * That hierarchy is the load-bearing part, and a hierarchy stated only in a
 * comment is a hierarchy that lasts until the next change.
 *
 * SO THIS SUITE TESTS CLAIMS, NOT MARKUP. Nothing here freezes a class name, a
 * DOM shape or a composition — Stage 8 will rebuild what is inside `<main>` and
 * a test that pinned the chrome's structure would be deleted by the change that
 * implements it. What is held is what must survive: that football context, game
 * and people stay three separate things; that a one-competition player gets no
 * fake chooser; that attention is quiet when nothing is waiting and never
 * invents urgency; that Jump is optional and grouped; and that permanent chrome
 * is a function of what the player plays.
 *
 * `e2e/vnext-shell.spec.ts` holds everything that needs a layout engine.
 */

function renderShell(
  model: VNextShellModel,
  options: {
    readonly onIntent?: (intent: ShellIntent) => void
    readonly destination?: 'home' | 'matches' | 'games' | 'leagues'
    readonly children?: ReactNode
  } = {},
) {
  return render(
    <VNextRoot>
      <VNextShell
        destination={options.destination ?? 'home'}
        shell={model}
        onIntent={options.onIntent}
        header={<VNextPageHeader title="Home" />}
      >
        {options.children ?? <p>Placeholder</p>}
      </VNextShell>
    </VNextRoot>,
  )
}

/** Everything the shell shows without opening anything: the permanent chrome. */
function permanentText(): string {
  const shell = document.querySelector('[data-vnext-shell]') as HTMLElement
  const overlay = document.querySelector('[data-vnext-overlay]')
  const clone = shell.cloneNode(true) as HTMLElement
  if (overlay) clone.querySelector('[data-vnext-overlay]')?.remove()
  return clone.textContent ?? ''
}

/* ========================================================================== *
 * A. The selected authority
 * ========================================================================== */

describe('the shell follows the Competition Deck', () => {
  it('makes the football competition the root and its four sections the navigation', () => {
    // The badge-free world, so the assertion below reads the four LABELS rather
    // than a count that happens to sit inside one of the buttons.
    renderShell(shellScenarios.quietDay)

    // The competition is stated as a control, not as a tab among the
    // destinations — which is the whole difference between "I am inside a
    // competition" and "competition is one of the things I can look at".
    expect(
      screen.getAllByRole('button', { name: /Premier League, change competition/ }).length,
    ).toBeGreaterThan(0)

    const nav = at(screen.getAllByRole('navigation', { name: 'Competition sections' }), 0)
    expect(
      [...nav.querySelectorAll('button')].map((button) => button.textContent?.trim()),
    ).toEqual(['Home', 'Matches', 'Games', 'Leagues'])
  })

  it('does not let the rejected concepts into the primary navigation', () => {
    renderShell(shellScenarios.fourCompetitions)
    const nav = at(screen.getAllByRole('navigation', { name: 'Competition sections' }), 0)
    const labels = [...nav.querySelectorAll('button')].map((button) =>
      button.textContent?.trim().toLowerCase(),
    )

    // Concept B's front door was a cross-competition queue and Concept C's was a
    // command surface. Both contributed an idea and neither contributed a
    // destination; a "Needs you" or "Jump" tab here would be the hierarchy
    // inverting.
    for (const rejected of ['needs you', 'inbox', 'queue', 'jump', 'play', 'season']) {
      expect(labels, `${rejected} is not a primary destination`).not.toContain(rejected)
    }
  })

  it('keeps football context, game and people as three separate things', () => {
    // The claim the whole model exists to protect. A competition is not a game
    // and a game is not a private league, so the three cannot be found in one
    // undifferentiated list — which is what Jump's grouped result proves.
    const groups = shellJumpGroups(shellScenarios.manyCompetitions, '')
    expect(groups.competitions.length).toBeGreaterThan(0)
    expect(groups.games.length).toBeGreaterThan(0)

    const competitionNames = new Set(groups.competitions.map((entry) => entry.label))
    for (const game of groups.games) {
      expect(
        competitionNames.has(game.label),
        'a game must never be labelled as a competition',
      ).toBe(false)
    }

    const leagues = shellJumpGroups(shellScenarios.oneCompetition, '').leagues
    expect(leagues.length).toBeGreaterThan(0)
    for (const entry of leagues) {
      // A private container is one game inside one competition, and its row
      // says both. "Sunday Club" alone could be any of three games.
      expect(entry.detail).toContain('Premier League')
      expect(entry.detail).toContain('Match Predictor')
    }
  })
})

/* ========================================================================== *
 * B. One competition
 * ========================================================================== */

describe('the one-competition contract', () => {
  it('states the competition as a label and offers no chooser', () => {
    renderShell(shellScenarios.oneCompetition)

    expect(shellSwitchable(shellScenarios.oneCompetition)).toBe(false)
    expect(
      screen.queryByRole('button', { name: /change competition/i }),
      'a control offering one choice is furniture',
    ).toBeNull()
    // And it is not a disabled button either, which is the same lie in worse
    // clothes.
    expect(document.querySelectorAll('[data-vnext-switcher="label"]').length)
      .toBeGreaterThan(0)
    expect(permanentText()).toContain('Premier League')
  })

  it('offers no “Your competitions” group to switch within', () => {
    renderShell(shellScenarios.oneCompetition)
    expect(screen.queryByRole('navigation', { name: 'Your competitions' })).toBeNull()
  })

  it('still reaches discovery, because the catalogue is not the player’s list', () => {
    const onIntent = vi.fn()
    renderShell(shellScenarios.oneCompetition, { onIntent })

    const explore = screen.getAllByRole('button', { name: 'Explore competitions' })
    expect(explore.length, 'Explore is present at every scale').toBeGreaterThan(0)
    fireEvent.click(at(explore, 0))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'discover' })
  })

  it('keeps every other competition’s name out of the permanent chrome', () => {
    renderShell(shellScenarios.oneCompetition)
    const chrome = permanentText()
    for (const stranger of ['Scottish Premiership', 'Champions League', 'Euro 2028', 'La Liga']) {
      expect(chrome, `${stranger} has no business in a Premier League player’s chrome`)
        .not.toContain(stranger)
    }
  })

  it('does not offer the power-user accelerator to a one-competition player', () => {
    expect(shellJumpAvailable(shellScenarios.oneCompetition)).toBe(false)
    renderShell(shellScenarios.oneCompetition)
    expect(screen.queryByRole('button', { name: /jump to/i })).toBeNull()
  })
})

/* ========================================================================== *
 * C. Multiple competitions
 * ========================================================================== */

describe('the multi-competition contract', () => {
  it('offers a switcher and reports the active competition', () => {
    renderShell(shellScenarios.fourCompetitions)
    expect(shellSwitchable(shellScenarios.fourCompetitions)).toBe(true)
    const switcher = at(
      screen.getAllByRole('button', { name: /Premier League, change competition/ }),
      0,
    )
    expect(switcher).toHaveAttribute('aria-expanded', 'false')
    expect(switcher).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('asks the host to change context and never navigates by itself', () => {
    const onIntent = vi.fn()
    renderShell(shellScenarios.fourCompetitions, { onIntent })

    fireEvent.click(
      at(screen.getAllByRole('button', { name: /Premier League, change competition/ }), 0),
    )
    const dialog = screen.getByRole('dialog', { name: 'Choose a competition' })
    fireEvent.click(within(dialog).getByRole('button', { name: /Scottish Premiership/ }))

    // THE SHELL EMITS AN INTENT AND NOTHING ELSE. It holds no route, so the
    // destination surviving the switch is the host's rule to keep — and the
    // shell is structurally incapable of breaking it.
    expect(onIntent).toHaveBeenCalledWith({ kind: 'context', contextId: 'spfl' })
  })

  it('keeps the destination semantically appropriate when the context changes', () => {
    // The same page id, a different competition: the shell restates the new
    // football context and leaves the destination alone.
    const { rerender } = render(
      <VNextRoot>
        <VNextShell
          destination="matches"
          shell={shellScenarios.fourCompetitions}
          header={<VNextPageHeader title="Matches" />}
        >
          <p>Placeholder</p>
        </VNextShell>
      </VNextRoot>,
    )
    expect(permanentText()).toContain('Premier League')

    rerender(
      <VNextRoot>
        <VNextShell
          destination="matches"
          shell={{ ...shellScenarios.fourCompetitions, activeContextId: 'spfl' }}
          header={<VNextPageHeader title="Matches" />}
        >
          <p>Placeholder</p>
        </VNextShell>
      </VNextRoot>,
    )
    expect(permanentText()).toContain('Scottish Premiership')
    const nav = at(screen.getAllByRole('navigation', { name: 'Competition sections' }), 0)
    expect(at([...nav.querySelectorAll('[aria-current="page"]')], 0).textContent)
      .toContain('Matches')
  })

  it('keeps a followed competition distinct from a played one', () => {
    renderShell(shellScenarios.fourCompetitions)
    fireEvent.click(
      at(screen.getAllByRole('button', { name: /Premier League, change competition/ }), 0),
    )
    const dialog = screen.getByRole('dialog', { name: 'Choose a competition' })
    // Contract 157's real state: followed, nothing joined. It says so rather
    // than being counted as zero games and looking broken.
    expect(within(dialog).getByText(/Following · no games joined/)).toBeInTheDocument()
  })
})

/* ========================================================================== *
 * D. Attention — retained from Concept B
 * ========================================================================== */

describe('the secondary attention layer', () => {
  it('renders nothing at all on a quiet day', () => {
    renderShell(shellScenarios.quietDay)
    expect(attentionElsewhere(shellScenarios.quietDay)).toEqual([])
    expect(document.querySelectorAll('[data-vnext-attention]')).toHaveLength(0)
    expect(permanentText()).not.toMatch(/needs? you/i)
  })

  it('surfaces urgent work waiting in another competition', () => {
    renderShell(shellScenarios.fourCompetitions)
    expect(
      screen.getAllByRole('button', { name: /2 things need you elsewhere/ }).length,
    ).toBeGreaterThan(0)
  })

  it('names the competition and the game separately', () => {
    renderShell(shellScenarios.fourCompetitions)
    fireEvent.click(
      at(screen.getAllByRole('button', { name: /2 things need you elsewhere/ }), 0),
    )
    const dialog = screen.getByRole('dialog', { name: 'Needs you elsewhere' })

    // The row's own name carries both, in that order and apart. A single
    // "Euro 2028 Predictor" string would be exactly the collapse the three
    // dimensions exist to prevent.
    const row = within(dialog).getByRole('button', { name: /^Euro 2028, Match Predictor:/ })
    expect(row).toBeInTheDocument()
    expect(within(dialog).getByText('Euro 2028')).toBeInTheDocument()
    expect(within(dialog).getByText(/Match Predictor · 6 predictions to make/))
      .toBeInTheDocument()
  })

  it('never reports work in the competition the player is already in', () => {
    // Home already answers "what matters here?". An attention control that
    // repeated the current competition's own deadline would be Home's job
    // leaking upwards into chrome.
    const inEuro = { ...shellScenarios.fourCompetitions, activeContextId: 'euro2028' }
    const elsewhere = attentionElsewhere(inEuro)
    expect(elsewhere.map((item) => item.contextId)).not.toContain('euro2028')
  })

  it('takes the player to the game in one press', () => {
    const onIntent = vi.fn()
    renderShell(shellScenarios.fourCompetitions, { onIntent })
    fireEvent.click(
      at(screen.getAllByRole('button', { name: /2 things need you elsewhere/ }), 0),
    )
    const dialog = screen.getByRole('dialog', { name: 'Needs you elsewhere' })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Euro 2028, Match Predictor:/ }))

    expect(onIntent).toHaveBeenCalledWith({
      kind: 'game',
      contextId: 'euro2028',
      game: 'match-predictor',
    })
  })

  it('does not manufacture urgency from the browser’s clock', () => {
    // Every word the attention layer says is a string the application supplied.
    // Moving the clock a year cannot change one of them, which is what makes a
    // story and a screenshot comparable.
    renderShell(shellScenarios.fourCompetitions)
    const before = permanentText()

    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'))
      const { unmount } = renderShell(shellScenarios.fourCompetitions)
      // Two shells are mounted; the second one's text is the tail of the body.
      expect(document.body.textContent).toContain('2 things need you elsewhere')
      unmount()
    } finally {
      vi.useRealTimers()
    }

    expect(before).toContain('2 things need you elsewhere')
  })

  it('orders live before urgent before soon, deterministically', () => {
    const ordered = attentionElsewhere(shellScenarios.manyCompetitions)
    expect(ordered.map((item) => item.urgency)).toEqual(['live', 'urgent'])
  })

  it('is a layer and not a destination', () => {
    // Concept B's architecture made the queue the front door. This is a control
    // in the chrome that opens a dialog, and there is no navigation landmark
    // and no `aria-current` anywhere near it.
    renderShell(shellScenarios.fourCompetitions)
    const control = at(
      screen.getAllByRole('button', { name: /2 things need you elsewhere/ }),
      0,
    )
    expect(control.getAttribute('aria-current')).toBeNull()
    expect(control.closest('nav')).toBeNull()
  })
})

/* ========================================================================== *
 * E. Jump — retained from Concept C
 * ========================================================================== */

describe('the optional Jump accelerator', () => {
  it('appears only once the rail has stopped being complete', () => {
    expect(shellJumpAvailable(shellScenarios.oneCompetition)).toBe(false)
    expect(shellJumpAvailable(shellScenarios.fourCompetitions)).toBe(false)
    expect(shellJumpAvailable(shellScenarios.platformScale)).toBe(false)
    expect(shellJumpAvailable(shellScenarios.manyCompetitions)).toBe(true)
    expect(shellScenarios.manyCompetitions.contexts.length).toBeGreaterThan(
      SHELL_SHORTCUT_LIMIT,
    )
  })

  it('is never required for ordinary navigation', () => {
    // The four destinations, the switcher, Explore and the account are all
    // reachable without it in the world where it does exist.
    renderShell(shellScenarios.manyCompetitions)
    expect(screen.getAllByRole('navigation', { name: 'Competition sections' }).length)
      .toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /change competition/ }).length)
      .toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Explore competitions' }).length)
      .toBeGreaterThan(0)
  })

  it('groups competitions, games and leagues separately', () => {
    renderShell(shellScenarios.manyCompetitions)
    fireEvent.click(screen.getByRole('button', { name: /jump to/i }))
    const dialog = screen.getByRole('dialog', { name: 'Jump to' })

    for (const group of ['Competitions', 'Games', 'Leagues']) {
      expect(
        within(dialog).getByRole('list', { name: group }),
        `${group} is its own list`,
      ).toBeInTheDocument()
    }

    // A flat list would satisfy "the rows are all there" and fail the point.
    const competitions = within(dialog).getByRole('list', { name: 'Competitions' })
    expect(within(competitions).getByRole('button', { name: /^Premier League/ }))
      .toBeInTheDocument()
    expect(within(competitions).queryByRole('button', { name: /Match Predictor/ }))
      .toBeNull()
  })

  it('filters within the groups and keeps them apart', () => {
    renderShell(shellScenarios.manyCompetitions)
    fireEvent.click(screen.getByRole('button', { name: /jump to/i }))
    const dialog = screen.getByRole('dialog', { name: 'Jump to' })

    fireEvent.change(
      within(dialog).getByRole('searchbox', {
        name: 'Search your competitions, games and leagues',
      }),
      { target: { value: 'serie' } },
    )

    const competitions = within(dialog).getByRole('list', { name: 'Competitions' })
    expect(within(competitions).getByRole('button', { name: /^Serie A/ })).toBeInTheDocument()
    expect(within(competitions).queryByRole('button', { name: /^Premier League/ })).toBeNull()
    // The heading stays even when its group empties, so the hierarchy does not
    // rearrange itself while the player types.
    expect(within(dialog).getByText('Leagues')).toBeInTheDocument()
  })

  it('offers no destination a competition cannot support', () => {
    // Euro 2028 runs no Last Man Standing, so there is no LMS row to press —
    // absent rather than present and refusing.
    const groups = shellJumpGroups(shellScenarios.unsupportedGame, '')
    const euroGames = groups.games.filter((entry) => entry.contextId === 'euro2028')
    expect(euroGames.map((entry) => entry.game)).toEqual([
      'match-predictor',
      'championship',
    ])
  })

  it('does not leak the catalogue into the accelerator', () => {
    // Twenty published competitions, three of them the player's. Jump searches
    // the player's own world; the other seventeen are discovery's business.
    const groups = shellJumpGroups(shellScenarios.platformScale, '')
    expect(groups.competitions).toHaveLength(3)
    expect(shellScenarios.platformScale.discovery.catalogueSize).toBe(20)
  })

  it('opens on the keyboard and closes on Escape, returning focus', () => {
    renderShell(shellScenarios.manyCompetitions)
    const opener = screen.getByRole('button', { name: /jump to/i })
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Jump to' })
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Jump to' })).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})

/* ========================================================================== *
 * F/G. The two real pages
 * ========================================================================== */

describe('the shell hosts the accepted pages unchanged', () => {
  it('renders the Gold Standard Home inside a competition', () => {
    render(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextHome model={homeScenarios.live} />
        </VNextShellProvider>
      </VNextRoot>,
    )

    // Home's own heading is the matchweek, which is the thing INSIDE the
    // competition. The shell states the competition. Neither says the other's
    // sentence, which is the whole division of labour.
    expect(
      at(screen.getAllByRole('heading', { level: 1 }), 0).textContent,
    ).toBe(homeScenarios.live.competition.matchweekLabel)
    expect(permanentText()).toContain('Premier League')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('renders the Stage 7 Match Predictor inside a competition and a game', () => {
    render(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextMatchPredictor model={openPredictorModel} actions={inertActions()} />
        </VNextShellProvider>
      </VNextRoot>,
    )

    // The competition is obvious from the chrome, the GAME is obvious from the
    // page's own heading, and the navigation marks `Games` as current — which
    // is the hierarchy working rather than being asserted.
    expect(at(screen.getAllByRole('heading', { level: 1 }), 0).textContent)
      .toBe('Match Predictor')
    expect(permanentText()).toContain('Premier League')

    const nav = at(screen.getAllByRole('navigation', { name: 'Competition sections' }), 0)
    expect(at([...nav.querySelectorAll('[aria-current="page"]')], 0).textContent)
      .toContain('Games')
  })

  it('lets the page keep working when no application world is supplied', () => {
    // Stage 6's rule survives: `VNextHome({ model })` and
    // `VNextMatchPredictor({ model, actions })` are renderable alone, which is
    // what keeps the deterministic visual matrix deterministic.
    render(
      <VNextRoot>
        <VNextHome model={homeScenarios.live} />
      </VNextRoot>,
    )
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /change competition/i })).toBeNull()
  })
})

/* ========================================================================== *
 * J. Scale
 * ========================================================================== */

describe('the platform may be large and the product must feel small', () => {
  it('bounds the rail’s competition shortcuts and counts the rest', () => {
    renderShell(shellScenarios.manyCompetitions)
    const shortcuts = screen.getByRole('navigation', { name: 'Your competitions' })
    const rows = within(shortcuts).getAllByRole('button')

    expect(rows).toHaveLength(SHELL_SHORTCUT_LIMIT)
    expect(
      within(shortcuts).getByText(
        `+${shellScenarios.manyCompetitions.contexts.length - SHELL_SHORTCUT_LIMIT} more`,
      ),
    ).toBeInTheDocument()
  })

  it('renders twenty published competitions as a three-competition product', () => {
    renderShell(shellScenarios.platformScale)
    const shortcuts = screen.getByRole('navigation', { name: 'Your competitions' })
    expect(within(shortcuts).getAllByRole('button')).toHaveLength(3)

    // The catalogue is a number behind one control, never a wall of rows.
    expect(permanentText()).not.toContain('La Liga')
    expect(permanentText()).not.toContain('Bundesliga')
  })

  it('does not put the catalogue on screen before the player asks for it', () => {
    renderShell(shellScenarios.platformScale)
    // Nothing states "20" in the permanent chrome; the count appears inside the
    // sheet, where the player has already asked to change competition.
    expect(permanentText()).not.toContain('All 20 competitions')

    fireEvent.click(
      at(screen.getAllByRole('button', { name: /Premier League, change competition/ }), 0),
    )
    expect(
      screen.getByRole('button', { name: 'All 20 competitions' }),
    ).toBeInTheDocument()
  })

  it('answers a player with no competitions without inventing one', () => {
    renderShell(shellScenarios.noCompetitions)
    expect(permanentText()).toContain('No competition selected')
    // NEVER a claim about what the player follows. The same empty state is
    // reached by a platform-scoped page that is simply not inside a
    // competition, and telling that player they follow nothing would be false.
    expect(permanentText()).not.toContain('No competition yet')
    expect(screen.queryByRole('button', { name: /change competition/i })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Your competitions' })).toBeNull()
    // The one thing with something to do.
    expect(screen.getAllByRole('button', { name: 'Explore competitions' }).length)
      .toBeGreaterThan(0)
  })
})

/* ========================================================================== *
 * Every world, on the same terms
 * ========================================================================== */

describe('every deterministic world holds the same contract', () => {
  it('has a premise for each world and a world for each premise', () => {
    // The review surface prints these, so a world added without one would board
    // with no statement of what it is for.
    expect([...shellScenarioNames].sort()).toEqual(
      Object.keys(shellScenarioPremises).sort(),
    )
    expect(shellScenarioNames.length).toBeGreaterThanOrEqual(9)
  })

  for (const name of shellScenarioNames) {
    it(`renders ${name} with one main, one h1 and one current destination`, () => {
      // THE FLOOR EVERY WORLD OWES, including the ones easiest to forget: no
      // competitions at all, a competition that runs no Last Man Standing, and
      // names far too long for any column.
      renderShell(shellScenarios[name])

      expect(screen.getAllByRole('main')).toHaveLength(1)
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

      for (const nav of screen.getAllByRole('navigation', {
        name: 'Competition sections',
      })) {
        expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
      }

      // Every navigation landmark is named. jsdom renders both shapes, so this
      // covers the hidden one too — which is the copy nobody looks at.
      for (const nav of screen.getAllByRole('navigation')) {
        expect(nav.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(0)
      }
    })

    it(`keeps ${name}'s attention layer honest`, () => {
      const model = shellScenarios[name]
      renderShell(model)

      const elsewhere = attentionElsewhere(model)
      const controls = document.querySelectorAll('[data-vnext-attention="control"]')

      if (elsewhere.length === 0) {
        // Silence is the contract, not an empty state.
        expect(controls).toHaveLength(0)
      } else {
        expect(controls.length).toBeGreaterThan(0)
        // And it never reports the competition the player is already in.
        expect(elsewhere.map((item) => item.contextId)).not.toContain(
          model.activeContextId,
        )
      }
    })
  }
})

/* ========================================================================== *
 * Overlay focus, across all three
 * ========================================================================== */

describe('every overlay behaves the same way', () => {
  const cases = [
    {
      label: 'the competition sheet',
      model: shellScenarios.fourCompetitions,
      opener: /Premier League, change competition/,
      title: 'Choose a competition',
    },
    {
      label: 'the attention list',
      model: shellScenarios.fourCompetitions,
      opener: /2 things need you elsewhere/,
      title: 'Needs you elsewhere',
    },
    {
      label: 'Jump',
      model: shellScenarios.manyCompetitions,
      opener: /jump to/i,
      title: 'Jump to',
    },
  ] as const

  for (const entry of cases) {
    it(`${entry.label} takes focus, closes on Escape and gives focus back`, () => {
      renderShell(entry.model)
      const opener = at(screen.getAllByRole('button', { name: entry.opener }), 0)
      fireEvent.click(opener)

      const dialog = screen.getByRole('dialog', { name: entry.title })
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(
        dialog.contains(document.activeElement),
        'focus enters the overlay rather than staying behind it',
      ).toBe(true)

      fireEvent.keyDown(dialog, { key: 'Escape' })
      expect(screen.queryByRole('dialog', { name: entry.title })).toBeNull()
      expect(document.activeElement).toBe(opener)
    })

    it(`${entry.label} closes from its own Close control`, () => {
      renderShell(entry.model)
      const opener = at(screen.getAllByRole('button', { name: entry.opener }), 0)
      fireEvent.click(opener)
      const dialog = screen.getByRole('dialog', { name: entry.title })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('dialog', { name: entry.title })).toBeNull()
      expect(document.activeElement).toBe(opener)
    })
  }

  it('never opens two overlays at once', () => {
    renderShell(shellScenarios.manyCompetitions)
    fireEvent.click(screen.getByRole('button', { name: /jump to/i }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(
      at(screen.getAllByRole('button', { name: /change competition/ }), 0),
    )
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
})

/**
 * Five no-ops with the real signature. The predictor is rendered here to prove
 * the SHELL hosts it; what its controls do is `tests/vnext/predictor.test.tsx`'s
 * question and is answered there against the rehearsal.
 */
function inertActions(): PredictorActions {
  return {
    setPrediction: () => {},
    clearPrediction: () => {},
    setJoker: () => {},
    confirmCard: () => {},
    retrySave: () => {},
    reload: () => {},
    refreshAfterDeadline: () => {},
  }
}
