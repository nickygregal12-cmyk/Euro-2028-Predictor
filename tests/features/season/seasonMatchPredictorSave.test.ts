import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createSeasonMatchPredictorGateway } from '../../../src/dev/seasonMatchPredictorGateway'
import { instantFor } from '../../../src/dev/seasonPreviewFixture'
import { useSeasonMatchPredictor } from '../../../src/features/season/useSeasonMatchPredictor'
import type { MatchPredictorGateway } from '../../../src/features/season/matchPredictorModel'
import { at } from '../../support/indexed'

/**
 * The season save path: optimistic edits, failure, version-conflict recovery,
 * and Contract 214's current-card confirmation integrity.
 */

const BEFORE_LOCK = () => instantFor(1, -180)

function confirmedGateway(options?: {
  prediction?: { home: number; away: number } | null
  jokerPlayed?: boolean
  onApply?: () => void
}): MatchPredictorGateway {
  const base = createSeasonMatchPredictorGateway({ scenario: 'healthy', now: BEFORE_LOCK() })
  return {
    async load(matchweek) {
      const page = await base.load(matchweek)
      return {
        ...page,
        cardStatus: 'confirmed',
        confirmedAt: '2026-08-20T12:34:00Z',
        confirmationReference: 'MW1-1A2B3C4D',
        fixtures: page.fixtures.map((fixture, index) =>
          index === 0
            ? { ...fixture, prediction: options?.prediction ?? fixture.prediction }
            : fixture,
        ),
        joker: {
          ...page.joker,
          playedHere: options?.jokerPlayed ?? page.joker.playedHere,
        },
      }
    },
    async apply(matchweek, command) {
      options?.onApply?.()
      await base.apply(matchweek, command)
    },
  }
}

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

describe('Contract 214 current-card confirmation', () => {
  it('invalidates confirmation immediately when a prediction visibly changes', async () => {
    const gateway = confirmedGateway({ prediction: { home: 1, away: 0 } })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const fixtureId = at(result.current.page!.fixtures, 0).fixtureId

    expect(result.current.page!.cardStatus).toBe('confirmed')
    expect(result.current.page!.confirmationReference).toBe('MW1-1A2B3C4D')

    act(() => {
      result.current.setPrediction(fixtureId, { home: 2, away: 0 })
    })

    expect(result.current.page!.fixtures[0]?.prediction).toEqual({ home: 2, away: 0 })
    expect(result.current.page!.cardStatus).toBe('provisional')
    expect(result.current.page!.confirmedAt).toBeNull()
    expect(result.current.page!.confirmationReference).toBeNull()
  })

  it('invalidates confirmation immediately when the Joker changes', async () => {
    const gateway = confirmedGateway({ jokerPlayed: false })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.setJoker(true)
    })

    expect(result.current.page!.joker.playedHere).toBe(true)
    expect(result.current.page!.cardStatus).toBe('provisional')
    expect(result.current.page!.confirmationReference).toBeNull()
  })

  it('does not send or invalidate a prediction no-op', async () => {
    let writes = 0
    const gateway = confirmedGateway({ prediction: { home: 1, away: 0 }, onApply: () => writes++ })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const fixtureId = at(result.current.page!.fixtures, 0).fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 1, away: 0 })
    })

    expect(writes).toBe(0)
    expect(result.current.page!.cardStatus).toBe('confirmed')
    expect(result.current.page!.confirmationReference).toBe('MW1-1A2B3C4D')
  })

  it('does not send or invalidate a Joker no-op', async () => {
    let writes = 0
    const gateway = confirmedGateway({ jokerPlayed: true, onApply: () => writes++ })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.setJoker(true)
    })

    expect(writes).toBe(0)
    expect(result.current.page!.cardStatus).toBe('confirmed')
    expect(result.current.page!.confirmationReference).toBe('MW1-1A2B3C4D')
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

  // Contract 214. The confirm write is the only moment the server's instant and
  // reference are known. Until the settled write carried them back, the card
  // read "confirmed" with no evidence line for the rest of the session.
  it('shows the confirmation evidence the settled confirm write answered', async () => {
    const base = createSeasonMatchPredictorGateway({ scenario: 'healthy', now: BEFORE_LOCK() })
    const gateway: MatchPredictorGateway = {
      load: (matchweek) => base.load(matchweek),
      async apply(matchweek, command) {
        await base.apply(matchweek, command)
        if (command.kind !== 'confirmCard') return
        return { confirmedAt: '2026-08-20T12:34:00Z', confirmationReference: 'MW1-5E6F7A8B' }
      },
    }
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.setPrediction(at(result.current.page!.fixtures, 0).fixtureId, { home: 2, away: 0 })
    })
    act(() => {
      result.current.confirmCard()
    })

    expect(result.current.page!.cardStatus).toBe('confirmed')
    await waitFor(() => {
      expect(result.current.page!.confirmedAt).toBe('2026-08-20T12:34:00Z')
      expect(result.current.page!.confirmationReference).toBe('MW1-5E6F7A8B')
    })
  })

  // The inverse: a gateway that answers nothing must leave the receipt with no
  // evidence rather than the browser inventing an instant to fill the gap.
  it('leaves confirmation evidence absent when the gateway answers none', async () => {
    const gateway = createSeasonMatchPredictorGateway({ scenario: 'healthy', now: BEFORE_LOCK() })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => {
      result.current.setPrediction(at(result.current.page!.fixtures, 0).fixtureId, { home: 2, away: 0 })
    })
    act(() => {
      result.current.confirmCard()
    })

    await waitFor(() => expect(result.current.page!.cardStatus).toBe('confirmed'))
    expect(result.current.page!.confirmedAt).toBeNull()
    expect(result.current.page!.confirmationReference).toBeNull()
  })
})
