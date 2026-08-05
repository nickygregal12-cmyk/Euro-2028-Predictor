import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { LmsRoundPage, SeasonLmsGateway } from '../../../src/features/season/lmsRoundModel'
import { useSeasonLms } from '../../../src/features/season/useSeasonLms'

/**
 * The season Last Man Standing hook.
 *
 * The property worth defending hardest is that A PICK IS NOT OPTIMISTIC. This
 * surface differs from the Match Predictor card deliberately: a scoreline is a
 * guess and can be applied immediately, while a Last Man Standing pick consumes
 * a club for the rest of the cycle and can eliminate the player. Showing it as
 * taken before the server accepted it would show a commitment they may not have
 * made — so a refused pick must leave the page exactly as it was.
 *
 * The second is that a successful pick RELOADS rather than patching locally:
 * the write moves the used list and can move the entry outcome, and re-deriving
 * those in the browser would be a second copy of rules the server owns.
 */

const NOW = () => new Date('2026-08-05T12:00:00Z')

function page(over: Partial<LmsRoundPage> = {}): LmsRoundPage {
  return {
    available: true,
    entered: true,
    entryOutcome: 'active',
    round: {
      windowId: 'w2',
      sequence: 2,
      label: 'Round 2',
      opensAt: '2026-08-04T12:00:00Z',
      locksAt: '2026-08-07T12:00:00Z',
    },
    fixtures: [
      {
        fixtureId: 'f1',
        kickoffAt: '2026-08-07T14:00:00Z',
        status: 'scheduled',
        home: { teamId: 'gamma', name: 'Gamma', used: false },
        away: { teamId: 'delta', name: 'Delta', used: false },
        score: null,
      },
    ],
    pick: null,
    pickOutcome: null,
    ...over,
  }
}

function Harness({ gateway }: { gateway: SeasonLmsGateway }) {
  const { status, page: loaded, error, conflict, pick, reload } = useSeasonLms(gateway, NOW)
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="pick">{loaded?.pick?.teamId ?? 'none'}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="conflict">{String(conflict)}</span>
      <button onClick={() => pick('gamma')}>pick</button>
      <button onClick={reload}>reload</button>
    </div>
  )
}

describe('the season LMS hook', () => {
  it('does not show a pick the server refused', async () => {
    const load = vi.fn().mockResolvedValue(page())
    const pick = vi
      .fn()
      .mockRejectedValue(new Error('Each team can only be used once in Last Man Standing'))
    render(<Harness gateway={{ load, pick }} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ready'))
    await act(async () => void screen.getByText('pick').click())

    // The whole point: a refused pick leaves the page exactly as it was.
    expect(screen.getByTestId('pick').textContent).toBe('none')
    expect(screen.getByTestId('error').textContent).not.toBe('')
  })

  it('reloads after a successful pick rather than patching locally', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce(page({ pick: { teamId: 'gamma' } }))
    const pick = vi.fn().mockResolvedValue(undefined)
    render(<Harness gateway={{ load, pick }} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ready'))
    await act(async () => void screen.getByText('pick').click())

    await waitFor(() => expect(screen.getByTestId('pick').textContent).toBe('gamma'))
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('classifies a version conflict as terminal and asks for a reload', async () => {
    const load = vi.fn().mockResolvedValue(page())
    const pick = vi.fn().mockRejectedValue(Object.assign(new Error('conflict'), { code: 'PT409' }))
    render(<Harness gateway={{ load, pick }} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ready'))
    await act(async () => void screen.getByText('pick').click())

    expect(screen.getByTestId('conflict').textContent).toBe('true')
    expect(screen.getByTestId('error').textContent).toContain('Reload')
    expect(screen.getByTestId('pick').textContent).toBe('none')
  })

  it('reports a load failure rather than rendering an empty round', async () => {
    const load = vi.fn().mockRejectedValue(new Error('network'))
    render(<Harness gateway={{ load, pick: vi.fn() }} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('failed'))
    expect(screen.getByTestId('error').textContent).not.toBe('')
  })

  it('clears a previous error when the player picks again', async () => {
    const load = vi.fn().mockResolvedValue(page())
    const pick = vi
      .fn()
      .mockRejectedValueOnce(new Error('Each team can only be used once in Last Man Standing'))
      .mockResolvedValueOnce(undefined)
    render(<Harness gateway={{ load, pick }} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('ready'))
    await act(async () => void screen.getByText('pick').click())
    expect(screen.getByTestId('error').textContent).not.toBe('')

    await act(async () => void screen.getByText('pick').click())
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe(''))
  })
})
