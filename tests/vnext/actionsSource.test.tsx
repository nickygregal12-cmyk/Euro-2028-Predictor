import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useVNextActionsSource } from '../../src/vnext/integration/actions/useVNextActionsSource'
import type { ActionsGateway } from '../../src/vnext/integration/actions/useVNextActionsSource'
import type {
  PersistentPlayerAction,
  PlayerActionsFeed,
} from '../../src/services/supabase/playerActions'

/**
 * ACQUISITION, AND THE ONE PROMISE `MIG-UI-14` ACTUALLY ASKS FOR.
 *
 * The register's acceptance evidence for the action centre is *"a test that an
 * item marked read on one device does not reappear on another"*. That is a
 * claim about a SERVER write, so what is provable here is the half this code
 * owns: that the write is issued from what the server said rather than from
 * anything the browser remembers, that it is issued on READING rather than on
 * loading, and that a write which did not happen is never treated as though it
 * had. The other half is the migration's, and `player_action_state` holds it.
 *
 * Every case drives a fake gateway. No Supabase, no network.
 */

function action(over: Partial<PersistentPlayerAction> = {}): PersistentPlayerAction {
  return {
    actionKey: 'a',
    actionType: 'lms_pick_due',
    priority: 1,
    tournamentId: 'tournament-1',
    competitionId: 'comp-1',
    deadlineAt: null,
    expiresAt: null,
    context: {},
    seen: false,
    seenAt: null,
    dismissed: false,
    generatedAt: '2026-08-23T09:00:00.000Z',
    ...over,
  }
}

function gatewayOf(
  feed: PlayerActionsFeed,
  over: Partial<ActionsGateway> = {},
): ActionsGateway {
  return {
    load: vi.fn(async () => feed),
    markSeen: vi.fn(async () => {}),
    dismiss: vi.fn(async () => {}),
    ...over,
  }
}

describe('the action feed hook', () => {
  it('reads nothing at all while the player is not signed in', async () => {
    const gateway = gatewayOf({ unseen: 0, actions: [] })
    const { result } = renderHook(() => useVNextActionsSource(false, gateway))

    expect(gateway.load).not.toHaveBeenCalled()
    expect(result.current.feed).toBeNull()
    expect(result.current.status).toBe('idle')
  })

  it('loads once the player is signed in', async () => {
    const feed = { unseen: 1, actions: [action()] }
    const { result } = renderHook(() => useVNextActionsSource(true, gatewayOf(feed)))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.feed).toEqual(feed)
  })

  it('does not mark anything seen merely by loading', async () => {
    // A BADGE IS NOT A READING. Marking on load would record that the player
    // had seen a number, which is exactly the thing the persisted state is
    // supposed to mean something more than.
    const gateway = gatewayOf({ unseen: 1, actions: [action()] })
    const { result } = renderHook(() => useVNextActionsSource(true, gateway))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(gateway.markSeen).not.toHaveBeenCalled()
  })

  it('marks exactly the unseen keys when the panel is opened', async () => {
    const gateway = gatewayOf({
      unseen: 2,
      actions: [
        action({ actionKey: 'a', seen: false }),
        action({ actionKey: 'b', seen: true }),
        action({ actionKey: 'c', seen: false }),
      ],
    })
    const { result } = renderHook(() => useVNextActionsSource(true, gateway))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.markSeen())

    // FROM WHAT THE SERVER SAID, not from a local set of "things rendered this
    // session" — which is what makes the state cross-device.
    await waitFor(() => expect(gateway.markSeen).toHaveBeenCalledWith(['a', 'c']))
  })

  it('brings the unseen count down with the items it marked', async () => {
    const gateway = gatewayOf({
      unseen: 2,
      actions: [action({ actionKey: 'a' }), action({ actionKey: 'c' })],
    })
    const { result } = renderHook(() => useVNextActionsSource(true, gateway))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.markSeen())

    // A badge that stayed at 2 above a panel showing two read items would be
    // the chrome contradicting the thing the player is looking at.
    await waitFor(() => expect(result.current.feed?.unseen).toBe(0))
    expect(result.current.feed?.actions.every((entry) => entry.seen)).toBe(true)
  })

  it('writes nothing when everything is already seen', async () => {
    const gateway = gatewayOf({ unseen: 0, actions: [action({ seen: true })] })
    const { result } = renderHook(() => useVNextActionsSource(true, gateway))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.markSeen())
    expect(gateway.markSeen).not.toHaveBeenCalled()
  })

  it('leaves items unread when the seen write fails', async () => {
    // THE BINDING CASE. Optimism about a write that did not happen is how a
    // player loses an item they never saw: the badge clears, the row loses its
    // mark, and the server still believes it is unread — so the next read
    // brings it back and the one after that does too.
    const gateway = gatewayOf(
      { unseen: 1, actions: [action({ actionKey: 'a', seen: false })] },
      { markSeen: vi.fn(async () => Promise.reject(new Error('offline'))) },
    )
    const { result } = renderHook(() => useVNextActionsSource(true, gateway))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.markSeen())

    await waitFor(() => expect(gateway.markSeen).toHaveBeenCalled())
    expect(result.current.feed?.actions[0]?.seen).toBe(false)
    expect(result.current.feed?.unseen).toBe(1)
  })

  it('removes a dismissed item only after the server accepts it', async () => {
    let release: (() => void) | null = null
    const gateway = gatewayOf(
      { unseen: 1, actions: [action({ actionKey: 'a' }), action({ actionKey: 'b' })] },
      {
        dismiss: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              release = resolve
            }),
        ),
      },
    )
    const { result } = renderHook(() => useVNextActionsSource(true, gateway))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    let settled = false
    act(() => {
      void result.current.dismiss('a').then(() => {
        settled = true
      })
    })

    // STILL THERE while the write is out. A row that left on the click and came
    // back on the next read would be the surface disagreeing with the authority
    // about what the player has dealt with.
    expect(result.current.feed?.actions).toHaveLength(2)
    expect(settled).toBe(false)

    await act(async () => {
      release?.()
    })

    await waitFor(() => expect(result.current.feed?.actions).toHaveLength(1))
    expect(result.current.feed?.actions[0]?.actionKey).toBe('b')
  })

  it('keeps a dismissal failure visible to the caller and keeps the row', async () => {
    const gateway = gatewayOf(
      { unseen: 1, actions: [action({ actionKey: 'a' })] },
      { dismiss: vi.fn(async () => Promise.reject(new Error('refused'))) },
    )
    const { result } = renderHook(() => useVNextActionsSource(true, gateway))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await expect(result.current.dismiss('a')).rejects.toThrow('refused')
    expect(result.current.feed?.actions).toHaveLength(1)
  })

  it('drops the unseen count when the dismissed item was itself unread', async () => {
    const gateway = gatewayOf({
      unseen: 1,
      actions: [action({ actionKey: 'a', seen: false })],
    })
    const { result } = renderHook(() => useVNextActionsSource(true, gateway))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      await result.current.dismiss('a')
    })

    expect(result.current.feed?.unseen).toBe(0)
  })

  it('asks for the fifty-row window rather than the service default of twenty', async () => {
    // The panel's badge reports the server's TABLE-WIDE unseen count, so a
    // twenty-row read let a player see a count for work the list could not
    // show them. Asserted on the real default gateway rather than a fake,
    // because the defect was entirely in which argument that gateway sends.
    const fetchMyActions = vi.fn(async () => ({ unseen: 0, actions: [] }))
    vi.doMock('../../src/services/supabase/playerActions', () => ({
      fetchMyActions,
      markMyActionsSeen: vi.fn(async () => {}),
      dismissMyAction: vi.fn(async () => {}),
    }))

    const { useVNextActionsSource: hook } = await import(
      '../../src/vnext/integration/actions/useVNextActionsSource'
    )
    const { result } = renderHook(() => hook(true))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fetchMyActions).toHaveBeenCalledWith(50)
    vi.doUnmock('../../src/services/supabase/playerActions')
  })

  it('counts an unread row once when it is dismissed while marking is in flight', async () => {
    // THE DOUBLE-DECREMENT. `markSeen` captured three keys; a dismissal of one
    // of them landed first and took its own one off `unseen`; then the write
    // returned and subtracted all three. The badge undercounted the server
    // total — invisibly, because `Math.max(0, …)` clamps it whenever the
    // server's count is no larger than the loaded page.
    let releaseSeen: (() => void) | null = null
    const gateway = gatewayOf(
      {
        // Nine unread on the server, three on this page: the shape that makes
        // the clamp stop hiding the arithmetic.
        unseen: 9,
        actions: [
          action({ actionKey: 'a', seen: false }),
          action({ actionKey: 'b', seen: false }),
          action({ actionKey: 'c', seen: false }),
        ],
      },
      {
        markSeen: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              releaseSeen = resolve
            }),
        ),
      },
    )
    const { result } = renderHook(() => useVNextActionsSource(true, gateway))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.markSeen())
    await waitFor(() => expect(gateway.markSeen).toHaveBeenCalled())

    // One of the three leaves while the seen write is still out.
    await act(async () => {
      await result.current.dismiss('a')
    })
    expect(result.current.feed?.unseen).toBe(8)

    await act(async () => {
      releaseSeen?.()
    })

    // Two rows remained to be marked, so two more come off — not three.
    await waitFor(() => expect(result.current.feed?.unseen).toBe(6))
  })

  it('reports a failed read without claiming the inbox is empty', async () => {
    const gateway = gatewayOf(
      { unseen: 0, actions: [] },
      { load: vi.fn(async () => Promise.reject(new Error('down'))) },
    )
    const { result } = renderHook(() => useVNextActionsSource(true, gateway))

    await waitFor(() => expect(result.current.status).toBe('failed'))
    // `null` AND NOT `{ unseen: 0, actions: [] }`. The surface must be able to
    // tell "we could not ask" from "there is nothing".
    expect(result.current.feed).toBeNull()
  })

  it('keeps the last good feed when a later read fails', async () => {
    const feed = { unseen: 1, actions: [action()] }
    let attempt = 0
    const gateway = gatewayOf(feed, {
      load: vi.fn(async () => {
        attempt += 1
        if (attempt === 1) return feed
        throw new Error('down')
      }),
    })
    const { result } = renderHook(() => useVNextActionsSource(true, gateway))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.reload())

    await waitFor(() => expect(result.current.status).toBe('failed'))
    // A stale list beats a blank one, and the surface says it is stale from
    // `status` rather than from the absence of rows.
    expect(result.current.feed).toEqual(feed)
  })

  it('clears the feed when the player signs out', async () => {
    const gateway = gatewayOf({ unseen: 1, actions: [action()] })
    const { result, rerender } = renderHook(
      ({ signedIn }: { signedIn: boolean }) => useVNextActionsSource(signedIn, gateway),
      { initialProps: { signedIn: true } },
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ signedIn: false })

    // ONE PLAYER'S ACTIONS MUST NOT SURVIVE INTO ANOTHER'S SESSION.
    expect(result.current.feed).toBeNull()
    expect(result.current.status).toBe('idle')
  })
})
