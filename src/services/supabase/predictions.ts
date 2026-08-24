// Entry + prediction query wrappers. An "entry" is one user's set of
// predictions for a tournament (competition type is carried by entries in later
// tiers — see docs/competition-structure.md). v0.1 covers group match scores
// and the joker flag.

import { db } from './client'
import { recordProductEvent } from '../analytics/productEvents'
import { rpcArgs } from './rpcArguments'
import { preparedInsert } from './preparedInsert'
import { VersionConflictError, isVersionConflict } from './writeConflict'

export type {
  EntrySubmissionState,
  EntrySubmissionStatus,
} from './entrySubmissionStatusModel'
export { mapEntrySubmissionStatus } from './entrySubmissionStatusModel'

export type Entry = {
  id: string
  submittedAt: string | null
}

export type MatchPrediction = {
  matchId: string
  homeScore: number
  awayScore: number
  joker: boolean
  version: number
}

type DatabaseError = {
  code?: string
}

function mapEntry(row: { id: string; submitted_at: string | null }): Entry {
  return { id: row.id, submittedAt: row.submitted_at }
}

function isConcurrentMembershipInsert(error: DatabaseError | null): boolean {
  return error?.code === '23505'
}

/**
 * Fetch the user's entry for a tournament, creating it on first use.
 *
 * The unique (user_id, tournament_id) boundary is the concurrency authority.
 * INSERT ... ON CONFLICT DO NOTHING lets one tab create the row while any
 * concurrent loser falls through to a normal read instead of surfacing a raw
 * unique-constraint error.
 *
 * Contract 66 also creates the canonical game membership from a BEFORE trigger.
 * Two truly simultaneous first-use inserts can therefore contend on the
 * membership unique key before the outer entry conflict handler is reached.
 * PostgreSQL returns that expected loser as 23505 only after the winning
 * transaction has settled, so it follows the same shared-row read path.
 */
/**
 * The caller's tournament entry, or null when they have none.
 *
 * READ-ONLY, AND THAT IS THE WHOLE POINT. `getOrCreateEntry` below UPSERTS, and
 * the contract-66 membership trigger fires on that insert — so merely rendering
 * a surface that mounted the predictions provider enrolled the visitor in the
 * competition. Harmless while every signed-in route was a Euro route; not
 * harmless once More -> Profile is two taps from a Scottish Premiership player's
 * Hub. Entry is an act, not a side effect of looking.
 *
 * `maybeSingle` rather than `single`: no row is the ordinary answer here.
 */
export async function fetchMyEntry(
  userId: string,
  tournamentId: string,
): Promise<Entry | null> {
  const { data, error } = await db
    .from('entries')
    .select('id, submitted_at')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .maybeSingle()

  if (error) throw error
  return data ? mapEntry(data) : null
}

export async function getOrCreateEntry(userId: string, tournamentId: string): Promise<Entry> {
  const created = await db
    .from('entries')
    .upsert(
      { user_id: userId, tournament_id: tournamentId },
      {
        onConflict: 'user_id,tournament_id',
        ignoreDuplicates: true,
      },
    )
    .select('id, submitted_at')
    .maybeSingle()

  if (created.error && !isConcurrentMembershipInsert(created.error)) throw created.error
  if (created.data) return mapEntry(created.data)

  // A zero-row RETURNING result, or the contract-66 membership-trigger race,
  // means another request won the canonical first-use insert. Read the committed
  // shared entry instead of exposing an expected concurrency outcome to the UI.
  const existing = await db
    .from('entries')
    .select('id, submitted_at')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .single()

  if (existing.error) throw existing.error
  return mapEntry(existing.data)
}

/**
 * Submit the entry via the server-side `submit_entry` function, which validates
 * completeness (all group matches predicted, a full 15-winner bracket) before
 * stamping submitted_at — the client is never trusted to gate submission.
 * Returns the (server) submission timestamp. Submission does not freeze the
 * entry; predictions stay editable until the real lock.
 */
export async function submitEntry(entryId: string): Promise<string> {
  const { data, error } = await db.rpc('submit_entry', { p_entry_id: entryId })
  if (error) throw error
  // Recorded HERE rather than at the caller, so no submission path can be added
  // later that forgets to count. Fire-and-forget and after the server said yes:
  // an attempt that failed is not a submission, and analytics must not delay
  // the timestamp a player is waiting for.
  recordProductEvent('entry_submitted', {})
  return data as string
}

export async function fetchMatchPredictions(entryId: string): Promise<MatchPrediction[]> {
  const { data, error } = await db
    .from('match_predictions')
    .select('match_id, home_score, away_score, joker, version')
    .eq('entry_id', entryId)
  if (error) throw error
  return (data ?? []).map((p) => ({
    matchId: p.match_id,
    homeScore: p.home_score,
    awayScore: p.away_score,
    joker: p.joker,
    version: p.version,
  }))
}

/**
 * Insert or update a single match prediction (keyed on entry + match). The
 * server remains the authority on locks; this write will be rejected by RLS /
 * lock enforcement once that lands, so callers must surface save failures.
 */
// Optimistic concurrency: `expectedVersion` is the version the client last read
// for this row (0 for a first write). The server's version trigger rejects a
// stale write with SQLSTATE 'PT409'; we surface that as VersionConflictError.
// Returns the new stored version for the caller to echo on its next write.
export async function upsertMatchPrediction(
  entryId: string,
  matchId: string,
  homeScore: number,
  awayScore: number,
  joker: boolean,
  expectedVersion: number,
): Promise<number> {
  const { data, error } = await db
    .from('match_predictions')
    .upsert(
      preparedInsert('match_predictions', {
        entry_id: entryId,
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
        joker,
        version: expectedVersion,
        updated_at: new Date().toISOString(),
      }),
      { onConflict: 'entry_id,match_id' },
    )
    .select('version')
    .single()
  if (error) {
    if (isVersionConflict(error)) throw new VersionConflictError()
    throw error
  }
  return data.version
}

/**
 * Remove one saved score pair through the protected database boundary. A null
 * expected version means the client never read a row: the RPC returns false if
 * none exists, but raises PT409 if another device created one in the meantime.
 */
export async function deleteMatchPrediction(
  entryId: string,
  matchId: string,
  expectedVersion: number | null,
): Promise<boolean> {
  const { data, error } = await db.rpc(
    'delete_match_prediction',
    rpcArgs('delete_match_prediction', ['p_expected_version'], {
      p_entry_id: entryId,
      p_match_id: matchId,
      p_expected_version: expectedVersion,
    }),
  )
  if (error) {
    if (isVersionConflict(error)) throw new VersionConflictError()
    throw error
  }
  return data as boolean
}

/**
 * Contract 57's clear: one atomic pre-lock wipe of the caller's own entry —
 * scores, ties, positions, bracket, awards — and the submitted flag. The server
 * refuses post-lock.
 *
 * NO CALLER TODAY, deliberately. It used to be the Account page's danger zone,
 * which put a destructive control over one tournament's entry on a page that
 * belongs to the account: a player whose only competition is a league season
 * was offered it too. Clearing an entry is a per-competition action and returns
 * on the surface that owns the entry, alongside the rest of the parked Euro
 * scope. The RPC is unchanged and still enforces the lock.
 */
export async function clearMyPredictions(tournamentId: string): Promise<void> {
  const { error } = await db.rpc('clear_my_predictions', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
}
