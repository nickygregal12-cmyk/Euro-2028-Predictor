import { supabase } from './client'

export type AdminResultMethod = 'regulation' | 'extra_time' | 'penalties'
export type AdminResultState = 'scheduled' | 'confirmed' | 'corrected'

export type AdminMatchResult = {
  matchId: string
  state: AdminResultState
  method: AdminResultMethod | null
  home90: number | null
  away90: number | null
  home120: number | null
  away120: number | null
  homePenalties: number | null
  awayPenalties: number | null
  winnerTeamId: string | null
  version: number
  confirmedAt: string | null
  correctedAt: string | null
  reason: string | null
}

export type AdminResultMutation = {
  matchId: string
  method: AdminResultMethod
  home90: number
  away90: number
  home120: number | null
  away120: number | null
  homePenalties: number | null
  awayPenalties: number | null
  reason: string | null
}

export type AdminResultRevision = {
  revision: number
  action: 'confirm' | 'correct' | 'clear'
  previousResult: Record<string, unknown>
  newResult: Record<string, unknown>
  reason: string | null
  recordedAt: string
}

type ResultRow = {
  id: string
  result_state: AdminResultState
  result_method: AdminResultMethod | null
  home_score_90: number | null
  away_score_90: number | null
  home_score_120: number | null
  away_score_120: number | null
  home_penalties: number | null
  away_penalties: number | null
  winner_team_id: string | null
  result_version: number
  confirmed_at: string | null
  corrected_at: string | null
  last_result_reason: string | null
}

function mapResult(row: ResultRow): AdminMatchResult {
  return {
    matchId: row.id,
    state: row.result_state,
    method: row.result_method,
    home90: row.home_score_90,
    away90: row.away_score_90,
    home120: row.home_score_120,
    away120: row.away_score_120,
    homePenalties: row.home_penalties,
    awayPenalties: row.away_penalties,
    winnerTeamId: row.winner_team_id,
    version: row.result_version,
    confirmedAt: row.confirmed_at,
    correctedAt: row.corrected_at,
    reason: row.last_result_reason,
  }
}

export async function fetchAdminMatchResults(
  tournamentId: string,
): Promise<AdminMatchResult[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, result_state, result_method, home_score_90, away_score_90, home_score_120, away_score_120, home_penalties, away_penalties, winner_team_id, result_version, confirmed_at, corrected_at, last_result_reason',
    )
    .eq('tournament_id', tournamentId)

  if (error) throw error
  return ((data ?? []) as ResultRow[]).map(mapResult)
}

function mutationArgs(input: AdminResultMutation) {
  return {
    p_match_id: input.matchId,
    p_method: input.method,
    p_home_90: input.home90,
    p_away_90: input.away90,
    p_home_120: input.home120,
    p_away_120: input.away120,
    p_home_penalties: input.homePenalties,
    p_away_penalties: input.awayPenalties,
    p_reason: input.reason,
  }
}

export async function confirmAdminMatchResult(
  input: AdminResultMutation,
): Promise<void> {
  const { error } = await supabase.rpc(
    'admin_confirm_match_result',
    mutationArgs(input),
  )
  if (error) throw error
}

export async function correctAdminMatchResult(
  input: AdminResultMutation,
): Promise<void> {
  const { error } = await supabase.rpc(
    'admin_correct_match_result',
    mutationArgs(input),
  )
  if (error) throw error
}

export async function clearAdminMatchResult(
  matchId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_clear_match_result', {
    p_match_id: matchId,
    p_reason: reason.trim(),
  })
  if (error) throw error
}

type RevisionRow = {
  revision: number
  action: 'confirm' | 'correct' | 'clear'
  previous_result: Record<string, unknown>
  new_result: Record<string, unknown>
  reason: string | null
  recorded_at: string
}

export async function fetchAdminMatchResultRevisions(
  matchId: string,
): Promise<AdminResultRevision[]> {
  const { data, error } = await supabase.rpc('admin_match_result_revisions', {
    p_match_id: matchId,
  })
  if (error) throw error

  return ((data ?? []) as RevisionRow[]).map((row) => ({
    revision: row.revision,
    action: row.action,
    previousResult: row.previous_result,
    newResult: row.new_result,
    reason: row.reason,
    recordedAt: row.recorded_at,
  }))
}
