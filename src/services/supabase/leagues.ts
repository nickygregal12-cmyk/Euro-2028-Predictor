// Query wrappers for private leagues (Original Predictor only —
// docs/competition-structure.md §1). Every read/write goes through protected
// database functions so profiles, entries and membership tables remain closed.
//
// Wrappers throw on error. Callers decide whether a failed read is fatal or an
// independently unavailable source, but must never convert failure into a
// successful empty account or league.

import { db } from './client'
import {
  reportOperationFailure,
  serverCodeOf,
} from '../observability/operationFailure'
import {
  mapLeagueMemberPage,
  mapTransferCandidates,
  type LeagueMemberPage,
  type TransferCandidate,
} from './leagueMembersModel'

export type {
  LeagueMember,
  LeagueMemberPage,
  LeagueMemberYou,
  TransferCandidate,
} from './leagueMembersModel'

export type CreatedLeague = { id: string; name: string; inviteCode: string }

/**
 * What a join screen is told about a code before the caller commits to it.
 *
 * Deliberately two fields. Contract 152 removed `id`, `memberCount` and
 * `ownerName`: those are what turned a guessed code into a positively
 * identified private group, and the owner's display name disclosed a real
 * person to whoever did the guessing. The name is what an invitee needs in
 * order to know what they are joining; `isMember` is what decides the button.
 * The id was returned and never read.
 */
export type LeaguePreview = {
  name: string
  isMember: boolean
}

export type LeagueSummary = {
  id: string
  name: string
  inviteCode: string
  memberCount: number
  isOwner: boolean
  ownerName: string
  lastActivityAt: string | null
}

export type LeagueHeader = {
  id: string
  name: string
  inviteCode: string
  memberCount: number
  isOwner: boolean
  ownerId: string
  ownerName: string
}

export type LeagueMemberPageOptions = {
  limit?: number
  after?: string | null
}

/** Create a league and return its id, name and freshly-minted invite code. */
export async function createLeague(tournamentId: string, name: string): Promise<CreatedLeague> {
  const { data, error } = await db.rpc('create_league', {
    p_tournament_id: tournamentId,
    p_name: name,
  })
  // `C1`. A league that would not create is a player who cannot start playing
  // with their friends, and it fails by being caught and shown — invisible to
  // everything else. The NAME is deliberately not reported: it is player-
  // authored free text and can contain anything, including somebody's name.
  if (error) {
    reportOperationFailure('league.create', {
      outcome: 'failed',
      serverCode: serverCodeOf(error),
      seasonId: tournamentId,
    })
    throw error
  }
  const row = (data ?? [])[0]
  if (!row) throw new Error('League creation returned no row')
  return { id: row.id, name: row.name, inviteCode: row.invite_code }
}

/** Pre-join summary for an invite code, or null if no league matches it. */
export async function fetchLeaguePreview(code: string): Promise<LeaguePreview | null> {
  const { data, error } = await db.rpc('get_league_preview', { p_code: code })
  if (error) throw error
  const row = (data ?? [])[0]
  if (!row) return null
  return { name: row.name, isMember: row.is_member }
}

/**
 * Issue this league a new invite code, invalidating the old one.
 *
 * THIS IS WHAT MAKES A LEAKED CODE RECOVERABLE WITHOUT DELETING THE LEAGUE, and
 * it is the third thing contract 158 added for `SEC-001`. Until Development
 * reached contract 158 the function could not be called through the typed
 * client at all — `database.types.ts` is generated from Development, and since
 * `TYPE-001` closed there is no untyped client to reach for — so the note that
 * stood here recorded a deliberate ordering rather than an omission. That
 * ordering has now been satisfied: Development is at 168 and the types name it.
 *
 * WHO MAY DO IT IS THE SERVER'S DECISION AND ONLY THE SERVER'S. The function is
 * owner-only inside; this sends the league id and nothing else, adds no check
 * of its own, and hands back whatever came out. A caller who is not the owner
 * receives the server's refusal, which is what the interface shows.
 *
 * THE OLD CODE STOPS WORKING THE INSTANT THIS RETURNS. That is the point, and
 * it is why the control that calls this must confirm first: every invite
 * already sent, pasted into a group chat or written down becomes a wrong code.
 */
export async function rotateLeagueInviteCode(leagueId: string): Promise<string> {
  const { data, error } = await db.rpc('rotate_league_invite_code', {
    p_league_id: leagueId,
  })
  if (error) throw error
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Rotating the invite code returned no new code.')
  }
  return data
}

/** Join a league by invite code (idempotent). Returns the joined league. */
export async function joinLeague(code: string): Promise<{ id: string; name: string }> {
  const { data, error } = await db.rpc('join_league', { p_code: code })
  // `C1`. The invite CODE is never reported: it is a bearer credential, and
  // anyone holding one can join the league it belongs to.
  if (error) {
    reportOperationFailure('league.join', {
      outcome: 'failed',
      serverCode: serverCodeOf(error),
    })
    throw error
  }
  const row = (data ?? [])[0]
  if (!row) throw new Error('Join returned no league')
  return { id: row.id, name: row.name }
}

/** The caller's leagues for a tournament (hub list + activity tie-break). */
export async function fetchMyLeagues(tournamentId: string): Promise<LeagueSummary[]> {
  const { data, error } = await db.rpc('get_my_leagues', { p_tournament_id: tournamentId })
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    inviteCode: r.invite_code as string,
    memberCount: r.member_count as number,
    isOwner: r.is_owner as boolean,
    ownerName: r.owner_name as string,
    lastActivityAt: typeof r.last_activity_at === 'string' ? r.last_activity_at : null,
  }))
}

/** Header details for a league the caller belongs to. */
export async function fetchLeague(leagueId: string): Promise<LeagueHeader> {
  const { data, error } = await db.rpc('get_league', { p_league_id: leagueId })
  if (error) throw error
  const row = (data ?? [])[0]
  if (!row) throw new Error('League not found')
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    memberCount: row.member_count,
    isOwner: row.is_owner,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
  }
}

/** Fetch one server-ranked private-league standings page. */
export async function fetchLeagueMembersPage(
  leagueId: string,
  options: LeagueMemberPageOptions = {},
): Promise<LeagueMemberPage> {
  const { data, error } = await db.rpc('get_league_members', {
    p_league_id: leagueId,
    p_limit: options.limit ?? 50,
    ...(options.after == null ? {} : { p_after: options.after }),
  })
  if (error) throw error
  return mapLeagueMemberPage(data)
}

/** Owner-only candidate search, independent of the standings page payload. */
export async function searchLeagueTransferCandidates(
  leagueId: string,
  query = '',
  limit = 20,
): Promise<TransferCandidate[]> {
  const { data, error } = await db.rpc('search_league_transfer_candidates', {
    p_league_id: leagueId,
    p_query: query,
    p_limit: limit,
  })
  if (error) throw error
  return mapTransferCandidates(data ?? [])
}

/** Leave a league. The server refuses if the caller is the owner. */
export async function leaveLeague(leagueId: string): Promise<void> {
  const { error } = await db.rpc('leave_league', { p_league_id: leagueId })
  if (error) throw error
}

/** Transfer ownership to another member (owner only). */
export async function transferOwnership(leagueId: string, newOwnerId: string): Promise<void> {
  const { error } = await db.rpc('transfer_ownership', {
    p_league_id: leagueId,
    p_new_owner: newOwnerId,
  })
  if (error) throw error
}

/** Delete a league (owner only). Cascades to memberships. */
export async function deleteLeague(leagueId: string): Promise<void> {
  const { error } = await db.rpc('delete_league', { p_league_id: leagueId })
  if (error) throw error
}
