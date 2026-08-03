import { createLocalAdmin, localTournamentSeason } from './local-supabase'

const PASSWORD = 'Automatic-local-only-2028!'

export type AutomaticSubmissionFixture = {
  complete: { email: string; password: string }
  incomplete: { email: string; password: string }
  tournamentId: string
  originalLockAt: string | null
}

type SeedTeam = {
  id: string
  name: string
  groupIndex: number
  slot: number
}

function parseSeedTeam(id: string, name: string): SeedTeam {
  const match = /^Team ([A-F])([1-4])$/.exec(name)
  if (!match) throw new Error(`Unexpected automatic-submission team: ${name}`)
  return {
    id,
    name,
    groupIndex: match[1].charCodeAt(0) - 'A'.charCodeAt(0),
    slot: Number(match[2]),
  }
}

function predictedScore(home: SeedTeam, away: SeedTeam) {
  const winner = home.slot < away.slot ? home : away
  const loser = winner === home ? away : home
  const pair = [winner.slot, loser.slot].sort((a, b) => a - b).join('-')
  const winningGoals = pair === '3-4' ? winner.groupIndex + 1 : pair === '1-3' ? 3 : 2
  return winner === home
    ? { home: winningGoals, away: 0 }
    : { home: 0, away: winningGoals }
}

async function createUser(
  email: string,
  displayName: string,
): Promise<string> {
  const admin = createLocalAdmin()
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
  if (!created.user) throw new Error(`Automatic-submission user ${email} was not created.`)

  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.user.id,
    display_name: displayName,
    welcomed_at: new Date().toISOString(),
  })
  if (profileError) throw profileError
  return created.user.id
}

export async function prepareAutomaticSubmissionFixture(
  suffix: string,
): Promise<AutomaticSubmissionFixture> {
  const admin = createLocalAdmin()
  const safeSuffix = suffix.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const completeEmail = `auto-complete-${safeSuffix}@euro28.local`
  const incompleteEmail = `auto-incomplete-${safeSuffix}@euro28.local`
  const tournament = await localTournamentSeason()

  const completeUserId = await createUser(completeEmail, 'Auto Complete')
  const incompleteUserId = await createUser(incompleteEmail, 'Auto Incomplete')

  const { data: entries, error: entryError } = await admin
    .from('entries')
    .insert([
      { user_id: completeUserId, tournament_id: tournament.id },
      { user_id: incompleteUserId, tournament_id: tournament.id },
    ])
    .select('id, user_id')
  if (entryError) throw entryError
  const completeEntry = entries?.find((entry) => entry.user_id === completeUserId)
  if (!completeEntry) throw new Error('Complete automatic-submission entry was not created.')

  const { data: teams, error: teamsError } = await admin
    .from('teams')
    .select('id, name')
    .eq('tournament_id', tournament.id)
  if (teamsError) throw teamsError
  const teamsById = new Map(
    (teams ?? []).map((team) => [team.id, parseSeedTeam(team.id, team.name)]),
  )
  const teamsByName = new Map((teams ?? []).map((team) => [team.name, team.id]))

  const { data: matches, error: matchesError } = await admin
    .from('matches')
    .select('id, match_ref, home_team_id, away_team_id')
    .eq('tournament_id', tournament.id)
    .eq('round', 'group')
    .order('match_ref')
  if (matchesError) throw matchesError
  if (!matches || matches.length !== 36) {
    throw new Error(`Automatic-submission fixture expected 36 group matches, found ${matches?.length ?? 0}.`)
  }

  const predictions = matches.map((match) => {
    if (!match.home_team_id || !match.away_team_id) {
      throw new Error(`Group match ${match.match_ref} has unresolved teams.`)
    }
    const home = teamsById.get(match.home_team_id)
    const away = teamsById.get(match.away_team_id)
    if (!home || !away) throw new Error(`Group match ${match.match_ref} has unknown teams.`)
    const score = predictedScore(home, away)
    return {
      entry_id: completeEntry.id,
      match_id: match.id,
      home_score: score.home,
      away_score: score.away,
      joker: false,
      version: 0,
    }
  })

  const { error: predictionError } = await admin
    .from('match_predictions')
    .insert(predictions)
  if (predictionError) throw predictionError

  const progressionNames = [
    ['Team B1', 'champion'],
    ['Team E1', 'final'],
    ['Team F1', 'sf'],
    ['Team C1', 'sf'],
    ['Team A1', 'qf'],
    ['Team D2', 'qf'],
    ['Team A2', 'qf'],
    ['Team D1', 'qf'],
  ] as const
  const progression = progressionNames.map(([teamName, stage]) => {
    const teamId = teamsByName.get(teamName)
    if (!teamId) throw new Error(`Automatic-submission team ${teamName} is missing.`)
    return { entry_id: completeEntry.id, team_id: teamId, stage }
  })

  const { error: progressionError } = await admin
    .from('predicted_progression')
    .insert(progression)
  if (progressionError) throw progressionError

  const processAt = new Date()
  const lockAt = new Date(processAt.getTime() - 10_000)
  const { error: lockError } = await admin
    .from('tournaments')
    .update({ lock_at: lockAt.toISOString() })
    .eq('id', tournament.id)
  if (lockError) throw lockError

  const { error: processError } = await admin.rpc('process_due_entry_submissions', {
    p_now: processAt.toISOString(),
  })
  if (processError) throw processError

  return {
    complete: { email: completeEmail, password: PASSWORD },
    incomplete: { email: incompleteEmail, password: PASSWORD },
    tournamentId: tournament.id,
    originalLockAt: tournament.lockAt,
  }
}

export async function restoreAutomaticSubmissionFixture(
  fixture: AutomaticSubmissionFixture,
): Promise<void> {
  const admin = createLocalAdmin()
  const fallbackFuture = new Date()
  fallbackFuture.setUTCFullYear(fallbackFuture.getUTCFullYear() + 10)
  const { error } = await admin
    .from('tournaments')
    .update({ lock_at: fixture.originalLockAt ?? fallbackFuture.toISOString() })
    .eq('id', fixture.tournamentId)
  if (error) throw error
}
