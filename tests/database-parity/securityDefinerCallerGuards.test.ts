import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `DB-002` — security-definer caller assurance, asserted over the committed
 * migrations rather than over prose.
 *
 * ---------------------------------------------------------------------------
 * THE DEFECT THIS EXISTS FOR, WHICH THE REPOSITORY HAS ALREADY WRITTEN DOWN
 * TWICE AND NEVER ENFORCED
 * ---------------------------------------------------------------------------
 *
 * `AGENTS.md`, under Database discipline:
 *
 *     `current_user` is not a caller check inside a SECURITY DEFINER function.
 *     It is the function OWNER there, for every caller.
 *
 * `20260804163000_lms_auto_assignment.sql` says the same at greater length, with
 * a table of what each form returns per caller, and ends: **THAT FORM MUST NOT
 * BE COPIED.**
 *
 * Both are right, and until this file neither was executable. Four migrations
 * legitimately carry `current_user = 'postgres'` as a trusted-writer predicate,
 * every one of them on a `security invoker` trigger function where
 * `current_user` genuinely is the caller. Copying that conjunct into a definer
 * produces a predicate that is **always true** — a control that reads, in
 * review, exactly like a security narrowing, and is not one. Nothing in CI
 * would have noticed.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS ASSERTED, AND WHY IT IS SOURCE-LEVEL
 * ---------------------------------------------------------------------------
 *
 * `pg_proc` cannot answer this. A function redefined twice in one migration —
 * which `stageC1LockFunctionConsistency` records actually happening, and drifting
 * — shows only its last definition to the live database, so a live check would
 * pass over the exact defect that suite was written to catch. The committed text
 * is where both definitions are, so the committed text is what is read here.
 *
 * This file adds no migration and changes no schema. It is a guard over what is
 * already there.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

function migrationFiles(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

/**
 * Comments stripped, for the reason contract 172 learned the hard way: its own
 * privacy assertion read `pg_get_functiondef`, which returns comments, and the
 * comment explaining why a column was excluded contained that column's name. A
 * comment must never change what a parser thinks the data is.
 *
 * That matters more here than anywhere: the migrations that WARN about
 * `current_user` all contain the string `current_user` in their warnings.
 */
function codeOf(migration: string): string {
  return readFileSync(resolve(migrationsDirectory, migration), 'utf8')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

type FunctionBody = {
  migration: string
  name: string
  definer: boolean
  body: string
}

/**
 * Every `create function` / `create or replace function` in the committed
 * migrations, with its body up to the next `create` at column zero or the end
 * of the file. Deliberately generous at the tail: a body that swallows a little
 * trailing DDL can only ever make an assertion stricter, never weaker.
 */
function functionBodies(): FunctionBody[] {
  const bodies: FunctionBody[] = []

  for (const migration of migrationFiles()) {
    const code = codeOf(migration)
    const header = /create\s+(?:or\s+replace\s+)?function\s+((?:[a-z_0-9]+\.)?[a-z_0-9]+)\s*\(/gi
    const starts: { name: string; index: number }[] = []

    for (const match of code.matchAll(header)) {
      starts.push({ name: match[1], index: match.index ?? 0 })
    }

    starts.forEach((start, position) => {
      const end = position + 1 < starts.length ? starts[position + 1].index : code.length
      const body = code.slice(start.index, end)
      bodies.push({
        migration,
        name: start.name,
        definer: /\bsecurity\s+definer\b/i.test(body),
        body,
      })
    })
  }

  return bodies
}

const allFunctions = functionBodies()
const definerFunctions = allFunctions.filter((entry) => entry.definer)

describe('security-definer caller guards (DB-002)', () => {
  it('parses the migrations at all', () => {
    // Without this every assertion below would pass vacuously against an empty
    // list — the failure mode a regex-driven guard is most prone to, and the one
    // that makes it look green for ever after a rename.
    expect(allFunctions.length).toBeGreaterThan(300)
    expect(definerFunctions.length).toBeGreaterThan(150)
  })

  it('never uses current_user as a caller check inside a security-definer function', () => {
    // THE ASSERTION THIS FILE EXISTS FOR. See the header.
    const offenders = definerFunctions
      .filter((entry) => /\bcurrent_user\b/.test(entry.body))
      .map((entry) => `${entry.migration}: ${entry.name}`)

    expect(
      offenders,
      'Inside SECURITY DEFINER, current_user is the function OWNER for every ' +
        'caller, so a predicate on it is always true. Use session_user for a ' +
        'trusted-writer check, or auth.uid() for a player check.',
    ).toEqual([])
  })

  it('keeps the legitimate current_user predicates on security-invoker functions', () => {
    // The positive control, and the reason the assertion above can be absolute.
    // If these four ever move to `security definer`, the check above fires and
    // this one records what was true beforehand.
    const invokerUses = allFunctions
      .filter((entry) => !entry.definer && /\bcurrent_user\b/.test(entry.body))
      .map((entry) => entry.name)

    expect(invokerUses.length).toBeGreaterThan(0)
    expect(
      definerFunctions.filter((entry) => /\bcurrent_user\b/.test(entry.body)),
    ).toHaveLength(0)
  })

  it('pins search_path on every security-definer function', () => {
    // `schemaSecurityInvariants` asserts this too. It is repeated here on the
    // independently parsed body list, because two parsers agreeing is what makes
    // either of them trustworthy — and because a definer whose body this parser
    // failed to find would silently drop out of every other assertion in this
    // file without anyone noticing.
    // BOTH SPELLINGS, and finding that out was the point of writing a second
    // parser. `SET search_path = ''` is what this repository's authors type;
    // `SET search_path TO ''` is what `pg_get_functiondef` emits, so every
    // function that has ever been round-tripped through the live database
    // carries the `TO` form. A guard matching only `=` would have reported
    // fourteen false positives — or, written the other way round, would have
    // silently exempted every round-tripped definer from the check.
    const unpinned = definerFunctions
      .filter((entry) => !/set\s+search_path\s*(?:=|to)\s/i.test(entry.body))
      .map((entry) => `${entry.migration}: ${entry.name}`)

    expect(unpinned).toEqual([])
  })

  it('decides identity from auth.uid() or session_user, never from a role name comparison', () => {
    // A definer that compares `session_user` or `current_role` to a hard-coded
    // role name is making an authorisation decision from something the platform
    // controls rather than from the caller's identity. `session_user` for a
    // trusted-WRITER check is legitimate and is what the header recommends; a
    // comparison against a literal role name inside a definer that also reads
    // player data is not, and there are none today.
    const suspicious = definerFunctions
      .filter((entry) => /\bcurrent_role\b/.test(entry.body))
      .map((entry) => `${entry.migration}: ${entry.name}`)

    expect(suspicious).toEqual([])
  })
})
