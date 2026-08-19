import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from './vnextAxe'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { VNextGames } from '../../src/vnext/games/VNextGames'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { gamesScenarioNames, gamesScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { GamesPageModel } from '../../src/vnext/models/games'

function renderGames(
  model: GamesPageModel,
  props: {
    onRetry?: () => void
    refreshing?: boolean
    onIntent?: (intent: { kind: string; gameId: string }) => void
    joiningGameId?: string | null
  } = {},
) {
  return render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <VNextGames model={model} {...props} />
    </VNextShellProvider>,
  )
}

const zone = (name: string) =>
  document.querySelector(`[data-vnext-zone="${name}"]`) as HTMLElement | null

const rowOf = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-vnext-game="${id}"]`) as HTMLElement

describe('every world is a page', () => {
  it.each(gamesScenarioNames)('%s has one main and one h1', (name) => {
    renderGames(gamesScenarios[name])
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  /** EVERY WORLD MUST BE A STATE `buildGamesModel` CAN PRODUCE. */
  it.each(gamesScenarioNames)('%s pairs its panels lawfully', (name) => {
    const world = gamesScenarios[name]
    if (world.games.kind !== 'games') return

    expect(world.games.entries.length).toBeGreaterThan(0)
    for (const game of world.games.entries) {
      expect(game.id).toBeTruthy()
      // A DISQUALIFIED STANDING CARRIES NO REJOIN OUTLOOK, because the server
      // refuses above the flag and the mapper has nothing conditional to say.
      if (game.standing.kind === 'disqualified') {
        expect(Object.keys(game.standing)).toEqual(['kind'])
      }
      // A PLAYING STANDING CARRIES NOTHING ELSE either.
      if (game.standing.kind === 'playing') {
        expect(Object.keys(game.standing)).toEqual(['kind'])
      }
    }
  })
})

describe('the games are peers', () => {
  it('draws every row the same, with no feature treatment', () => {
    const { container } = renderGames(gamesScenarios.allOpen)
    const rows = [...container.querySelectorAll('[data-vnext-game]')]
    expect(rows).toHaveLength(3)
    // No row carries a modifier the others do not. `data-standing` is the same
    // for all three here, which is the point: nothing distinguishes them.
    const standings = rows.map((row) => row.getAttribute('data-standing'))
    expect(new Set(standings).size).toBe(1)
  })

  it('keeps the catalogue’s order rather than promoting a game', () => {
    const { container } = renderGames(gamesScenarios.allOpen)
    const ids = [...container.querySelectorAll('[data-vnext-game]')].map((row) =>
      row.getAttribute('data-vnext-game'),
    )
    expect(ids).toEqual(['g-main', 'g-lms', 'g-cup'])
  })

  it('groups only by whether the player is in a game', () => {
    renderGames(gamesScenarios.playingOne)
    // BY ROW ID, not by text: a game's name appears in its title AND in each
    // button's screen-reader label, so matching on text alone is ambiguous by
    // design rather than by accident.
    const ids = (name: string) =>
      [...(zone(name)?.querySelectorAll('[data-vnext-game]') ?? [])].map((row) =>
        row.getAttribute('data-vnext-game'),
      )
    expect(ids('playing')).toEqual(['g-lms'])
    expect(ids('rest')).toEqual(['g-main', 'g-cup'])
  })

  it('shows no empty group when the player is in everything', () => {
    renderGames(gamesScenarios.playingAll)
    expect(zone('rest')).toBeNull()
    expect(zone('playing')).not.toBeNull()
  })
})

describe('the page offers one way in, and never a rejoin', () => {
  it('offers Join only where registration is open and the player never joined', () => {
    const { container } = renderGames(gamesScenarios.everyRegistrationState)
    const joins = screen.getAllByRole('button', { name: /^join/i })
    expect(joins).toHaveLength(1)
    expect(within(rowOf(container, 'g-main')).getByRole('button', { name: /^join/i })).toBeInTheDocument()
  })

  it('offers NO rejoin control to a player who left, even where it is allowed', () => {
    const { container } = renderGames(gamesScenarios.leftAndAllowed)
    const row = rowOf(container, 'g-lms')
    expect(within(row).queryByRole('button', { name: /join/i })).toBeNull()
  })

  it('states the rule rather than a verdict where rejoining depends on running-ness', () => {
    const { container } = renderGames(gamesScenarios.leftAndUncertain)
    const row = rowOf(container, 'g-lms')
    expect(row.textContent).toMatch(/only takes you back if it has not started/i)
    expect(within(row).queryByRole('button', { name: /join/i })).toBeNull()
  })

  it('says disqualified absolutely, with no condition attached', () => {
    const { container } = renderGames(gamesScenarios.disqualified)
    const row = rowOf(container, 'g-lms')
    expect(row.textContent).toMatch(/cannot rejoin/i)
    expect(row.textContent).not.toMatch(/if it has not started/i)
    expect(within(row).queryByRole('button', { name: /join/i })).toBeNull()
  })

  it('emits the game id it was asked about', () => {
    const onIntent = vi.fn()
    const { container } = renderGames(gamesScenarios.allOpen, { onIntent })
    fireEvent.click(within(rowOf(container, 'g-cup')).getByRole('button', { name: /look inside/i }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'open-game', gameId: 'g-cup' })
    fireEvent.click(within(rowOf(container, 'g-cup')).getByRole('button', { name: /^join/i }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'join-game', gameId: 'g-cup' })
  })

  it('disables only the row being joined, not the others', () => {
    const { container } = renderGames(gamesScenarios.allOpen, { joiningGameId: 'g-lms' })
    const joining = within(rowOf(container, 'g-lms')).getByRole('button', { name: /joining/i })
    expect(joining).toBeDisabled()
    expect(within(rowOf(container, 'g-main')).getByRole('button', { name: /^join/i })).toBeEnabled()
  })
})

describe('the four registration sentences are distinct', () => {
  it('keeps "not open" and "closed" apart, because they ask opposite things', () => {
    const { container } = renderGames(gamesScenarios.everyRegistrationState)
    expect(rowOf(container, 'g-lms').textContent).toMatch(/has not opened/i)
    expect(rowOf(container, 'g-cup').textContent).toMatch(/has closed/i)
    expect(rowOf(container, 'g-old').textContent).toMatch(/finished/i)
  })
})

describe('the page names nothing the catalogue did not', () => {
  it('renders an unnamed game without inventing a title from its key', () => {
    const { container } = renderGames(gamesScenarios.unnamedGame)
    const row = rowOf(container, 'g-lms')
    expect(row.textContent).toContain('A game this competition runs')
    expect(container.textContent).not.toMatch(/last_man_standing/)
  })

  it('never prints a raw game key on any world', () => {
    for (const name of gamesScenarioNames) {
      const { container, unmount } = renderGames(gamesScenarios[name])
      expect(container.textContent, name).not.toMatch(/main_predictor|last_man_standing|predictor_cup/)
      unmount()
    }
  })
})

describe('the states that are not a catalogue', () => {
  it('distinguishes a competition running nothing from a failed read', () => {
    renderGames(gamesScenarios.noGames)
    expect(zone('no-games')).not.toBeNull()
    expect(zone('unavailable')).toBeNull()
  })

  it('offers a retry on a failed read only where one was given', () => {
    const onRetry = vi.fn()
    renderGames(gamesScenarios.unavailable, { onRetry })
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    screen.getByRole('button', { name: /try again/i })
  })

  it('says a switched-off game is not running rather than hiding it', () => {
    const { container } = renderGames(gamesScenarios.inactiveGame)
    expect(rowOf(container, 'g-lms')).not.toBeNull()
    expect(zone('inactive')?.textContent).toMatch(/not running/i)
  })
})

/**
 * THE RULES, BESIDE THE GAMES THEY GOVERN.
 *
 * The route matrix ABSORBS `/more/scoring` — "rules belong beside the game they
 * govern", "reached from a game, not from a directory" — so the hub carries
 * them, and it opens on the game the player is most likely asking about.
 */
describe('the scoring rules are on the page, not in a directory', () => {
  it('renders them beside the catalogue', () => {
    renderGames(gamesScenarios.allOpen)
    expect(zone('rules')).not.toBeNull()
  })

  it('opens on the game the player is actually in', () => {
    renderGames(gamesScenarios.playingOne)
    // `playingOne` has the player in Last Man Standing.
    expect(zone('rules')?.getAttribute('data-game')).toBe('last-man-standing')
  })

  it('opens on the catalogue’s first game where the player is in none', () => {
    renderGames(gamesScenarios.allOpen)
    // Never a hard-coded favourite: that would be this page deciding which game
    // matters, on a page built to stop exactly that.
    expect(zone('rules')?.getAttribute('data-game')).toBe('match-predictor')
  })

  it('lets a player read another game’s rules without leaving', () => {
    renderGames(gamesScenarios.playingOne)
    fireEvent.click(screen.getByRole('radio', { name: 'Championship' }))
    expect(zone('rules')?.getAttribute('data-game')).toBe('championship')
  })

  it('shows no rules where there is no catalogue to explain', () => {
    renderGames(gamesScenarios.noGames)
    expect(zone('rules')).toBeNull()
  })
})


describe('every world passes the accessibility scan', () => {
  it.each(gamesScenarioNames)('%s has no critical or serious violation', async (name) => {
    await expectNoAxeViolations(
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextGames model={gamesScenarios[name]} onRetry={() => {}} />
      </VNextShellProvider>,
    )
  })
})
