// Optimistic-concurrency conflict signalling, shared by the prediction write
// wrappers. The server raises SQLSTATE 'PT409' (see migration
// 20260722120000_write_integrity.sql) when a write carries a stale version —
// i.e. the row was changed elsewhere. That is DISTINCT from lock / joker /
// rate-limit rejections (all 'check_violation' / 23514), so the client can treat
// it specially: non-retryable, resolved by the user (load-latest / keep-mine).

/** The custom SQLSTATE the version trigger raises. Mnemonic: HTTP 409 Conflict. */
export const VERSION_CONFLICT_CODE = 'PT409'

export class VersionConflictError extends Error {
  constructor() {
    super('This was changed on another device.')
    this.name = 'VersionConflictError'
  }
}

/** True when a caught error is the server's version-conflict rejection. */
export function isVersionConflict(err: unknown): boolean {
  if (err instanceof VersionConflictError) return true
  // supabase-js / PostgREST surfaces the SQLSTATE in `code`.
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === VERSION_CONFLICT_CODE
}
