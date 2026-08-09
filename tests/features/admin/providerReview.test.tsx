import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mapProviderReviewQueues } from '../../../src/services/supabase/providerReviewQueuesModel'
import { ProviderReviewPanel } from '../../../src/features/admin/ProviderReviewPanel'

function raw(overrides: Record<string, unknown> = {}) {
  return {
    competition: { id: 'season-1', name: 'Scottish Premiership', season_key: '2026-27' },
    limit: 20,
    result_refusals: { unreviewed: 0, items: [] },
    status_observations: { unreviewed: 0, items: [] },
    consumption_problems: { unreviewed: 0, items: [] },
    kickoff_revisions: { unreviewed: 0, items: [] },
    window_conflicts: { unreviewed: 0, items: [] },
    pending_calendar_proposals: 0,
    recent_result_changes: [],
    ...overrides,
  }
}

const REFUSAL = {
  id: 'r1',
  reason: 'protected_confirmation',
  provider: 'sportmonks',
  provider_status: 'FT',
  detail: {},
  refused_at: '2026-08-08T16:00:00Z',
  fixture: { id: 'f1', home: 'Rangers', away: 'Hibernian', kickoff_at: '2026-08-08T14:00:00Z' },
}

describe('decoding the review queues', () => {
  it('reports clear only when nothing anywhere needs a person', () => {
    expect(mapProviderReviewQueues(raw()).clear).toBe(true)
    expect(
      mapProviderReviewQueues(
        raw({ result_refusals: { unreviewed: 3, items: [REFUSAL] } }),
      ).clear,
    ).toBe(false)
  })

  it('counts a staged calendar as work, because a decision is owed on it', () => {
    expect(mapProviderReviewQueues(raw({ pending_calendar_proposals: 380 })).clear).toBe(false)
  })

  it('does not let history make a season look like it needs attention', () => {
    // Contract 125's revisions are an audit trail. Counting them would train an
    // operator to ignore the indicator.
    const queues = mapProviderReviewQueues(
      raw({
        recent_result_changes: [
          {
            id: 'rev1',
            action: 'correct',
            revision: 2,
            previous: { home: 1, away: 1 },
            result: { home: 2, away: 1 },
            reason: 'scoreline corrected',
            by: 'administrator',
            recorded_at: '2026-08-08T18:00:00Z',
            fixture: { id: 'f1', home: 'Rangers', away: 'Hibernian' },
          },
        ],
      }),
    )
    expect(queues.clear).toBe(true)
    expect(queues.recentResultChanges).toHaveLength(1)
  })

  it('summarises each queue in its own terms rather than generically', () => {
    const queues = mapProviderReviewQueues(
      raw({
        result_refusals: { unreviewed: 1, items: [REFUSAL] },
        window_conflicts: {
          unreviewed: 1,
          items: [
            {
              id: 'w1',
              round: 'Matchweek 5',
              blocked_by: 'Matchweek 6',
              detected_at: '2026-08-08T10:00:00Z',
            },
          ],
        },
      }),
    )

    const refusal = queues.queues.find((queue) => queue.kind === 'result_refusal')
    expect(refusal?.items[0]?.summary).toContain('Rangers v Hibernian')
    expect(refusal?.items[0]?.summary).toContain('protected_confirmation')

    const conflict = queues.queues.find((queue) => queue.kind === 'window_conflict')
    expect(conflict?.items[0]?.summary).toContain('blocked by Matchweek 6')
  })

  it('keeps the server record whole for a detail view', () => {
    const queues = mapProviderReviewQueues(
      raw({ result_refusals: { unreviewed: 1, items: [REFUSAL] } }),
    )
    const item = queues.queues.find((queue) => queue.kind === 'result_refusal')?.items[0]
    expect(item?.detail.provider_status).toBe('FT')
  })

  it('drops an item with no id, because it could not be acknowledged', () => {
    const queues = mapProviderReviewQueues(
      raw({ result_refusals: { unreviewed: 1, items: [{ reason: 'x' }] } }),
    )
    expect(queues.queues.find((queue) => queue.kind === 'result_refusal')?.items).toHaveLength(0)
  })

  it('refuses a payload it cannot identify', () => {
    expect(() => mapProviderReviewQueues({ limit: 20 })).toThrow()
  })
})

describe('the review panel', () => {
  function renderPanel(payload: Record<string, unknown>, acknowledge = vi.fn()) {
    const load = vi.fn(async () => mapProviderReviewQueues(payload))
    render(<ProviderReviewPanel load={load} acknowledge={acknowledge} />)
    return { load, acknowledge }
  }

  it('says acknowledging corrects nothing, rather than implying it fixes', async () => {
    renderPanel(raw())
    await waitFor(() => expect(screen.getByText(/it corrects nothing/)).toBeTruthy())
  })

  it('offers no acknowledge control for an empty queue', async () => {
    renderPanel(raw())
    await waitFor(() => expect(screen.getByText(/Nothing is waiting for review/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Mark these reviewed' })).toBeNull()
  })

  it('acknowledges the items it is showing and re-reads afterwards', async () => {
    const acknowledge = vi.fn(async () => ({ marked: 1 }))
    const { load } = renderPanel(
      raw({ result_refusals: { unreviewed: 1, items: [REFUSAL] } }),
      acknowledge,
    )

    const button = await screen.findByRole('button', { name: 'Mark these reviewed' })
    fireEvent.click(button)

    await waitFor(() => expect(acknowledge).toHaveBeenCalledWith('result_refusal', ['r1']))
    // Re-read rather than removing the row locally: the server's count is the
    // one that matters and another administrator may have moved it.
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  })

  it('reports marking fewer than asked as ordinary, not as a failure', async () => {
    const acknowledge = vi.fn(async () => ({ marked: 0 }))
    renderPanel(raw({ result_refusals: { unreviewed: 1, items: [REFUSAL] } }), acknowledge)

    fireEvent.click(await screen.findByRole('button', { name: 'Mark these reviewed' }))
    await waitFor(() => expect(screen.getByText(/already been reviewed/)).toBeTruthy())
  })

  it('says when it is showing a page of a longer queue', async () => {
    // Clearing what is on screen must not read as clearing the queue.
    renderPanel(raw({ result_refusals: { unreviewed: 57, items: [REFUSAL] } }))
    await waitFor(() => expect(screen.getByText(/Showing 1 of 57/)).toBeTruthy())
  })

  it('reports a staged calendar as a count and offers no decision on it', async () => {
    renderPanel(raw({ pending_calendar_proposals: 380 }))
    await waitFor(() => expect(screen.getByText(/380 staged calendar fixtures/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Reject/ })).toBeNull()
  })

  it('shows a failed read as failed, never as an empty set of queues', async () => {
    render(
      <ProviderReviewPanel
        load={() => Promise.reject(new Error('offline'))}
        acknowledge={vi.fn()}
      />,
    )
    await waitFor(() => expect(screen.getByText('These queues could not be read')).toBeTruthy())
  })
})
