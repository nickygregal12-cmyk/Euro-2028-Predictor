import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { monthlyStandings, rollingFormPoints } from '../../src/domain/season/standings'

/**
 * The two retention tables, in both languages.
 *
 * WHAT THE SQL DECIDES THAT THE TYPESCRIPT DOES NOT, and it is the whole
 * reason contract 122 needed an owner decision rather than an implementation:
 * `monthlyStandings` takes the matchweek→month calendar as an ARGUMENT and
 * says so — "the caller derives it from fixture kickoffs; this module reads no
 * clock". So the SQL is the caller, and it had to choose which instant names a
 * matchweek's month, and in which timezone.
 *
 *   FIRST KICKOFF (`window_opens_at`), because it is the one instant every
 *   played round has and it is stable when a fixture is added later in the
 *   week;
 *
 *   IN THE COMPETITION'S `display_timezone`, because a month boundary is not a
 *   UTC fact. A 23:30Z kickoff on 31 July is 00:30 on 1 August in Europe/London.
 *
 * A MATCHWEEK CANNOT BE SPLIT, which is forced rather than chosen.
 * `season_matchweek_scores` is keyed `(entry_id, competition_round_id)`, so
 * points exist per matchweek and never per fixture. With ADR 0012 pairing
 * points to matchweeks played, there is no half-matchweek to put in January —
 * which is why the calendar maps a whole round to one month and the assertions
 * below feed the TypeScript the same way.
 *
 * These assertions pin the CONTRACT between the two sides — the shape, the
 * ranking rule, the refusals — against the SQL text. A differential sweep needs
 * a live database, so it belongs to the pgTAP suite and to
 * `174_season_period_standings.sql`, which straddles a real month boundary.
 */

const root = process.cwd()
const migration = readFileSync(
  resolve(root, 'supabase/migrations/20260806130000_season_period_standings.sql'),
  'utf8',
)

describe('the month a matchweek belongs to', () => {
  it('reads the round window in the competition timezone, never in UTC', () => {
    // Two `at time zone` applications: the first reads the timestamptz as local
    // wall-clock time in the season's zone, the second formats it. Dropping
    // either silently reverts the month to UTC at exactly the boundaries that
    // matter, which no shape assertion would catch.
    expect(migration).toMatch(
      /to_char\(\s*round\.window_opens_at at time zone season\.display_timezone,\s*'YYYY-MM'\s*\)/,
    )
    expect(migration).not.toMatch(/to_char\(\s*round\.window_opens_at,\s*'YYYY-MM'/)
  })

  it('names the month from the window opening, not its close', () => {
    // `window_closes_at` is the other end of the same span and would look
    // equally plausible in a table. It is not the owner's rule.
    expect(migration).not.toMatch(/window_closes_at at time zone/)
  })

  it('places only league matchweeks', () => {
    expect(migration).toMatch(/round\.kind = 'league_matchweek'/)
  })
})

describe('the monthly table matches the TypeScript authority', () => {
  it('ranks with rank() and breaks ties by entry id, as computeSeasonStandings does', () => {
    // `dense_rank` would give 1, 2, 2, 3 where the authority gives 1, 2, 2, 4.
    expect(migration).toMatch(/rank\(\) over \(\s*partition by totals\.month\s*order by totals\.points desc\s*\)/)
    expect(migration).not.toMatch(/dense_rank\(\) over \(\s*partition by totals\.month/)
    expect(migration).toMatch(/order by ranked\.points desc, ranked\.entry_id/)
  })

  it('refuses the whole table when a settled matchweek cannot be placed', () => {
    // `monthlyStandings` returns null in this case and says why: a table that
    // silently drops a matchweek misranks the month.
    expect(monthlyStandings([{ entryId: 'a', matchweeks: [{ matchweek: 1, points: 5 }] }], {})).toBeNull()
    expect(migration).toMatch(/round\.window_opens_at is null/)
    expect(migration).toMatch(/if v_unplaceable > 0 then\s*\n\s*return null;/)
  })

  it('counts a month an entry did not play as absent rather than zero', () => {
    // The TypeScript builds months only from settled totals, so an entry with
    // nothing in a month is missing from it. The SQL reads FROM the scores for
    // the same reason — an `entries` left join would put everyone on zero in
    // every month of the season, including months not yet played.
    const rows = monthlyStandings(
      [
        { entryId: 'a', matchweeks: [{ matchweek: 1, points: 5 }] },
        { entryId: 'b', matchweeks: [{ matchweek: 2, points: 3 }] },
      ],
      { 1: '2027-01', 2: '2027-02' },
    )
    expect(rows).not.toBeNull()
    expect(rows?.map((month) => month.month)).toEqual(['2027-01', '2027-02'])
    expect(rows?.[0]?.rows.map((row) => row.entryId)).toEqual(['a'])
    expect(rows?.[1]?.rows.map((row) => row.entryId)).toEqual(['b'])

    expect(migration).toMatch(/from public\.season_matchweek_scores score/)
    expect(migration).not.toMatch(/left join public\.season_matchweek_scores/)
  })

  it('returns months in ascending key order, as the TypeScript sorts them', () => {
    const rows = monthlyStandings(
      [{ entryId: 'a', matchweeks: [{ matchweek: 2, points: 1 }, { matchweek: 1, points: 1 }] }],
      { 1: '2027-02', 2: '2027-01' },
    )
    expect(rows?.map((month) => month.month)).toEqual(['2027-01', '2027-02'])
    expect(migration).toMatch(/order by month_table ->> 'month'/)
  })
})

describe('the form table matches the TypeScript authority', () => {
  it("takes each entry's own most recent settled matchweeks", () => {
    // Most recent to THAT entry, not the season's last N rounds: a player who
    // missed matchweek 12 has their previous settled one counted instead.
    const entry = {
      entryId: 'a',
      matchweeks: [
        { matchweek: 1, points: 1 },
        { matchweek: 2, points: 2 },
        { matchweek: 5, points: 9 },
      ],
    }
    expect(rollingFormPoints(entry, 2)).toBe(11)
    expect(migration).toMatch(
      /row_number\(\) over \(\s*partition by score\.entry_id\s*order by round\.ordinal desc\s*\)/,
    )
    expect(migration).toMatch(/where recent\.recency <= p_window/)
  })

  it('orders by round ordinal, needing no calendar and no timezone', () => {
    // Form is reachable on a season whose windows were never derived, which is
    // the practical difference between the two views.
    const formBlock = migration.slice(migration.indexOf('season_form_standings'))
    expect(formBlock).not.toMatch(/window_opens_at/)
    expect(formBlock).not.toMatch(/display_timezone/)
  })

  it('refuses a window below one rather than returning an empty table', () => {
    expect(rollingFormPoints({ entryId: 'a', matchweeks: [] }, 0)).toBeNull()
    expect(migration).toMatch(/Form window must be at least 1/)
  })
})

describe('neither view can reach the canonical total', () => {
  it('writes nothing', () => {
    // ADR 0012: the cumulative total is the only ranking that decides a season,
    // and these are derived views computed from it. A write here would make a
    // retention view a scoring authority.
    const body = migration.slice(migration.indexOf('create or replace function'))
    expect(body).not.toMatch(/insert into public\.season_matchweek_scores/)
    expect(body).not.toMatch(/update public\.season_matchweek_scores/)
    expect(body).not.toMatch(/delete from public\.season_matchweek_scores/)
  })

  it('keeps both authorities revoked from every browser role', () => {
    expect(migration).toMatch(
      /revoke all on function predictor_internal\.season_monthly_standings\(uuid\)\s*\n\s*from public, anon, authenticated, service_role;/,
    )
    expect(migration).toMatch(
      /revoke all on function predictor_internal\.season_form_standings\(uuid, integer\)\s*\n\s*from public, anon, authenticated, service_role;/,
    )
  })

  it('gates the browser read on holding an entry in that season', () => {
    // Contract 95's boundary, unchanged: a season is not the one competition
    // everybody is in, so a non-member is refused rather than shown an empty
    // table.
    expect(migration).toMatch(/This season is not yours to read/)
    expect(migration).toMatch(/grant execute on function public\.get_season_period_standings/)
  })
})
