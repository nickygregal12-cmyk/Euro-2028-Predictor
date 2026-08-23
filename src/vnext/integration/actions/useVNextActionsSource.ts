import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlayerActionsFeed } from '../../../services/supabase/playerActions'

/**
 * ACQUISITION ONLY, FOR THE ACTION CENTRE.
 *
 * The same split every adapter in this directory has: this file gets the answer
 * and maps NOTHING. `buildActionsModel` is the mapper and it is pure, so a
 * story and a render test can hand it a world.
 *
 * ============================ IT LOADS ONCE, ABOVE THE PAGES =============
 *
 * One bounded read for the whole player, so it belongs to the host that
 * survives movement between destinations rather than to a page. Unlike the
 * cross-competition inbox it does not scale with competition count — it is one
 * round trip whether the player has two competitions or twenty.
 *
 * ============================ SEEN IS THE SERVER'S, AND IT IS DURABLE ====
 *
 * `mark_actions_seen` is called when the panel OPENS, not when the feed loads:
 * marking on load would record that a player had seen a badge, which is not the
 * same as having seen the items. That is what makes the state meaningful across
 * devices — the acceptance evidence `MIG-UI-14` asks for is that an item marked
 * read on one device does not come back unread on another.
 *
 * A FAILED SEEN WRITE LEAVES THE ITEMS UNREAD. The read succeeded so the list
 * stays on screen, but nothing here pretends the server recorded anything:
 * rows keep their `New` mark and the next open retries. Optimism about a write
 * that did not happen is how a player loses an item they never saw.
 *
 * ============================ AND DISMISSAL WAITS FOR THE SERVER =========
 *
 * `dismiss_action` is awaited before the row leaves. A row that vanished on the
 * click and came back on the next read would be the surface disagreeing with
 * the authority about what the player has dealt with.
 */

export type ActionsGateway = {
  load: () => Promise<PlayerActionsFeed>
  markSeen: (actionKeys: readonly string[]) => Promise<void>
  dismiss: (actionKey: string) => Promise<void>
}

/**
 * Keep Supabase behind an async boundary, so importing this hook — or rendering
 * the shell that mounts it — does not initialise a client.
 */
/**
 * The window this integration is written against, stated rather than inherited.
 *
 * `fetchMyActions` defaults to 20 and `get_my_actions` clamps to 50. Every
 * comment in this directory describes the read as the fifty-row one, so taking
 * the service default silently gave the panel twenty rows while its badge kept
 * reporting the server's table-wide `unseen` — a player with work at rank 21
 * could see the count and never the item.
 */
const FEED_LIMIT = 50

const gateway: ActionsGateway = {
  load: async () => {
    const service = await import('../../../services/supabase/playerActions')
    return service.fetchMyActions(FEED_LIMIT)
  },
  markSeen: async (actionKeys) => {
    const service = await import('../../../services/supabase/playerActions')
    return service.markMyActionsSeen(actionKeys)
  },
  dismiss: async (actionKey) => {
    const service = await import('../../../services/supabase/playerActions')
    return service.dismissMyAction(actionKey)
  },
}

export type VNextActionsState = {
  /**
   * The server's feed, or `null` while it is out or after it failed.
   *
   * The two are deliberately not distinguished here: a shell affordance draws
   * nothing in both cases, and the one place the difference matters — the panel
   * itself — reads `status`.
   */
  readonly feed: PlayerActionsFeed | null
  readonly status: 'idle' | 'loading' | 'ready' | 'failed'
  /** Record that the player has now seen everything currently unseen. */
  readonly markSeen: () => void
  /** Dismiss one item, after the server accepts it. */
  readonly dismiss: (actionKey: string) => Promise<void>
  /** Re-read the feed. */
  readonly reload: () => void
}

export function useVNextActionsSource(
  signedIn: boolean,
  source: ActionsGateway = gateway,
): VNextActionsState {
  const [feed, setFeed] = useState<PlayerActionsFeed | null>(null)
  const [status, setStatus] = useState<VNextActionsState['status']>('idle')
  const [nonce, setNonce] = useState(0)
  /**
   * WHICH LOAD THIS IS. A player signing out mid-flight, or a reload issued
   * while the first is still out, must not have the stale answer land on top of
   * the current one.
   */
  const generation = useRef(0)

  useEffect(() => {
    if (!signedIn) {
      setFeed(null)
      setStatus('idle')
      return
    }

    const current = ++generation.current
    let active = true
    setStatus('loading')

    void (async () => {
      try {
        const loaded = await source.load()
        if (!active || current !== generation.current) return
        setFeed(loaded)
        setStatus('ready')
      } catch {
        if (!active || current !== generation.current) return
        // THE FEED IS NOT EMPTIED ON FAILURE where one was already loaded: the
        // last thing the server actually said is better than a blank panel, and
        // `status` carries the failure separately for the surface to report.
        setStatus('failed')
      }
    })()

    return () => {
      active = false
    }
  }, [signedIn, source, nonce])

  const markSeen = useCallback(() => {
    if (feed === null) return
    const unseen = feed.actions.filter((action) => !action.seen).map((action) => action.actionKey)
    if (unseen.length === 0) return

    const current = generation.current
    void (async () => {
      try {
        await source.markSeen(unseen)
      } catch {
        // Deliberately silent and deliberately WITHOUT a local update. The
        // items stay unread because that is what the server still believes.
        return
      }
      if (current !== generation.current) return
      setFeed((existing) => {
        if (existing === null) return existing

        // THE DECREMENT IS COUNTED OFF THE CURRENT STATE, NOT OFF THE KEYS THIS
        // WRITE CAPTURED. A row dismissed while the write was in flight has
        // ALREADY taken its own one off `unseen`, so subtracting the captured
        // length here would take it off twice — and `Math.max(0, …)` hides that
        // only while the server's count is no larger than the loaded page.
        // Counting the rows still present and still unread cannot double-count,
        // because a dismissed row is no longer among them.
        const marking = existing.actions.filter(
          (action) => !action.seen && unseen.includes(action.actionKey),
        )

        return {
          unseen: Math.max(0, existing.unseen - marking.length),
          actions: existing.actions.map((action) =>
            marking.some((entry) => entry.actionKey === action.actionKey)
              ? { ...action, seen: true }
              : action,
          ),
        }
      })
    })()
  }, [feed, source])

  const dismiss = useCallback(
    async (actionKey: string) => {
      const current = generation.current
      // AWAITED, NOT OPTIMISTIC. See the header: a row that left on the click
      // and returned on the next read would be the surface disagreeing with the
      // authority. A rejection propagates so the caller can report it.
      await source.dismiss(actionKey)
      if (current !== generation.current) return

      setFeed((existing) => {
        if (existing === null) return existing
        const removed = existing.actions.find((action) => action.actionKey === actionKey)
        return {
          unseen:
            removed && !removed.seen ? Math.max(0, existing.unseen - 1) : existing.unseen,
          actions: existing.actions.filter((action) => action.actionKey !== actionKey),
        }
      })
    },
    [source],
  )

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  return { feed, status, markSeen, dismiss, reload }
}
