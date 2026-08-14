import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createLocalAdmin } from './local-supabase'

export type PrivatePlayUser = {
  userId: string
  email: string
  password: string
  displayName: string
}

export type PrivateCompetitionRow = {
  id: string
  inviteCode: string
  tournamentId: string
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Private-play E2E requires ${name}.`)
  return value
}

function localBrowserClient() {
  const url = required('E2E_SUPABASE_URL')
  const anonKey = required('VITE_SUPABASE_ANON_KEY')
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error(`Private-play E2E refuses non-local Supabase ${parsed.origin}.`)
  }
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** A welcomed account with deliberately no season entry and no game membership. */
export async function prepareFreshPrivatePlayUser(label: string): Promise<PrivatePlayUser> {
  const admin = createLocalAdmin()
  const suffix = randomUUID()
  const email = `private-${label}-${suffix}@euro28.local`
  const password = `Private-${label}-${suffix}!`
  const displayName = `${label} private-play tester`

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) throw createError
  if (!created.user) throw new Error('Private-play fixture created no Auth user.')

  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.user.id,
    display_name: displayName,
    welcomed_at: new Date().toISOString(),
  })
  if (profileError) throw profileError

  const { count: entries, error: entryError } = await admin
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', created.user.id)
  if (entryError) throw entryError
  if ((entries ?? 0) !== 0) throw new Error('Fresh private-play user unexpectedly owns an entry.')

  return { userId: created.user.id, email, password, displayName }
}

export async function joinPrivateCompetitionAs(
  user: PrivatePlayUser,
  inviteCode: string,
): Promise<string> {
  const client = localBrowserClient()
  const { error: signInError } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (signInError) throw signInError

  const { data, error } = await client.rpc('join_private_competition', {
    p_code: inviteCode,
  })
  if (error) throw error

  const row = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {}
  const id = typeof row.game_competition_id === 'string' ? row.game_competition_id : null
  if (!id) throw new Error('Private competition join returned no competition id.')
  return id
}

export async function findPrivateCompetitionByName(name: string): Promise<PrivateCompetitionRow> {
  const { data, error } = await createLocalAdmin()
    .from('bonus_competitions')
    .select('id, invite_code, tournament_id')
    .eq('visibility_kind', 'private')
    .eq('name', name)
    .single()
  if (error) throw error
  if (!data?.invite_code) throw new Error(`Private competition ${name} has no invite code.`)
  return { id: data.id, inviteCode: data.invite_code, tournamentId: data.tournament_id }
}

/**
 * Contract 180 proof for a Championship-only entrant: the shared prediction
 * entry exists, but no Match Predictor membership was silently manufactured.
 */
export async function assertSharedCardWithoutMainMembership(
  userId: string,
  tournamentId: string,
): Promise<string> {
  const admin = createLocalAdmin()
  const { data: mainGame, error: gameError } = await admin
    .from('bonus_competitions')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('game_key', 'main_predictor')
    .single()
  if (gameError) throw gameError

  const { data: entry, error: entryError } = await admin
    .from('entries')
    .select('id, game_competition_id, game_membership_id')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .single()
  if (entryError) throw entryError
  if (entry.game_competition_id !== mainGame.id || entry.game_membership_id !== null) {
    throw new Error('Shared prediction entry does not preserve the no-membership Contract-180 shape.')
  }

  const { count: memberships, error: membershipError } = await admin
    .from('game_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('game_competition_id', mainGame.id)
  if (membershipError) throw membershipError
  if ((memberships ?? 0) !== 0) {
    throw new Error('Championship-only entrant was silently joined to Match Predictor.')
  }
  return entry.id
}

/**
 * Exercise the real card write as that fresh Championship-only user. This is a
 * browser-environment integration assertion rather than a service-role insert:
 * `save_season_prediction` must accept the authenticated account through the
 * exact shared entry Contract 180 created, while no Match Predictor membership
 * exists. pgTAP 229 separately pins the scorer's member -> entry -> prediction
 * join; this proves a real app-capable account can create the row that join reads.
 */
export async function saveSharedPredictionAs(
  user: PrivatePlayUser,
  tournamentId: string,
): Promise<string> {
  const admin = createLocalAdmin()
  const { data: fixture, error: fixtureError } = await admin
    .from('season_fixtures')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('status', 'scheduled')
    .gt('kickoff_at', new Date().toISOString())
    .order('kickoff_at', { ascending: true })
    .limit(1)
    .single()
  if (fixtureError) throw fixtureError

  const client = localBrowserClient()
  const { error: signInError } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (signInError) throw signInError

  const { data, error } = await client.rpc('save_season_prediction', {
    p_tournament_id: tournamentId,
    p_season_fixture_id: fixture.id,
    p_home: 2,
    p_away: 1,
    p_version: 0,
  })
  if (error) throw error

  const stored = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {}
  if (typeof stored.version !== 'number') {
    throw new Error('Shared-card prediction write returned no stored version.')
  }
  return fixture.id
}

export async function cleanupPrivatePlayUsers(users: readonly PrivatePlayUser[]): Promise<void> {
  for (const user of users) {
    const { error } = await createLocalAdmin().auth.admin.deleteUser(user.userId)
    if (error && error.name !== 'AuthRetryableFetchError') throw error
  }
}
