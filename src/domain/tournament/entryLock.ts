// Pure entry-lock policy. The whole entry locks at the tournament's opening
// kickoff (scoring-rules / CLAUDE.md rule 4). This MIRRORS the server-side lock
// (the enforce_entry_lock_* triggers) so the UI can reflect it — but the
// database is the authority; browser countdowns are cosmetic. Data in, data out.
//
// The lock instant comes from tournament data (tournaments.lock_at), never a
// client clock. Jokers are exempt: they follow their own per-match
// kickoff-commitment lock (see jokerPolicy.ts), not this one.

/**
 * True once the entry lock has passed. A tournament with no lock time set
 * (lock_at null) is never locked. The boundary is inclusive — at exactly the
 * lock instant the entry is locked (matches the server's `now() >= lock_at`).
 */
export function isEntryLocked(lockAt: string | null, now: Date = new Date()): boolean {
  if (!lockAt) return false
  return now.getTime() >= new Date(lockAt).getTime()
}
