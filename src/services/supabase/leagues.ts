// Query wrappers for private leagues (Original Predictor only —
// docs/competition-structure.md §1). Every read/write goes through protected
// database functions so profiles, entries and membership tables remain closed.
//
// Wrappers throw on error. Callers decide whether a failed read is fatal or an
// independently unavailable source, but must never convert failure into a
// successful empty account or league.

import { db } from './client'
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

export type LeaguePreview = {
  id: string
  name: string
  memberCount: number
  ownerName: string
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
  if (error) throw error
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
  return {
    id: row.id,
    name: row.name,
    memberCount: row.member_count,
    ownerName: row.owner_name,
    isMember: row.is_member,
  }
}

/** Join a league by invite code (idempotent). Returns the joined league. */
export async function joinLeague(code: string): Promise<{ id: string; name: string }> {
  const { data, error } = await db.rpc('join_league', { p_code: code })
  if (error) throw error
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
    p_after: options.after ?? undefined,
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
