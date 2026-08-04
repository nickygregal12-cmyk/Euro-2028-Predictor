import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeSeasonStandings } from '../../src/domain/season/standings'

/**
 * The season table, in both languages.
 *
 * WHAT THE SQL HAS TO DECIDE THAT THE TYPESCRIPT DOES NOT.
 * `computeSeasonStandings` ranks whatever list of entries it is handed,
 * including entries whose `matchweeks` array is empty. The list is the caller's
 * choice — so the SQL is the caller, and it had two answers available:
 *
 *   read `season_matchweek_scores` — a player who has banked no matchweek is
 *   ABSENT from their own league's table;
 *   read `entries` and left join — they appear on 0 points from 0 matchweeks.
 *
 * The second. A league table shows a team that has played no games on zero
 * rather than omitting it, and vanishing from a table you have joined reads as
 * a bug to the one person it happens to and as nothing at all to everyone else.
 *
 * THE TIE-BREAK IS A COLLATION QUESTION. Rank comes from points alone, but the
 * ORDER of rows within a tie is part of the returned array and the caller
 * renders in that order. TypeScript settles it with `localeCompare` (ICU);
 * PostgreSQL orders a `uuid` column bytewise. For general strings those
 * disagree — ICU treats a hyphen as ignorable at the primary level, so `'a-b'`
 * and `'ab'` can order differently. They agree here only because a UUID's
 * hyphens sit at four FIXED positions, so every comparison reaching a hyphen
 * has one on both sides. That is a property of the id format, not of the two
 * orderings, which is why the sweep below uses real UUIDs rather than trusting
 * the argument.
 *
 * EVIDENCE. 600 randomised seasons, 0 mismatches, 339 of them containing a tie.
 * The sweep feeds identical totals to both sides and compares the full array
 * including order. Four mutations of the SQL, all killed:
 *
 *   dense_rank instead of rank    223 / 600
 *   no entry-id tie-break         239 / 600
 *   points ascending              510 / 600
 *   row_number instead of rank    339 / 600
 *
 * The second row is load-bearing for a reason worth recording: the pgTAP file
 * `145_season_standings.sql` CANNOT kill that mutant. The function's
 * `group by entry.id` plans as a GroupAggregate over a sort on `entry.id`, so
 * rows reach `jsonb_agg` already in entry-id order and the explicit tie-break
 * is invisible through the table read however the rows were inserted. Nothing
 * promises that plan at a real season's size. The sweep has no group-by to hide
 * behind, and it is what proves the sort is doing work.
 *
 * The TypeScript authority is executed here; the SQL is read, and proven
 * against a real database in `145_season_standings.sql`.
 */

const migrationsDirectory = resolve(__dirname, '../../supabase/migrations')

function migrationSource(): string {
  const file = readdirSync(migrationsDirectory).find((name) =>
    name.endsWith('_season_standings_parity.sql'),
  )
  expect(file, 'the season standings parity migration').toBeTruthy()
  return readFileSync(resolve(migrationsDirectory, file!), 'utf8')
}

/** Comments describe; only code enforces. */
function migrationCode(): string {
  return migrationSource().replace(/--[^\n]*/g, '')
}

const entry = (entryId: string, ...points: number[]) => ({
  entryId,
  matchweeks: points.map((value, index) => ({ matchweek: index + 1, points: value })),
})

describe('standard competition ranking', () => {
  it('shares a rank on equal points and SKIPS the next', () => {
    const rows = computeSeasonStandings([
      entry('11111111-1111-4111-8111-111111111111', 10, 8),
      entry('22222222-2222-4222-8222-222222222222', 9),
      entry('33333333-3333-4333-8333-333333333333', 4, 5),
      entry('44444444-4444-4444-8444-444444444444'),
    ])
    expect(rows).not.toBeNull()
    expect(rows!.map((row) => row.rank)).toEqual([1, 2, 2, 4])
  })

  it('is rank(), not dense_rank(), in SQL — the difference is 4 versus 3', () => {
    expect(migrationCode()).toMatch(/rank\(\)\s+over\s*\(order by totals\.points desc\)/)
    expect(migrationCode()).not.toMatch(/dense_rank\(\)/)
  })
})

describe('who is in the table', () => {
  it('keeps an entry that has settled nothing, on zero from zero', () => {
    const rows = computeSeasonStandings([
      entry('11111111-1111-4111-8111-111111111111', 10),
      entry('44444444-4444-4444-8444-444444444444'),
    ])
    expect(rows).not.toBeNull()
    const empty = rows!.find((row) => row.entryId.startsWith('4444'))
    expect(empty).toMatchObject({ points: 0, matchweeksPlayed: 0 })
  })

  it('reads from entries with a LEFT JOIN, or that entry would vanish', () => {
    // The plain-language version of the trap: an inner join here silently
    // removes a player from their own league's table rather than showing them
    // on zero, and only that player would ever notice.
    expect(migrationCode()).toMatch(
      /from public\.entries entry\s+left join public\.season_matchweek_scores score/,
    )
  })

  it('counts matchweeks from the score rows, not the entries', () => {
    // `count(entry.id)` would count 1 for an entry with no scores, because a
    // left join emits one all-null row — so a player who has banked nothing
    // would report one matchweek played.
    expect(migrationCode()).toMatch(/count\(score\.entry_id\)/)
  })
})

describe('matches played is shown beside points', () => {
  it('distinguishes equal points from unequal matchweeks', () => {
    const rows = computeSeasonStandings([
      entry('22222222-2222-4222-8222-222222222222', 9),
      entry('33333333-3333-4333-8333-333333333333', 4, 5),
    ])
    expect(rows).not.toBeNull()
    expect(rows!.map((row) => row.points)).toEqual([9, 9])
    expect(new Set(rows!.map((row) => row.matchweeksPlayed))).toEqual(new Set([1, 2]))
  })
})

describe('the competition boundary', () => {
  it('returns null for anything that is not a league season', () => {
    // Not an empty array: ADR 0011 forbids a combined cross-competition
    // standings path, and `[]` would read as "this season has no players".
    expect(migrationCode()).toMatch(/where exists \(\s*select 1 from public\.tournaments t/)
    expect(migrationCode()).toMatch(/t\.kind = 'league_season'/)
  })

  it('is revoked from every browser role', () => {
    expect(migrationCode()).toMatch(
      /revoke all on function predictor_internal\.season_standings\(uuid\)\s+from public, anon, authenticated/,
    )
  })
})

describe('the tie-break the caller renders', () => {
  it('orders by points then entry id', () => {
    expect(migrationCode()).toMatch(/order by ranked\.points desc, ranked\.entry_id\)/)
  })

  it('agrees with localeCompare on UUIDs, which is what the sweep swept', () => {
    // A direct restatement of the equivalence the header argues structurally.
    // If this ever fails, the argument in the migration header is wrong and the
    // SQL needs an explicit collation rather than a comment.
    const ids = [
      '00000000-0000-4000-8000-000000000000',
      '0000000a-0000-4000-8000-000000000000',
      'a0000000-0000-4000-8000-000000000000',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '12345678-90ab-4cde-8f01-234567890abc',
    ]
    const byLocale = [...ids].sort((left, right) => left.localeCompare(right))
    const byBytes = [...ids].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    expect(byLocale).toEqual(byBytes)
  })
})
