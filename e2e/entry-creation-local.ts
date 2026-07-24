import { randomUUID } from 'node:crypto'
import { createLocalAdmin } from './local-supabase'

export type EntryRaceUser = {
  userId: string
  tournamentId: string
  email: string
  password: string
}

export async function prepareEntryRaceUser(): Promise<EntryRaceUser> {
  const admin = createLocalAdmin()
  const suffix = randomUUID()
  const email = `entry-race-${suffix}@euro28.local`
  const password = `Entry-race-${suffix}!`

  const { data: tournaments, error: tournamentError } = await admin
    .from('tournaments')
    .select('id')
    .limit(1)
  if (tournamentError) throw tournamentError
  const tournamentId = tournaments?.[0]?.id
  if (!tournamentId) throw new Error('Entry race fixture found no seeded tournament.')

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) throw createError
  if (!created.user) throw new Error('Entry race fixture created no Auth user.')

  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.user.id,
    display_name: 'Entry Race Tester',
    welcomed_at: new Date().toISOString(),
  })
  if (profileError) throw profileError

  return {
    userId: created.user.id,
    tournamentId,
    email,
    password,
  }
}

export async function countRaceEntries(
  userId: string,
  tournamentId: string,
): Promise<number> {
  const admin = createLocalAdmin()
  const { count, error } = await admin
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
  if (error) throw error
  return count ?? 0
}

export async function cleanupEntryRaceUser(userId: string): Promise<void> {
  let lastError: unknown

  // The disposable GoTrue container can briefly reject an admin request while
  // authenticated browser sessions are still closing. Retry only this cleanup
  // boundary; the test assertions and application requests are never retried.
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const admin = createLocalAdmin()
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (!error) return

    lastError = error
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 250))
    }
  }

  throw lastError
}
