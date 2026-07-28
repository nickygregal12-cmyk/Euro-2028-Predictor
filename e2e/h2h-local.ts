import { createLocalAdmin, DEFAULT_E2E_EMAIL } from './local-supabase'

const PASSWORD = 'H2h-surface-local-2028!'
const INVITE_CODE = 'H2H001'
const RIVAL_POINTS = 37
const RIVAL_RANK = 2

export type H2HSurfaceFixture = {
  leagueId: string
  leagueName: string
  rivalId: string
  rivalDisplayName: string
  rivalPoints: number
  rivalRank: number
  tournamentId: string
  originalLockAt: string | null
}

function safeSuffix(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)
}

async function deleteUserIfPresent(email: string): Promise<void> {
  const admin = createLocalAdmin()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  const existing = data.users.find((user) => user.email === email)
  if (!existing) return
  const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id)
  if (deleteError) throw deleteError
}

async function setTournamentLock(
  tournamentId: string,
  lockAt: string | null,
): Promise<void> {
  const { error } = await createLocalAdmin()
    .from('tournaments')
    .update({ lock_at: lockAt })
    .eq('id', tournamentId)
  if (error) throw error
}

export async function lockH2HSurfaceFixture(fixture: H2HSurfaceFixture): Promise<void> {
  await setTournamentLock(
    fixture.tournamentId,
    new Date(Date.now() - 60_000).toISOString(),
  )
}

export async function prepareH2HSurfaceFixture(suffix: string): Promise<H2HSurfaceFixture> {
  const admin = createLocalAdmin()
  const label = safeSuffix(suffix)
  const rivalEmail = `h2h-${label}@euro28.local`
  const rivalDisplayName = `H2H Rival ${label.slice(0, 12)}`
  const leagueName = `H2H Surface ${label.slice(0, 16)}`
  let rivalId: string | null = null
  let leagueId: string | null = null
  let tournamentId: string | null = null
  let originalLockAt: string | null = null

  try {
    const { error: staleLeagueError } = await admin
      .from('leagues')
      .delete()
      .eq('invite_code', INVITE_CODE)
    if (staleLeagueError) throw staleLeagueError

    await deleteUserIfPresent(rivalEmail)

    const defaultEmail = process.env.E2E_USER_EMAIL?.trim() || DEFAULT_E2E_EMAIL
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    if (listError) throw listError
    const caller = listed.users.find((user) => user.email === defaultEmail)
    if (!caller) throw new Error(`H2H fixture found no E2E user ${defaultEmail}.`)

    const { data: tournament, error: tournamentError } = await admin
      .from('tournaments')
      .select('id, lock_at')
      .limit(1)
      .single()
    if (tournamentError) throw tournamentError
    tournamentId = tournament.id
    originalLockAt = tournament.lock_at

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: rivalEmail,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: rivalDisplayName },
    })
    if (createError) throw createError
    if (!created.user) throw new Error('H2H rival creation returned no user.')
    rivalId = created.user.id

    const { error: profileError } = await admin.from('profiles').upsert({
      id: rivalId,
      display_name: rivalDisplayName,
      welcomed_at: new Date().toISOString(),
    })
    if (profileError) throw profileError

    const { data: league, error: leagueError } = await admin
      .from('leagues')
      .insert({
        tournament_id: tournamentId,
        owner_id: rivalId,
        name: leagueName,
        invite_code: INVITE_CODE,
      })
      .select('id')
      .single()
    if (leagueError) throw leagueError
    leagueId = league.id

    const { error: membershipError } = await admin.from('league_members').insert([
      {
        league_id: leagueId,
        user_id: rivalId,
        role: 'owner',
      },
      {
        league_id: leagueId,
        user_id: caller.id,
        role: 'member',
      },
    ])
    if (membershipError) throw membershipError

    const { data: entry, error: entryError } = await admin
      .from('entries')
      .insert({
        user_id: rivalId,
        tournament_id: tournamentId,
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (entryError) throw entryError

    const { error: scoreError } = await admin.from('score_events').insert({
      entry_id: entry.id,
      category: 'group_matches',
      points: RIVAL_POINTS,
      explanation: 'H2H surface browser fixture',
    })
    if (scoreError) throw scoreError

    const { error: historyError } = await admin.from('rank_history').insert({
      user_id: rivalId,
      tournament_id: tournamentId,
      matchday_key: 'MD1',
      matchday_ord: 1,
      rank: RIVAL_RANK,
      total_points: RIVAL_POINTS,
      captured_at: new Date().toISOString(),
    })
    if (historyError) throw historyError

    await setTournamentLock(
      tournamentId,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    )

    return {
      leagueId,
      leagueName,
      rivalId,
      rivalDisplayName,
      rivalPoints: RIVAL_POINTS,
      rivalRank: RIVAL_RANK,
      tournamentId,
      originalLockAt,
    }
  } catch (error) {
    if (leagueId) await admin.from('leagues').delete().eq('id', leagueId)
    if (rivalId) await admin.auth.admin.deleteUser(rivalId)
    if (tournamentId) await setTournamentLock(tournamentId, originalLockAt)
    throw error
  }
}

export async function clearH2HSurfaceFixture(fixture: H2HSurfaceFixture): Promise<void> {
  const admin = createLocalAdmin()
  try {
    const { error: leagueError } = await admin.from('leagues').delete().eq('id', fixture.leagueId)
    if (leagueError) throw leagueError

    const { error: userError } = await admin.auth.admin.deleteUser(fixture.rivalId)
    if (userError) throw userError
  } finally {
    await setTournamentLock(fixture.tournamentId, fixture.originalLockAt)
  }
}
