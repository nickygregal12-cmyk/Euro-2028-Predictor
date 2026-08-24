// The live-results channel. THE ONLY MODULE IN THE REPOSITORY THAT OPENS ONE.
//
// ADR 0008 accepted a narrow channel whose job is to INVALIDATE match, standings
// and leaderboard queries, and rejected realtime over broad user-owned or
// scoring tables. Contract 218 publishes exactly one table, `public.matches`,
// whose policy is already `for select to authenticated using (true)` -- so a
// subscriber learns nothing it could not already select.
//
// THIS FUNCTION DISCARDS THE PAYLOAD. It takes a zero-argument callback and
// hands it nothing, so a caller cannot read a score off the wire even by
// mistake. That is the structural reason this channel can never become a second
// source of match truth: no value travels through it to be believed. What the
// callback does is refetch, and the numbers come back from `get_leaderboard`,
// which is the only thing in the system that ranks anything.

import { db } from './client'

/** Every table change this channel carries; the payload itself is dropped. */
const EVERY_CHANGE = { event: '*', schema: 'public', table: 'matches' } as const

/**
 * Opens the live-results channel and calls `onChange` whenever a match row
 * changes. Returns the teardown; callers must invoke it. Safe to call more than
 * once only if each returned teardown is used -- the provider above this keeps
 * the app to a single subscription.
 */
export function subscribeToMatchResultChanges(onChange: () => void): () => void {
  const channel = db
    .channel('live-results')
    // The payload is deliberately not forwarded. See the note above.
    .on('postgres_changes', EVERY_CHANGE, () => {
      onChange()
    })
    .subscribe()

  return () => {
    // removeChannel both unsubscribes and drops the socket reference. Leaving
    // the channel attached would keep it reconnecting for the life of the tab.
    void db.removeChannel(channel)
  }
}
