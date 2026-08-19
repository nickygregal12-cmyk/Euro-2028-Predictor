import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PersistentPlayerAction,
  PlayerActionsFeed,
} from '../services/supabase/playerActions'

export type PersistentActionsGateway = {
  load: () => Promise<PlayerActionsFeed>
  markSeen: (actionKeys: readonly string[]) => Promise<void>
  dismiss: (actionKey: string) => Promise<void>
}

/**
 * Keep the real Supabase client behind an async boundary. ActionCentre is lazy,
 * and this preserves that property all the way down: importing the hook for a
 * unit test or rendering the application shell does not initialise Supabase.
 */
const gateway: PersistentActionsGateway = {
  load: async () => {
    const service = await import('../services/supabase/playerActions')
    return service.fetchMyActions()
  },
  markSeen: async (actionKeys) => {
    const service = await import('../services/supabase/playerActions')
    return service.markMyActionsSeen(actionKeys)
  },
  dismiss: async (actionKey) => {
    const service = await import('../services/supabase/playerActions')
    return service.dismissMyAction(actionKey)
  },
}

export type PersistentActionsStatus = 'idle' | 'loading' | 'ready' | 'error'

export function usePersistentActions(
  open: boolean,
  source: PersistentActionsGateway = gateway,
) {
  const generation = useRef(0)
  const [status, setStatus] = useState<PersistentActionsStatus>('idle')
  const [actions, setActions] = useState<readonly PersistentPlayerAction[]>([])

  const load = useCallback(async () => {
    if (!open) return
    const current = ++generation.current
    setStatus('loading')

    let feed: PlayerActionsFeed
    try {
      feed = await source.load()
    } catch {
      if (current === generation.current) setStatus('error')
      return
    }

    if (current !== generation.current) return
    setActions(feed.actions)
    setStatus('ready')

    const unseen = feed.actions
      .filter((action) => !action.seen)
      .map((action) => action.actionKey)
    if (unseen.length === 0) return

    try {
      await source.markSeen(unseen)
    } catch {
      // The read succeeded, so keep showing it. A failed seen write is not
      // permission to pretend the server recorded anything: rows stay `New`
      // and opening the panel later can retry the canonical command.
      return
    }

    if (current !== generation.current) return
    setActions((existing) =>
      existing.map((action) =>
        unseen.includes(action.actionKey) ? { ...action, seen: true } : action,
      ),
    )
  }, [open, source])

  useEffect(() => {
    if (!open) {
      generation.current += 1
      setStatus('idle')
      setActions([])
      return
    }
    void load()
    return () => {
      generation.current += 1
    }
  }, [load, open])

  const dismiss = useCallback(
    async (actionKey: string) => {
      try {
        await source.dismiss(actionKey)
      } catch {
        // Keep the server-owned row visible if persistence failed. Removing it
        // locally would manufacture a cross-device state that does not exist.
        return
      }
      setActions((existing) => existing.filter((action) => action.actionKey !== actionKey))
    },
    [source],
  )

  return { status, actions, reload: load, dismiss }
}
