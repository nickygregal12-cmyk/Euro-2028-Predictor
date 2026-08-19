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
    try {
      const feed = await source.load()
      if (current !== generation.current) return
      setActions(feed.actions)
      setStatus('ready')

      const unseen = feed.actions
        .filter((action) => !action.seen)
        .map((action) => action.actionKey)
      if (unseen.length === 0) return
      await source.markSeen(unseen)
      if (current !== generation.current) return
      setActions((existing) =>
        existing.map((action) =>
          unseen.includes(action.actionKey) ? { ...action, seen: true } : action,
        ),
      )
    } catch {
      if (current === generation.current) setStatus('error')
    }
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
      await source.dismiss(actionKey)
      setActions((existing) => existing.filter((action) => action.actionKey !== actionKey))
    },
    [source],
  )

  return { status, actions, reload: load, dismiss }
}
