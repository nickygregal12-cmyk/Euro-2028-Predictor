import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from './vnextAxe'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { VNextDiscovery } from '../../src/vnext/discovery/VNextDiscovery'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { discoveryScenarioNames, discoveryScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { DiscoveryPageModel } from '../../src/vnext/models/discovery'

function renderDiscovery(
  model: DiscoveryPageModel,
  props: {
    onRetry?: () => void
    refreshing?: boolean
    onIntent?: (intent: { kind: string }) => void
    busyTournamentId?: string | null
  } = {},
) {
  return render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <VNextDiscovery model={model} {...props} />
    </VNextShellProvider>,
  )
}

const zone = (name: string) =>
  document.querySelector(`[data-vnext-zone="${name}"]`) as HTMLElement | null

const rowOf = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-vnext-season="${id}"]`) as HTMLElement

describe('every world is a page', () => {
  it.each(discoveryScenarioNames)('%s has one main and one h1', (name) => {
    renderDiscovery(discoveryScenarios[name])
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it.each(discoveryScenarioNames)('%s lights no destination, because discovery is not one', (name) => {
    const { container } = renderDiscovery(discoveryScenarios[name])
    expect([...container.querySelectorAll('[aria-current]')]).toEqual([])
  })
})

describe('no row ever carries both controls, and none is a toggle', () => {
  it('offers Follow only where the player does not follow', () => {
    const { container } = renderDiscovery(discoveryScenarios.someFollowed)
    // t-1 is followed; t-2 and t-3 are not.
    expect(within(rowOf(container, 't-1')).queryByRole('button', { name: /^follow/i })).toBeNull()
    expect(within(rowOf(container, 't-1')).getByRole('button', { name: /unfollow/i })).toBeInTheDocument()
    expect(within(rowOf(container, 't-2')).getByRole('button', { name: /^follow/i })).toBeInTheDocument()
    expect(within(rowOf(container, 't-2')).queryByRole('button', { name: /unfollow/i })).toBeNull()
  })

  it('never shows both on one row, on any world', () => {
    for (const name of discoveryScenarioNames) {
      const { container, unmount } = renderDiscovery(discoveryScenarios[name])
      for (const row of container.querySelectorAll('[data-vnext-season]')) {
        const follow = within(row as HTMLElement).queryAllByRole('button', { name: /^follow/i })
        const unfollow = within(row as HTMLElement).queryAllByRole('button', { name: /unfollow/i })
        expect(follow.length && unfollow.length, `${name} row`).toBeFalsy()
      }
      unmount()
    }
  })

  it('emits the tournament id it was asked about', () => {
    const onIntent = vi.fn()
    const { container } = renderDiscovery(discoveryScenarios.someFollowed, { onIntent })
    fireEvent.click(within(rowOf(container, 't-2')).getByRole('button', { name: /^follow/i }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'follow', tournamentId: 't-2' })
    fireEvent.click(within(rowOf(container, 't-1')).getByRole('button', { name: /unfollow/i }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'unfollow', tournamentId: 't-1' })
  })

  it('disables only the row being written to', () => {
    const { container } = renderDiscovery(discoveryScenarios.catalogue, { busyTournamentId: 't-2' })
    expect(within(rowOf(container, 't-2')).getByRole('button', { name: /following…/i })).toBeDisabled()
    expect(within(rowOf(container, 't-1')).getByRole('button', { name: /^follow/i })).toBeEnabled()
  })
})

describe('an unknown follow state offers nothing and says so', () => {
  it('draws no follow control on any row', () => {
    const { container } = renderDiscovery(discoveryScenarios.followUnknown)
    const rows = container.querySelectorAll('[data-vnext-season]')
    expect(rows.length).toBe(3)
    for (const row of rows) {
      expect(within(row as HTMLElement).queryByRole('button', { name: /follow/i })).toBeNull()
    }
  })

  it('still shows the catalogue, because published seasons are not private', () => {
    const { container } = renderDiscovery(discoveryScenarios.followUnknown)
    expect(container.querySelectorAll('[data-vnext-season]')).toHaveLength(3)
    expect(container.textContent).toContain('Highland League')
  })

  it('explains the absence rather than leaving it to be inferred', () => {
    renderDiscovery(discoveryScenarios.followUnknown)
    expect(zone('follow-unknown')?.textContent).toMatch(/could not check which of these you already follow/i)
  })

  it('says nothing of the sort when the state is known', () => {
    renderDiscovery(discoveryScenarios.catalogue)
    expect(zone('follow-unknown')).toBeNull()
  })
})

describe('the page opens a season by the address the catalogue stored', () => {
  it('emits both halves', () => {
    const onIntent = vi.fn()
    const { container } = renderDiscovery(discoveryScenarios.catalogue, { onIntent })
    fireEvent.click(within(rowOf(container, 't-3')).getByRole('button', { name: /look inside/i }))
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'open-season',
      competitionSlug: 'border',
      seasonKey: '2027-28',
    })
  })
})

describe('the catalogue is printed as read', () => {
  it('prints a status where the catalogue gave one', () => {
    const { container } = renderDiscovery(discoveryScenarios.catalogue)
    expect(rowOf(container, 't-3').textContent).toContain('scheduled')
  })

  it('prints nothing where it did not', () => {
    const { container } = renderDiscovery(discoveryScenarios.noStatus)
    const row = rowOf(container, 't-1')
    expect(within(row).queryByText(/active|scheduled|draft/i)).toBeNull()
  })

  it('keeps the read’s order', () => {
    const { container } = renderDiscovery(discoveryScenarios.catalogue)
    const ids = [...container.querySelectorAll('[data-vnext-season]')].map((r) =>
      r.getAttribute('data-vnext-season'),
    )
    expect(ids).toEqual(['t-1', 't-2', 't-3'])
  })
})

describe('nothing published is not the same as nothing read', () => {
  it('says the platform publishes nothing', () => {
    renderDiscovery(discoveryScenarios.nothingPublished)
    expect(zone('no-competitions')?.textContent).toMatch(/no published competitions/i)
    expect(zone('unavailable')).toBeNull()
  })

  it('says the read did not answer, and offers a retry', () => {
    const onRetry = vi.fn()
    renderDiscovery(discoveryScenarios.unavailable, { onRetry })
    expect(zone('unavailable')?.textContent).toMatch(/could not load the competition list/i)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('the page never suggests that following gets you into a game', () => {
  it.each(discoveryScenarioNames)('%s says nothing about joining or playing', (name) => {
    const { container } = renderDiscovery(discoveryScenarios[name])
    // Contract 157's migration refuses to install if following creates a game
    // entry. The copy must not imply the thing the server forbids.
    expect(container.textContent).not.toMatch(/join a game|start playing|enter the/i)
  })
})


describe('every world passes the accessibility scan', () => {
  it.each(discoveryScenarioNames)('%s has no critical or serious violation', async (name) => {
    await expectNoAxeViolations(
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextDiscovery model={discoveryScenarios[name]} />
      </VNextShellProvider>,
    )
  })
})
