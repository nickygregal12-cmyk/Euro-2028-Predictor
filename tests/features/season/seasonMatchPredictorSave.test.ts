import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createSeasonMatchPredictorGateway } from '../../../src/dev/seasonMatchPredictorGateway'
import { instantFor } from '../../../src/dev/seasonPreviewFixture'
import { useSeasonMatchPredictor } from '../../../src/features/season/useSeasonMatchPredictor'
import { at } from '../../support/indexed'

/**
 * The season save path: optimistic edits, failure, and version-conflict
 * recovery.
 *
 * These are the §13.4 gates that cannot be proven by rendering a happy path —
 * "optimistic save state", "conflict and unknown-outcome recovery". The gateway
 * scenarios exist so each one is reached deliberately rather than waited for.
 *
 * WHY NOT MSW. The tooling plan lists Mock Service Worker for the first
 * functional journey, and it is the right tool for a network boundary. This
 * journey does not have one yet: no season RPC exists, so the seam is the
 * gateway interface, and mocking HTTP would mean mocking a request the
 * application never makes. MSW arrives with the bounded RPC it would intercept.
 */

const BEFORE_LOCK = () => instantFor(1, -180)

describe('optimistic save', () => {
  it('applies an edit locally before the save settles, and marks the card engaged', async () => {
    const gateway = createSeasonMatchPredictorGateway({ scenario: 'slow', now: BEFORE_LOCK() })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))

    await waitFor(() => expect(result.current.status).toBe('ready'), { timeout: 5000 })
    const fixtureId = at(result.current.page!.fixtures, 0).fixtureId
    expect(result.current.presentation!.state).toBe('not_created')

    act(() => {
      result.current.setPrediction(fixtureId, { home: 2, away: 1 })
    })

    // Immediately, without waiting for the slow gateway: the value is on screen
    // and the card has stopped being unbanked. Both are the point of optimism.
    expect(result.current.page!.fixtures[0]?.prediction).toEqual({ home: 2, away: 1 })
    expect(result.current.presentation!.atLock).toBe('banks_entered')
    expect(result.current.presentation!.state).toBe('active_in_progress')
  })

  it('keeps the edit visible when the save fails', async () => {
    const gateway = createSeasonMatchPredictorGateway({ scenario: 'save_failure', now: BEFORE_LOCK() })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const fixtureId = at(result.current.page!.fixtures, 0).fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 3, away: 0 })
    })

    // Silently reverting a player's typing is worse than showing a retrying
    // save: they cannot tell a revert from having mistyped.
    await waitFor(() => expect(result.current.saveStatus[fixtureId]).toBeDefined())
    expect(result.current.page!.fixtures[0]?.prediction).toEqual({ home: 3, away: 0 })
  })
})

describe('version-conflict recovery', () => {
  it('moves the card to conflict_requires_refresh and stops accepting edits', async () => {
    const gateway = createSeasonMatchPredictorGateway({
      scenario: 'version_conflict',
      now: BEFORE_LOCK(),
    })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const fixtureId = at(result.current.page!.fixtures, 0).fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 1, away: 1 })
    })

    await waitFor(() => expect(result.current.saveStatus[fixtureId]).toBe('conflict'), {
      timeout: 5000,
    })
    expect(result.current.presentation!.state).toBe('conflict_requires_refresh')
    expect(result.current.presentation!.editable).toBe(false)

    // And a further edit is refused with an explanation rather than silently
    // dropped, because the page knows it is showing stale data.
    act(() => {
      result.current.setPrediction(fixtureId, { home: 4, away: 4 })
    })
    expect(result.current.refusal).toMatch(/changed somewhere else/)
  })

  it('recovers on an explicit reload', async () => {
    const gateway = createSeasonMatchPredictorGateway({
      scenario: 'version_conflict',
      now: BEFORE_LOCK(),
    })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const fixtureId = at(result.current.page!.fixtures, 0).fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 1, away: 1 })
    })
    await waitFor(() => expect(result.current.presentation!.state).toBe('conflict_requires_refresh'), {
      timeout: 5000,
    })

    act(() => {
      result.current.reload()
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.presentation!.state).not.toBe('conflict_requires_refresh')
    expect(result.current.saveStatus[fixtureId]).toBeUndefined()
  })
})

describe('load failure and lock states', () => {
  it('reports an unavailable matchweek with the gateway’s own reason', async () => {
    const gateway = createSeasonMatchPredictorGateway({ scenario: 'load_failure', now: BEFORE_LOCK() })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))

    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(result.current.loadError).toMatch(/could not be reached/)
  })

  it('refuses edits after the lock instant', async () => {
    const gateway = createSeasonMatchPredictorGateway({ scenario: 'healthy', now: instantFor(1, 120) })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.presentation!.state).toBe('locked')
    act(() => {
      result.current.setPrediction(at(result.current.page!.fixtures, 0).fixtureId, { home: 9, away: 9 })
    })
    expect(result.current.refusal).toBe('This matchweek is locked.')
    expect(result.current.page!.fixtures[0]?.prediction).toBeNull()
  })

  it('presents an empty published matchweek without inventing fixtures', async () => {
    const gateway = createSeasonMatchPredictorGateway({ scenario: 'no_fixtures', now: BEFORE_LOCK() })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.page!.fixtures).toHaveLength(0)
    // No fixture data means the lock cannot be derived, so the domain fails
    // closed and the surface says unavailable rather than "open with no games".
    expect(result.current.presentation!.state).toBe('unavailable')
  })
})
