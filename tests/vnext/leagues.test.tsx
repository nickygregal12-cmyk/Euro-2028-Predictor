import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { VNextLeagues } from '../../src/vnext/leagues/VNextLeagues'
import type { LeaguesIntent } from '../../src/vnext/leagues/VNextLeagues'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import {
  leaguesScenarioNames,
  leaguesScenarios,
  shellScenarios,
} from '../../src/vnext/fixtures'
import type { LeaguesModel } from '../../src/vnext/models/leagues'
import { at, first } from '../support/indexed'

/**
 * WHAT IS WORTH GUARDING ABOUT THE STAGE 9 SURFACE.
 *
 * Not a DOM snapshot. Composition, column counts, overflow and target sizes are
 * measured in a real browser by `e2e/vnext-leagues.spec.ts`, because jsdom
 * evaluates no container query and computes no layout.
 *
 * What is held here is the set of promises that must survive any redesign:
 *
 *   1. A ROW OPENS ONLY WHERE THE SERVER SAID IT MAY, and it opens the person
 *      it belongs to — proved with two players who share a display name.
 *   2. A row that may not be opened is PLAIN TEXT, not a disabled control.
 *   3. TIED RANKS ARE PRINTED AS SENT, never renumbered into a tidy sequence.
 *   4. A player who is not on the page still gets an answer.
 *   5. Before anything settles there is NO movement column — not a column of
 *      dashes, which would say "nobody moved".
 *   6. Points never appear without the matchweeks they came from.
 *   7. Every state is stated in WORDS as well as in colour.
 *   8. One `<main>`, one `<h1>`, in every world.
 *   9. The accessibility floor the foundation set.
 *  10. Reduced motion changes the animation and never the content.
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
 * `VNextLeagues` renders `VNextShell` itself, so wrapping it in another gives
 * the document two `<main>` landmarks and two navigations. The world reaches
 * the page's own shell through the provider, exactly as the connected
 * integration does.
 */
function renderLeagues(model: LeaguesModel, onIntent?: (intent: LeaguesIntent) => void) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextLeagues model={model} onIntent={onIntent} />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

/** The standings table itself, rather than the pinned "your standing" one. */
function standingsTable(): HTMLElement {
  return first(screen.getAllByRole('table'))
}

function bodyRows(table: HTMLElement): HTMLElement[] {
  return within(table)
    .getAllByRole('row')
    .filter((row) => within(row).queryAllByRole('columnheader').length === 0)
}

/* ------------------------------------------------------------------------ *
 * 1–2. Identity and permission
 * ------------------------------------------------------------------------ */

describe('a row opens only where the server said it may', () => {
  it('gives an openable player a button and a closed one plain text', () => {
    renderLeagues(leaguesScenarios.seasonTable, vi.fn())

    // Two rows in this world carry `reach: profile` with an id.
    expect(screen.getByRole('button', { name: 'Jamie Ferguson-Whyte' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Martin Okafor' })).toBeTruthy()

    // The rest are strangers, and a stranger is text.
    expect(screen.queryByRole('button', { name: 'Rhona Buchanan' })).toBeNull()
    expect(screen.getByText('Rhona Buchanan')).toBeTruthy()
  })

  it('offers no control at all in a table where nobody may be opened', () => {
    renderLeagues(leaguesScenarios.nothingOpenable, vi.fn())

    const table = standingsTable()
    expect(within(table).queryAllByRole('button')).toEqual([])
    // AND NOTHING DISABLED. A disabled control advertises something the reader
    // cannot have; these are simply people they have never played alongside.
    expect(table.querySelectorAll('button[disabled]')).toHaveLength(0)
    expect(table.querySelectorAll('[aria-disabled="true"]')).toHaveLength(0)
  })

  it('does not open a player the server addressed no profile for', () => {
    // Søren's reach said `profile` and carried no id. A surface that concluded
    // a permission from the reach alone would draw a link with nowhere to go.
    renderLeagues(leaguesScenarios.everyoneOpenable, vi.fn())

    expect(screen.queryByRole('button', { name: 'Søren Kjær' })).toBeNull()
    expect(screen.getByText('Søren Kjær')).toBeTruthy()
  })

  it('never turns the reader into a link to themselves', () => {
    renderLeagues(leaguesScenarios.seasonTable, vi.fn())

    expect(screen.queryByRole('button', { name: 'Nicky Gregal' })).toBeNull()
    // …and says so in a word rather than only with an accent.
    expect(screen.getByText('You')).toBeTruthy()
  })

  it('marks the reader`s row for assistive technology as well as visually', () => {
    renderLeagues(leaguesScenarios.seasonTable)

    const current = bodyRows(standingsTable()).filter(
      (row) => row.getAttribute('aria-current') === 'true',
    )
    expect(current).toHaveLength(1)
    expect(within(first(current)).getByText('Nicky Gregal')).toBeTruthy()
  })

  it('emits no intent at all when the host supplied no handler', () => {
    // A page with no host cannot open anybody, so it must not draw a control
    // that does nothing when pressed.
    renderLeagues(leaguesScenarios.seasonTable)
    expect(screen.queryByRole('button', { name: 'Jamie Ferguson-Whyte' })).toBeNull()
  })
})

describe('two players with one display name stay two players', () => {
  it('opens the right one, by id and never by name', async () => {
    const onIntent = vi.fn()
    renderLeagues(leaguesScenarios.duplicateNames, onIntent)

    // Three rows read "Sam Docherty"; exactly one of them is openable.
    const named = screen.getAllByText('Sam Docherty')
    expect(named.length).toBeGreaterThanOrEqual(3)

    const buttons = screen.getAllByRole('button', { name: 'Sam Docherty' })
    expect(buttons).toHaveLength(1)

    await userEvent.click(first(buttons))
    // BOTH SERVER-ISSUED ADDRESSES, because Stage 10's profile is assembled
    // from reads keyed by each: the account id opens contract 151's profile and
    // the season reference opens contract 192's history and rivalry.
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'openPlayer',
      playerId: 'player-sam-a',
      playerRef: 'ref-sam-a',
    })

    // The intent carries an id and nothing that could be a display name.
    const intent = onIntent.mock.calls[0]?.[0] as LeaguesIntent
    expect(JSON.stringify(intent)).not.toContain('Sam Docherty')
  })

  it('draws all three rows rather than collapsing the duplicates', () => {
    renderLeagues(leaguesScenarios.duplicateNames, vi.fn())
    expect(bodyRows(standingsTable())).toHaveLength(4)
  })
})

/* ------------------------------------------------------------------------ *
 * 3–4. Rank
 * ------------------------------------------------------------------------ */

describe('the rank column is the server`s', () => {
  it('prints tied ranks as sent instead of renumbering the rows', () => {
    renderLeagues(leaguesScenarios.tiedRanks, vi.fn())

    const ranks = bodyRows(standingsTable()).map(
      (row) => within(row).getAllByRole('rowheader')[0]?.textContent ?? '',
    )
    // Four players share rank 2 and the next row is rank 6. A renumbering
    // would produce 1,2,3,4,5,6 and look entirely plausible.
    expect(ranks.map((rank) => rank.replace(/[^\d]/g, ''))).toEqual([
      '1',
      '2',
      '2',
      '2',
      '2',
      '6',
    ])
  })

  it('says a tie in a word, not only with a symbol', () => {
    renderLeagues(leaguesScenarios.tiedRanks, vi.fn())
    expect(screen.getAllByText('tied').length).toBeGreaterThan(0)
  })

  it('answers "where do I stand" for a player who is not on the page', () => {
    renderLeagues(leaguesScenarios.seasonYouOffPage, vi.fn())

    // The reader is 318th of 412 and the page shows three rows.
    expect(screen.getByText('Your standing')).toBeTruthy()
    expect(screen.getByText('318')).toBeTruthy()
    expect(screen.getByText(/Showing 3 of 412 players/)).toBeTruthy()
  })

  it('does not pin a second copy of a reader who IS on the page', () => {
    renderLeagues(leaguesScenarios.seasonTable, vi.fn())
    expect(screen.queryByText('Your standing')).toBeNull()
    expect(screen.getAllByText('Nicky Gregal')).toHaveLength(1)
  })
})

/* ------------------------------------------------------------------------ *
 * 5. Movement
 * ------------------------------------------------------------------------ */

describe('movement', () => {
  it('has no column at all before a matchweek settles', () => {
    renderLeagues(leaguesScenarios.leagueUnsettled, vi.fn())

    expect(screen.queryByRole('columnheader', { name: 'Moved' })).toBeNull()
    // …and the page says why, rather than leaving a reader to guess.
    expect(screen.getByText(/Movement appears once a matchweek settles/)).toBeTruthy()
  })

  it('draws a column once one has, with a word beside every arrow', () => {
    renderLeagues(leaguesScenarios.leagueSettled, vi.fn())

    expect(screen.getByRole('columnheader', { name: 'Moved' })).toBeTruthy()
    expect(screen.getByText(/up 3 places since Matchweek 12/)).toBeTruthy()
    expect(screen.getByText(/down 1 place since Matchweek 12/)).toBeTruthy()
    expect(screen.getByText(/no change since Matchweek 12/)).toBeTruthy()
  })

  it('gives a member with no movement recorded a word, not a silent cell', () => {
    // The column is only drawn once something settled, so a null here is a
    // member the movement read did not mention. The dash is `aria-hidden`; with
    // nothing beside it the cell is completely silent to a screen reader and
    // "no movement recorded" is indistinguishable from a broken cell.
    renderLeagues(leaguesScenarios.leagueSettled, vi.fn())
    expect(screen.getByText('no movement recorded')).toBeTruthy()
  })

  it('offers a retry beside whatever could not be read', async () => {
    const onRetry = vi.fn()
    render(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextLeagues
            model={leaguesScenarios.leagueTableUnavailable}
            onIntent={vi.fn()}
            onRetry={onRetry}
          />
        </VNextShellProvider>
      </VNextRoot>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    // AND THE CHOOSER IS STILL THERE. A retry is not a substitute for a way out.
    expect(screen.getByRole('button', { name: 'Season' })).toBeTruthy()
  })

  it('names the matchweek a movement is over', () => {
    renderLeagues(leaguesScenarios.leagueSettled, vi.fn())
    // "up 2" with no answer to "since when" is a number a reader assumes is
    // about today.
    expect(screen.getAllByText(/since Matchweek 12/).length).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------------ *
 * 6. Points never travel alone
 * ------------------------------------------------------------------------ */

describe('points are never drawn without their matchweeks', () => {
  it('pairs every points total with the matchweeks it came from', () => {
    renderLeagues(leaguesScenarios.leagueTied, vi.fn())

    const rows = bodyRows(standingsTable())
    for (const row of rows) {
      expect(row.textContent).toMatch(/from \d+/)
    }
  })

  it('distinguishes two players tied on points from different matchweek counts', () => {
    renderLeagues(leaguesScenarios.leagueTied, vi.fn())

    const rows = bodyRows(standingsTable())
    expect(at(rows, 0).textContent).toContain('from 12')
    expect(at(rows, 1).textContent).toContain('from 11')
  })
})

/* ------------------------------------------------------------------------ *
 * 7. Everything is stated in words
 * ------------------------------------------------------------------------ */

describe('nothing is carried by colour alone', () => {
  it('marks a member who never entered the game', () => {
    renderLeagues(leaguesScenarios.leagueWithNonEntrants, vi.fn())
    expect(screen.getAllByText('Not entered')).toHaveLength(2)
  })

  it('names the league`s organiser', () => {
    renderLeagues(leaguesScenarios.leagueWithNonEntrants, vi.fn())
    expect(screen.getByText('Organiser')).toBeTruthy()
  })

  it('names what could not be read, without denying the players', () => {
    renderLeagues(leaguesScenarios.seasonUnavailable, vi.fn())

    expect(screen.getByText(/could not load the season table/)).toBeTruthy()
    // IT DOES NOT SAY THE COMPETITION IS EMPTY.
    expect(screen.queryByText(/no players/i)).toBeNull()
    expect(screen.queryByText(/nobody/i)).toBeNull()
  })

  it('keeps the chooser usable when only the chosen table failed', () => {
    renderLeagues(leaguesScenarios.leagueTableUnavailable, vi.fn())

    expect(screen.getByRole('button', { name: 'Season' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sunday Club/ })).toBeTruthy()
    expect(screen.getByText(/could not load this league’s table/)).toBeTruthy()
  })

  it('answers an empty table with a sentence rather than an empty table', () => {
    renderLeagues(leaguesScenarios.emptySeason, vi.fn())

    // A `<table>` of column headers over an empty body announces a structure
    // with nothing in it, which is a WCAG 1.3.1 failure as well as poor prose.
    expect(screen.queryAllByRole('table')).toEqual([])
    expect(screen.getByText('Nobody has entered this season yet.')).toBeTruthy()
    // AND IT IS NOT AN APOLOGY. Zero is the server's answer, not a failure.
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('says the same for a league nobody has entered', () => {
    renderLeagues(leaguesScenarios.leagueEmpty, vi.fn())
    expect(screen.queryAllByRole('table')).toEqual([])
    expect(screen.getByText('No member of this league has entered yet.')).toBeTruthy()
  })

  it('calls an unnamed league "This league" rather than inventing a name', () => {
    renderLeagues(leaguesScenarios.leagueUnnamed, vi.fn())
    expect(screen.getByRole('heading', { name: 'This league', level: 2 })).toBeTruthy()
    expect(screen.queryByText(/league-unknown/)).toBeNull()
  })
})

/* ------------------------------------------------------------------------ *
 * The chooser
 * ------------------------------------------------------------------------ */

describe('the scope chooser', () => {
  it('is absent when there is nothing to switch between', () => {
    renderLeagues(leaguesScenarios.nothingOpenable, vi.fn())

    expect(screen.queryByRole('button', { name: 'Season' })).toBeNull()
    expect(screen.getByText(/not in a private league/)).toBeTruthy()
  })

  it('does not say the reader has no league when the list simply failed', () => {
    // `leagues: []` HAS TWO MEANINGS. Here the read did not answer, so the page
    // may report the failure and may NOT report a fact about the reader.
    renderLeagues(leaguesScenarios.leagueListUnavailable, vi.fn())

    expect(screen.getByText(/could not load your private leagues/)).toBeTruthy()
    expect(screen.queryByText(/not in a private league/)).toBeNull()
  })

  it('never strands a reader inside a league the list could not name', () => {
    // The mirror of the case above: the LIST failed while a league's own table
    // answered. `leagues` is empty, so a chooser gated purely on its length
    // would not be drawn — leaving no "Season" control and no way out of a
    // league the page cannot even name.
    renderLeagues(leaguesScenarios.leagueUnnamed, vi.fn())

    expect(screen.getByRole('button', { name: 'Season' })).toBeTruthy()
  })

  it('highlights the table the model is actually showing', async () => {
    renderLeagues(leaguesScenarios.leagueSettled, vi.fn())

    expect(screen.getByRole('button', { name: 'Season' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
    expect(
      screen.getByRole('button', { name: /Sunday Club/ }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('does not move the highlight ahead of the model when pressed', async () => {
    // The two tables are two reads. A highlight that ran ahead would show one
    // league selected above another league's rows for a render.
    const onIntent = vi.fn()
    renderLeagues(leaguesScenarios.leagueSettled, onIntent)

    await userEvent.click(screen.getByRole('button', { name: 'Season' }))

    expect(onIntent).toHaveBeenCalledWith({ kind: 'scope', scope: { kind: 'global' } })
    expect(screen.getByRole('button', { name: 'Season' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('asks for a league by its id', async () => {
    const onIntent = vi.fn()
    renderLeagues(leaguesScenarios.seasonTable, onIntent)

    await userEvent.click(screen.getByRole('button', { name: /The Office/ }))
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'scope',
      scope: { kind: 'private', leagueId: 'league-office' },
    })
  })
})

/* ------------------------------------------------------------------------ *
 * 8. Document structure, in every world
 * ------------------------------------------------------------------------ */

describe('every world is one page', () => {
  for (const name of leaguesScenarioNames) {
    it(`${name} has one main landmark and one h1`, () => {
      const { unmount } = renderLeagues(leaguesScenarios[name], vi.fn())
      try {
        expect(screen.getAllByRole('main')).toHaveLength(1)
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
      } finally {
        unmount()
      }
    })
  }

  it('states one member count across the chooser, the heading and the foot', () => {
    // THE LIST AND CONTRACT 128 ARE TWO READS AND CAN DISAGREE. This has to
    // compare the CHIP against the table, because the heading and the foot now
    // both read `totalCount` and would agree with each other whatever went
    // wrong — an earlier version of this test regexed the flattened page text
    // and could not fail at all.
    for (const name of leaguesScenarioNames) {
      const model = leaguesScenarios[name]
      if (model.scope.kind !== 'private' || model.private === null) continue

      const { unmount } = renderLeagues(model, vi.fn())
      try {
        const chip = screen.queryAllByRole('button').find(
          (node) =>
            node.getAttribute('aria-pressed') === 'true' &&
            node.closest('[data-vnext-zone="chooser"]') !== null,
        )
        if (chip === undefined) continue

        const chipCount = (chip.textContent ?? '').match(/(\d[\d,]*)\s*members?\b/)?.[1]
        expect(
          chipCount,
          `${name}: the chooser chip states ${chipCount} and the table ${model.private?.totalCount}`,
        ).toBe(String(model.private?.totalCount))
      } finally {
        unmount()
      }
    }
  })

  it('names the competition and the game without merging them', () => {
    renderLeagues(leaguesScenarios.seasonTable, vi.fn())
    expect(screen.getByText('Caledonian Premiership · 2027/28')).toBeTruthy()
    expect(screen.getByText('Match Predictor')).toBeTruthy()
  })

  it('gives every standings table an accessible name', () => {
    renderLeagues(leaguesScenarios.leagueSettled, vi.fn())
    for (const table of screen.getAllByRole('table')) {
      expect((table.querySelector('caption')?.textContent ?? '').length).toBeGreaterThan(0)
    }
  })

  it('gives every standings table its column headers, pinned rows included', () => {
    // A one-row data table with no `<thead>` reads its rank as a bare number
    // with nothing to associate it to. axe does not flag a header-less data
    // table, so only an assertion catches it.
    renderLeagues(leaguesScenarios.seasonYouOffPage, vi.fn())

    const tables = screen.getAllByRole('table')
    expect(tables.length).toBe(2)
    for (const table of tables) {
      expect(
        within(table).getAllByRole('columnheader').map((cell) => cell.textContent),
      ).toEqual(['Rank', 'Player', 'Points'])
    }
  })

  it('gives a pinned PRIVATE row the same headers, movement column included', () => {
    // The private pinned table is the half with logic — its "Moved" column is
    // conditional — so it is the half worth asserting. A version of this test
    // that only covered the season table left it free to be deleted.
    renderLeagues(leaguesScenarios.largeLeague, vi.fn())

    const tables = screen.getAllByRole('table')
    expect(tables.length).toBe(2)
    for (const table of tables) {
      expect(
        within(table).getAllByRole('columnheader').map((cell) => cell.textContent),
      ).toEqual(['Rank', 'Player', 'Moved', 'Points'])
    }
  })
})

/* ------------------------------------------------------------------------ *
 * 9. Accessibility floor
 * ------------------------------------------------------------------------ */

describe('the accessibility floor holds in every world', () => {
  for (const name of leaguesScenarioNames) {
    it(`${name} has no critical or serious violation`, async () => {
      await scan(
        <VNextRoot>
          <VNextShellProvider model={shellScenarios.oneCompetition}>
            <VNextLeagues model={leaguesScenarios[name]} onIntent={vi.fn()} />
          </VNextShellProvider>
        </VNextRoot>,
      )
    })
  }
})

/* ------------------------------------------------------------------------ *
 * 10. Reduced motion
 * ------------------------------------------------------------------------ */

describe('reduced motion', () => {
  it('changes nothing about what the table says', () => {
    const full = render(
      <VNextRoot motion="full">
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextLeagues model={leaguesScenarios.leagueSettled} onIntent={vi.fn()} />
        </VNextShellProvider>
      </VNextRoot>,
    )
    const fullText = screen.getByRole('main').textContent
    full.unmount()

    render(
      <VNextRoot motion="reduced">
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextLeagues model={leaguesScenarios.leagueSettled} onIntent={vi.fn()} />
        </VNextShellProvider>
      </VNextRoot>,
    )
    expect(screen.getByRole('main').textContent).toBe(fullText)
  })
})
