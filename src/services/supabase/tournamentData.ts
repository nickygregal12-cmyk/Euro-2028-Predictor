// Tournament reference-data query wrappers (read-only in v0.1). Returns plain
// domain-shaped objects; no Supabase types leak past this module.

import { supabase } from './client'

export type Tournament = {
  id: string
  name: string
  year: number
  startsOn: string | null // ISO date
  endsOn: string | null
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

export type MatchRound = 'group' | 'r16' | 'qf' | 'sf' | 'final'

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
}

export type TournamentData = {
  tournament: Tournament
  groups: Group[] // ordered by letter
  teams: Team[]
  matches: Match[]
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

  const [groupsRes, groupTeamsRes, matchesRes] = await Promise.all([
    supabase.from('groups').select('id, letter').eq('tournament_id', t.id).order('letter'),
    supabase
      .from('group_teams')
      .select('slot, group_id, team:teams(id, name)')
      .order('slot'),
    supabase
      .from('matches')
      .select(
        'id, match_ref, round, group_id, matchday, home_source, away_source, home_team_id, away_team_id, match_date, kickoff_at, venue, home_score, away_score',
      )
      .eq('tournament_id', t.id)
      .order('match_date'),
  ])
  if (groupsRes.error) throw groupsRes.error
  if (groupTeamsRes.error) throw groupTeamsRes.error
  if (matchesRes.error) throw matchesRes.error

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
    })),
  }
}
