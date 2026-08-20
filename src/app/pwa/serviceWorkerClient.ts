/**
 * Registering the worker, and the update flow that goes with it.
 *
 * THE HARD RULE THIS FILE KEEPS: a new version never takes over a page the
 * player did not ask it to. The worker is registered without `skipWaiting`, so
 * a fresh build installs and then WAITS; the application says a new version is
 * available; and only a press of Refresh sends the instruction that lets it
 * take control. Nothing here reloads a tab on a timer, on a route change, or
 * because another tab updated.
 *
 * That is the answer to "do not force-refresh while the player is editing
 * unsaved input": there is no forced refresh at all. It costs a little — a
 * player who never presses Refresh stays on their build until they close every
 * tab — and the periodic check below is what stops that becoming permanent,
 * because the notice reappears every time the application is brought back to
 * the foreground.
 */

import { SERVICE_WORKER_PATH } from './serviceWorkerPath'

export type ServiceWorkerHandle = {
  /** Ask the waiting worker to take over, then reload this tab. */
  readonly applyUpdate: () => void
  /** Stop listening. */
  readonly dispose: () => void
}

export type RegisterOptions = {
  /** Called when a new build has installed and is waiting to take control. */
  readonly onUpdateReady: () => void
}

/** How long the application waits before asking the server for a new build. */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000

function serviceWorkerSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    window.isSecureContext
  )
}

export function registerServiceWorker(
  options: RegisterOptions,
): ServiceWorkerHandle {
  const noop: ServiceWorkerHandle = { applyUpdate: () => {}, dispose: () => {} }
  if (!serviceWorkerSupported()) return noop

  const container = navigator.serviceWorker
  let registration: ServiceWorkerRegistration | null = null
  let lastCheck = 0
  let updateRequested = false
  let disposed = false

  const announceIfWaiting = () => {
    // A waiting worker with NO current controller is a first install, not an
    // update — telling a first-time visitor that a new version is available
    // would be both untrue and baffling.
    if (registration?.waiting && container.controller) options.onUpdateReady()
  }

  const onControllerChange = () => {
    // Only the tab that asked reloads. Another tab pressing Refresh must not
    // pull this one out from under whoever is using it.
    if (updateRequested) window.location.reload()
  }

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    const now = Date.now()
    if (now - lastCheck < UPDATE_CHECK_INTERVAL_MS) return
    lastCheck = now
    void registration?.update().catch(() => {
      // An update check that cannot reach the network is an ordinary offline
      // moment, not a fault worth reporting.
    })
  }

  container.addEventListener('controllerchange', onControllerChange)
  document.addEventListener('visibilitychange', onVisible)

  void container
    // `updateViaCache: 'none'` so the worker script itself is never served from
    // the HTTP cache. A cached worker is a deployment that silently does not
    // reach anybody.
    .register(SERVICE_WORKER_PATH, { updateViaCache: 'none' })
    .then((current) => {
      if (disposed) return
      registration = current
      lastCheck = Date.now()
      announceIfWaiting()

      current.addEventListener('updatefound', () => {
        const installing = current.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') announceIfWaiting()
        })
      })
    })
    .catch(() => {
      // Registration failing is not a product failure: the application works
      // exactly as it did before, online. It is deliberately silent rather than
      // reported, because the common causes are a private window and a browser
      // that does not do this.
    })

  return {
    applyUpdate: () => {
      updateRequested = true
      const waiting = registration?.waiting
      if (waiting) {
        waiting.postMessage({ type: 'SKIP_WAITING' })
        return
      }
      // No waiting worker means the update landed between the notice and the
      // press. Reloading is still the right answer, and is what the player
      // asked for.
      window.location.reload()
    },
    dispose: () => {
      disposed = true
      container.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisible)
    },
  }
}
