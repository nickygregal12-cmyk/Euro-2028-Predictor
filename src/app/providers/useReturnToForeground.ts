import { useEffect, useRef } from 'react'

/**
 * Runs once when a genuinely backgrounded/hidden document becomes active again.
 * Browsers commonly emit both visibilitychange and focus for the same return;
 * clearing the background flag before invoking the callback deduplicates them.
 */
export function useReturnToForeground(onReturn: () => void) {
  const callbackRef = useRef(onReturn)
  callbackRef.current = onReturn

  useEffect(() => {
    let wasBackgrounded = document.visibilityState === 'hidden'

    function returnIfBackgrounded() {
      if (!wasBackgrounded || document.visibilityState !== 'visible') return
      wasBackgrounded = false
      callbackRef.current()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        wasBackgrounded = true
        return
      }
      returnIfBackgrounded()
    }

    function handleFocus() {
      returnIfBackgrounded()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])
}
