import { reportClientError } from './clientObservability'
import { serverCodeOf } from './operationFailure'

/**
 * Caught read/load failures are invisible to window.onerror and unhandled
 * rejection capture. Keep their telemetry deliberately content-free: a closed
 * operation name plus a sanitised server/network code is enough to group and
 * diagnose availability failures without sending player or competition data.
 */
export type ReadOperationName =
  | 'leaderboard.page'
  | 'season-leaderboard.page'
  | 'match-centre.league-picks'
  | 'match-centre.distribution'

export function reportReadFailure(
  operation: ReadOperationName,
  error: unknown,
): void {
  const code = sanitiseCode(serverCodeOf(error))
  const reported = new Error(`Read operation failed: read=${operation} code=${code}`)
  reported.name = 'ReadFailure'

  // Reuse the existing controlled caught-operation channel so the event still
  // passes the same redaction and Sentry allow-list as competitive failures.
  reportClientError(reported, 'operation-failure')
}

function sanitiseCode(value: string): string {
  const trimmed = value.trim().slice(0, 32)
  return /^[A-Za-z0-9_.-]+$/.test(trimmed) ? trimmed : 'unrecognised'
}
