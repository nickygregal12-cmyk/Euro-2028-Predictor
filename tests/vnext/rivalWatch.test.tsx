import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { VNextLeagues } from '../../src/vnext/leagues/VNextLeagues'
import type { LeaguesIntent } from '../../src/vnext/leagues/VNextLeagues'
import { leaguesScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { LeaguesModel } from '../../src/vnext/models/leagues'

/**
 * RIVAL WATCH — the half of it the cutover dropped.
 *
 * The Competition Deck derives rivals from where you stand: the row above, the
 * row below, the leader. That is a good default and it is not the feature the
 * Hub had. Contract 157 lets a player CHOOSE somebody, and choosing is what a
 * derived list can never do.
 *
 * The rules worth holding are all about the boundary. `set_pinned_rival`
 * refuses anybody the caller shares no private league with, and offering a
 * control where the write will be refused is worse than offering none — so
 * eligibility is read out of what the server already told us rather than
 * decided here.
 */

function renderLeagues(model: LeaguesModel, onIntent?: (intent: LeaguesIntent) => void) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextLeagues model={model} {...(onIntent ? { onIntent } : {})} />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

describe('choosing who to watch', () => {
  it('offers the control on a row the server named', () => {
    renderLeagues(leaguesScenarios.leagueSettled, vi.fn())

    expect(screen.getByRole('button', { name: 'Watch Martin Okafor' })).toBeInTheDocument()
  })

  it('says who each control is for, because eight of them read alike', () => {
    renderLeagues(leaguesScenarios.leagueSettled, vi.fn())
    const controls = screen.getAllByRole('button', { name: /^(Watch|Stop watching) / })

    const names = controls.map((control) => control.getAttribute('aria-label'))
    expect(new Set(names).size).toBe(names.length)
  })

  it('carries the state in a word as well as in aria-pressed', () => {
    renderLeagues(leaguesScenarios.leagueSettled, vi.fn())
    const watching = screen.getByRole('button', { name: 'Stop watching Jamie Ferguson-Whyte' })

    // Unreadable in greyscale is the failure this forbids.
    expect(watching).toHaveAttribute('aria-pressed', 'true')
    expect(watching.textContent).toBe('Watching')
  })

  it('emits the account id the write is keyed on', () => {
    const onIntent = vi.fn()
    renderLeagues(leaguesScenarios.leagueSettled, onIntent)

    screen.getByRole('button', { name: 'Watch Martin Okafor' }).click()

    // The season ref opens a profile; `set_pinned_rival` is keyed on the
    // account. Two questions, two identities.
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'watch-player',
      playerId: 'player-martin',
      watched: true,
    })
  })

  it('asks to stop when the row is already watched', () => {
    const onIntent = vi.fn()
    renderLeagues(leaguesScenarios.leagueSettled, onIntent)

    screen.getByRole('button', { name: 'Stop watching Jamie Ferguson-Whyte' }).click()

    expect(onIntent).toHaveBeenCalledWith({
      kind: 'watch-player',
      playerId: 'player-jamie',
      watched: false,
    })
  })
})

describe('where the control is not offered', () => {
  it('never offers it on your own row', () => {
    renderLeagues(leaguesScenarios.leagueSettled, vi.fn())

    expect(screen.queryByRole('button', { name: /Nicky Gregal/ })).toBeNull()
  })

  it('offers nothing at all where no row is openable', () => {
    // `nothingOpenable` is a table the server named with no account ids — the
    // boundary `set_pinned_rival` enforces. A control here would be refused.
    renderLeagues(leaguesScenarios.nothingOpenable, vi.fn())

    expect(screen.queryByRole('button', { name: /^Watch / })).toBeNull()
  })

  it('draws nothing when there is no host to write with', () => {
    // A story, a screenshot, a signed-out preview. A toggle that cannot write
    // is a promise the surface cannot keep.
    renderLeagues(leaguesScenarios.leagueSettled)

    expect(screen.queryByRole('button', { name: /^Watch / })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Stop watching / })).toBeNull()
  })

  it('keeps the table four columns wide, at every width', () => {
    /*
     * A FIFTH COLUMN IS WHERE THIS STARTED, and a screenshot at 390px is why
     * it did not stay there: the standings table already scrolls sideways on a
     * phone, so a watch column sat past the right edge and the only way to use
     * the feature was invisible at the width most people are at. The control
     * lives in the player cell instead.
     */
    renderLeagues(leaguesScenarios.leagueSettled, vi.fn())

    for (const table of screen.getAllByRole('table')) {
      const headers = within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent)
      expect(headers).toEqual(['Rank', 'Player', 'Moved', 'Points'])
    }

    // And it is inside the player's own cell rather than loose in the row.
    const control = screen.getByRole('button', { name: 'Watch Martin Okafor' })
    const cell = control.closest('td')
    expect(within(cell as HTMLElement).getByText('Martin Okafor')).toBeInTheDocument()
  })
})
