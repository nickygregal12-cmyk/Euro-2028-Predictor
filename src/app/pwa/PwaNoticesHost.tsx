import { lazy, Suspense, useEffect, useState } from 'react'

/**
 * Mounts the install and update notices, late and off the critical path.
 *
 * TWO SEPARATE DELAYS, FOR TWO SEPARATE REASONS.
 *
 * The lazy import keeps the notices, their stylesheet, the service-worker
 * registration and the install policy out of the entry chunk — the bundle every
 * visitor downloads before the first pixel. None of it is needed to render a
 * page and all of it can arrive afterwards.
 *
 * The idle wait keeps the registration itself off the first load. A service
 * worker installing precaches the whole application shell, and starting that
 * download while the page is still fetching the things it needs to render makes
 * the first visit measurably slower for a benefit that only arrives on the
 * second. `requestIdleCallback` puts it after the work that matters, with a
 * timeout so it still happens on a busy page.
 *
 * It renders nothing until then, and usually nothing after: on most visits
 * there is no update waiting and no invitation to make.
 */

const PwaNotices = lazy(() =>
  import('./PwaNotices').then((module) => ({ default: module.PwaNotices })),
)

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

export function PwaNoticesHost() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const idleWindow = window as IdleWindow
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(() => setReady(true), {
        timeout: 4000,
      })
      return () => idleWindow.cancelIdleCallback?.(handle)
    }
    // Safari has no idle callback; a plain timeout is the same intent with less
    // precision, and four seconds is well past first paint on any device.
    const timer = window.setTimeout(() => setReady(true), 4000)
    return () => window.clearTimeout(timer)
  }, [])

  if (!ready) return null
  return (
    <Suspense fallback={null}>
      <PwaNotices />
    </Suspense>
  )
}
