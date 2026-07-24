import { createClient } from '@supabase/supabase-js'

export const DEFAULT_E2E_EMAIL = 'e2e@euro28.local'
export const LOCAL_SUPABASE_PORT = '54321'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Browser E2E requires ${name}.`)
  return value
}

export function createLocalAdmin() {
  const url = required('E2E_SUPABASE_URL')
  const serviceRoleKey = required('E2E_SUPABASE_SERVICE_ROLE_KEY')
  const parsed = new URL(url)

  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.port !== LOCAL_SUPABASE_PORT
  ) {
    throw new Error(`Browser E2E refuses non-standard local Supabase URL ${parsed.origin}.`)
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function e2eUserId(): Promise<string> {
  const admin = createLocalAdmin()
  const email = process.env.E2E_USER_EMAIL?.trim() || DEFAULT_E2E_EMAIL
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  const user = data.users.find((candidate) => candidate.email === email)
  if (!user) throw new Error(`Browser E2E user ${email} was not created.`)
  return user.id
}

type SeedTeam = {
  id: string
  name: string
  groupIndex: number
  slot: number
}

function parseSeedTeam(id: string, name: string): SeedTeam {
  const match = /^Team ([A-F])([1-4])$/.exec(name)
  if (!match) throw new Error(`Unexpected browser E2E seed team name: ${name}`)
  return {
    id,
    name,
    groupIndex: match[1].charCodeAt(0) - 'A'.charCodeAt(0),
    slot: Number(match[2]),
  }
}

function predictedScore(home: SeedTeam, away: SeedTeam): { home: number; away: number } {
  if (home.groupIndex !== away.groupIndex) {
    throw new Error(`Seeded group match crosses groups: ${home.name} v ${away.name}`)
  }

  const winner = home.slot < away.slot ? home : away
  const loser = winner === home ? away : home
  const pair = [winner.slot, loser.slot].sort((a, b) => a - b).join('-')
  const winningGoals = pair === '3-4' ? winner.groupIndex + 1 : pair === '1-3' ? 3 : 2

  return winner === home
    ? { home: winningGoals, away: 0 }
    : { home: 0, away: winningGoals }
}

export type PreparedEntry = {
  entryId: string
  tournamentId: string
  firstMatchId: string
  firstHomeName: string
  firstAwayName: string
}

/**
 * Fill the existing local E2E entry with all 36 group predictions. The earlier
 * save/delete smoke journey leaves the entry present and empty, so this helper
 * deliberately refuses to bypass table grants with service-role DELETEs.
 *
 * Group positions are deterministic (slot 1 > 2 > 3 > 4), while each third-
 * placed team has a different goal difference so the best-third table settles
 * without manual tie resolution.
 */
export async function prepareCompleteGroupEntry(): Promise<PreparedEntry> {
  const admin = createLocalAdmin()
  const userId = await e2eUserId()

  const { data: tournaments, error: tournamentError } = await admin
    .from('tournaments')
    .select('id')
    .limit(1)
  if (tournamentError) throw tournamentError
  const tournamentId = tournaments?.[0]?.id
  if (!tournamentId) throw new Error('Browser E2E found no seeded tournament.')

  const { data: existing, error: existingError } = await admin
    .from('entries')
    .select('id, submitted_at')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .maybeSingle()
  if (existingError) throw existingError

  let entryId: string
  if (existing) {
    if (existing.submitted_at !== null) {
      throw new Error('Browser E2E submission fixture requires an unsubmitted entry.')
    }
    entryId = existing.id
  } else {
    const { data: created, error: entryError } = await admin
      .from('entries')
      .insert({ user_id: userId, tournament_id: tournamentId })
      .select('id')
      .single()
    if (entryError) throw entryError
    entryId = created.id
  }

  const { count: predictionCount, error: predictionCountError } = await admin
    .from('match_predictions')
    .select('match_id', { count: 'exact', head: true })
    .eq('entry_id', entryId)
  if (predictionCountError) throw predictionCountError
  if ((predictionCount ?? 0) !== 0) {
    throw new Error(
      `Browser E2E submission fixture expected an empty entry, found ${predictionCount} predictions.`,
    )
  }

  const { data: teams, error: teamsError } = await admin
    .from('teams')
    .select('id, name')
    .eq('tournament_id', tournamentId)
  if (teamsError) throw teamsError
  const teamsById = new Map(
    (teams ?? []).map((team) => [team.id, parseSeedTeam(team.id, team.name)]),
  )

  const { data: matches, error: matchesError } = await admin
    .from('matches')
    .select('id, match_ref, home_team_id, away_team_id')
    .eq('tournament_id', tournamentId)
    .eq('round', 'group')
    .order('match_ref')
  if (matchesError) throw matchesError
  if (!matches || matches.length !== 36) {
    throw new Error(`Browser E2E expected 36 group matches, found ${matches?.length ?? 0}.`)
  }

  const predictions = matches.map((match) => {
    if (!match.home_team_id || !match.away_team_id) {
      throw new Error(`Seeded group match ${match.match_ref} has unresolved teams.`)
    }
    const home = teamsById.get(match.home_team_id)
    const away = teamsById.get(match.away_team_id)
    if (!home || !away) {
      throw new Error(`Seeded group match ${match.match_ref} references an unknown team.`)
    }
    const score = predictedScore(home, away)
    return {
      entry_id: entryId,
      match_id: match.id,
      home_score: score.home,
      away_score: score.away,
      joker: false,
      version: 0,
    }
  })

  const { error: predictionError } = await admin.from('match_predictions').insert(predictions)
  if (predictionError) throw predictionError

  const first = matches[0]
  if (!first.home_team_id || !first.away_team_id) {
    throw new Error('First seeded match is unresolved.')
  }
  const firstHome = teamsById.get(first.home_team_id)
  const firstAway = teamsById.get(first.away_team_id)
  if (!firstHome || !firstAway) throw new Error('First seeded match teams are missing.')

  return {
    entryId,
    tournamentId,
    firstMatchId: first.id,
    firstHomeName: firstHome.name,
    firstAwayName: firstAway.name,
  }
}

/** Simulate another authenticated device changing one stored prediction. */
export async function overwritePrediction(
  entryId: string,
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  const admin = createLocalAdmin()
  const { data: current, error: readError } = await admin
    .from('match_predictions')
    .select('version')
    .eq('entry_id', entryId)
    .eq('match_id', matchId)
    .single()
  if (readError) throw readError

  const { error: updateError } = await admin
    .from('match_predictions')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      version: current.version,
      updated_at: new Date().toISOString(),
    })
    .eq('entry_id', entryId)
    .eq('match_id', matchId)
  if (updateError) throw updateError
}
