import { randomUUID } from 'node:crypto'
import { createLocalAdmin, localTournamentSeason } from './local-supabase'

export type LeagueInviteUser = {
  userId: string
  email: string
  password: string
  displayName: string
}

export async function prepareLeagueInviteUser(): Promise<LeagueInviteUser> {
  const admin = createLocalAdmin()
  const suffix = randomUUID()
  const email = `league-invite-${suffix}@euro28.local`
  const password = `League-invite-${suffix}!`
  const displayName = 'Invite Journey Tester'

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) throw createError
  if (!created.user) throw new Error('League invite fixture created no Auth user.')

  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.user.id,
    display_name: displayName,
    welcomed_at: new Date().toISOString(),
  })
  if (profileError) throw profileError

  // Private leagues are game-scoped in contract 66. An invited player must
  // already participate in that exact Original Predictor before join_league is
  // permitted; creating the ordinary entry exercises the canonical membership
  // trigger rather than bypassing the product boundary with a direct membership.
  const tournamentId = (await localTournamentSeason()).id
  const { error: entryError } = await admin.from('entries').insert({
    user_id: created.user.id,
    tournament_id: tournamentId,
  })
  if (entryError) throw entryError

  return {
    userId: created.user.id,
    email,
    password,
    displayName,
  }
}

function isRetryableAuthCleanupError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AuthRetryableFetchError'
  )
}

export async function cleanupLeagueInviteFixture(
  userId: string,
  leagueId: string | null,
): Promise<void> {
  const admin = createLocalAdmin()

  if (leagueId) {
    const { error: leagueError } = await admin.from('leagues').delete().eq('id', leagueId)
    if (leagueError) throw leagueError
  }

  let lastError: unknown
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const cleanupAdmin = createLocalAdmin()
    const { error } = await cleanupAdmin.auth.admin.deleteUser(userId)
    if (!error) return

    lastError = error
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 250))
    }
  }

  // The complete local Supabase stack is destroyed after the browser job. Only
  // a transient GoTrue transport error may fail soft at this final cleanup edge.
  if (isRetryableAuthCleanupError(lastError)) return
  throw lastError
}
