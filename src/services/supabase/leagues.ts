// Query wrappers for private leagues (Original Predictor only —
// docs/competition-structure.md §1). Every read/write goes through the
// security-definer functions in 20260719180000_add_leagues.sql so the
// profiles/entries RLS stays tight; this module never selects those tables.
//
// Wrappers throw on error (like the other service wrappers); callers that must
// keep working before the migration is applied catch and fail soft (e.g. the
// League hub treats a missing get_my_leagues as "no leagues yet").

import { supabase } from './client'

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

export type LeagueMember = {
  userId: string
  displayName: string
  totalPoints: number
  isYou: boolean
  isOwner: boolean
  hasEntry: boolean
  predictedCount: number
  joinedAt: string
}

/** Create a league and return its id, name and freshly-minted invite code. */
export async function createLeague(tournamentId: string, name: string): Promise<CreatedLeague> {
  const { data, error } = await supabase.rpc('create_league', {
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
  const { data, error } = await supabase.rpc('get_league_preview', { p_code: code })
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
  const { data, error } = await supabase.rpc('join_league', { p_code: code })
  if (error) throw error
  const row = (data ?? [])[0]
  if (!row) throw new Error('Join returned no league')
  return { id: row.id, name: row.name }
}

/** The caller's leagues for a tournament (hub list). */
export async function fetchMyLeagues(tournamentId: string): Promise<LeagueSummary[]> {
  const { data, error } = await supabase.rpc('get_my_leagues', { p_tournament_id: tournamentId })
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    inviteCode: r.invite_code as string,
    memberCount: r.member_count as number,
    isOwner: r.is_owner as boolean,
    ownerName: r.owner_name as string,
  }))
}

/** Header details for a league the caller belongs to. */
export async function fetchLeague(leagueId: string): Promise<LeagueHeader> {
  const { data, error } = await supabase.rpc('get_league', { p_league_id: leagueId })
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

/** Member rows for a league the caller belongs to (name + points; ranked in the domain). */
export async function fetchLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  const { data, error } = await supabase.rpc('get_league_members', { p_league_id: leagueId })
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    userId: r.user_id as string,
    displayName: r.display_name as string,
    totalPoints: r.total_points as number,
    isYou: r.is_you as boolean,
    isOwner: r.is_owner as boolean,
    hasEntry: r.has_entry as boolean,
    predictedCount: r.predicted_count as number,
    joinedAt: r.joined_at as string,
  }))
}

/** Leave a league. The server refuses if the caller is the owner. */
export async function leaveLeague(leagueId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_league', { p_league_id: leagueId })
  if (error) throw error
}

/** Transfer ownership to another member (owner only). */
export async function transferOwnership(leagueId: string, newOwnerId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_ownership', {
    p_league_id: leagueId,
    p_new_owner: newOwnerId,
  })
  if (error) throw error
}

/** Delete a league (owner only). Cascades to memberships. */
export async function deleteLeague(leagueId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_league', { p_league_id: leagueId })
  if (error) throw error
}
