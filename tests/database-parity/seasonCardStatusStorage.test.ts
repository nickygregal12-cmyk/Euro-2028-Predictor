import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveCardAtLock } from '../../src/domain/season/cardSubmission'

/**
 * Where a matchweek card is stored, and what the lock recorded about it.
 *
 * THE INVARIANT THIS EXISTS FOR is that absence is no-submission. Contract 80's
 * `resolveCardAtLock` returns `unbanked` for a player who never engaged the
 * matchweek, and contract 81 makes that unrepresentable to violate: `status`
 * permits only 'provisional' and 'confirmed', so a player who never engaged has
 * NO ROW. Storing an explicit 'no_submission' would be the same rule written a
 * weaker way — some later writer creates one per registered player "for
 * completeness", and from then on every player is a candidate for
 * auto-completion. The lock would enter people who never opened the app, with
 * default predictions, and the totals would look entirely plausible.
 *
 * THE SECOND INVARIANT is that the ledger is a record rather than a working
 * copy: append-only, one row per lock instant, each outcome carrying its own
 * evidence. Contract 82 asks it "have I processed this matchweek at this lock?"
 * and must get a truthful answer after a retry, a crash or a redeploy.
 *
 * Assertions read the migration with its comments stripped. The header explains
 * itself using the very words the assertions look for, so asserting against the
 * raw text passes on the prose — that has now happened three times in this
 * repository, most recently in `seasonCardLockParity.test.ts`.
 *
 * Accept/refuse behaviour was proven directly, against a scratch PostgreSQL 16
 * running the real DDL with satisfied foreign keys: 19 probes, every one
 * behaving as claimed. Structure is additionally read from the catalogue in
 * `133_season_card_status.sql`.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')

/**
 * Contract 81's migration, read on its own rather than from the concatenated
 * history. These tables are created once and never altered, so scoping the read
 * means a later migration cannot accidentally satisfy an assertion here — and a
 * later migration that DID alter them would fail these guards, which is the
 * behaviour wanted.
 */
const contract81File = readdirSync(migrationsDirectory).find((file) =>
  file.endsWith('_season_card_status.sql'),
)

/** The migration with every `--` comment removed, so prose cannot satisfy a guard. */
function code(text: string): string {
  return text.replace(/--[^\n]*/g, '')
}

const contract81 = code(
  contract81File === undefined
    ? ''
    : readFileSync(resolve(migrationsDirectory, contract81File), 'utf8'),
)

const cardTable =
  /create table if not exists public\.season_matchweek_cards \(([\s\S]*?)\n\);/.exec(
    contract81,
  )?.[1] ?? ''

const ledgerTable =
  /create table if not exists public\.season_matchweek_submission_outcomes \(([\s\S]*?)\n\);/.exec(
    contract81,
  )?.[1] ?? ''

const cardSubmissionSource = readFileSync(
  resolve(process.cwd(), 'src/domain/season/cardSubmission.ts'),
  'utf8',
)

/** The `CardStatus` union as the domain authority declares it. */
const declaredStatuses = (
  /export type CardStatus =([^\n]*)/.exec(cardSubmissionSource)?.[1] ?? ''
)
  .split('|')
  .map((part) => part.trim().replace(/^'|'$/g, ''))
  .filter((part) => part !== '')

describe('both definitions are found, so nothing below is vacuous', () => {
  it('finds the migration itself', () => {
    expect(contract81File, 'contract 81 migration not found').toBeDefined()
  })

  it.each([
    ['season_matchweek_cards', () => cardTable],
    ['season_matchweek_submission_outcomes', () => ledgerTable],
  ])('%s has a body to assert against', (_name, read) => {
    expect(read()).not.toBe('')
  })

  it('reads the three card statuses from the domain authority', () => {
    expect(declaredStatuses).toEqual(['no_submission', 'provisional', 'confirmed'])
  })
})

describe('absence is no-submission, so no-submission is not storable', () => {
  it('never appears in either table definition', () => {
    // Not just absent from the status CHECK: absent from the column default and
    // from anything else the two tables declare.
    expect(cardTable).not.toMatch(/no_submission/)
    expect(ledgerTable).not.toMatch(/no_submission/)
  })

  it('proves the exclusion at apply time rather than trusting it', () => {
    // The migration searches its own catalogue for the value and raises if it
    // finds one, so the schema and the reasoning cannot drift apart. This is
    // the one place the string may legitimately appear.
    expect(contract81).toMatch(
      /pg_get_constraintdef\(c\.oid\) like '%no_submission%'[\s\S]*?raise exception/,
    )
  })

  it('permits exactly the engaged statuses the domain declares', () => {
    const engaged = declaredStatuses.filter((status) => status !== 'no_submission')

    expect(engaged).toHaveLength(2)
    expect(cardTable).toContain(`status in (${engaged.map((s) => `'${s}'`).join(', ')})`)
  })

  it('makes the excluded status one the domain really has', () => {
    // If `no_submission` ever left `CardStatus`, the exclusion above would be
    // trivially true and this suite would stop protecting anything.
    expect(declaredStatuses).toContain('no_submission')
  })

  it('agrees with the resolution law that absence is unbanked', () => {
    expect(resolveCardAtLock([] as never, 'no_submission')).toEqual({ kind: 'unbanked' })
  })
})

describe('a card is the player state for one matchweek, not an event log', () => {
  it('holds one row per entry per matchweek', () => {
    expect(cardTable).toMatch(
      /unique \(tournament_id, entry_id, competition_round_id\)/,
    )
  })

  it('scopes both parents by season rather than by id alone', () => {
    // Composite keys make the season part of the key, so a card cannot point at
    // an entry from one season and a matchweek from another.
    expect(cardTable).toMatch(
      /foreign key \(tournament_id, entry_id\)\s*references public\.entries\(tournament_id, id\)/,
    )
    expect(cardTable).toMatch(
      /foreign key \(tournament_id, competition_round_id\)\s*references public\.competition_rounds\(tournament_id, id\)/,
    )
  })

  it('ties confirmed_at to the status in both directions', () => {
    // A biconditional, not an implication. One direction alone lets a
    // provisional card carry a confirmation timestamp, and `confirmed_at`
    // becomes decoration nobody can trust.
    expect(cardTable).toMatch(
      /check \(\(status = 'confirmed'\) = \(confirmed_at is not null\)\)/,
    )
  })
})

describe('the ledger records what the lock did, once per lock instant', () => {
  it('stores exactly the outcomes the resolution law can return', () => {
    // Executed, not read: these are the kinds `resolveCardAtLock` actually
    // produces, so adding a fourth outcome to the law fails here until the
    // ledger can hold it.
    const produced = new Set(
      [
        resolveCardAtLock([] as never, 'no_submission'),
        resolveCardAtLock(
          [
            {
              fixtureId: 'f1',
              defaultPrediction: { home: 1, away: 1 },
              playerPrediction: null,
            },
          ] as never,
          'provisional',
        ),
        resolveCardAtLock([] as never, 'provisional'),
      ].map((resolution) => resolution.kind),
    )

    expect([...produced].sort()).toEqual(['refused', 'submitted', 'unbanked'])
    for (const kind of produced) expect(ledgerTable).toContain(`'${kind}'`)
    expect(ledgerTable).toMatch(
      /outcome in \('submitted', 'unbanked', 'refused'\)/,
    )
  })

  it('puts the lock instant in the key, so a moved matchweek reprocesses', () => {
    // Without `locks_at` a rescheduled matchweek is skipped, because an outcome
    // recorded at the old instant already satisfies the key. The card would
    // never be submitted and nobody would see an error.
    expect(ledgerTable).toMatch(
      /unique \(entry_id, competition_round_id, locks_at\)/,
    )
  })
})

describe('each outcome carries its own evidence and nothing else', () => {
  const shape =
    /constraint season_matchweek_outcomes_shape check \(([\s\S]*?)\n  \)/.exec(
      ledgerTable,
    )?.[1] ?? ''

  /**
   * The three branches, each read separately.
   *
   * Asserting conjuncts against the whole constraint does not work: every
   * branch mentions the same three columns, so `submitted_at is null` is
   * present no matter which branch it belongs to. A mutation run proved that —
   * deleting `submitted_at is null` from the unbanked branch, which would let
   * an unbanked row assert a submission that never happened, left this suite
   * green because the refused branch still carried the phrase.
   */
  const branches = new Map(
    shape
      .split(/\bor\s*\(/)
      .map((branch) => [/outcome = '(\w+)'/.exec(branch)?.[1] ?? '', branch] as const)
      .filter(([outcome]) => outcome !== ''),
  )

  it('has a shape constraint with one branch per outcome', () => {
    expect(shape).not.toBe('')
    expect([...branches.keys()].sort()).toEqual(['refused', 'submitted', 'unbanked'])
  })

  it.each([
    ['submitted', ['submitted_at is not null', 'auto_completed is not null', 'refusal_reason is null']],
    ['unbanked', ['submitted_at is null', 'auto_completed is null', 'refusal_reason is null']],
    ['refused', ['submitted_at is null', 'auto_completed is null', 'refusal_reason is not null']],
  ])('a %s row carries precisely its own columns', (outcome, conjuncts) => {
    const branch = branches.get(outcome) ?? ''
    expect(branch, `${outcome} branch not found`).not.toBe('')
    for (const conjunct of conjuncts) expect(branch).toContain(conjunct)
  })

  it('closes the three-valued hole the tournament ledger left open', () => {
    // A CHECK treats NULL as satisfied. A refusal branch ending in
    // `char_length(btrim(<null>)) between 1 and 500` evaluates to NULL, the
    // whole OR evaluates to NULL, and the row is admitted — a refusal that does
    // not say why, which is the one thing the column exists for. A scratch
    // PostgreSQL 16 confirmed the tournament's `entry_automatic_submission_
    // outcomes` accepts exactly that. The explicit NOT NULL is what keeps this
    // branch two-valued; the length bound alone would not.
    expect(shape).toMatch(
      /refusal_reason is not null\s*and char_length\(btrim\(refusal_reason\)\) between 1 and 500/,
    )
  })

  it('bounds the reason rather than accepting whitespace', () => {
    expect(shape).toContain('char_length(btrim(refusal_reason)) between 1 and 500')
  })
})

describe('the ledger is append-only', () => {
  it('blocks update and delete with a trigger, as the tournament path does', () => {
    // Editable outcomes make the record worthless: a refusal becomes a
    // submission with no trace, and contract 82 reads the rewrite as truth.
    expect(contract81).toMatch(
      /before update or delete on public\.season_matchweek_submission_outcomes/,
    )
    expect(contract81).toMatch(
      /raise exception\s*'Season matchweek submission outcomes are immutable'/,
    )
    expect(contract81).toMatch(/errcode = '42501'/)
  })
})

describe('neither table is reachable from a browser', () => {
  it.each(['season_matchweek_cards', 'season_matchweek_submission_outcomes'])(
    '%s has RLS on and every browser role revoked',
    (table) => {
      expect(contract81).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`),
      )
      expect(contract81).toMatch(
        new RegExp(
          `revoke all on table public\\.${table}\\s*from public, anon, authenticated`,
        ),
      )
    },
  )
})
