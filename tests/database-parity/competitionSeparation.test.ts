import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * Competitions never combine into one entry, score or standing.
 *
 * This is a hard boundary of the platform, stated in ADR 0011 and ADR 0015 and
 * repeated in the project instructions: "No combined cross-competition entry,
 * score or standings path." `MASTER-TODO.md` carries it as a Stage H item —
 * *prove no aggregate ranking or cross-competition score path exists* — and
 * nothing proved it.
 *
 * What already exists nearby, and why neither covers this:
 *
 * - `tests/domain/domainBoundaryLaws.test.ts` guards **source imports**:
 *   tournament and season implementations stay independent, the shared layer
 *   depends on nothing above it. That is the code boundary, not the data path.
 * - `tests/services/tournamentDataScope.test.ts` guards reference-data scoping
 *   **within** one tournament — group teams not blending. Not entries, scores
 *   or standings across competitions.
 * - `dataApiExposure.test.ts` guards who may read `entry_totals`. That is a
 *   privilege question; this is a shape question.
 *
 * This is a **before-state contract** written at repository contract 65, in the
 * pattern of PRs #245, #246, #250 and #265. It exists now, rather than after the
 * next schema change, because C1b is the change most able to create such a path:
 * it introduces per-competition-season game membership and rescopes private
 * leagues. A boundary asserted only after the change cannot show the boundary
 * held *through* it.
 *
 * Text-based over the committed migrations, so it needs no database.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')

const migrations = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((migration) => ({
    migration,
    sql: readFileSync(resolve(migrationsDirectory, migration), 'utf8'),
  }))

/**
 * Comments are stripped before any statement is judged.
 *
 * The bonus-games migration states this very law in prose — "bonus points never
 * touch Original Predictor score_events" — directly above the table it applies
 * to. A guard that read comments would report the sentence describing the rule
 * as a violation of it.
 */
function withoutComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Every statement across every migration, comments removed. */
const statements = migrations.flatMap(({ migration, sql }) =>
  withoutComments(sql)
    .split(';')
    .map((statement) => ({ migration, statement })),
)

const allSql = migrations.map(({ sql }) => sql).join('\n')

/** `score_events`, but never the `bonus_score_events` that contains it. */
const ORIGINAL_SCORING = /(?<!bonus_)\bscore_events\b/
const BONUS_SCORING = /\bbonus_score_events\b/

const touchingOriginal = statements.filter(({ statement }) =>
  ORIGINAL_SCORING.test(statement),
)
const touchingBonus = statements.filter(({ statement }) =>
  BONUS_SCORING.test(statement),
)

describe('the separation is measured against something real', () => {
  it('finds both scoring surfaces, so the assertion below is not vacuous', () => {
    // Without this, a regex that matched nothing would report perfect
    // separation between two things it had failed to find at all.
    expect(touchingOriginal.length).toBeGreaterThan(10)
    expect(touchingBonus.length).toBeGreaterThan(10)
  })

  it('distinguishes the two names rather than matching one inside the other', () => {
    expect(ORIGINAL_SCORING.test('insert into bonus_score_events')).toBe(false)
    expect(ORIGINAL_SCORING.test('insert into score_events')).toBe(true)
    expect(BONUS_SCORING.test('insert into bonus_score_events')).toBe(true)
  })
})

describe('competition scoring never combines', () => {
  it('never reads both scoring surfaces in one statement', () => {
    // A join, a union or a sum across both is how one combined total would come
    // into existence. Statement granularity is deliberate: the C1 scope trigger
    // dispatches on `tg_table_name` and names many tables in one body, each in
    // its own branch and its own statement. Naming both is legitimate;
    // *reading* both at once is not.
    const combined = statements
      .filter(
        ({ statement }) =>
          ORIGINAL_SCORING.test(statement) && BONUS_SCORING.test(statement),
      )
      .map(({ migration, statement }) => `${migration}: ${statement.trim().slice(0, 120)}`)

    expect(
      combined,
      'these statements read Original Predictor and Bonus Game scoring together, ' +
        'which is the combined cross-competition score path ADR 0015 forbids',
    ).toEqual([])
  })
})

describe('every competitive row belongs to exactly one competition', () => {
  /** Relations that hold an entry, a score, a standing or a league. */
  const SCOPED_RELATIONS: { relation: string; column: string }[] = [
    { relation: 'entries', column: 'tournament_id' },
    { relation: 'leagues', column: 'tournament_id' },
    { relation: 'rank_history', column: 'tournament_id' },
    { relation: 'bonus_competitions', column: 'tournament_id' },
    { relation: 'bonus_competition_entrants', column: 'competition_id' },
    { relation: 'bonus_score_events', column: 'competition_id' },
  ]

  function createTableBody(relation: string): string {
    const pattern = new RegExp(
      `create table (?:if not exists )?(?:public\\.)?${relation}\\s*\\(([\\s\\S]*?)\\n\\);`,
      'i',
    )
    return pattern.exec(allSql)?.[1] ?? ''
  }

  it.each(SCOPED_RELATIONS)(
    '$relation carries a non-null $column',
    ({ relation, column }) => {
      const body = createTableBody(relation)

      expect(body, `no create table found for ${relation}`).not.toBe('')
      // Nullable scope is the same defect as no scope: a row with no
      // competition belongs to all of them at once.
      expect(
        body,
        `${relation}.${column} must be declared not null, or a row can exist ` +
          `outside every competition`,
      ).toMatch(new RegExp(`${column}[^,]*not null`, 'i'))
    },
  )

  it('keeps one Original Predictor entry per user per tournament', () => {
    // This is what makes an entry structurally incapable of spanning
    // competitions: the identity of an entry includes its tournament.
    expect(createTableBody('entries')).toMatch(/unique \(user_id, tournament_id\)/i)
  })

  it('keeps rank history keyed by tournament', () => {
    expect(createTableBody('rank_history')).toMatch(
      /unique \(user_id, tournament_id, matchday_key\)/i,
    )
  })

  it('keeps a Bonus Game entrant keyed by their competition', () => {
    expect(createTableBody('bonus_competition_entrants')).toMatch(
      /primary key \(competition_id, user_id\)/i,
    )
  })
})

describe('no standings surface returns an unscoped total', () => {
  /** Every declared function name and its parameter list. */
  function signatures(): { name: string; parameters: string }[] {
    const found: { name: string; parameters: string }[] = []
    const pattern =
      /create (?:or replace )?function\s+(?:public\.)?([a-z_0-9]+)\s*\(([\s\S]*?)\)\s*returns/gi
    for (const match of withoutComments(allSql).matchAll(pattern)) {
      found.push({ name: at(match, 1), parameters: at(match, 2) })
    }
    return found
  }

  const standings = signatures().filter(({ name }) =>
    /leaderboard|standings|rank_history/.test(name),
  )

  it('finds the standings surfaces it is about to judge', () => {
    const names = standings.map(({ name }) => name)
    expect(names).toContain('get_leaderboard')
    expect(names).toContain('get_ko_predictor_standings')
  })

  it('takes a competition scope as an argument, never returning a global table', () => {
    // A standings function with no scope parameter has only one thing it can
    // mean: everyone, everywhere, in one ranking.
    const unscoped = standings
      .filter(({ parameters }) => !/tournament_id|competition_id|league_id/.test(parameters))
      .map(({ name }) => name)

    expect(
      unscoped,
      'these standings functions take no competition scope, so they can only ' +
        'return an aggregate ranking across competitions',
    ).toEqual([])
  })

  it('constrains the leaderboard by the scope it was handed, in every definition of it', () => {
    // Accepting the parameter is not the same as using it.
    //
    // EVERY definition, not the first. A non-global `exec` returns whichever
    // body was written earliest, which stops being the installed one the moment
    // a later contract redefines the function -- and `get_leaderboard` is
    // redefined four times. Competition separation is not a property of one
    // revision: it has to hold at every point the function was rewritten, or a
    // rollout that stopped part-way would leave a leaderboard that spans
    // competitions. So all four are required to carry the filter.
    const pattern = /create or replace function [\w.]*get_leaderboard\([\s\S]*?\$\$([\s\S]*?)\$\$;/gi
    const bodies = [...allSql.matchAll(pattern)].map((match) => match[1] ?? '')

    expect(bodies.length, 'no get_leaderboard definition found').toBeGreaterThan(0)
    for (const [index, body] of bodies.entries()) {
      expect(body, `get_leaderboard definition ${index} does not filter by its scope`).toMatch(
        /tournament_id = p_tournament_id/,
      )
    }
  })
})

describe('the totals view cannot aggregate across competitions', () => {
  const definition = /create or replace view entry_totals as([\s\S]*?);/.exec(allSql)?.[1] ?? ''

  it('sums per entry, and an entry belongs to one tournament', () => {
    expect(definition, 'entry_totals definition not found').not.toBe('')
    // Grouping by entry is the separation: the tournament scope is carried by
    // the entry, so a per-entry total can never span two of them.
    expect(definition).toMatch(/group by e\.id/i)
    expect(definition).toMatch(/from entries e/i)
  })

  it('draws on Original Predictor scoring only', () => {
    expect(BONUS_SCORING.test(definition)).toBe(false)
    expect(definition).toMatch(/score_events/)
  })
})
