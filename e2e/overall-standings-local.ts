import { createLocalAdmin, setLocalOperatingLimits } from './local-supabase'

const PASSWORD = 'Standings-local-only-2028!'
const USER_COUNT = 55
const SCALE_USER_LIMIT = 250
const DEFAULT_USER_LIMIT = 50
const DEFAULT_LEAGUE_LIMIT = 20

type CreatedStandingsUser = {
  id: string
  email: string
  displayName: string
  number: number
}

export type OverallStandingsFixture = {
  email: string
  password: string
  displayName: string
  userIds: string[]
}

function isRetryableAuthError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AuthRetryableFetchError'
  )
}

async function wait(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, attempt * 250))
}

async function deleteUserWithRetry(userId: string): Promise<void> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const { error } = await createLocalAdmin().auth.admin.deleteUser(userId)
    if (!error) return
    lastError = error
    if (!isRetryableAuthError(error) || attempt === 4) break
    await wait(attempt)
  }
  throw lastError
}

async function deleteUsers(userIds: string[]): Promise<void> {
  for (const userId of userIds) await deleteUserWithRetry(userId)
}

async function createStandingsUser(
  email: string,
  displayName: string,
  number: number,
): Promise<CreatedStandingsUser> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const { data, error } = await createLocalAdmin().auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    })
    if (!error && data.user) return { id: data.user.id, email, displayName, number }

    lastError = error ?? new Error(`Standings user ${email} was not created.`)
    if (!isRetryableAuthError(lastError) || attempt === 4) break
    await wait(attempt)
  }
  throw lastError
}

export async function prepareOverallStandingsFixture(
  suffix: string,
): Promise<OverallStandingsFixture> {
  await setLocalOperatingLimits(SCALE_USER_LIMIT, DEFAULT_LEAGUE_LIMIT)

  const admin = createLocalAdmin()
  const safeSuffix = suffix.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const prefix = `standings-${safeSuffix}-`
  const createdUsers: CreatedStandingsUser[] = []

  try {
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    if (listError) throw listError

    const retryUsers = listed.users.filter((user) => user.email?.startsWith(prefix))
    if (retryUsers.length > 0) {
      await deleteUsers(retryUsers.map((user) => user.id))
    }

    const { data: tournament, error: tournamentError } = await admin
      .from('tournaments')
      .select('id')
      .limit(1)
      .single()
    if (tournamentError) throw tournamentError

    // The database deliberately serialises Auth inserts to protect the final
    // public slot. Create this disposable scale fixture serially rather than
    // queuing 55 requests behind the same transaction lock.
    for (let index = 0; index < USER_COUNT; index += 1) {
      const number = index + 1
      const displayName = `Scale Player ${String(number).padStart(3, '0')}`
      const email = `${prefix}${String(number).padStart(3, '0')}@euro28.local`
      createdUsers.push(await createStandingsUser(email, displayName, number))
    }

    const { error: profileError } = await admin.from('profiles').upsert(
      createdUsers.map((user) => ({
        id: user.id,
        display_name: user.displayName,
        welcomed_at: new Date().toISOString(),
      })),
    )
    if (profileError) throw profileError

    const { data: entries, error: entryError } = await admin
      .from('entries')
      .insert(
        createdUsers.map((user) => ({
          user_id: user.id,
          tournament_id: tournament.id,
          submitted_at: new Date().toISOString(),
        })),
      )
      .select('id, user_id')
    if (entryError) throw entryError

    const entryByUser = new Map((entries ?? []).map((entry) => [entry.user_id, entry.id]))
    const { error: scoreError } = await admin.from('score_events').insert(
      createdUsers.map((user) => {
        const entryId = entryByUser.get(user.id)
        if (!entryId) throw new Error(`Standings entry for ${user.email} is missing.`)
        return {
          entry_id: entryId,
          category: 'group_matches',
          points: user.number === USER_COUNT ? -1000 : 1000 - user.number,
          explanation: 'Paginated standings browser fixture',
        }
      }),
    )
    if (scoreError) throw scoreError

    const current = createdUsers[USER_COUNT - 1]
    return {
      email: current.email,
      password: PASSWORD,
      displayName: current.displayName,
      userIds: createdUsers.map((user) => user.id),
    }
  } catch (error) {
    try {
      await deleteUsers(createdUsers.map((user) => user.id))
    } finally {
      await setLocalOperatingLimits(DEFAULT_USER_LIMIT, DEFAULT_LEAGUE_LIMIT)
    }
    throw error
  }
}

export async function clearOverallStandingsFixture(
  fixture: OverallStandingsFixture,
): Promise<void> {
  try {
    await deleteUsers(fixture.userIds)
  } finally {
    await setLocalOperatingLimits(DEFAULT_USER_LIMIT, DEFAULT_LEAGUE_LIMIT)
  }
}
