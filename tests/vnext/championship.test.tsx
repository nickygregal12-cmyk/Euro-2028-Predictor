import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { VNextChampionship } from '../../src/vnext/championship/VNextChampionship'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import {
  championshipScenarioNames,
  championshipScenarios,
  shellScenarios,
} from '../../src/vnext/fixtures'
import type { ChampionshipPageModel } from '../../src/vnext/models/championship'

/**
 * THE STAGE 12 SURFACE.
 *
 * jsdom evaluates no container query, so responsive claims belong to the
 * browser suite. These are about the MODEL and the MARKUP:
 *
 *   1. NOTHING ABOUT ELIMINATION IS EVER PRINTED unless an authority stated it.
 *   2. AN EMPTY SEAT IS "To be decided", never a person called "Player" and
 *      never a bye.
 *   3. A SETTLED TIE IS A WORD, with no scoreline anywhere on the page.
 *   4. NO CONNECTOR LINE, at any width, because the read supplies no edge.
 *   5. EVERY WORLD IS A STATE THE MAPPER CAN PRODUCE.
 */

function renderChampionship(
  model: ChampionshipPageModel,
  props: {
    onRetry?: () => void
    refreshing?: boolean
    onIntent?: (intent: { kind: 'submit-penalty-number'; value: number }) => void
    busy?: boolean
    notice?: string
  } = {},
) {
  return render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <VNextChampionship model={model} {...props} />
    </VNextShellProvider>,
  )
}

function zone(name: string): HTMLElement {
  const node = document.querySelector(`[data-vnext-zone="${name}"]`)
  if (node === null) throw new Error(`no zone ${name}`)
  return node as HTMLElement
}

describe('every world is one page', () => {
  it.each(championshipScenarioNames)('%s has one main and one h1', (name) => {
    renderChampionship(championshipScenarios[name])
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  /**
   * EVERY WORLD MUST BE A STATE `buildChampionshipModel` CAN PRODUCE.
   *
   * Stage 10 shipped a fixture depicting a payload the server cannot emit, and
   * four layers of tests passed against it because every layer trusted the
   * fixture. These are the pairing rules the mapper enforces, asserted over all
   * the worlds at once so a new one cannot be added in an impossible state.
   */
  it.each(championshipScenarioNames)('%s pairs its panels lawfully', (name) => {
    const world = championshipScenarios[name]

    // CONTRACT 207. The standing is `bonus_competition_entrants.outcome`, so
    // every one of the five stored values is a lawful world and NONE of them
    // has to agree with the bracket — a competition can record a player as
    // eliminated with no knockout drawn at all, which `eliminatedInGroups` is.
    if (world.standing.kind === 'stated') {
      expect(['active', 'qualified', 'survived', 'eliminated', 'champion']).toContain(
        world.standing.outcome,
      )
    }

    // WHAT MUST STILL AGREE: a world claiming the READER won it must also carry
    // the bracket that says who won, because the page announces the winner from
    // the bracket panel and a champion with no bracket would be a page saying
    // "you won" beside no final.
    if (world.standing.kind === 'stated' && world.standing.outcome === 'champion') {
      expect(world.bracket.kind).toBe('bracket')
      if (world.bracket.kind === 'bracket') {
        expect(world.bracket.champion?.isYou).toBe(true)
      }
    }

    // A locked or unscheduled Penalty Number carries no lane, because there is
    // nothing to submit with — and an open one always does.
    if (world.penaltyNumber.kind === 'open' || world.penaltyNumber.kind === 'submitted') {
      expect(['odd', 'even']).toContain(world.penaltyNumber.lane)
    }
    // A panel that is not a bracket cannot be offering a live submission.
    if (world.bracket.kind !== 'bracket') {
      expect(world.penaltyNumber.kind).toBe('not-required')
    }

    // A PENALTY NUMBER REQUIRES A LIVE TIE OF THE READER'S. Contract 193
    // returns `penalty_number` only when `my_tie` is non-null, and `my_tie`
    // filters `winner_user_id is null` — so a reader whose own seats are all
    // settled has nothing to submit into. Five worlds were shipped offering a
    // knocked-out or already-crowned reader a submission form, and the rule set
    // above had no clause that could notice.
    if (
      world.bracket.kind === 'bracket' &&
      world.penaltyNumber.kind !== 'not-required'
    ) {
      const live = world.bracket.seats.filter((seat) => {
        if (seat.outcome.kind !== 'unsettled') return false
        return [seat.home, seat.away].some((side) => side.kind === 'player' && side.isYou)
      })
      expect(live.length).toBeGreaterThan(0)
    }

    if (world.bracket.kind === 'bracket') {
      // `not-drawn` is the mapper's answer to an empty seat list, so a
      // `bracket` panel is never empty.
      expect(world.bracket.seats.length).toBeGreaterThan(0)
      for (const seat of world.bracket.seats) {
        // A settled tie names a decision; an unsettled one names nothing.
        if (seat.outcome.kind === 'settled') {
          expect(seat.outcome.decision).toBeTruthy()
        }
      }
    }
  })
})

describe('elimination is stated by the server, and never derived', () => {
  it('says nothing about elimination when the reader lost their only tie', () => {
    // The world where the inference is most available: a settled defeat, no
    // later tie, and a read that carried no outcome. `lostButNotStated` is now
    // a database behind contract 208, and the page must be as silent as it was
    // when no read anywhere held the fact.
    renderChampionship(championshipScenarios.lostButNotStated)
    const page = document.body.textContent ?? ''
    expect(page).not.toMatch(/eliminated|knocked out|you are out/i)
    // The draw fact is still stated, and it is the only thing in the block.
    expect(zone('standing').textContent).toBe('You were seeded into the knockout draw.')
    expect(document.querySelector('[data-vnext-zone="seeded"]')).not.toBeNull()
  })

  it('states elimination where nothing on the page looks like a defeat', () => {
    // THE WORLD CONTRACT 207 EXISTS FOR. Group phase, no knockout, no settled
    // tie and no seed — every inference the surface could make returns "still
    // in", and the competition has recorded the reader as out.
    renderChampionship(championshipScenarios.eliminatedInGroups)
    expect(zone('standing').textContent).toContain('You have been eliminated')
    expect(document.querySelector('[data-vnext-zone="seeded"]')).toBeNull()
  })

  it('names the winner AND states the reader is out, from two different facts', () => {
    renderChampionship(championshipScenarios.someoneElseWon)
    // The bracket panel announces the fixture's winner.
    expect(zone('champion').textContent).toContain('Bo Nilsson')
    // The standing states the entrant's outcome. Neither produced the other.
    expect(zone('standing').textContent).toContain('You have been eliminated')
  })

  it('states champion where the server named the reader', () => {
    renderChampionship(championshipScenarios.youAreChampion)
    expect(zone('standing').textContent).toContain('You won the Championship')
  })
})

describe('an empty seat is a hole, not a person and not a bye', () => {
  it('reads "To be decided"', () => {
    renderChampionship(championshipScenarios.halfFilledSeat)
    expect(zone('bracket').textContent).toContain('To be decided')
  })

  // Contract 193 coalesces an unfilled seat to the display name 'Player'. No
  // fixture uses that word as a real entrant's name — `wideDraw` used to name
  // sixteen of them that way, which is exactly the world with the most seats
  // for a sentinel to hide in — so a bare "Player" anywhere could only have
  // come from trusting that coalesce.
  it.each(championshipScenarioNames)(
    'never prints the literal name contract 193 returns for a hole (%s)',
    (name) => {
      const { container } = renderChampionship(championshipScenarios[name])
      expect(container.textContent).not.toMatch(/\bPlayer\b/)
    },
  )

  it('does not call it a bye or a walkover', () => {
    renderChampionship(championshipScenarios.halfFilledSeat)
    expect(zone('bracket').textContent).not.toMatch(/bye|walkover/i)
    expect(zone('bracket').textContent).toContain('Not played yet')
  })
})

describe('a settled tie is a word, and never a score', () => {
  it('states each decision in the settlement authority’s vocabulary', () => {
    renderChampionship(championshipScenarios.everyDecision)
    const bracket = zone('bracket').textContent ?? ''
    expect(bracket).toContain('Decided on points')
    expect(bracket).toContain('Decided in extra time')
    expect(bracket).toContain('Decided by Penalty Number')
    expect(bracket).toContain('Walkover')
  })

  it('keeps an organiser walkover distinct from an ordinary one', () => {
    renderChampionship(championshipScenarios.walkover)
    const bracket = zone('bracket').textContent ?? ''
    expect(bracket).toContain('Walkover, awarded by an organiser')
  })

  it('says nothing about WHY a walkover happened', () => {
    renderChampionship(championshipScenarios.walkover)
    expect(zone('bracket').textContent).not.toMatch(/withdrew|withdrawn|disqualif/i)
  })

  it('renders no scoreline anywhere on a settled bracket', () => {
    renderChampionship(championshipScenarios.everyDecision)
    // A scoreline would be two digits with a separator between them.
    expect(zone('bracket').textContent ?? '').not.toMatch(/\d+\s*[-–:]\s*\d+/)
  })

  it('marks the winner in words, not only in weight', () => {
    renderChampionship(championshipScenarios.everyDecision)
    expect(zone('bracket').textContent).toContain('— won')
  })
})

describe('the bracket asserts no topology', () => {
  it('draws no connector between seats', () => {
    renderChampionship(championshipScenarios.wideDraw)
    // An edge between seats would be an svg line or a bordered connector
    // element. Neither may exist: the read supplies `bracket_slot` per seat and
    // no edge, so a line would be this lane inventing the progression.
    expect(zone('bracket').querySelectorAll('svg, line, path')).toHaveLength(0)
  })

  it('names an unlabelled round by its sequence rather than by counting seats', () => {
    renderChampionship(championshipScenarios.unlabelledRound)
    expect(zone('bracket').textContent).toContain('Round 21')
  })

  it('groups rounds in the server’s order', () => {
    renderChampionship(championshipScenarios.wideDraw)
    const headings = [...zone('bracket').querySelectorAll('h2')].map((h) => h.textContent)
    expect(headings).toEqual(['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'])
  })

  it('renders a play-off whose round size the server left null', () => {
    renderChampionship(championshipScenarios.playoffRound)
    expect(zone('bracket').textContent).toContain('Play-off')
  })
})

describe('the reader can find themselves', () => {
  it('marks their own tie in words', () => {
    renderChampionship(championshipScenarios.drawnBracket)
    expect(zone('bracket').textContent).toContain('Your tie')
  })

  it('marks their own name', () => {
    renderChampionship(championshipScenarios.drawnBracket)
    expect(zone('bracket').textContent).toContain('(you)')
  })
})

describe('the states that are not a bracket', () => {
  it('offers no join door to a non-entrant', () => {
    renderChampionship(championshipScenarios.notEntered)
    expect(zone('not-entered').textContent).toContain('not entered')
    expect((document.body.textContent ?? '').toLowerCase()).not.toContain('join')
  })

  it('says the draw has not been made rather than showing an empty bracket', () => {
    renderChampionship(championshipScenarios.notDrawn)
    expect(zone('not-drawn').textContent).toContain('has not been made')
  })

  it('offers a retry only where the read failed', () => {
    renderChampionship(championshipScenarios.unavailable, { onRetry: () => {} })
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
  })

  it('swaps the sentence rather than the page while refreshing', () => {
    renderChampionship(championshipScenarios.unavailable, {
      onRetry: () => {},
      refreshing: true,
    })
    expect(zone('bracket-unavailable').textContent).toContain('Trying again')
    // No second retry beside an in-flight one.
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
  })
})

/**
 * THE PENALTY NUMBER — the one secret, and the one thing the page asks for.
 */
describe('the Penalty Number states its rule before any refusal', () => {
  it('prints the odd-lane rule beside the box', () => {
    renderChampionship(championshipScenarios.penaltyOpenOdd)
    expect(zone('penalty-rule').textContent).toContain('odd number from 1 to 99')
  })

  it('prints the even-lane rule for the other lane', () => {
    renderChampionship(championshipScenarios.penaltySubmittedZero)
    expect(zone('penalty-rule').textContent).toContain('even number from 0 to 98')
  })

  it('refuses to submit a value the lane forbids', () => {
    const onIntent = vi.fn()
    renderChampionship(championshipScenarios.penaltyOpenOdd, { onIntent })
    const input = zone('penalty-number').querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '8' } })
    // Even, in the odd lane. The server would refuse it; the page does not send
    // it — the constraint was knowable before the write.
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
    fireEvent.submit(input.closest('form') as HTMLFormElement)
    expect(onIntent).not.toHaveBeenCalled()
  })

  it('submits a value the lane allows', () => {
    const onIntent = vi.fn()
    renderChampionship(championshipScenarios.penaltyOpenOdd, { onIntent })
    const input = zone('penalty-number').querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '7' } })
    fireEvent.submit(input.closest('form') as HTMLFormElement)
    expect(onIntent).toHaveBeenCalledWith({ kind: 'submit-penalty-number', value: 7 })
  })
})

describe('a submitted zero is a submission', () => {
  it('shows the stored value rather than an empty prompt', () => {
    renderChampionship(championshipScenarios.penaltySubmittedZero)
    // `0` is legal in the even lane. A page choosing its case on truthiness
    // tells this player they have not submitted.
    expect(zone('penalty-value').textContent).toContain('0')
    expect(zone('penalty-number').textContent).toContain('change it')
  })
})

describe('the Penalty Number panel says only what the read stated', () => {
  it('calls an unscheduled round unscheduled, not closed', () => {
    renderChampionship(championshipScenarios.penaltyUnscheduled)
    const panel = zone('penalty-number').textContent ?? ''
    expect(panel).toContain('no kick-off time yet')
    // Nothing has been missed, so it must not read as a deadline gone by.
    expect(panel).not.toMatch(/locked|closed|too late/i)
  })

  it('shows the reader their own locked value', () => {
    renderChampionship(championshipScenarios.penaltyLocked)
    expect(zone('penalty-number').textContent).toContain('37')
  })

  it('says plainly when they never submitted', () => {
    renderChampionship(championshipScenarios.penaltyLockedUnsubmitted)
    expect(zone('penalty-number').textContent).toContain('did not submit')
  })

  /**
   * THERE IS NOWHERE TO SHOW THE OPPONENT'S NUMBER, so no world can leak one.
   * Contract 193 never returns it, and the model has no field for it or for
   * whether they submitted.
   */
  it.each(championshipScenarioNames)('%s never mentions an opponent’s number', (name) => {
    renderChampionship(championshipScenarios[name])
    const page = document.body.textContent ?? ''
    expect(page).not.toMatch(/their penalty|opponent.s (penalty|number)|they (have )?submitted/i)
  })

  it('carries the write’s own sentence rather than re-choosing copy', () => {
    renderChampionship(championshipScenarios.penaltyOpenOdd, {
      notice: 'This round is not taking Penalty Numbers. Reload to see where it stands.',
    })
    expect(zone('penalty-number').textContent).toContain('not taking Penalty Numbers')
  })

  /**
   * NOTE THE VALID VALUE. An earlier version asserted the button was disabled
   * with the box EMPTY — which it is anyway, because nothing is submittable
   * yet. That version passed with the `busy` guard removed entirely. The guard
   * only means anything when the value would otherwise be accepted.
   */
  it('waits rather than queueing a second submission', () => {
    const onIntent = vi.fn()
    renderChampionship(championshipScenarios.penaltyOpenOdd, { busy: true, onIntent })
    const input = zone('penalty-number').querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '7' } })

    expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
    fireEvent.submit(input.closest('form') as HTMLFormElement)
    expect(onIntent).not.toHaveBeenCalled()
  })
})

/**
 * THE GROUP PHASE, RENDERED.
 *
 * The Championship spends most of its life here, and this page answered it with
 * one sentence — "the knockout draw has not been made yet" — while contract 167
 * held the standings that phase is about. These assert the table is real, is
 * the server's, and stays silent where the server said nothing.
 */
describe('the group phase', () => {
  it('renders a table for each group, in the server’s row order', () => {
    renderChampionship(championshipScenarios.groupPhase)
    const tables = screen.getAllByRole('table')
    expect(tables).toHaveLength(2)
    const firstColumn = within(tables[0] as HTMLElement)
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent)
    expect(firstColumn[0]).toContain('Ada Lovelace')
    expect(firstColumn[3]).toContain('Dee Okafor')
  })

  it('marks the reader’s own row and their own group', () => {
    const { container } = renderChampionship(championshipScenarios.groupPhase)
    expect(container.querySelectorAll('tr[data-you]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-yours="true"]')).toHaveLength(1)
  })

  it('shows a group table alongside a bracket that does not exist yet', () => {
    renderChampionship(championshipScenarios.groupPhase)
    // BOTH, from two reads that disagree by design.
    expect(screen.getByText('The knockout draw has not been made yet.')).toBeInTheDocument()
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0)
  })

  it('says the reader holds no group without hiding the tables', () => {
    renderChampionship(championshipScenarios.groupsButNotYours)
    expect(screen.getByText('You do not hold a group in this stage.')).toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(2)
  })

  it('prints no table at all when the competition has no group stage', () => {
    renderChampionship(championshipScenarios.noGroupStage)
    expect(screen.queryAllByRole('table')).toHaveLength(0)
  })

  it('renders the bracket when only the group read failed', () => {
    const { container } = renderChampionship(championshipScenarios.groupsUnavailable)
    expect(screen.queryAllByRole('table')).toHaveLength(0)
    // The other read answered, and its panel is untouched.
    expect(container.querySelector('[data-vnext-zone="bracket"]')).not.toBeNull()
  })

  it('writes an em dash where a player has no scoreline error yet', () => {
    renderChampionship(championshipScenarios.groupPhase)
    const table = screen.getAllByRole('table')[1] as HTMLElement
    const lastRow = within(table).getAllByRole('row').at(-1) as HTMLElement
    expect(lastRow.textContent).toContain('—')
  })

  /**
   * A SCROLLING BOX A KEYBOARD CANNOT REACH HIDES ITS CONTENT.
   *
   * `overflow-x: auto` makes the group container a scrollable region. Without a
   * tab stop, the columns past the fold are unreachable by keyboard on every
   * phone — which is exactly where the table scrolls. The axe gate caught this
   * across 42 stories; this holds it at the unit level too.
   */
  it('gives each scrolling group table a tab stop and a name', () => {
    const { container } = renderChampionship(championshipScenarios.groupPhase)
    const boxes = [...container.querySelectorAll('[data-vnext-group]')]
    expect(boxes.length).toBe(2)
    for (const box of boxes) {
      expect(box.getAttribute('tabindex')).toBe('0')
      expect(box.getAttribute('role')).toBe('region')
      expect(box.getAttribute('aria-label')).toMatch(/^Group \d+$/)
    }
  })

  it('names each scrollable region distinctly, because they are landmarks', () => {
    const { container } = renderChampionship(championshipScenarios.groupPhase)
    const names = [...container.querySelectorAll('[data-vnext-group]')].map((box) =>
      box.getAttribute('aria-label'),
    )
    expect(new Set(names).size).toBe(names.length)
  })

  it('gives every group table a caption naming the group', () => {
    const { container } = renderChampionship(championshipScenarios.groupPhase)
    const captions = [...container.querySelectorAll('caption')].map((c) => c.textContent)
    expect(captions[0]).toContain('Group 1')
    expect(captions[1]).toContain('Group 2')
  })
})

/**
 * THE FIELD ITSELF. A Penalty Number is a SEALED BID that cannot be changed
 * after the round locks, so the value submitted must be the value typed.
 */
describe('the Penalty Number field takes digits and nothing else', () => {
  function field() {
    return screen.getByLabelText('Your Penalty Number') as HTMLInputElement
  }

  it.each([
    ['0x11', '01'],
    ['1e1', '11'],
    ['+7', '7'],
    ['7.5', '75'],
    [' 9 ', '9'],
  ])('keeps only the digits of %s', (typed, kept) => {
    renderChampionship(championshipScenarios.penaltyOpenOdd)
    fireEvent.change(field(), { target: { value: typed } })
    expect(field().value).toBe(kept)
  })

  it('never holds more than two digits, because the range is 0 to 99', () => {
    renderChampionship(championshipScenarios.penaltyOpenOdd)
    fireEvent.change(field(), { target: { value: '1234' } })
    expect(field().value).toBe('12')
  })

  it('submits the number that is on screen', () => {
    const onIntent = vi.fn()
    renderChampionship(championshipScenarios.penaltyOpenOdd, { onIntent })
    // `0x11` is 17 to `Number`, and 17 is odd — so an unfiltered field would
    // have accepted it and submitted 17, a bid the reader never typed. Filtered,
    // the field holds `01` and submits the 1 that is on screen.
    fireEvent.change(field(), { target: { value: '0x11' } })
    expect(field().value).toBe('01')
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'submit-penalty-number', value: 1 })
  })

  it('identifies a value this lane will not take, rather than only disabling', () => {
    renderChampionship(championshipScenarios.penaltyOpenOdd)
    fireEvent.change(field(), { target: { value: '8' } })
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    const describedBy = field().getAttribute('aria-describedby') ?? ''
    expect(describedBy).toContain('vnext-penalty-error')
  })

  it('is not marked invalid before anything is typed', () => {
    renderChampionship(championshipScenarios.penaltyOpenOdd)
    expect(field()).not.toHaveAttribute('aria-invalid')
  })

  it('describes the field with the VISIBLE rule, not a hidden second copy', () => {
    const { container } = renderChampionship(championshipScenarios.penaltyOpenOdd)
    const described = container.querySelector('#vnext-penalty-rule')
    expect(described).not.toBeNull()
    // One element carries the sentence, and the input points at it.
    expect(container.querySelectorAll('#vnext-penalty-rule')).toHaveLength(1)
    expect(described?.getAttribute('data-vnext-zone')).toBe('penalty-rule')
  })
})

/**
 * THE REFUSAL SENTENCE OUTLIVES THE PANEL IT WAS EARNED IN.
 *
 * The dominant refusal is `55000` — the round locked at its first kickoff — and
 * the hook re-reads on refusal, so the panel flips to `locked` before the
 * sentence can be shown. Rendered only inside the submission form, it was
 * discarded on the one refusal that actually happens.
 */
describe('a refusal is shown whatever the panel became', () => {
  it.each([
    ['penaltyLocked', 'locked'],
    ['penaltyUnscheduled', 'unscheduled'],
    ['penaltyOpenOdd', 'open'],
  ] as const)('shows it over the %s panel', (name, _state) => {
    renderChampionship(championshipScenarios[name], {
      notice: 'Penalty Numbers for this round locked at the first kick-off.',
    })
    expect(
      screen.getByText('Penalty Numbers for this round locked at the first kick-off.'),
    ).toBeInTheDocument()
  })

  it('shows it even where there is no Penalty Number to submit', () => {
    renderChampionship(championshipScenarios.notDrawn, { notice: 'That did not save.' })
    expect(screen.getByText('That did not save.')).toBeInTheDocument()
  })

  it('renders no Penalty Number section at all when there is nothing to say', () => {
    const { container } = renderChampionship(championshipScenarios.notDrawn)
    expect(container.querySelector('[data-vnext-zone="penalty-number"]')).toBeNull()
  })
})

/**
 * THE STANDING SLOT SAYS WHAT THE FIELD KNOWS, AND NO MORE.
 *
 * `you_qualified` is `exists(member.seed is not null)` — permanently true from
 * the moment a seed is dealt, and never false once a player is knocked out. In
 * the standing slot it read as a current status, so a player eliminated in
 * round one saw it above the seat recording their defeat.
 */
describe('the qualification line is a draw fact, not a survival claim', () => {
  it('does not let the draw fact contradict the verdict above it', () => {
    // Contract 208's separation, at its sharpest: eliminated AND once seeded
    // are both true of the same reader. The verdict leads; the draw fact
    // follows it in the past tense and never stands in for it.
    const { container } = renderChampionship({
      ...championshipScenarios.lostButNotStated,
      standing: { kind: 'stated', outcome: 'eliminated' },
    })
    const standing = container.querySelector('[data-vnext-zone="standing"]')
    expect(standing?.textContent).toBe(
      'You have been eliminated.You were seeded into the knockout draw.',
    )
    // Nothing on the page claims they are still in it.
    expect(screen.queryByText(/still in/i)).toBeNull()
  })

  it('draws no verdict at all where the read carried none', () => {
    const { container } = renderChampionship({
      ...championshipScenarios.lostButNotStated,
      seededIntoKnockout: false,
    })
    expect(container.querySelector('[data-vnext-zone="standing"]')).toBeNull()
  })
})

/**
 * THE DOCUMENT'S COUNT AND THE REGISTRY'S, HELD TOGETHER.
 *
 * The authority claimed fourteen worlds in two places while nineteen were
 * shipped. A number written by hand in prose drifts the first time a world is
 * added; asserting it is cheaper than remembering.
 */
describe('the authority states the number of worlds that exist', () => {
  it('matches `docs/product/vnext-championship.md`', async () => {
    const { readFileSync } = await import('node:fs')
    const doc = readFileSync('docs/product/vnext-championship.md', 'utf8')
    const claimed = [...doc.matchAll(/(\d+)\s+(?:deterministic\s+)?worlds/g)].map((m) =>
      Number(m[1]),
    )
    expect(claimed.length).toBeGreaterThan(0)
    for (const count of claimed) expect(count).toBe(championshipScenarioNames.length)
  })
})
