import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LeagueSnapshot } from '../../../src/features/home/LeagueSnapshot'

const onOpen = vi.fn()
const onCreate = vi.fn()

describe('LeagueSnapshot availability states', () => {
  it('does not turn an unavailable read into a create-league prompt', () => {
    render(
      <LeagueSnapshot
        league={null}
        available={false}
        onOpen={onOpen}
        onCreate={onCreate}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('League data unavailable')
    expect(screen.getByText(/Your leagues are still saved/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Play your mates/ })).not.toBeInTheDocument()
  })

  it('shows the create prompt only for a successful empty result', () => {
    render(
      <LeagueSnapshot
        league={null}
        available
        onOpen={onOpen}
        onCreate={onCreate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Play your mates/ }))
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('League data unavailable')).not.toBeInTheDocument()
  })

  it('opens a loaded league snapshot', () => {
    render(
      <LeagueSnapshot
        available
        league={{
          id: 'league-1',
          name: 'Office League',
          memberCount: 8,
          rank: 2,
          gapToTop: 3,
          lastActivityMs: 0,
        }}
        onOpen={onOpen}
        onCreate={onCreate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Office League/ }))
    expect(onOpen).toHaveBeenCalledWith('league-1')
    expect(screen.getByText('2nd of 8 · 3 pts behind top')).toBeVisible()
  })
})
