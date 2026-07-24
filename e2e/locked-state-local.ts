import { createLocalAdmin, prepareCompleteGroupEntry, type PreparedEntry } from './local-supabase'

export const LOCKED_E2E_EMAIL = 'locked-e2e@euro28.local'
export const LOCKED_E2E_PASSWORD = 'Locked-local-only-2028!'
export const LOCKED_E2E_PLAYER = 'Lock Test Striker'
export const LOCKED_E2E_ALTERNATE_PLAYER = 'Lock Test Forward'

export type PreparedLockedStateEntry = PreparedEntry & {
  email: string
  password: string
  playerName: string
  alternatePlayerName: string
  futureLockAt: string
}

async function replaceLockedUser(): Promise<void> {
  const admin = createLocalAdmin()
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw listError

  const existing = listed.users.find((user) => user.email === LOCKED_E2E_EMAIL)
  if (existing) {
    const { error } = await admin.auth.admin.deleteUser(existing.id)
    if (error) throw error
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: LOCKED_E2E_EMAIL,
    password: LOCKED_E2E_PASSWORD,
    email_confirm: true,
  })
  if (createError) throw createError
  if (!created.user) throw new Error('Locked-state browser E2E user creation returned no user.')

  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.user.id,
    display_name: 'Locked E2E Tester',
    welcomed_at: new Date().toISOString(),
  })
  if (profileError) throw profileError
}

async function insertLocalPlayers(tournamentId: string): Promise<void> {
  const admin = createLocalAdmin()
  const { data: teams, error: teamsError } = await admin
    .from('teams')
    .select('id')
    .eq('tournament_id', tournamentId)
    .order('name')
    .limit(2)
  if (teamsError) throw teamsError
  if (!teams || teams.length < 2) {
    throw new Error('Locked-state browser E2E requires at least two seeded teams.')
  }

  const { error: playersError } = await admin.from('players').insert([
    {
      tournament_id: tournamentId,
      team_id: teams[0].id,
      name: LOCKED_E2E_PLAYER,
    },
    {
      tournament_id: tournamentId,
      team_id: teams[1].id,
      name: LOCKED_E2E_ALTERNATE_PLAYER,
    },
  ])
  if (playersError) throw playersError
}

/**
 * Prepare a dedicated entry while the disposable tournament is still unlocked.
 * The scoped environment override reuses the deterministic 36-score fixture and
 * cannot race because Browser E2E runs with one worker.
 */
export async function prepareLockedStateEntry(): Promise<PreparedLockedStateEntry> {
  await replaceLockedUser()

  const previousEmail = process.env.E2E_USER_EMAIL
  process.env.E2E_USER_EMAIL = LOCKED_E2E_EMAIL
  try {
    const prepared = await prepareCompleteGroupEntry()
    const admin = createLocalAdmin()
    const { data: tournament, error: tournamentError } = await admin
      .from('tournaments')
      .select('lock_at')
      .eq('id', prepared.tournamentId)
      .single()
    if (tournamentError) throw tournamentError
    if (!tournament.lock_at) {
      throw new Error('Locked-state browser E2E requires the disposable future lock.')
    }

    await insertLocalPlayers(prepared.tournamentId)

    return {
      ...prepared,
      email: LOCKED_E2E_EMAIL,
      password: LOCKED_E2E_PASSWORD,
      playerName: LOCKED_E2E_PLAYER,
      alternatePlayerName: LOCKED_E2E_ALTERNATE_PLAYER,
      futureLockAt: tournament.lock_at,
    }
  } finally {
    if (previousEmail === undefined) delete process.env.E2E_USER_EMAIL
    else process.env.E2E_USER_EMAIL = previousEmail
  }
}

/** Move only the disposable local tournament lock. createLocalAdmin refuses any hosted URL. */
export async function setDisposableTournamentLock(
  tournamentId: string,
  lockAt: string,
): Promise<void> {
  const admin = createLocalAdmin()
  const { error } = await admin.from('tournaments').update({ lock_at: lockAt }).eq('id', tournamentId)
  if (error) throw error
}
