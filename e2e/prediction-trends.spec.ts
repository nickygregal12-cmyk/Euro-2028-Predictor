import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

const EMAILS = ['trends-a@example.test', 'trends-b@example.test', 'trends-c@example.test']
const PASSWORD = 'Trends-local-only-2028!'

type Fixture = {
  admin: SupabaseClient
  tournamentId: string
  originalLock: string | null
  userIds: string[]
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Prediction trends E2E requires ${name}.`)
  return value
}

async function prepareFixture(): Promise<Fixture> {
  const url = required('E2E_SUPABASE_URL')
  const serviceRoleKey = required('E2E_SUPABASE_SERVICE_ROLE_KEY')
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('Prediction trends fixture refuses non-local Supabase.')
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: tournaments, error: tournamentError } = await admin
    .from('tournaments')
    .select('id, lock_at')
    .order('year')
    .limit(1)
  if (tournamentError) throw tournamentError
  const tournament = tournaments?.[0]
  if (!tournament) throw new Error('Prediction trends fixture found no tournament.')

  const { data: teams, error: teamError } = await admin
    .from('teams')
    .select('id')
    .eq('tournament_id', tournament.id)
    .order('name')
    .limit(4)
  if (teamError) throw teamError
  if (!teams || teams.length < 4) throw new Error('Prediction trends fixture needs four teams.')

  const { data: matches, error: matchError } = await admin
    .from('matches')
    .select('id')
    .eq('tournament_id', tournament.id)
    .eq('round', 'group')
    .order('match_ref')
    .limit(2)
  if (matchError) throw matchError
  if (!matches || matches.length < 2) throw new Error('Prediction trends fixture needs two group matches.')

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listed.error) throw listed.error
  for (const email of EMAILS) {
    const existing = listed.data.users.find((user) => user.email === email)
    if (existing) {
      const removed = await admin.auth.admin.deleteUser(existing.id)
      if (removed.error) throw removed.error
    }
  }

  const userIds: string[] = []
  for (let index = 0; index < EMAILS.length; index += 1) {
    const created = await admin.auth.admin.createUser({
      email: EMAILS[index],
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: `Trend Player ${index + 1}` },
    })
    if (created.error) throw created.error
    if (!created.data.user) throw new Error('Prediction trends fixture user creation returned no user.')
    userIds.push(created.data.user.id)
  }

  const now = new Date().toISOString()
  const profiles = userIds.map((id, index) => ({
    id,
    display_name: `Trend Player ${index + 1}`,
    welcomed_at: now,
  }))
  const profileWrite = await admin.from('profiles').upsert(profiles)
  if (profileWrite.error) throw profileWrite.error

  const entries = userIds.map((userId) => ({
    user_id: userId,
    tournament_id: tournament.id,
    submitted_at: now,
  }))
  const entryWrite = await admin.from('entries').insert(entries).select('id, user_id')
  if (entryWrite.error) throw entryWrite.error
  const entryByUser = new Map((entryWrite.data ?? []).map((entry) => [entry.user_id, entry.id]))

  const scorelines = [
    [[2, 0], [1, 1]],
    [[2, 0], [2, 1]],
    [[0, 1], [1, 1]],
  ]
  const predictionRows = userIds.flatMap((userId, userIndex) => {
    const entryId = entryByUser.get(userId)
    if (!entryId) throw new Error('Prediction trends fixture lost an entry.')
    return matches.map((match, matchIndex) => ({
      entry_id: entryId,
      match_id: match.id,
      home_score: scorelines[userIndex][matchIndex][0],
      away_score: scorelines[userIndex][matchIndex][1],
    }))
  })
  const predictionWrite = await admin.from('match_predictions').insert(predictionRows)
  if (predictionWrite.error) throw predictionWrite.error

  const progressionRows = userIds.flatMap((userId, index) => {
    const entryId = entryByUser.get(userId)
    if (!entryId) throw new Error('Prediction trends fixture lost a progression entry.')
    return [
      { entry_id: entryId, team_id: teams[index === 2 ? 2 : 0].id, stage: 'champion' },
      { entry_id: entryId, team_id: teams[1].id, stage: 'final' },
    ]
  })
  const progressionWrite = await admin.from('predicted_progression').insert(progressionRows)
  if (progressionWrite.error) throw progressionWrite.error

  const pastLock = new Date(Date.now() - 60_000).toISOString()
  const lockWrite = await admin.from('tournaments').update({ lock_at: pastLock }).eq('id', tournament.id)
  if (lockWrite.error) throw lockWrite.error

  return {
    admin,
    tournamentId: tournament.id,
    originalLock: tournament.lock_at,
    userIds,
  }
}

async function removeFixture(fixture: Fixture | null) {
  if (!fixture) return
  const restored = await fixture.admin
    .from('tournaments')
    .update({ lock_at: fixture.originalLock })
    .eq('id', fixture.tournamentId)
  if (restored.error) throw restored.error
  for (const userId of fixture.userIds) {
    const removed = await fixture.admin.auth.admin.deleteUser(userId)
    if (removed.error) throw removed.error
  }
}

let fixture: Fixture | null = null

test.describe('post-lock prediction trends', () => {
  test.beforeAll(async () => {
    fixture = await prepareFixture()
  })

  test.afterAll(async () => {
    await removeFixture(fixture)
    fixture = null
  })

  test('shows bounded consensus without mobile overflow', async ({ page }) => {
    await page.goto('/prediction-trends')
    await expect(page.getByRole('heading', { name: 'Prediction trends' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Champion race' })).toBeVisible()
    await expect(page.getByText(/3 locked entries/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: "The people's final" })).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
