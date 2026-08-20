import { reportClientError } from './clientObservability'

const CORRELATION_REFERENCE = /^FPH-\d{14}-[0-9A-F]{4}$/

/**
 * Report a React render failure under the same correlation reference the fatal
 * fallback shows to the player.
 *
 * The original error MESSAGE is deliberately not copied into the new error:
 * render failures can contain server or player-derived text. Only the original
 * call frames are retained; the first stack line normally repeats the original
 * message and is discarded before the existing client-observability sanitiser
 * sees the stack. Component stacks go through that same sanitiser.
 */
export function reportFatalRenderError(
  value: unknown,
  reference: string,
  componentStack?: string | null,
): void {
  const safeReference = CORRELATION_REFERENCE.test(reference)
    ? reference
    : 'FPH-INVALID-REFERENCE'
  const original = value instanceof Error ? value : null
  const reported = new Error(`Fatal application error: reference=${safeReference}`)
  reported.name = original?.name || 'FatalRenderError'

  const frames = original?.stack?.split('\n').slice(1).join('\n').trim()
  if (frames) {
    reported.stack = `${reported.name}: ${reported.message}\n${frames}`
  }

  reportClientError(
    reported,
    'react',
    typeof window === 'undefined' ? '/' : window.location.pathname,
    componentStack,
  )
}
