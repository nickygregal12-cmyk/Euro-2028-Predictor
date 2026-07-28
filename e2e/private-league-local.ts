import { createLocalAdmin, DEFAULT_E2E_EMAIL, setLocalOperatingLimits } from './local-supabase'

const PASSWORD = 'Private-league-local-2028!'
const SYNTHETIC_USER_COUNT = 55
const SCALE_USER_LIMIT = 250
const DEFAULT_USER_LIMIT = 50
const DEFAULT_LEAGUE_LIMIT = 20
const INVITE_CODE = 'PLPAGE'
const CANDIDATE_NUMBER = 10

export type PrivateLeagueFixture = {
  leagueId: string
  leagueName: string
  memberDisplayName: string
  ownerEmail: string
  ownerPassword: string
  ownerDisplayName: string
  candidateDisplayName: string
  h2hRivalId: string
  h2hRivalDisplayName: string
  tournamentId: string
  originalLockAt: string | null
  syntheticUserIds: string[]
}

type CreatedUser = {
  id: string
  email: string
  displayName: string
  number: number
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

async function createUser(email: string, displayName: string, number: number): Promise<CreatedUser> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const { data, error } = await createLocalAdmin().auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    })
    if (!error && data.user) return { id: data.user.id, email, displayName, number }
    lastError = error ?? new Error(`Private-league user ${email} was not created.`)
    if (!isRetryableAuthError(lastError) || attempt === 4) break
    await wait(attempt)
  }
  throw lastError
}

async function deleteUser(userId: string): Promise<void> {
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
  for (const userId of userIds) await deleteUser(userId)
}

export async function preparePrivateLeagueFixture(suffix: string): Promise<PrivateLeagueFixture> {
  await setLocalOperatingLimits(SCALE_USER_LIMIT, DEFAULT_LEAGUE_LIMIT)

  const admin = createLocalAdmin()
  const safeSuffix = suffix.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const emailPrefix = `private-league-${safeSuffix}-`
  // Keep generated fixture names beneath the authoritative league-name limit,
  // including Playwright retry/project suffixes that can be unexpectedly long.
  const leagueName = `PL Scale ${safeSuffix.slice(0, 20)}`
  const createdUsers: CreatedUser[] = []
  let leagueId: string | null = null
  let tournamentId: string | null = null
  let originalLockAt: string | null = null

  try {
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    if (listError) throw listError

    const staleUsers = listed.users.filter((user) => user.email?.startsWith(emailPrefix))
    if (staleUsers.length > 0) await deleteUsers(staleUsers.map((user) => user.id))

    const defaultEmail = process.env.E2E_USER_EMAIL?.trim() || DEFAULT_E2E_EMAIL
    const defaultUser = listed.users.find((user) => user.email === defaultEmail)
    if (!defaultUser) throw new Error(`Private-league fixture found no E2E user ${defaultEmail}.`)

    const { data: tournament, error: tournamentError } = await admin
      .from('tournaments')
      .select('id, lock_at')
      .limit(1)
      .single()
    if (tournamentError) throw tournamentError
    tournamentId = tournament.id
    originalLockAt = tournament.lock_at

    const { error: oldLeagueError } = await admin.from('leagues').delete().eq('invite_code', INVITE_CODE)
    if (oldLeagueError) throw oldLeagueError

    for (let index = 0; index < SYNTHETIC_USER_COUNT; index += 1) {
      const number = index + 1
      const displayName =
        number === 1
          ? 'Private League Owner'
          : number === CANDIDATE_NUMBER
            ? 'Ownership Candidate'
            : `Private League Player ${String(number).padStart(3, '0')}`
      const email = `${emailPrefix}${String(number).padStart(3, '0')}@euro28.local`
      createdUsers.push(await createUser(email, displayName, number))
    }

    const { error: profileError } = await admin.from('profiles').upsert(
      createdUsers.map((user) => ({
        id: user.id,
        display_name: user.displayName,
        welcomed_at: new Date().toISOString(),
      })),
    )
    if (profileError) throw profileError

    const owner = createdUsers[0]
    const { data: league, error: leagueError } = await admin
      .from('leagues')
      .insert({
        tournament_id: tournament.id,
        owner_id: owner.id,
        name: leagueName,
        invite_code: INVITE_CODE,
      })
      .select('id')
      .single()
    if (leagueError) throw leagueError
    leagueId = league.id

    const joinedBase = Date.now() - 60_000
    const { error: memberError } = await admin.from('league_members').insert([
      ...createdUsers.map((user, index) => ({
        league_id: league.id,
        user_id: user.id,
        role: user.id === owner.id ? 'owner' : 'member',
        joined_at: new Date(joinedBase + index * 1000).toISOString(),
      })),
      {
        league_id: league.id,
        user_id: defaultUser.id,
        role: 'member',
        joined_at: new Date(joinedBase + SYNTHETIC_USER_COUNT * 1000).toISOString(),
      },
    ])
    if (memberError) throw memberError

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
        if (!entryId) throw new Error(`Private-league entry for ${user.email} is missing.`)
        return {
          entry_id: entryId,
          category: 'group_matches',
          points: 1000 - user.number,
          explanation: 'Private league pagination browser fixture',
        }
      }),
    )
    if (scoreError) throw scoreError

    const lockedAt = new Date(Date.now() - 10_000).toISOString()
    const { error: lockError } = await admin
      .from('tournaments')
      .update({ lock_at: lockedAt })
      .eq('id', tournament.id)
    if (lockError) throw lockError

    const candidate = createdUsers.find((user) => user.number === CANDIDATE_NUMBER)
    if (!candidate) throw new Error('Private-league ownership candidate is missing.')
    const h2hRival = createdUsers[1]
    if (!h2hRival) throw new Error('Private-league H2H rival is missing.')

    return {
      leagueId: league.id,
      leagueName,
      memberDisplayName: 'E2E Tester',
      ownerEmail: owner.email,
      ownerPassword: PASSWORD,
      ownerDisplayName: owner.displayName,
      candidateDisplayName: candidate.displayName,
      h2hRivalId: h2hRival.id,
      h2hRivalDisplayName: h2hRival.displayName,
      tournamentId: tournament.id,
      originalLockAt: tournament.lock_at,
      syntheticUserIds: createdUsers.map((user) => user.id),
    }
  } catch (error) {
    try {
      if (leagueId) await admin.from('leagues').delete().eq('id', leagueId)
      await deleteUsers(createdUsers.map((user) => user.id))
    } finally {
      if (tournamentId) {
        const { error: restoreError } = await admin
          .from('tournaments')
          .update({ lock_at: originalLockAt })
          .eq('id', tournamentId)
        if (restoreError) throw restoreError
      }
      await setLocalOperatingLimits(DEFAULT_USER_LIMIT, DEFAULT_LEAGUE_LIMIT)
    }
    throw error
  }
}

export async function clearPrivateLeagueFixture(fixture: PrivateLeagueFixture): Promise<void> {
  const admin = createLocalAdmin()
  try {
    const { error: leagueError } = await admin.from('leagues').delete().eq('id', fixture.leagueId)
    if (leagueError) throw leagueError
    await deleteUsers(fixture.syntheticUserIds)
  } finally {
    const { error: restoreError } = await admin
      .from('tournaments')
      .update({ lock_at: fixture.originalLockAt })
      .eq('id', fixture.tournamentId)
    if (restoreError) throw restoreError
    await setLocalOperatingLimits(DEFAULT_USER_LIMIT, DEFAULT_LEAGUE_LIMIT)
  }
}
