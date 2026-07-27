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

export async function prepareResolvedKnockoutFixture(): Promise<PreparedKnockoutFixture> {
  const admin = createLocalAdmin()
  const { data: match, error: matchError } = await admin
    .from('matches')
    .select('id, match_ref, tournament_id, result_state')
    .eq('match_ref', 'R16-1')
    .single()
  if (matchError) throw matchError
  if (match.result_state !== 'scheduled') {
    throw new Error('The mobile admin fixture must still be scheduled.')
  }

  const { data: teams, error: teamsError } = await admin
    .from('teams')
    .select('id, name')
    .eq('tournament_id', match.tournament_id)
    .order('name')
    .limit(2)
  if (teamsError) throw teamsError
  if (!teams || teams.length !== 2) {
    throw new Error('The mobile admin fixture requires two seeded teams.')
  }

  const { error: updateError } = await admin
    .from('matches')
    .update({
      home_team_id: teams[0].id,
      away_team_id: teams[1].id,
    })
    .eq('id', match.id)
  if (updateError) throw updateError

  return {
    id: match.id,
    matchRef: match.match_ref,
    homeName: teams[0].name,
    awayName: teams[1].name,
  }
}

export async function clearPreparedKnockoutFixture(matchId: string): Promise<void> {
  const { error } = await createLocalAdmin()
    .from('matches')
    .update({ home_team_id: null, away_team_id: null })
    .eq('id', matchId)
  if (error) throw error
}
