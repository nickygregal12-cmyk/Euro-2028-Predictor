import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  props: { onRetry?: () => void; refreshing?: boolean } = {},
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

    // The mapper can only state `champion` when the bracket names one, and can
    // never produce `eliminated` at all — no season read supplies it.
    if (world.standing.kind === 'stated') {
      expect(world.standing.outcome).not.toBe('eliminated')
      if (world.standing.outcome === 'champion') {
        expect(world.bracket.kind).toBe('bracket')
        if (world.bracket.kind === 'bracket') {
          expect(world.bracket.champion?.isYou).toBe(true)
        }
      }
    }

    // A panel that is not a bracket carries no standing the bracket implied.
    if (world.bracket.kind !== 'bracket') {
      expect(world.standing.kind).toBe('not-stated')
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

describe('elimination is never printed', () => {
  it('says nothing when the reader lost their only tie', () => {
    renderChampionship(championshipScenarios.lostButNotStated)
    const page = document.body.textContent ?? ''
    expect(page).not.toMatch(/eliminated|knocked out|you are out/i)
    // And no standing banner at all, rather than an empty one.
    expect(document.querySelector('[data-vnext-zone="standing"]')).toBeNull()
  })

  it('names the winner without telling the reader they are out', () => {
    renderChampionship(championshipScenarios.someoneElseWon)
    expect(zone('champion').textContent).toContain('Bo Nilsson')
    expect(document.body.textContent ?? '').not.toMatch(/eliminated/i)
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

  it('never prints the literal name contract 193 returns for a hole', () => {
    renderChampionship(championshipScenarios.halfFilledSeat)
    // Contract 193 coalesces an unfilled seat to the display name 'Player'.
    // Our own fixture names are "Ada Lovelace" etc, so a bare "Player" on the
    // page could only have come from trusting that coalesce.
    expect(zone('bracket').textContent).not.toMatch(/\bPlayer\b/)
  })

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
