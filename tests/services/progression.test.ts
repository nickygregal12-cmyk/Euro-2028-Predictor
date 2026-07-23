import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('../../src/services/supabase/client', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}))

import {
  deleteProgression,
  fetchProgression,
  upsertProgression,
} from '../../src/services/supabase/progression'
import { VersionConflictError } from '../../src/services/supabase/writeConflict'

const ENTRY_ONE = '30000000-0000-0000-0000-000000000001'
const ENTRY_TWO = '30000000-0000-0000-0000-000000000002'
const TEAM_A = '30000000-0000-0000-0000-000000000101'
const TEAM_B = '30000000-0000-0000-0000-000000000102'
const TEAM_C = '30000000-0000-0000-0000-000000000103'

function mockFetch(data: unknown[]) {
  mocks.eq.mockResolvedValueOnce({ data, error: null })
  mocks.select.mockReturnValueOnce({ eq: mocks.eq })
  mocks.from.mockReturnValueOnce({ select: mocks.select })
}

describe('atomic progression persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('coalesces changed upserts and deletes into one complete replacement RPC', async () => {
    mockFetch([
      { team_id: TEAM_A, stage: 'qf', version: 2 },
      { team_id: TEAM_B, stage: 'sf', version: 4 },
    ])
    await fetchProgression(ENTRY_ONE)

    mocks.rpc.mockResolvedValueOnce({
      data: [
        { team_id: TEAM_A, stage: 'sf', version: 3 },
        { team_id: TEAM_C, stage: 'qf', version: 0 },
      ],
      error: null,
    })

    const updateA = upsertProgression(ENTRY_ONE, TEAM_A, 'sf', 2)
    const insertC = upsertProgression(ENTRY_ONE, TEAM_C, 'qf', 0)
    const deleteB = deleteProgression(ENTRY_ONE, TEAM_B)

    await expect(Promise.all([updateA, insertC, deleteB])).resolves.toEqual([3, 0, undefined])
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('replace_predicted_progression', {
      p_entry_id: ENTRY_ONE,
      p_desired: {
        [TEAM_A]: 'sf',
        [TEAM_C]: 'qf',
      },
      p_expected_versions: {
        [TEAM_A]: 2,
        [TEAM_B]: 4,
      },
    })
  })

  it('uses the authoritative returned snapshot as the next batch baseline', async () => {
    mockFetch([{ team_id: TEAM_A, stage: 'qf', version: 0 }])
    await fetchProgression(ENTRY_TWO)

    mocks.rpc
      .mockResolvedValueOnce({
        data: [{ team_id: TEAM_A, stage: 'sf', version: 1 }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ team_id: TEAM_A, stage: 'final', version: 2 }],
        error: null,
      })

    await expect(upsertProgression(ENTRY_TWO, TEAM_A, 'sf', 0)).resolves.toBe(1)
    await expect(upsertProgression(ENTRY_TWO, TEAM_A, 'final', 1)).resolves.toBe(2)

    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'replace_predicted_progression', {
      p_entry_id: ENTRY_TWO,
      p_desired: { [TEAM_A]: 'final' },
      p_expected_versions: { [TEAM_A]: 1 },
    })
  })

  it('maps a complete-snapshot PT409 rejection to the existing conflict type', async () => {
    const entry = '30000000-0000-0000-0000-000000000003'
    mockFetch([])
    await fetchProgression(entry)

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'PT409', message: 'complete bracket snapshot changed' },
    })

    await expect(upsertProgression(entry, TEAM_A, 'qf', 0)).rejects.toBeInstanceOf(
      VersionConflictError,
    )
  })
})
