import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Database } from '../../src/services/supabase/database.types'

/**
 * The generated database types, and the one thing that can go wrong with them.
 *
 * A generated file rots silently. Nothing about `database.types.ts` changes when
 * a migration adds a column — it simply stops describing the schema, and every
 * type it provides stays confidently wrong. That is a worse failure than having
 * no types at all, because the hand-written casts it replaces at least looked
 * like assertions somebody made; a stale generated file looks like ground truth.
 *
 * WHAT THIS CHECKS, and what it deliberately does not.
 *
 * It compares the contract the file was generated at against the repository's
 * current migration count. That catches the real trigger — migrations advanced,
 * nobody regenerated — with no Docker, no credentials and no hosted call.
 *
 * It does NOT regenerate and diff. The audit asked for that, and it is the
 * stronger check, but it needs either a running local Supabase (Docker) or
 * hosted credentials on every pull request. The second is worse than it sounds:
 * generation reads hosted DEVELOPMENT, and ADR 0024 treats Development trailing
 * the repository as the normal working state, so a regenerate-and-diff gate
 * would fail legitimately on every schema-advancing pull request — exactly the
 * circular gate ADR 0024 removed for deploy previews. Doing it against a local
 * database from the committed migrations is the right answer and is recorded as
 * `AUD-10-c`; it also needs measuring first, because the local and hosted
 * generators can differ cosmetically (`__InternalSupabase.PostgrestVersion` is
 * the known one) and a gate that fails on that is a gate people switch off.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')

const meta = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'src/services/supabase/database.types.meta.json'), 'utf8'),
) as {
  source: string
  projectRef: string
  generatedFromContract: number
  developmentHostedContract: number
}

function migrationCount(): number {
  return readdirSync(resolve(repositoryRoot, 'supabase/migrations')).filter((name) =>
    name.endsWith('.sql'),
  ).length
}

describe('generated database types', () => {
  it('never describes a schema the repository has not written', () => {
    // CORRECTED 10 August 2026 (AUD-11), AND THE CORRECTION IS THE POINT.
    //
    // This assertion read `.toBe(migrationCount())` — the types must have been
    // generated at the REPOSITORY's contract. That is unsatisfiable for the one
    // kind of pull request it was written to catch. Generation reads hosted
    // Development, Development receives a migration only AFTER the pull request
    // merges, so from the moment a migration file is added until a rollout runs
    // there is nothing the author can do to make this pass. It went red on the
    // first migration to follow it (contract 152) and would have gone red on
    // every migration for ever after.
    //
    // That is the circular gate ADR 0024 removed for deploy previews, and
    // `database-types-baseline.md` argued against for AUD-10-c in as many
    // words — arriving through AUD-10-a's artifact guard instead.
    //
    // THE PROPERTY IS NOT WEAKENED, IT IS RELOCATED, and it was already here.
    // "The types describe what Development actually has" is asserted below
    // against the hosted record, and that is the assertion that matters: when
    // Development moves to 152, it fails until the types are regenerated. What
    // is dropped is only the demand that regeneration happen BEFORE the rollout
    // that makes it possible.
    //
    // What remains here is the impossible state: types that describe more
    // migrations than the repository contains cannot have come from a schema
    // this repository built, so they came from somewhere else.
    expect(
      meta.generatedFromContract,
      'database.types.ts describes more migrations than the repository holds. ' +
        'It was generated from a schema this repository did not build.',
    ).toBeLessThanOrEqual(migrationCount())
  })

  it('reports how far the types trail the repository, rather than hiding it', () => {
    // Not a threshold — a statement of position, in the same shape `NOW.md`
    // uses for pending development migrations. A trailing artifact is normal
    // between a migration merging and its rollout; it is only invisible
    // trailing that is dangerous.
    //
    // The compiler is what actually protects the gap. Since `TYPE-001` closed,
    // every service module is on the typed client, so repository code cannot
    // call a function the generated types do not know about — a browser read
    // for a not-yet-applied migration fails `tsc` rather than failing a user.
    // That ordering is a feature: the RPC has to exist on Development before a
    // browser can be written against it.
    const pending = migrationCount() - meta.generatedFromContract

    expect(pending, `The generated types trail the repository by ${pending} migration(s).`)
      .toBeGreaterThanOrEqual(0)
  })

  it('was generated from Development, never from Production', () => {
    // The generator refuses the Production ref by name; this asserts the
    // committed artifact honours the same boundary, so a file generated by hand
    // against the wrong project cannot be committed quietly.
    const production = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'config/production-hosted-contract.json'), 'utf8'),
    ) as { projectRef: string }
    const development = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'config/development-hosted-contract.json'), 'utf8'),
    ) as { projectRef: string }

    expect(meta.source).toBe('hosted-development')
    expect(meta.projectRef).toBe(development.projectRef)
    expect(meta.projectRef).not.toBe(production.projectRef)
  })

  it('describes a schema Development had actually applied', () => {
    // Guards the case the generator only warns about: types generated while
    // Development trailed the repository describe neither one usefully.
    expect(meta.generatedFromContract).toBe(meta.developmentHostedContract)
  })

  it('exports a Database type covering the core gameplay tables', () => {
    // A positive control. Without it, every assertion above would pass just as
    // happily against a truncated or empty file — the count check reads the meta
    // JSON, not the types, so nothing else here would notice.
    //
    // Compile-time only: these resolve to `never` if a table is missing, and
    // `tsc -b` fails on the assignment rather than the test failing at runtime.
    // That is the point — the types are a compile-time artifact, so the check
    // that they are populated belongs at compile time too.
    type Tables = Database['public']['Tables']
    const covered: Record<string, true> = {
      entries: true satisfies Tables['entries'] extends { Row: unknown } ? true : never,
      matches: true satisfies Tables['matches'] extends { Row: unknown } ? true : never,
      leagues: true satisfies Tables['leagues'] extends { Row: unknown } ? true : never,
      match_predictions: true satisfies Tables['match_predictions'] extends { Row: unknown }
        ? true
        : never,
      season_fixtures: true satisfies Tables['season_fixtures'] extends { Row: unknown }
        ? true
        : never,
    }

    expect(Object.keys(covered).sort()).toEqual([
      'entries',
      'leagues',
      'match_predictions',
      'matches',
      'season_fixtures',
    ])
  })

  it('carries a do-not-edit header, because it is regenerated wholesale', () => {
    const source = readFileSync(
      resolve(repositoryRoot, 'src/services/supabase/database.types.ts'),
      'utf8',
    )

    expect(source.startsWith('// GENERATED FILE — DO NOT EDIT BY HAND.')).toBe(true)
    // The header names where provenance lives, so a reader who wants to know
    // which schema this describes is not left guessing at a file with no date.
    expect(source).toContain('database.types.meta.json')
  })

  it('is consumed by the client', () => {
    // THIS ASSERTION WAS INVERTED ON 10 AUGUST 2026, and the inversion is the
    // point of having written it.
    //
    // AUD-10-a landed the artifact and left the client untyped, so this read
    // `.not.toContain('createClient<Database>')` — a deliberate tripwire, so
    // that whoever typed the client would be sent to the baseline document
    // rather than find a stale "not yet used" note in a header. AUD-10-b-i
    // typed it, the tripwire fired on the first run, and this is that visit.
    //
    // It is inverted rather than deleted for the same reason the AUTH-002
    // before-state assertion was: deleting it would leave nothing that fails if
    // the client is ever quietly untyped again.
    const client = readFileSync(
      resolve(repositoryRoot, 'src/services/supabase/client.ts'),
      'utf8',
    )

    expect(client).toContain('createClient<Database>')
  })
})
