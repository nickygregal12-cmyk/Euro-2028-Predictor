import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  usePersistentActions,
  type PersistentActionsGateway,
} from '../../src/app/usePersistentActions'
import type { PersistentPlayerAction } from '../../src/services/supabase/playerActions'

function action(overrides: Partial<PersistentPlayerAction> = {}): PersistentPlayerAction {
  return {
    actionKey: 'action-1',
    actionType: 'matchweek_predictions_due',
    priority: 2,
    tournamentId: 'season-1',
    competitionId: null,
    deadlineAt: null,
    expiresAt: null,
    context: {},
    seen: false,
    seenAt: null,
    dismissed: false,
    generatedAt: '2026-08-18T12:00:00Z',
    ...overrides,
  }
}

describe('usePersistentActions', () => {
  it('marks only server-returned unseen actions seen when the panel opens', async () => {
    const markSeen = vi.fn(async () => undefined)
    const source: PersistentActionsGateway = {
      load: async () => ({ unseen: 1, actions: [action()] }),
      markSeen,
      dismiss: async () => undefined,
    }

    const { result } = renderHook(() => usePersistentActions(true, source))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await waitFor(() => expect(markSeen).toHaveBeenCalledWith(['action-1']))
    await waitFor(() => expect(result.current.actions[0]?.seen).toBe(true))
  })

  it('keeps a successful feed visible when marking seen fails', async () => {
    const source: PersistentActionsGateway = {
      load: async () => ({ unseen: 1, actions: [action()] }),
      markSeen: async () => {
        throw new Error('write failed')
      },
      dismiss: async () => undefined,
    }

    const { result } = renderHook(() => usePersistentActions(true, source))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await waitFor(() => expect(result.current.actions).toHaveLength(1))
    expect(result.current.actions[0]?.seen).toBe(false)
  })

  it('does nothing while the panel is closed', async () => {
    const load = vi.fn(async () => ({ unseen: 0, actions: [] }))
    const source: PersistentActionsGateway = {
      load,
      markSeen: async () => undefined,
      dismiss: async () => undefined,
    }

    const { result } = renderHook(() => usePersistentActions(false, source))
    expect(result.current.status).toBe('idle')
    expect(load).not.toHaveBeenCalled()
  })

  it('persists dismissal through the gateway before removing the row locally', async () => {
    const dismiss = vi.fn(async () => undefined)
    const source: PersistentActionsGateway = {
      load: async () => ({ unseen: 0, actions: [action({ seen: true })] }),
      markSeen: async () => undefined,
      dismiss,
    }

    const { result } = renderHook(() => usePersistentActions(true, source))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => result.current.dismiss('action-1'))
    expect(dismiss).toHaveBeenCalledWith('action-1')
    expect(result.current.actions).toEqual([])
  })

  it('keeps the server-owned row visible when dismissal fails', async () => {
    const source: PersistentActionsGateway = {
      load: async () => ({ unseen: 0, actions: [action({ seen: true })] }),
      markSeen: async () => undefined,
      dismiss: async () => {
        throw new Error('write failed')
      },
    }

    const { result } = renderHook(() => usePersistentActions(true, source))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => result.current.dismiss('action-1'))
    expect(result.current.actions).toHaveLength(1)
  })

  it('reports a failed persistent read without inventing an empty successful feed', async () => {
    const source: PersistentActionsGateway = {
      load: async () => {
        throw new Error('offline')
      },
      markSeen: async () => undefined,
      dismiss: async () => undefined,
    }

    const { result } = renderHook(() => usePersistentActions(true, source))
    await waitFor(() => expect(result.current.status).toBe('error'))
  })
})
