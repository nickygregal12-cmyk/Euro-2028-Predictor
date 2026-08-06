import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { CupPhasePage, SeasonCupGateway } from '../../../src/features/season/cupPhaseModel'
import { useSeasonCupPhase } from '../../../src/features/season/useSeasonCupPhase'

/**
 * The Championship phase hook: a failure is a failure, never an empty table,
 * and a reload recovers from one.
 */

function pageFixture(): CupPhasePage {
  return {
    competitionId: 'competition-1',
    entered: true,
    phaseKind: 'initial',
    group: {
      id: 'group-1',
      ordinal: 1,
      size: 6,
      phaseKind: 'initial',
      parentGroupId: null,
    },
    table: [],
  }
}

describe('useSeasonCupPhase', () => {
  it('loads the page and presents it', async () => {
    const gateway: SeasonCupGateway = {
      load: async () => pageFixture(),
    }

    const { result } = renderHook(() => useSeasonCupPhase(gateway))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.page?.entered).toBe(true)
    expect(result.current.presentation?.phaseLine).toBe('League phase')
    expect(result.current.error).toBeNull()
  })

  it('reports a load failure as failed, not as an empty page', async () => {
    const gateway: SeasonCupGateway = {
      load: async () => {
        throw new Error('The Predictor Championship response was not in the expected shape.')
      },
    }

    const { result } = renderHook(() => useSeasonCupPhase(gateway))

    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(result.current.page).toBeNull()
    expect(result.current.presentation).toBeNull()
    expect(result.current.error).toBeTruthy()
  })

  it('recovers through reload after a failure', async () => {
    let calls = 0
    const gateway: SeasonCupGateway = {
      load: async () => {
        calls += 1
        if (calls === 1) throw new Error('boom')
        return pageFixture()
      },
    }

    const { result } = renderHook(() => useSeasonCupPhase(gateway))

    await waitFor(() => expect(result.current.status).toBe('failed'))

    act(() => result.current.reload())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.error).toBeNull()
    expect(result.current.page?.group?.id).toBe('group-1')
  })
})
