import { expect, test, type TestInfo } from '@playwright/test'
import {
  createLocalAdmin,
  DEFAULT_E2E_EMAIL,
  localOperatingCounts,
  setLocalOperatingLimits,
} from './local-supabase'

const FIXTURE_CODE = 'CAPFUL'

function desktopOnly(testInfo: TestInfo) {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The operating-cap mutation runs once against the shared disposable stack.',
  )
}

async function fillLeagueCapacity(): Promise<string | null> {
  const counts = await localOperatingCounts()
  if (counts.leagues > 0) {
    await setLocalOperatingLimits(50, counts.leagues)
    return null
  }

  await setLocalOperatingLimits(50, 1)
  const admin = createLocalAdmin()
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (usersError) throw usersError
  const owner = users.users.find(
    (user) => user.email === (process.env.E2E_USER_EMAIL?.trim() || DEFAULT_E2E_EMAIL),
  )
  if (!owner) throw new Error('Operating-cap fixture could not find the E2E owner.')

  const { data: tournament, error: tournamentError } = await admin
    .from('tournaments')
    .select('id')
    .limit(1)
    .single()
  if (tournamentError) throw tournamentError

  const { error: previousError } = await admin
    .from('leagues')
    .delete()
    .eq('invite_code', FIXTURE_CODE)
  if (previousError) throw previousError

  const { data: league, error: leagueError } = await admin
    .from('leagues')
    .insert({
      tournament_id: tournament.id,
      owner_id: owner.id,
      name: 'Operating Cap Fixture',
      invite_code: FIXTURE_CODE,
    })
    .select('id')
    .single()
  if (leagueError) throw leagueError

  const { error: membershipError } = await admin.from('league_members').insert({
    league_id: league.id,
    user_id: owner.id,
    role: 'owner',
  })
  if (membershipError) throw membershipError
  return league.id
}

test('create league shows contact-admin guidance at the total league cap', async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo)
  const fixtureLeagueId = await fillLeagueCapacity()

  try {
    await page.goto('/league')
    await expect(page.getByRole('heading', { name: 'League' })).toBeVisible()
    await page.getByRole('button', { name: /create league/i }).click()

    const dialog = page.getByRole('dialog', { name: 'Create a league' })
    await dialog.getByLabel('League name').fill('Rejected Capacity League')
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(dialog.getByText('League limit reached. Contact admin.', { exact: true })).toBeVisible({
      timeout: 15_000,
    })
  } finally {
    if (fixtureLeagueId) {
      const { error } = await createLocalAdmin().from('leagues').delete().eq('id', fixtureLeagueId)
      if (error) throw error
    }
    await setLocalOperatingLimits(50, 20)
  }
})
