// Back/forward navigation restoration for the app shell.
//
// The app scrolls inside PageShell's <main> element (overflow-y:auto), NOT the
// window — so the browser's native scroll restoration (which only knows about
// window scroll) does nothing, and every back-navigation landed at the top.
// React Router's <ScrollRestoration> needs the data router; we use the
// declarative <BrowserRouter>, so we restore manually against that element.
//
// Behaviour: on POP (back/forward) restore the saved scrollTop for that history
// entry; on a new PUSH/REPLACE start at the top. Because route chunks are lazy
// and pages fetch async, the saved position is re-applied as content grows (a
// short ResizeObserver window), and stops the moment the user actually
// interacts, so it never fights a deliberate scroll.

import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Per history-entry scroll positions, keyed by location.key. Module-level so it
// survives route remounts within a session (native back/forward semantics).
const scrollPositions = new Map<string, number>()

const REAPPLY_MS = 1000

export function useScrollRestoration(ref: RefObject<HTMLElement | null>) {
  const location = useLocation()
  const navType = useNavigationType() // 'POP' (back/forward) | 'PUSH' | 'REPLACE'

  // Continuously record the current entry's scroll position.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => scrollPositions.set(location.key, el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [location.key, ref])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    if (navType !== 'POP') {
      // New navigation → top. (The <main> element persists across routes, so its
      // scrollTop would otherwise carry over from the previous page.)
      el.scrollTop = 0
      return
    }

    // Back/forward → restore, re-applying as async content grows.
    const target = scrollPositions.get(location.key) ?? 0
    el.scrollTop = target
    let cancelled = false
    const reapply = () => {
      if (!cancelled) el.scrollTop = target
    }
    const ro = new ResizeObserver(reapply)
    ro.observe(el.firstElementChild ?? el)

    const stop = () => {
      cancelled = true
      ro.disconnect()
      el.removeEventListener('wheel', stop)
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('keydown', stop)
      clearTimeout(timer)
    }
    // Only genuine input stops the re-apply — programmatic 'scroll' events (e.g. a
    // page's own scrollIntoView) must not, or restoration would lose to them.
    el.addEventListener('wheel', stop, { passive: true })
    el.addEventListener('touchstart', stop, { passive: true })
    el.addEventListener('keydown', stop)
    const timer = window.setTimeout(stop, REAPPLY_MS)

    return stop
  }, [location.key, navType, ref])
}

// State that should be restored when you navigate BACK to a page but reset on a
// fresh visit — e.g. the bracket's active round, the Matches filter chips.
// Keyed by location.key (stable per history entry), so POP restores it and a new
// PUSH starts from `initial`. Mirrors the scroll-restoration semantics.
export function useLocationState<T>(name: string, initial: T): [T, (v: T) => void] {
  const location = useLocation()
  const storageKey = `nav-state:${name}:${location.key}`
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      return raw !== null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (v: T) => {
      setValue(v)
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(v))
      } catch {
        /* sessionStorage unavailable (private mode / quota) — state still works in-memory */
      }
    },
    [storageKey],
  )
  return [value, set]
}
