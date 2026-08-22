import { createClient } from '@supabase/supabase-js'
import baseGlobalSetup from './global-setup'

const LOCAL_SUPABASE_PORT = '54321'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Shipping vNext E2E requires ${name}.`)
  return value
}

/**
 * THE PLAYER WORLD THE SHIPPING-VNEXT JOURNEYS NEED.
 *
 * The ordinary global setup deliberately seeds the historical Euro tournament
 * entry and nothing about the weekly player's league choices. That is correct
 * for the broad retained suite and insufficient for the release question this
 * suite asks: can a real Football Hub player leave Account/Explore and get back
 * into their active/relevant competition, and can they switch between two?
 *
 * This shipping-only layer therefore does four local-only things after the
 * canonical identities exist:
 *
 *  1. keep Scottish Premiership as the playable season from the shared fixture;
 *  2. publish the otherwise-draft Premier League ONLY in disposable local DB,
 *     giving the switcher a second real catalogue entry without changing a
 *     repository or hosted lifecycle;
 *  3. follow both through the authenticated `set_competition_follow` RPC and
 *     join the public Scottish Match Predictor through `join_competition_game`;
 *  4. save the three current-matchweek predictions through the real
 *     `save_season_prediction` RPC.
 *
 * The membership makes Scottish Premiership deterministically the first item in
 * `player.mine`: the product's own relevance sorter puts a competition the
 * player actually plays ahead of one they only follow. Saving the open card
 * makes that same player genuinely CAUGHT UP, so Home's own model reaches the
 * `Find a league` action because they have no outstanding picks and no private
 * Match Predictor league — not because the test injected a presentation model.
 *
 * It does NOT insert preference rows, game memberships or predictions by
 * service role. Those user facts all go through their application RPCs.
 */
export default async function shippingVNextGlobalSetup() {
  await baseGlobalSetup()

  const url = required('E2E_SUPABASE_URL')
  const serviceRoleKey = required('E2E_SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = required('VITE_SUPABASE_ANON_KEY')
  const email = required('E2E_USER_EMAIL')
  const password = required('E2E_USER_PASSWORD')

  const parsed = new URL(url)
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.port !== LOCAL_SUPABASE_PORT
  ) {
    throw new Error(`Shipping vNext E2E refuses non-local Supabase ${parsed.origin}.`)
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: seasons, error: seasonsError } = await admin
    .from('tournaments')
    .select('id, name, status')
    .in('name', ['Scottish Premiership 2026/27', 'Premier League 2026/27'])
  if (seasonsError) throw seasonsError

  const scottish = seasons?.find((season) => season.name === 'Scottish Premiership 2026/27')
  const premier = seasons?.find((season) => season.name === 'Premier League 2026/27')
  if (!scottish || !premier) {
    throw new Error('Shipping vNext E2E requires both domestic league-season rows.')
  }

  if (scottish.status !== 'active') {
    throw new Error(`Shipping vNext E2E expected Scottish season active; found ${scottish.status}.`)
  }

  const { error: publishError } = await admin
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', premier.id)
  if (publishError) throw publishError

  const { data: mainGame, error: mainGameError } = await admin
    .from('bonus_competitions')
    .select('id')
    .eq('tournament_id', scottish.id)
    .eq('game_key', 'main_predictor')
    .eq('visibility_kind', 'public')
    .single()
  if (mainGameError) throw mainGameError

  const player = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInError } = await player.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  for (const tournamentId of [scottish.id, premier.id]) {
    const { error } = await player.rpc('set_competition_follow', {
      p_tournament_id: tournamentId,
      p_following: true,
      p_favourite_team_id: null,
    })
    if (error) throw error
  }

  const { error: joinError } = await player.rpc('join_competition_game', {
    p_game_competition_id: mainGame.id,
  })
  if (joinError) throw joinError

  const { data: openFixtures, error: fixturesError } = await admin
    .from('season_fixtures')
    .select('id, competition_round_id, kickoff_at')
    .eq('tournament_id', scottish.id)
    .eq('status', 'scheduled')
    .order('kickoff_at', { ascending: true })
    .limit(3)
  if (fixturesError) throw fixturesError
  if ((openFixtures ?? []).length !== 3) {
    throw new Error('Shipping vNext E2E expected three fixtures in the open Scottish matchweek.')
  }

  const [first] = openFixtures ?? []
  if (!first) throw new Error('Shipping vNext E2E found no open Scottish fixture.')
  if (!(openFixtures ?? []).every((fixture) => fixture.competition_round_id === first.competition_round_id)) {
    throw new Error('Shipping vNext E2E first three fixtures do not form one matchweek.')
  }

  for (const [index, fixture] of (openFixtures ?? []).entries()) {
    const { error } = await player.rpc('save_season_prediction', {
      p_tournament_id: scottish.id,
      p_season_fixture_id: fixture.id,
      p_home: index === 1 ? 1 : 2,
      p_away: index === 1 ? 1 : 0,
      p_version: 0,
    })
    if (error) throw error
  }

  await player.auth.signOut()
}