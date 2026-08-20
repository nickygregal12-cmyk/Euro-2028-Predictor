import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  isIosPlatform,
  resolveInstallInvitation,
  type InstallInvitation,
  type InstallPlatform,
} from './installInvitation'
import {
  readInstallDismissedAt,
  recordVisit,
  writeInstallDismissedAt,
} from './pwaStorage'
import {
  registerServiceWorker,
  type ServiceWorkerHandle,
} from './serviceWorkerClient'
import { useOfflineStatus } from './useOnlineStatus'

/**
 * The browser half of the install and update experience.
 *
 * Everything impure lives here — the deferred prompt event, display mode,
 * platform sniffing, storage, the registration — and every decision it feeds
 * lives in `installInvitation.ts`, which is pure and tested on its own.
 *
 * `beforeinstallprompt` IS CAPTURED AT MODULE SCOPE, NOT IN THE EFFECT, and
 * that is not a style choice. Chromium fires the event once, early, and often
 * before React has mounted anything; a listener attached in an effect misses it
 * and the install action never appears. The listener below runs on import, so
 * the event is held from the moment the entry chunk executes and the hook
 * simply asks whether one arrived.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const promptListeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Preventing the default is what defers Chromium's own mini-infobar so the
    // application can offer installation in context instead of on arrival.
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    promptListeners.forEach((listener) => listener())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    promptListeners.forEach((listener) => listener())
  })
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari's own, older signal, which is the only one it sets.
  return (navigator as { standalone?: boolean }).standalone === true
}

function detectPlatform(hasPrompt: boolean): InstallPlatform {
  if (hasPrompt) return 'prompt'
  if (typeof navigator === 'undefined') return 'unsupported'
  return isIosPlatform(
    navigator.userAgent,
    navigator.platform ?? '',
    navigator.maxTouchPoints ?? 0,
  )
    ? 'ios'
    : 'unsupported'
}

export type PwaNoticesState = {
  readonly offline: boolean
  readonly updateReady: boolean
  readonly invitation: InstallInvitation
  readonly applyUpdate: () => void
  readonly install: () => void
  readonly dismissInstall: () => void
}

export function usePwaNotices(): PwaNoticesState {
  const offline = useOfflineStatus()
  const [updateReady, setUpdateReady] = useState(false)
  const [promptAvailable, setPromptAvailable] = useState(deferredPrompt !== null)
  const [standalone, setStandalone] = useState(isStandalone)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [visits, setVisits] = useState(0)
  const [handle, setHandle] = useState<ServiceWorkerHandle | null>(null)

  useEffect(() => {
    setVisits(recordVisit())
    setDismissedAt(readInstallDismissedAt())
  }, [])

  useEffect(() => {
    const listener = () => {
      setPromptAvailable(deferredPrompt !== null)
      setStandalone(isStandalone())
    }
    promptListeners.add(listener)
    return () => {
      promptListeners.delete(listener)
    }
  }, [])

  useEffect(() => {
    // The display mode changes without a reload when a player installs from the
    // browser's own menu, so the promotion has to disappear on the signal
    // rather than on the next visit.
    const query = window.matchMedia?.('(display-mode: standalone)')
    if (!query) return
    const listener = () => setStandalone(isStandalone())
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    // NEVER AGAINST A DEVELOPMENT SERVER. Vite serves unbundled modules and
    // emits no `/sw.js`, so registration would fail — and on a port that once
    // served a preview build it would do something worse, leaving a worker from
    // that build in control of the dev application and serving its assets.
    if (import.meta.env.DEV) return
    const registered = registerServiceWorker({
      onUpdateReady: () => setUpdateReady(true),
    })
    setHandle(registered)
    return () => registered.dispose()
  }, [])

  const invitation = useMemo(
    () =>
      resolveInstallInvitation({
        standalone,
        platform: detectPlatform(promptAvailable),
        visits,
        dismissedAt,
        now: Date.now(),
      }),
    [standalone, promptAvailable, visits, dismissedAt],
  )

  const install = useCallback(() => {
    const event = deferredPrompt
    if (!event) return
    // Chromium allows one use of a deferred prompt, so it is released here
    // whatever the player answers.
    deferredPrompt = null
    setPromptAvailable(false)
    void event.prompt().catch(() => {})
    void event.userChoice
      .then((choice) => {
        // Cancelling the browser's own dialog is an answer too, and is
        // remembered exactly as "Not now" is. Without this the notice would
        // return on the next visit to someone who has already said no once.
        if (choice.outcome === 'dismissed') {
          const at = Date.now()
          writeInstallDismissedAt(at)
          setDismissedAt(at)
        }
      })
      .catch(() => {})
  }, [])

  const dismissInstall = useCallback(() => {
    const at = Date.now()
    writeInstallDismissedAt(at)
    setDismissedAt(at)
  }, [])

  const applyUpdate = useCallback(() => {
    handle?.applyUpdate()
  }, [handle])

  return { offline, updateReady, invitation, applyUpdate, install, dismissInstall }
}
