import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../../src/services/supabase/client', () => ({
  supabase: { rpc: mocks.rpc },
}))

import { createSeasonCupRpcGateway } from '../../src/services/supabase/seasonCup'

const COMPETITION_ID = '60000000-0000-0000-0000-000000000201'
const GROUP_ID = '60000000-0000-0000-0000-000000000301'
const PARENT_GROUP_ID = '60000000-0000-0000-0000-000000000302'
const YOU = '60000000-0000-0000-0000-000000000501'
const RIVAL = '60000000-0000-0000-0000-000000000502'

function gateway() {
  return createSeasonCupRpcGateway({ competitionId: COMPETITION_ID })
}

function phasePayload(overrides: Record<string, unknown> = {}) {
  return {
    competition_id: COMPETITION_ID,
    entered: true,
    phase_kind: 'initial',
    group: {
      id: GROUP_ID,
      ordinal: 1,
      size: 8,
      phase_kind: 'initial',
      parent_group_id: null,
    },
    table: [
      {
        user_id: RIVAL,
        is_you: false,
        group_rank: 1,
        table_points: 9,
        points_for: 41,
        points_against: 30,
        window_points: 41,
        exacts: 3,
        corrects: 8,
        scoreline_error: 12,
      },
      {
        user_id: YOU,
        is_you: true,
        group_rank: 2,
        table_points: 7,
        points_for: 38,
        points_against: 33,
        window_points: 38,
        exacts: 2,
        corrects: 7,
        scoreline_error: 15,
      },
    ],
    ...overrides,
  }
}

describe('createSeasonCupRpcGateway — load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps a league-phase table onto the read model', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: phasePayload(), error: null })

    const page = await gateway().load()

    expect(mocks.rpc).toHaveBeenCalledWith('get_season_cup_phase', {
      p_competition_id: COMPETITION_ID,
    })
    expect(page.entered).toBe(true)
    expect(page.phaseKind).toBe('initial')
    expect(page.group).toEqual({
      id: GROUP_ID,
      ordinal: 1,
      size: 8,
      phaseKind: 'initial',
      parentGroupId: null,
    })
    expect(page.table).toHaveLength(2)
    expect(page.table[0]).toEqual({
      userId: RIVAL,
      isYou: false,
      groupRank: 1,
      tablePoints: 9,
      pointsFor: 41,
      pointsAgainst: 30,
      windowPoints: 41,
      exacts: 3,
      corrects: 8,
      scorelineError: 12,
    })
    expect(page.table[1]).toMatchObject({ userId: YOU, isYou: true, groupRank: 2 })
  })

  it('maps a split-phase group, keeping its parent ancestry', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: phasePayload({
        phase_kind: 'split',
        group: {
          id: GROUP_ID,
          ordinal: 1,
          size: 4,
          phase_kind: 'split',
          parent_group_id: PARENT_GROUP_ID,
        },
      }),
      error: null,
    })

    const page = await gateway().load()

    expect(page.phaseKind).toBe('split')
    expect(page.group?.phaseKind).toBe('split')
    expect(page.group?.parentGroupId).toBe(PARENT_GROUP_ID)
  })

  it('maps a non-entrant to entered=false with nothing else, as the contract answers', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { competition_id: COMPETITION_ID, entered: false },
      error: null,
    })

    const page = await gateway().load()

    expect(page.entered).toBe(false)
    expect(page.phaseKind).toBeNull()
    expect(page.group).toBeNull()
    expect(page.table).toEqual([])
  })

  it('keeps an empty table an empty table, not a failure', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: phasePayload({ table: [] }), error: null })

    const page = await gateway().load()

    expect(page.entered).toBe(true)
    expect(page.table).toEqual([])
  })

  it('surfaces the RPC error rather than swallowing it', async () => {
    const refusal = Object.assign(new Error('Authentication is required'), { code: '42501' })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: refusal })

    await expect(gateway().load()).rejects.toBe(refusal)
  })

  it('fails loudly on a malformed payload instead of rendering a guess', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { nonsense: true }, error: null })

    await expect(gateway().load()).rejects.toThrow(
      'The Predictor Championship response was not in the expected shape.',
    )
  })

  it('fails loudly when an entered payload is missing its group or table', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { competition_id: COMPETITION_ID, entered: true },
      error: null,
    })

    await expect(gateway().load()).rejects.toThrow(
      'The Predictor Championship response was not in the expected shape.',
    )
  })
})
