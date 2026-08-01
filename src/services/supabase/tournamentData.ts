// Tournament reference-data query wrappers (read-only in v0.1). Returns plain
// domain-shaped objects; no Supabase types leak past this module.

import { supabase } from './client'

export type CompetitionKind = 'tournament' | 'league_season'
export type CompetitionStatus = 'draft' | 'scheduled' | 'active' | 'complete' | 'archived'

export type Tournament = {
  id: string
  name: string
  year: number
  startsOn: string | null // ISO date
  endsOn: string | null
  // The entry-lock instant (opening kickoff). Server-authoritative; the UI only
  // reflects it. Null until set. Dev overrides this row to exercise locked UI.
  lockAt: string | null // ISO timestamp
  // Optional only during the repository-first rollout so existing isolated
  // fixtures and hosted contract 64 remain valid. Contract 65 stores every one
  // of these fields as NOT NULL after backfill.
  competitionId?: string | null
  seasonKey?: string | null
  kind?: CompetitionKind | null
  displayTimeZone?: string | null
  status?: CompetitionStatus | null
}

export type Group = {
  id: string
  letter: string // 'A'..'F'
}

export type Team = {
  id: string
  name: string
  groupId: string
  slot: number // 1..4 within the group
}

export type MatchRound = 'group' | 'r16' | 'qf' | 'sf' | 'final' | 'league'
export type MatchResultState = 'scheduled' | 'confirmed' | 'corrected'
export type MatchResultMethod = 'regulation' | 'extra_time' | 'penalties'

export type Match = {
  id: string
  matchRef: string
  round: MatchRound
  groupId: string | null
  matchday: number | null
  homeSource: string
  awaySource: string
  homeTeamId: string | null
  awayTeamId: string | null
  matchDate: string // ISO date
  kickoffAt: string | null
  venue: string
  homeScore: number | null
  awayScore: number | null
  // These fields already exist in the contract-38 matches table. They remain
  // optional in the TypeScript shape so older isolated fixtures and visual
  // previews can still construct a minimal Match while repository reads always
  // populate the authoritative result lifecycle.
  resultState?: MatchResultState
  resultMethod?: MatchResultMethod | null
  homeScore90?: number | null
  awayScore90?: number | null
  homeScore120?: number | null
  awayScore120?: number | null
  homePenalties?: number | null
  awayPenalties?: number | null
  winnerTeamId?: string | null
}

export type TournamentData = {
  tournament: Tournament
  groups: Group[] // ordered by letter
  teams: Team[]
  matches: Match[]
}

type StageCSeasonMetadata = {
  competitionId: string | null
  seasonKey: string | null
  kind: CompetitionKind | null
  displayTimeZone: string | null
  status: CompetitionStatus | null
}

/**
 * lock_at is read best-effort: it's a follow-up-migration column, so a database
 * without that migration applied still loads the app (the entry simply reads as
 * never-locked until the migration lands).
 */
async function fetchLockAt(tournamentId: string): Promise<string | null> {
  try {
    const lockRes = await supabase
      .from('tournaments')
      .select('lock_at')
      .eq('id', tournamentId)
      .single()
    if (lockRes.error) return null
    return (lockRes.data as { lock_at: string | null }).lock_at ?? null
  } catch {
    return null
  }
}

/**
 * Stage C1 lands repository-first. Until contract 65 is explicitly promoted to
 * a hosted database, the old schema must continue loading. Missing columns are
 * therefore treated as migration-not-yet-applied, not as empty authoritative
 * metadata; once present, the persisted timezone becomes the competition-day
 * authority used by every shared context adapter.
 */
async function fetchStageCSeasonMetadata(tournamentId: string): Promise<StageCSeasonMetadata> {
  try {
    const result = await supabase
      .from('tournaments')
      .select('competition_id, season_key, kind, display_timezone, status')
      .eq('id', tournamentId)
      .single()

    if (result.error || !result.data) {
      return {
        competitionId: null,
        seasonKey: null,
        kind: null,
        displayTimeZone: null,
        status: null,
      }
    }

    const row = result.data as {
      competition_id: string | null
      season_key: string | null
      kind: CompetitionKind | null
      display_timezone: string | null
      status: CompetitionStatus | null
    }

    return {
      competitionId: row.competition_id ?? null,
      seasonKey: row.season_key ?? null,
      kind: row.kind ?? null,
      displayTimeZone: row.display_timezone ?? null,
      status: row.status ?? null,
    }
  } catch {
    return {
      competitionId: null,
      seasonKey: null,
      kind: null,
      displayTimeZone: null,
      status: null,
    }
  }
}

/**
 * Loads the single active tournament plus its groups, teams (with group + slot)
 * and every fixture. One call, joined client-side into the shapes the domain
 * layer and screens consume.
 */
export async function fetchTournamentData(): Promise<TournamentData> {
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments')
    .select('id, name, year, starts_on, ends_on')
    .order('year', { ascending: true })
    .limit(1)
  if (tErr) throw tErr
  const t = tournaments?.[0]
  if (!t) throw new Error('No tournament found — has the fixture seed been run?')

  const [groupsRes, matchesRes, lockAt, stageCMetadata] = await Promise.all([
    supabase.from('groups').select('id, letter').eq('tournament_id', t.id).order('letter'),
    supabase
      .from('matches')
      .select(
        'id, match_ref, round, group_id, matchday, home_source, away_source, home_team_id, away_team_id, match_date, kickoff_at, venue, home_score, away_score, result_state, result_method, home_score_90, away_score_90, home_score_120, away_score_120, home_penalties, away_penalties, winner_team_id',
      )
      .eq('tournament_id', t.id)
      .order('match_date'),
    fetchLockAt(t.id),
    fetchStageCSeasonMetadata(t.id),
  ])
  if (groupsRes.error) throw groupsRes.error
  if (matchesRes.error) throw matchesRes.error

  const groupIds = (groupsRes.data ?? []).map((g) => g.id)

  // Stage C1 adds an explicit tournament_id to group_teams. This query remains
  // scoped through the already-loaded group ids as well, so it is compatible
  // with both contract 64 and contract 65 throughout the repository-first rollout.
  //
  // The embed names its foreign key explicitly. Contract 65 adds the composite
  // same-season `group_teams_tournament_team_fkey` alongside the original
  // `group_teams_team_id_fkey`, which gives PostgREST two ways to reach `teams`;
  // an unqualified `teams(...)` embed then fails the whole request with
  // PGRST201 rather than picking one. Naming the single-column key preserves the
  // contract-64 result shape exactly, and is valid against both contracts.
  const groupTeamsRes = groupIds.length
    ? await supabase
        .from('group_teams')
        .select('slot, group_id, team:teams!group_teams_team_id_fkey(id, name)')
        .in('group_id', groupIds)
        .order('slot')
    : { data: [], error: null }
  if (groupTeamsRes.error) throw groupTeamsRes.error

  const teams: Team[] = (groupTeamsRes.data ?? []).flatMap((gt) => {
    // The embedded `team` relation comes back as an object (or array on some
    // PostgREST versions); normalise to a single record.
    const team = Array.isArray(gt.team) ? gt.team[0] : gt.team
    if (!team) return []
    return [{ id: team.id, name: team.name, groupId: gt.group_id, slot: gt.slot }]
  })

  return {
    tournament: {
      id: t.id,
      name: t.name,
      year: t.year,
      startsOn: t.starts_on,
      endsOn: t.ends_on,
      lockAt,
      ...stageCMetadata,
    },
    groups: (groupsRes.data ?? []).map((g) => ({ id: g.id, letter: g.letter })),
    teams,
    matches: (matchesRes.data ?? []).map((m) => ({
      id: m.id,
      matchRef: m.match_ref,
      round: m.round as MatchRound,
      groupId: m.group_id,
      matchday: m.matchday,
      homeSource: m.home_source,
      awaySource: m.away_source,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      matchDate: m.match_date,
      kickoffAt: m.kickoff_at,
      venue: m.venue,
      homeScore: m.home_score,
      awayScore: m.away_score,
      resultState: m.result_state as MatchResultState,
      resultMethod: m.result_method as MatchResultMethod | null,
      homeScore90: m.home_score_90,
      awayScore90: m.away_score_90,
      homeScore120: m.home_score_120,
      awayScore120: m.away_score_120,
      homePenalties: m.home_penalties,
      awayPenalties: m.away_penalties,
      winnerTeamId: m.winner_team_id,
    })),
  }
}
