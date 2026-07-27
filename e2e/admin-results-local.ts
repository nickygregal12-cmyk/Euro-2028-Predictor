import { createLocalAdmin } from './local-supabase'

const ORDINARY_PASSWORD = 'Ordinary-local-only-2028!'

export type OrdinaryUser = {
  id: string
  email: string
  password: string
}

export type PreparedKnockoutFixture = {
  id: string
  matchRef: string
  homeName: string
  awayName: string
  preparedGroupMatchIds: string[]
}

type SeededTeam = {
  id: string
  name: string
  groupIndex: number
  slot: number
}

function parseSeededTeam(id: string, name: string): SeededTeam {
  const match = /^Team ([A-F])([1-4])$/.exec(name)
  if (!match) throw new Error(`Unexpected seeded team name: ${name}`)

  return {
    id,
    name,
    groupIndex: match[1].charCodeAt(0) - 'A'.charCodeAt(0),
    slot: Number(match[2]),
  }
}

function seededGroupScore(
  home: SeededTeam,
  away: SeededTeam,
): { home: number; away: number } {
  if (home.groupIndex !== away.groupIndex) {
    throw new Error(`Seeded group match crosses groups: ${home.name} v ${away.name}`)
  }

  const winner = home.slot < away.slot ? home : away
  const loser = winner === home ? away : home
  const pair = [winner.slot, loser.slot].sort((a, b) => a - b).join('-')
  const winningGoals =
    pair === '3-4' ? winner.groupIndex + 1 : pair === '1-3' ? 3 : 2

  return winner === home
    ? { home: winningGoals, away: 0 }
    : { home: 0, away: winningGoals }
}

export async function prepareOrdinaryUser(suffix: string): Promise<OrdinaryUser> {
  const admin = createLocalAdmin()
  const safeSuffix = suffix.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const email = `e2e-admin-boundary-${safeSuffix}@euro28.local`

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw listError

  const existing = listed.users.find((user) => user.email === email)
  if (existing) {
    const { error } = await admin.auth.admin.deleteUser(existing.id)
    if (error) throw error
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: ORDINARY_PASSWORD,
    email_confirm: true,
  })
  if (createError) throw createError
  if (!created.user) throw new Error('Ordinary E2E user creation returned no user.')

  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.user.id,
    display_name: `Ordinary ${safeSuffix}`,
    welcomed_at: new Date().toISOString(),
  })
  if (profileError) throw profileError

  return { id: created.user.id, email, password: ORDINARY_PASSWORD }
}

export async function deleteOrdinaryUser(userId: string): Promise<void> {
  const { error } = await createLocalAdmin().auth.admin.deleteUser(userId)
  if (error) throw error
}

export async function ensureMatchResultCleared(
  matchRef = 'GA-1',
): Promise<void> {
  const admin = createLocalAdmin()
  const { data: match, error: matchError } = await admin
    .from('matches')
    .select('id, result_state')
    .eq('match_ref', matchRef)
    .single()
  if (matchError) throw matchError
  if (match.result_state === 'scheduled') return

  const { error: clearError } = await admin.rpc('clear_match_result', {
    p_match_id: match.id,
    p_reason: 'E2E cleanup after admin result lifecycle',
  })
  if (clearError) throw clearError
}

async function clearPreparedGroupMatches(matchIds: string[]): Promise<void> {
  const admin = createLocalAdmin()

  for (const matchId of [...matchIds].reverse()) {
    const { data: match, error: readError } = await admin
      .from('matches')
      .select('result_state')
      .eq('id', matchId)
      .single()
    if (readError) throw readError
    if (match.result_state === 'scheduled') continue

    const { error } = await admin.rpc('clear_match_result', {
      p_match_id: matchId,
      p_reason: 'E2E cleanup after actual Round-of-16 preparation',
    })
    if (error) throw error
  }
}

export async function prepareResolvedKnockoutFixture(): Promise<PreparedKnockoutFixture> {
  const admin = createLocalAdmin()
  const { data: target, error: targetError } = await admin
    .from('matches')
    .select('id, match_ref, tournament_id, result_state')
    .eq('match_ref', 'R16-1')
    .single()
  if (targetError) throw targetError
  if (target.result_state !== 'scheduled') {
    throw new Error('The mobile admin fixture must still be scheduled.')
  }

  const { data: teams, error: teamsError } = await admin
    .from('teams')
    .select('id, name')
    .eq('tournament_id', target.tournament_id)
  if (teamsError) throw teamsError
  const teamsById = new Map(
    (teams ?? []).map((team) => [team.id, parseSeededTeam(team.id, team.name)]),
  )

  const { data: groupMatches, error: groupMatchesError } = await admin
    .from('matches')
    .select('id, match_ref, result_state, home_team_id, away_team_id')
    .eq('tournament_id', target.tournament_id)
    .eq('round', 'group')
    .order('match_ref')
  if (groupMatchesError) throw groupMatchesError
  if (!groupMatches || groupMatches.length !== 36) {
    throw new Error(
      `The actual Round-of-16 fixture requires 36 seeded group matches, found ${groupMatches?.length ?? 0}.`,
    )
  }

  const preparedGroupMatchIds: string[] = []

  try {
    for (const match of groupMatches) {
      if (match.result_state !== 'scheduled') continue
      if (!match.home_team_id || !match.away_team_id) {
        throw new Error(`Seeded group match ${match.match_ref} has unresolved teams.`)
      }

      const home = teamsById.get(match.home_team_id)
      const away = teamsById.get(match.away_team_id)
      if (!home || !away) {
        throw new Error(`Seeded group match ${match.match_ref} references an unknown team.`)
      }

      const score = seededGroupScore(home, away)
      const { error } = await admin.rpc('confirm_match_result', {
        p_match_id: match.id,
        p_method: 'regulation',
        p_home_90: score.home,
        p_away_90: score.away,
        p_home_120: null,
        p_away_120: null,
        p_home_penalties: null,
        p_away_penalties: null,
        p_reason: 'E2E actual Round-of-16 preparation',
      })
      if (error) throw error
      preparedGroupMatchIds.push(match.id)
    }

    const { data: resolved, error: resolvedError } = await admin
      .from('matches')
      .select('id, match_ref, home_team_id, away_team_id')
      .eq('id', target.id)
      .single()
    if (resolvedError) throw resolvedError
    if (!resolved.home_team_id || !resolved.away_team_id) {
      throw new Error('Completing the group stage did not populate R16-1.')
    }

    const home = teamsById.get(resolved.home_team_id)
    const away = teamsById.get(resolved.away_team_id)
    if (!home || !away) {
      throw new Error('The populated R16-1 fixture references an unknown team.')
    }

    return {
      id: resolved.id,
      matchRef: resolved.match_ref,
      homeName: home.name,
      awayName: away.name,
      preparedGroupMatchIds,
    }
  } catch (error) {
    await clearPreparedGroupMatches(preparedGroupMatchIds)
    throw error
  }
}

export async function clearPreparedKnockoutFixture(
  fixture: PreparedKnockoutFixture,
): Promise<void> {
  await ensureMatchResultCleared(fixture.matchRef)
  await clearPreparedGroupMatches(fixture.preparedGroupMatchIds)
}
