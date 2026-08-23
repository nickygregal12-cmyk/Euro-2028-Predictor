// Dev seed runner (see README.md in this folder).
//
//   npx tsx scripts/seed-dev/index.ts            # dry run: generate + score +
//                                                #   print, writes NOTHING
//   SEED_DEV=i-understand \
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//   npx tsx scripts/seed-dev/index.ts --commit   # write to the DEV database
//
// Add --scenario=<standard|contested|sparse> to seed a named hostile state
// (scenarios.ts). Omitted means `standard`, which is the behaviour above.
//
// Dry run is the default so an accidental run is harmless. Committing is
// fail-closed (scripts/seed-dev/seedPolicy.ts) and idempotent (it deletes any
// prior seed users first, identified by their @seed.euro28.test email domain).
//
// This is a DEV-ONLY tool. It must never run against a production project — the
// guard refuses if SEED_DEV isn't acknowledged or the target matches
// SUPABASE_PROD_URL. It relies on the tournament being in the future (nothing
// locked yet), so predictions and jokers write freely; the "mid-tournament" is
// simulated purely by entering ~12 results.

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildFixture } from './fixture'
import { generateSeedData, SEED_EMAIL_DOMAIN, type GeneratedEntry } from './generate'
import { rankScored, scoreEntries } from './scoreEntries'
import {
  applyScenario,
  readScenario,
  SCENARIOS,
  submittedOnly,
  type ScenarioName,
} from './scenarios'
import { evaluateSeedPolicy } from './seedPolicy'

// A loosely-typed admin client (default generics). The seed writes to a handful
// of tables by name and reads a few columns, so the untyped surface is fine and
// avoids threading a generated Database type into a dev-only script.
type Admin = SupabaseClient

const SEED_USER_PASSWORD = 'seed-user-euro28!'

function printDryRun(scenario: ScenarioName): void {
  const fixture = buildFixture()
  const data = applyScenario(fixture, generateSeedData(fixture), scenario)
  // Ranked from the SUBMITTED entries only, because that is what the database
  // ranks from. A dry run that disagrees with the seeded app is worse than no
  // dry run — it is a confident wrong answer.
  const scored = rankScored(scoreEntries(fixture, submittedOnly(data)))

  console.log('\nDEV SEED — DRY RUN (nothing written)\n')
  console.log(`Scenario: ${scenario} — ${SCENARIOS[scenario].summary}\n`)
  console.log(
    `${data.entries.length} test users · ${data.results.length} results entered · ` +
      `${fixture.matches.length} group matches in the fixture\n`,
  )

  console.log('Overall standings — submitted entries (group-match points so far):')
  for (const e of scored) {
    const rank = String(e.rank).padStart(2, ' ')
    const total = String(e.total).padStart(4, ' ')
    console.log(`  ${rank}. ${total}   ${e.displayName}`)
  }

  // Show one entry's Points breakdown to prove the pipeline end-to-end. Absent
  // only if the fixture scored nobody, in which case there is no breakdown to
  // print and the dry run says so rather than reporting an empty one.
  const sample = scored[0]
  if (sample === undefined) {
    console.log('\nNo scored entries, so there is no sample breakdown to show.')
  } else {
    console.log(`\nSample breakdown — ${sample.displayName} (total ${sample.total}):`)
    for (const ev of sample.events.slice(0, 8)) {
      const pts = ev.joker ? `2× +${ev.points}` : `+${ev.points}`
      console.log(`  ${pts.padStart(7, ' ')}  ${ev.explanation}`)
    }
    if (sample.events.length > 8) console.log(`  … ${sample.events.length - 8} more`)
  }

  const unsubmitted = data.entries.filter((entry) => !entry.submitted)
  if (unsubmitted.length > 0) {
    console.log(
      `\n${unsubmitted.length} of ${data.entries.length} entries were never submitted: ` +
        unsubmitted.map((entry) => entry.displayName).join(', '),
    )
  }

  const best = scored[0]
  if (best !== undefined) {
    const level = scored.filter((entry) => entry.total === best.total)
    if (level.length > 1) {
      console.log(
        `\nLevel at the top on ${best.total}: ` +
          level.map((entry) => entry.displayName).join(' and '),
      )
    }
  }

  console.log(
    '\nCommitting also creates "The Seed Test League" (code SEEDLG) owned by the ' +
      'first seed user with ~8 members, so the League detail page renders populated.',
  )
  const extraPools = SCENARIOS[scenario].extraPoolSizes
  if (extraPools.length > 0) {
    console.log(
      `It also creates ${extraPools.length} smaller pool(s) of ` +
        `${extraPools.join(' and ')} member(s), the sizes at which a leaderboard stops ` +
        'meaning anything.',
    )
  }
  console.log('\nRe-run with --commit (and the dev env vars) to write this to the database.\n')
}

async function commit(scenario: ScenarioName): Promise<void> {
  const { url, serviceKey } = evaluateSeedPolicy(process.env)

  // Imported lazily so the dry-run path never touches the network layer.
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as Admin

  const fixture = buildFixture()
  const data = applyScenario(fixture, generateSeedData(fixture), scenario)

  // --- resolve the real reference data by stable references -----------------
  const { data: tournament, error: tErr } = await admin
    .from('tournaments')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  if (tErr || !tournament) throw new Error(`No tournament found — apply supabase/seed.sql first. ${tErr?.message ?? ''}`)
  const tournamentId = tournament.id as string

  const { data: groups } = await admin.from('groups').select('id, letter').eq('tournament_id', tournamentId)
  const groupIdByLetter = new Map((groups ?? []).map((g) => [g.letter as string, g.id as string]))

  const { data: groupTeams } = await admin
    .from('group_teams')
    .select('slot, team_id, group_id')
  // group_id → letter, then (letter, slot) → team_id
  const letterByGroupId = new Map([...groupIdByLetter].map(([letter, id]) => [id, letter]))
  const teamIdByRef = new Map<string, string>()
  for (const gt of groupTeams ?? []) {
    const letter = letterByGroupId.get(gt.group_id as string)
    if (letter) teamIdByRef.set(`${letter}${gt.slot}`, gt.team_id as string)
  }

  const { data: matches } = await admin
    .from('matches')
    .select('id, match_ref')
    .eq('tournament_id', tournamentId)
  const matchIdByRef = new Map((matches ?? []).map((m) => [m.match_ref as string, m.id as string]))

  // --- idempotent wipe: delete any prior seed users -------------------------
  const seedUserIds = await listSeedUserIds(admin)
  if (seedUserIds.length > 0) {
    // Delete every APP row referencing the seed users FIRST, so the auth-API
    // user delete below only removes a BARE auth.users row. Postgres cascades a
    // full entry fine via direct SQL, but GoTrue's admin deleteUser 500s
    // (AuthRetryableFetchError, masked as an empty {}) when it has to cascade a
    // whole entry chain per user — it appears to time out on the cascade.
    // Clearing the rows here via the service client sidesteps that entirely.
    //
    // Order matters. leagues.owner_id is ON DELETE RESTRICT (a user who still
    // owns a league can't be deleted — 20260720120000_league_fk_semantics.sql),
    // so seed-owned leagues go first (this cascades their memberships too); then
    // any remaining memberships; then the entries chain (cascades
    // match_predictions, predicted_*, bonus_predictions, score_events); then
    // profiles. The league tables are best-effort (may not exist on an older DB);
    // entries + profiles always exist.
    const { error: leaguesErr } = await admin.from('leagues').delete().in('owner_id', seedUserIds)
    if (leaguesErr && !isMissingRelation(leaguesErr)) {
      throw new Error(`Failed to clear prior seed-owned leagues: ${describeError(leaguesErr)}`)
    }
    const { error: membersErr } = await admin
      .from('league_members')
      .delete()
      .in('user_id', seedUserIds)
    if (membersErr && !isMissingRelation(membersErr)) {
      throw new Error(`Failed to clear prior seed league memberships: ${describeError(membersErr)}`)
    }
    const { error: entriesErr } = await admin.from('entries').delete().in('user_id', seedUserIds)
    if (entriesErr) {
      throw new Error(`Failed to clear prior seed entries: ${describeError(entriesErr)}`)
    }
    const { error: profilesErr } = await admin.from('profiles').delete().in('id', seedUserIds)
    if (profilesErr) {
      throw new Error(`Failed to clear prior seed profiles: ${describeError(profilesErr)}`)
    }

    for (const id of seedUserIds) {
      // The user is bare now (all app rows removed above), so this only removes
      // the auth.users row — no heavy cascade for the auth API to choke on.
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) throw new Error(`Failed to delete prior seed user ${id}: ${describeError(error)}`)
    }
  }
  console.log(`Removed ${seedUserIds.length} prior seed user(s).`)

  // --- write each entry ------------------------------------------------------
  const stageToDb: Record<string, string> = {
    R16: 'r16',
    QF: 'qf',
    SF: 'sf',
    FINAL: 'final',
    CHAMPION: 'champion',
  }

  const seededUsers: { userId: string; displayName: string }[] = []
  for (const entry of data.entries) {
    const userId = await createUser(admin, entry)
    seededUsers.push({ userId, displayName: entry.displayName })
    // Upsert, not insert: once the on_auth_user_created trigger
    // (20260720190000) is applied, createUser already creates the profiles row
    // from user_metadata.display_name, so a plain insert would conflict. Upsert
    // works whether or not that migration is applied.
    const { error: profErr } = await admin
      .from('profiles')
      .upsert({ id: userId, display_name: entry.displayName }, { onConflict: 'id' })
    if (profErr) throw new Error(`profiles upsert failed for ${entry.email}: ${describeError(profErr)}`)

    const { data: entryRow, error: eErr } = await admin
      .from('entries')
      .insert({
        user_id: userId,
        tournament_id: tournamentId,
        // A non-submitter keeps a full set of drafted predictions and simply
        // never pressed the button, which is the state under review.
        submitted_at: entry.submitted ? new Date().toISOString() : null,
      })
      .select('id')
      .single()
    if (eErr || !entryRow) throw new Error(`entry insert failed for ${entry.email}: ${eErr?.message}`)
    const entryId = entryRow.id as string

    await insertOrThrow(
      admin,
      'match_predictions',
      entry.groupMatches.map((m) => ({
        entry_id: entryId,
        match_id: matchIdByRef.get(m.matchRef),
        home_score: m.homeScore,
        away_score: m.awayScore,
        joker: m.joker,
      })),
    )

    await insertOrThrow(
      admin,
      'predicted_group_positions',
      entry.groupOrders.flatMap((go) =>
        go.order.map((slot, i) => ({
          entry_id: entryId,
          group_id: groupIdByLetter.get(go.groupLetter),
          team_id: teamIdByRef.get(`${go.groupLetter}${slot}`),
          position: i + 1,
        })),
      ),
    )

    await insertOrThrow(
      admin,
      'predicted_progression',
      entry.progression.map((p) => ({
        entry_id: entryId,
        team_id: teamIdByRef.get(`${p.groupLetter}${p.slot}`),
        stage: stageToDb[p.stage],
      })),
    )
  }

  // Pre-stamp welcomed_at so impersonating a seed user in dev doesn't trigger the
  // one-time /welcome screen. Best-effort: the column is a follow-up migration
  // (20260720160000_add_profile_welcomed_at.sql); a missing column just warns.
  {
    const { error: welcomeErr } = await admin
      .from('profiles')
      .update({ welcomed_at: new Date().toISOString() })
      .in(
        'id',
        seededUsers.map((u) => u.userId),
      )
    if (welcomeErr) {
      console.warn(
        `Could not pre-stamp welcomed_at (apply 20260720160000_add_profile_welcomed_at.sql): ${describeError(welcomeErr)}`,
      )
    }
  }

  // --- enter results (simulate the mid-tournament) --------------------------
  for (const r of data.results) {
    const matchId = matchIdByRef.get(r.matchRef)
    if (!matchId) continue
    const { error } = await admin
      .from('matches')
      .update({ home_score: r.homeScore, away_score: r.awayScore })
      .eq('id', matchId)
    if (error) throw new Error(`result update failed for ${r.matchRef}: ${describeError(error)}`)
  }

  // Belt-and-braces: the result trigger recomputes on each write, but invoke the
  // recompute once more explicitly so the run ALWAYS ends with populated
  // score_events and zero manual steps (acceptance: entry_totals matches the
  // leaderboard test right after seeding). Needs execute granted to service_role
  // (20260720140000_fix_recompute_trigger.sql); fail-soft if that migration or
  // the scoring migration isn't applied yet.
  const { error: recomputeErr } = await admin.rpc('recompute_tournament_scores', {
    p_tournament_id: tournamentId,
  })
  if (recomputeErr) {
    console.warn(
      'Explicit score recompute skipped — apply 20260720130000_add_scoring.sql + ' +
        `20260720140000_fix_recompute_trigger.sql to enable it: ${describeError(recomputeErr)}`,
    )
  } else {
    console.log('Recomputed scores (score_events + entry_totals now reflect the results).')
  }

  const submittedCount = data.entries.filter((entry) => entry.submitted).length
  console.log(
    `Seeded ${data.entries.length} users (${submittedCount} submitted, ` +
      `${data.entries.length - submittedCount} not) and ${data.results.length} results.`,
  )

  // --- a populated test league (so the League detail page has real members) --
  await seedTestLeague(admin, tournamentId, seededUsers)
  await seedSmallPools(admin, tournamentId, seededUsers, SCENARIOS[scenario].extraPoolSizes)
}

/**
 * The pools a leaderboard cannot say anything useful about. `docs/design-system.md`
 * requires the "Only you" surface to survive 1-entry and 2-entry pools, and the
 * ordinary seed has never produced one — every league it made had eight members.
 *
 * Owners are taken from the END of the seed user list so these pools do not
 * overlap the populated league, which takes the first eight. Best-effort and
 * idempotent on the same terms as `seedTestLeague`: the seed-user wipe removes
 * any league a seed user owns before the users themselves go.
 */
async function seedSmallPools(
  admin: Admin,
  tournamentId: string,
  users: { userId: string; displayName: string }[],
  sizes: readonly number[],
): Promise<void> {
  if (sizes.length === 0) return

  let taken = 0
  for (const [index, size] of sizes.entries()) {
    // Count back from the end, so the populated league's members are untouched.
    // Checked BEFORE slicing: a negative start index would silently count from
    // the end again and hand back somebody else's pool members.
    if (users.length - taken < size) {
      console.warn(`Skipped a ${size}-member pool: only ${users.length} seed users exist.`)
      continue
    }
    const members = users.slice(users.length - taken - size, users.length - taken)
    taken += size

    const owner = members[0]
    if (owner === undefined) continue
    const name = size === 1 ? 'A Pool Of One' : `A Pool Of ${size}`
    const inviteCode = `SEEDP${index + 1}`

    const { data: league, error: leagueError } = await admin
      .from('leagues')
      .insert({
        tournament_id: tournamentId,
        owner_id: owner.userId,
        name,
        invite_code: inviteCode,
      })
      .select('id')
      .single()
    if (leagueError || !league) {
      console.warn(`Skipped the ${size}-member pool: ${leagueError?.message ?? 'no row'}`)
      continue
    }

    const { error: memberError } = await admin.from('league_members').insert(
      members.map((member) => ({
        league_id: league.id,
        user_id: member.userId,
        role: member.userId === owner.userId ? 'owner' : 'member',
      })),
    )
    if (memberError) {
      console.warn(`Pool "${name}" created but members failed: ${memberError.message}`)
      continue
    }
    console.log(`Seeded "${name}" (code ${inviteCode}) — ${members.length} member(s).`)
  }
}

// Creates one league owned by the first seed user with several seed members, so
// the League detail page renders against real, hostile-named members. Best-
// effort: if the leagues migration (20260719180000_add_leagues.sql) isn't
// applied yet, it warns and skips rather than failing the whole seed. Idempotent
// via the seed-user wipe, which clears seed league rows before deleting users.
async function seedTestLeague(
  admin: Admin,
  tournamentId: string,
  users: { userId: string; displayName: string }[],
): Promise<void> {
  const owner = users[0]
  if (owner === undefined || users.length < 2) return
  const members = users.slice(0, 8) // owner + up to 7 others
  const INVITE_CODE = 'SEEDLG'

  const { data: league, error: lErr } = await admin
    .from('leagues')
    .insert({
      tournament_id: tournamentId,
      owner_id: owner.userId,
      name: 'The Seed Test League',
      invite_code: INVITE_CODE,
    })
    .select('id')
    .single()
  if (lErr || !league) {
    console.warn(
      `Skipped the test league (apply 20260719180000_add_leagues.sql to enable it): ${lErr?.message ?? 'no row'}`,
    )
    return
  }

  const { error: mErr } = await admin.from('league_members').insert(
    members.map((m) => ({
      league_id: league.id,
      user_id: m.userId,
      role: m.userId === owner.userId ? 'owner' : 'member',
    })),
  )
  if (mErr) {
    console.warn(`Test league created but members failed: ${mErr.message}`)
    return
  }
  console.log(
    `Seeded "The Seed Test League" (code ${INVITE_CODE}) — owner ${owner.displayName}, ${members.length} members.`,
  )
}

// --- small helpers -----------------------------------------------------------
async function listSeedUserIds(admin: Admin): Promise<string[]> {
  const ids: string[] = []
  // Page through the auth users; keep the ones on the seed email domain.
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers failed: ${describeError(error)}`)
    const users = data.users ?? []
    for (const u of users) {
      if (u.email && u.email.endsWith(`@${SEED_EMAIL_DOMAIN}`)) ids.push(u.id)
    }
    if (users.length < 200) break
  }
  return ids
}

async function createUser(admin: Admin, entry: GeneratedEntry): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: entry.email,
    password: SEED_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: entry.displayName },
  })
  if (error || !data.user) throw new Error(`createUser failed for ${entry.email}: ${describeError(error)}`)
  return data.user.id
}

async function insertOrThrow(admin: Admin, table: string, rows: unknown): Promise<void> {
  const { error } = await admin.from(table).insert(rows as never)
  if (error) throw new Error(`insert into ${table} failed: ${describeError(error)}`)
}

// True when an error is "relation does not exist" — the leagues migration may
// not be applied on an older dev DB, in which case there are no league rows to
// clear and the wipe should carry on rather than abort.
function isMissingRelation(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  return (
    e?.code === '42P01' || // Postgres undefined_table
    e?.code === 'PGRST205' || // PostgREST: table not found in schema cache
    /does not exist/i.test(e?.message ?? '')
  )
}

// The Supabase admin API frequently masks the underlying Postgres error as an
// empty object (its props are non-enumerable, so `${err}`/JSON.stringify give
// "{}"). Dig every useful field out so a failure is actually diagnosable.
function describeError(error: unknown): string {
  if (error == null) return 'unknown error'
  if (typeof error === 'string') return error

  const e = error as Record<string, unknown>
  const fields = ['message', 'code', 'status', 'details', 'hint', 'name']
  const parts = fields
    .map((k) => (e[k] != null && e[k] !== '' ? `${k}=${String(e[k])}` : null))
    .filter(Boolean) as string[]
  if (parts.length > 0) return parts.join(' · ')

  // Fall back to non-enumerable own props (typical of API error objects), then
  // to a plain stringify.
  const own = Object.getOwnPropertyNames(e)
    .map((k) => {
      try {
        return `${k}=${String(e[k])}`
      } catch {
        return null
      }
    })
    .filter(Boolean) as string[]
  if (own.length > 0) return own.join(' · ')

  try {
    const json = JSON.stringify(error)
    return json && json !== '{}' ? json : String(error)
  } catch {
    return String(error)
  }
}

// --- entrypoint --------------------------------------------------------------
async function main(): Promise<void> {
  // Read the scenario BEFORE anything else, so an unrecognised name refuses
  // without having touched a database.
  const scenario = readScenario(process.argv)
  if (process.argv.includes('--commit')) {
    await commit(scenario)
  } else {
    printDryRun(scenario)
  }
}

main().catch((err) => {
  console.error('\nSeed failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
