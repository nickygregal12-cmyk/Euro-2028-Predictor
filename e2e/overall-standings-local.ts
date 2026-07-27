import { createLocalAdmin } from './local-supabase'

const PASSWORD = 'Standings-local-only-2028!'
const USER_COUNT = 55

export type OverallStandingsFixture = {
  email: string
  password: string
  displayName: string
  userIds: string[]
}

async function deleteUsers(userIds: string[]): Promise<void> {
  const admin = createLocalAdmin()
  for (const userId of userIds) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) throw error
  }
}

export async function prepareOverallStandingsFixture(
  suffix: string,
): Promise<OverallStandingsFixture> {
  const admin = createLocalAdmin()
  const safeSuffix = suffix.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const prefix = `standings-${safeSuffix}-`

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

  const createdUsers = await Promise.all(
    Array.from({ length: USER_COUNT }, async (_, index) => {
      const number = index + 1
      const displayName = `Scale Player ${String(number).padStart(3, '0')}`
      const email = `${prefix}${String(number).padStart(3, '0')}@euro28.local`
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      })
      if (error) throw error
      if (!data.user) throw new Error(`Standings user ${email} was not created.`)
      return { id: data.user.id, email, displayName, number }
    }),
  )

  try {
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
  } catch (error) {
    await deleteUsers(createdUsers.map((user) => user.id))
    throw error
  }

  const current = createdUsers[USER_COUNT - 1]
  return {
    email: current.email,
    password: PASSWORD,
    displayName: current.displayName,
    userIds: createdUsers.map((user) => user.id),
  }
}

export async function clearOverallStandingsFixture(
  fixture: OverallStandingsFixture,
): Promise<void> {
  await deleteUsers(fixture.userIds)
}
