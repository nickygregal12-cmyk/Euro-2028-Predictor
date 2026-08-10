import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// The page has real production defaults for both calls, and every assertion
// below injects them. Mock the module so importing the component does not
// initialise a Supabase client in this credential-free unit test.
vi.mock('../../../src/services/supabase/euroPublication', () => ({
  fetchEuroPublicationState: vi.fn(),
  transitionEuroPublicationState: vi.fn(),
}))

import { EuroPublicationPage } from '../../../src/features/admin/EuroPublicationPage'
import type { EuroPublicationSnapshot } from '../../../src/services/supabase/euroPublicationModel'

const CHANGED_AT = '2026-08-09T17:56:56.564Z'

function snapshot(
  state: EuroPublicationSnapshot['state'],
  changedAt = CHANGED_AT,
): EuroPublicationSnapshot {
  return { state, changedAt }
}

function renderPage(options: {
  readState: () => Promise<EuroPublicationSnapshot>
  transition?: (input: {
    expectedState: EuroPublicationSnapshot['state']
    nextState: EuroPublicationSnapshot['state']
    reason: string
  }) => Promise<EuroPublicationSnapshot>
}) {
  return render(
    <EuroPublicationPage
      readState={options.readState}
      transition={options.transition ?? (() => Promise.reject(new Error('not expected')))}
    />,
  )
}

describe('/admin/euro', () => {
  it('reports the server state and the instant it last changed', async () => {
    renderPage({ readState: () => Promise.resolve(snapshot('hidden')) })

    expect(await screen.findByText('hidden')).toBeInTheDocument()
    expect(screen.getByText('2026-08-09 17:56:56 UTC')).toBeInTheDocument()
    expect(
      screen.getByText(/absent from the weekly platform/i),
    ).toBeInTheDocument()
  })

  it('offers only the one adjacent step the lifecycle permits', async () => {
    renderPage({ readState: () => Promise.resolve(snapshot('prelaunch')) })

    expect(
      await screen.findByRole('button', { name: /advance to registration-open/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /advance to live/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /advance to hidden/i }),
    ).not.toBeInTheDocument()
  })

  it('offers no control at the end of the lifecycle', async () => {
    renderPage({ readState: () => Promise.resolve(snapshot('archived')) })

    expect(await screen.findByText(/end of the lifecycle/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /advance to/i }),
    ).not.toBeInTheDocument()
  })

  it('sends the state it read as the expected state, with the reason as typed', async () => {
    const transition = vi.fn().mockResolvedValue(snapshot('prelaunch'))
    const readState = vi
      .fn()
      .mockResolvedValueOnce(snapshot('hidden'))
      .mockResolvedValue(snapshot('prelaunch', '2026-08-10T04:00:00.000Z'))

    renderPage({ readState, transition })

    fireEvent.change(await screen.findByLabelText('Reason'), { target: { value: 'Owner approved prelaunch' } })
    fireEvent.click(screen.getByRole('button', { name: /advance to prelaunch/i }))

    await waitFor(() => expect(transition).toHaveBeenCalledTimes(1))
    expect(transition).toHaveBeenCalledWith({
      expectedState: 'hidden',
      nextState: 'prelaunch',
      reason: 'Owner approved prelaunch',
    })

    // Re-read rather than trusting the row the write returned: the operator
    // needs the state the route guard will read, not the one the write claimed.
    await waitFor(() => expect(readState).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByText('Euro 2028 moved from hidden to prelaunch.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('2026-08-10 04:00:00 UTC')).toBeInTheDocument()
  })

  it('sends an empty reason rather than refusing it here, and reports the server refusal', async () => {
    const transition = vi.fn().mockRejectedValue({ code: '22023' })

    renderPage({
      readState: () => Promise.resolve(snapshot('hidden')),
      transition,
    })

    fireEvent.click(await screen.findByRole('button', { name: /advance to prelaunch/i }))

    await waitFor(() => expect(transition).toHaveBeenCalledTimes(1))
    expect(transition.mock.calls[0]?.[0]).toMatchObject({ reason: '' })
    expect(await screen.findByText(/requires a reason/i)).toBeInTheDocument()
  })

  it('reports a refused capability without claiming the transition happened', async () => {

    renderPage({
      readState: () => Promise.resolve(snapshot('hidden')),
      transition: vi.fn().mockRejectedValue({ code: '42501' }),
    })

    fireEvent.change(await screen.findByLabelText('Reason'), { target: { value: 'Trying it on' } })
    fireEvent.click(screen.getByRole('button', { name: /advance to prelaunch/i }))

    expect(await screen.findByText(/owner capability/i)).toBeInTheDocument()
    expect(screen.queryByText(/moved from/i)).not.toBeInTheDocument()
    // The state on the page is still what the server last said it was.
    expect(screen.getByText('hidden')).toBeInTheDocument()
  })

  it('reports a concurrent change instead of retrying against the new state', async () => {
    const transition = vi.fn().mockRejectedValue({ code: '40001' })

    renderPage({
      readState: () => Promise.resolve(snapshot('hidden')),
      transition,
    })

    fireEvent.change(await screen.findByLabelText('Reason'), { target: { value: 'Owner approved prelaunch' } })
    fireEvent.click(screen.getByRole('button', { name: /advance to prelaunch/i }))

    expect(await screen.findByText(/changed while this page was open/i)).toBeInTheDocument()
    expect(transition).toHaveBeenCalledTimes(1)
  })

  it('offers no publication control when the state cannot be read', async () => {
    renderPage({
      readState: () => Promise.reject(new Error('network down')),
    })

    expect(
      await screen.findByText(/No publication control is offered/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /advance to/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument()
  })

  it('offers no publication control when the state row is missing', async () => {
    renderPage({
      readState: () => Promise.reject({ code: '55000' }),
    })

    expect(
      await screen.findByText(/holds no Euro publication state row/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /advance to/i }),
    ).not.toBeInTheDocument()
  })

  it('never offers a way back, at any state', async () => {
    for (const state of ['prelaunch', 'registration-open', 'live', 'completed'] as const) {
      const { unmount } = renderPage({ readState: () => Promise.resolve(snapshot(state)) })
      expect(await screen.findByText(/cannot be moved back/i)).toBeInTheDocument()
      const controls = screen.getAllByRole('button')
      expect(controls).toHaveLength(1)
      unmount()
    }
  })
})
