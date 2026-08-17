import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { expectNoSeriousAxeViolations } from './axe-scan'
import { localTournamentSeason } from './local-supabase'

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
  const tournament = await localTournamentSeason()

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

  // Each project/retry receives fresh identities. Ten submitted fixture entries
  // guarantee that the tournament-wide aggregate clears the privacy threshold,
  // regardless of the disposable seed's existing entries.
  const suffix = randomUUID()
  const emails = Array.from(
    { length: 10 },
    (_, index) => `trends-${suffix}-${index + 1}@example.test`,
  )
  const userIds: string[] = []
  for (let index = 0; index < emails.length; index += 1) {
    const email = emails[index]
    if (email === undefined) throw new Error('Prediction trends fixture lost an email.')
    const created = await admin.auth.admin.createUser({
      email,
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
    const selectedScorelines = scorelines[userIndex % scorelines.length]
    if (!selectedScorelines) throw new Error('Prediction trends fixture lost a scoreline set.')
    return matches.map((match, matchIndex) => {
      const scoreline = selectedScorelines[matchIndex]
      if (!scoreline) throw new Error('Prediction trends fixture lost a scoreline.')
      return {
        entry_id: entryId,
        match_id: match.id,
        home_score: scoreline[0],
        away_score: scoreline[1],
      }
    })
  })
  const predictionWrite = await admin.from('match_predictions').insert(predictionRows)
  if (predictionWrite.error) throw predictionWrite.error

  const progressionRows = userIds.flatMap((userId, index) => {
    const entryId = entryByUser.get(userId)
    if (!entryId) throw new Error('Prediction trends fixture lost a progression entry.')
    const champion = teams[index % 3 === 2 ? 2 : 0]
    const finalist = teams[1]
    if (!champion || !finalist) throw new Error('Prediction trends fixture lost a team.')
    return [
      { entry_id: entryId, team_id: champion.id, stage: 'champion' },
      { entry_id: entryId, team_id: finalist.id, stage: 'final' },
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
    originalLock: tournament.lockAt,
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

  // Auth can briefly stop accepting admin requests during Playwright worker
  // teardown. User removal is best-effort because the entire database is
  // disposable and deleted by the workflow immediately after this suite.
  for (const userId of fixture.userIds) {
    try {
      await fixture.admin.auth.admin.deleteUser(userId)
    } catch {
      // Disposable local teardown remains the authoritative cleanup boundary.
    }
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

    const crowdSummary = page.getByText(/locked entries? in this view/i).locator('xpath=..')
    await expect(crowdSummary).toBeVisible()
    const crowdText = await crowdSummary.textContent()
    const submittedEntries = Number.parseInt(crowdText?.match(/\d+/)?.[0] ?? '0', 10)
    expect(submittedEntries).toBeGreaterThanOrEqual(10)

    await expect(page.getByRole('heading', { name: "The people's final" })).toBeVisible()

    // The route scan reaches `/prediction-trends` before the lock, where there
    // is no consensus to show. This is the page with data on it: the champion
    // race, the crowd summary and the goal distribution. `.distribution` is the
    // element whose prohibited `aria-label` was fixed on 31 July 2026 from a
    // static sweep — it renders only here, so this is the first scan that has
    // ever seen it.
    await expectNoSeriousAxeViolations(page, '/prediction-trends')

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
