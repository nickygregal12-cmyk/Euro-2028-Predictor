// Dev seed runner (see README.md in this folder).
//
//   npx tsx scripts/seed-dev/index.ts            # dry run: generate + score +
//                                                #   print, writes NOTHING
//   SEED_DEV=i-understand \
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//   npx tsx scripts/seed-dev/index.ts --commit   # write to the DEV database
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
import { evaluateSeedPolicy } from './seedPolicy'

// A loosely-typed admin client (default generics). The seed writes to a handful
// of tables by name and reads a few columns, so the untyped surface is fine and
// avoids threading a generated Database type into a dev-only script.
type Admin = SupabaseClient

const SEED_USER_PASSWORD = 'seed-user-euro28!'

function printDryRun(): void {
  const fixture = buildFixture()
  const data = generateSeedData(fixture)
  const scored = rankScored(scoreEntries(fixture, data))

  console.log('\nDEV SEED — DRY RUN (nothing written)\n')
  console.log(
    `${data.entries.length} test users · ${data.results.length} results entered · ` +
      `${fixture.matches.length} group matches in the fixture\n`,
  )

  console.log('Overall standings (group-match points so far):')
  for (const e of scored) {
    const rank = String(e.rank).padStart(2, ' ')
    const total = String(e.total).padStart(4, ' ')
    console.log(`  ${rank}. ${total}   ${e.displayName}`)
  }

  // Show one entry's Points breakdown to prove the pipeline end-to-end.
  const sample = scored[0]
  console.log(`\nSample breakdown — ${sample.displayName} (total ${sample.total}):`)
  for (const ev of sample.events.slice(0, 8)) {
    const pts = ev.joker ? `2× +${ev.points}` : `+${ev.points}`
    console.log(`  ${pts.padStart(7, ' ')}  ${ev.explanation}`)
  }
  if (sample.events.length > 8) console.log(`  … ${sample.events.length - 8} more`)

  console.log(
    '\nCommitting also creates "The Seed Test League" (code SEEDLG) owned by the ' +
      'first seed user with ~8 members, so the League detail page renders populated.',
  )
  console.log('\nRe-run with --commit (and the dev env vars) to write this to the database.\n')
}

async function commit(): Promise<void> {
  const { url, serviceKey } = evaluateSeedPolicy(process.env)

  // Imported lazily so the dry-run path never touches the network layer.
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as Admin

  const fixture = buildFixture()
  const data = generateSeedData(fixture)

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
    await insertOrThrow(admin, 'profiles', { id: userId, display_name: entry.displayName })

    const { data: entryRow, error: eErr } = await admin
      .from('entries')
      .insert({ user_id: userId, tournament_id: tournamentId, submitted_at: new Date().toISOString() })
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

  console.log(
    `Seeded ${data.entries.length} users with submitted entries and ${data.results.length} results.`,
  )

  // --- a populated test league (so the League detail page has real members) --
  await seedTestLeague(admin, tournamentId, seededUsers)
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
  if (users.length < 2) return
  const owner = users[0]
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
  const isCommit = process.argv.includes('--commit')
  if (isCommit) {
    await commit()
  } else {
    printDryRun()
  }
}

main().catch((err) => {
  console.error('\nSeed failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
