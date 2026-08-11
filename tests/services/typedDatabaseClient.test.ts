import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `TYPE-001` closed, and the three ways it could quietly reopen.
 *
 * This file replaces `databaseTypeMigration.test.ts`, which counted how many
 * service modules were still on the untyped client and refused to let one move
 * back. That count reached zero, so it was deleted along with the `supabase`
 * export it tracked — but the property it protected still needs protecting, and
 * it is a different property now. It is no longer "how much is left"; it is
 * "there is no way back".
 *
 * The three reopenings, in order of how easy they are to do by accident:
 *
 *   1. **A second, untyped client.** Someone needs a client the generated types
 *      disagree with, and adds one — either a bare `createClient(...)` or an
 *      untyped alias beside `db`. That is exactly the seam this work removed,
 *      and it would come back looking temporary.
 *   2. **A cast at a call site.** A single `as any`, `as unknown as` or
 *      `@ts-expect-error` in a service module restores the situation
 *      `TYPE-001` describes — hand-written types hiding schema drift — with the
 *      added insult of looking deliberate.
 *   3. **The two mechanisms spreading.** `preparedInsert` and `rpcArgs` each
 *      hold exactly one assertion, because each spans a fact SQL knows and
 *      TypeScript cannot express — a trigger-filled column, and an argument
 *      that accepts NULL. They are narrow on purpose. A third such module, or
 *      either of these growing a second assertion, is the point at which
 *      "documented exception" starts becoming "escape hatch".
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')
const serviceDirectory = resolve(repositoryRoot, 'src/services/supabase')

/** The two modules that may hold a schema-bridging assertion, and why. */
const MECHANISMS = ['preparedInsert.ts', 'rpcArguments.ts']

function read(name: string): string {
  return readFileSync(resolve(serviceDirectory, name), 'utf8')
}

function serviceModules(): string[] {
  return readdirSync(serviceDirectory).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.d.ts'),
  )
}

describe('every database call goes through the typed client', () => {
  it('exports exactly one client, and it carries the generated types', () => {
    const client = read('client.ts')

    expect((client.match(/createClient/g) ?? []).length).toBe(2) // the import, and the call
    expect(client).toContain('createClient<Database>')
    expect(client).toMatch(/export const db = createClient<Database>/)

    // The untyped export is gone. Nothing may reintroduce it under any name:
    // an export whose type erases `Database` is the seam coming back.
    expect(client).not.toMatch(/export const supabase\b/)
    expect(client).not.toMatch(/:\s*SupabaseClient\b(?!<)/)
  })

  it('creates the client in exactly one module', () => {
    // Two `createClient` calls would give two GoTrue instances racing over one
    // session, which is the runtime hazard the staged migration was careful to
    // avoid even while the codebase was half-typed.
    // The generated artifact names `createClient` in a doc comment; it declares
    // types and calls nothing, so it is excluded by name rather than by pattern.
    const creators = serviceModules()
      .filter((name) => name !== 'database.types.ts')
      .filter((name) => /createClient[<(]/.test(read(name)))

    expect(creators).toEqual(['client.ts'])
  })

  it('has no service module importing the Supabase client library directly', () => {
    const offenders = serviceModules().filter(
      (name) => name !== 'client.ts' && /from '@supabase\/supabase-js'/.test(read(name)),
    )

    // `auth.ts` imports a TYPE from the library, which is fine and stays
    // possible — this asserts nothing imports `createClient` itself.
    for (const name of offenders) {
      expect(read(name), `${name} imports from the client library`).toMatch(
        /import type \{[^}]*\} from '@supabase\/supabase-js'/,
      )
    }
  })

  it('suppresses nothing at a call site', () => {
    const suppressions: string[] = []

    for (const name of serviceModules()) {
      const source = read(name)
      for (const pattern of [/@ts-expect-error/, /@ts-ignore/, /\bas any\b/]) {
        if (pattern.test(source)) suppressions.push(`${name}: ${String(pattern)}`)
      }
    }

    expect(suppressions, `Type suppressions in service modules:\n  ${suppressions.join('\n  ')}`)
      .toEqual([])
  })

  it('names every module that narrows an opaque `Json` return, so the list cannot grow quietly', () => {
    // `as unknown as` is NOT counted as a suppression above, and the distinction
    // is the point of this test rather than an omission from that one.
    //
    // A function returning `jsonb` is generated as `Returns: Json`. That is the
    // type being correct — the database really does return an opaque document —
    // so every consumer of one must narrow it, and no amount of client typing
    // removes the need. That is the opposite direction from asserting past a
    // shape the generator got right on the way IN, which is what `as any` and
    // `@ts-expect-error` do and what this work exists to prevent.
    //
    // It is still worth counting. A narrowing that is not followed by a check is
    // a runtime crash waiting for a schema change, so the modules doing it are
    // named here and each one is asserted to validate what it narrowed.
    const narrowing = serviceModules().filter((name) => /as unknown as/.test(read(name)))

    expect(narrowing).toEqual(['seasonCupPlayer.ts'])

    for (const name of narrowing) {
      expect(read(name), `${name} narrows a Json return without throwing on a bad shape`).toMatch(
        /throw new Error\(/,
      )
    }
  })
})

describe('the two documented mechanisms stay narrow', () => {
  it('confines schema-bridging assertions to the mechanism modules', () => {
    // A service module asserting its way past the generated types is the defect
    // `TYPE-001` names. The two mechanisms are allowed one each because each
    // spans a fact the type system genuinely cannot carry.
    const asserting = serviceModules().filter((name) => {
      if (MECHANISMS.includes(name)) return false
      // `as` onto a generated Insert/Args type — the shapes a bridge produces.
      return /\bas (?:InsertOf|ArgsOf)\b/.test(read(name))
    })

    expect(asserting).toEqual([])
  })

  it('holds exactly one assertion in each mechanism, with its reason recorded', () => {
    for (const name of MECHANISMS) {
      const source = read(name)

      const assertions = source.match(/\breturn \w+ as \w/g) ?? []
      expect(assertions.length, `${name} should hold exactly one assertion`).toBe(1)

      // Each names the migration that establishes the fact it is bridging, so
      // the exception can be re-checked rather than merely trusted.
      expect(source, `${name} must cite the migration it relies on`).toMatch(
        /supabase\/migrations|\d{14}_[a-z0-9_]+\.sql/,
      )
    }
  })

  it('binds each bridge to one named table or function', () => {
    // Both take the table/function name as their first argument. That is what
    // stops either becoming a general-purpose widener: the row or the argument
    // object is checked against one specific generated shape.
    expect(read('preparedInsert.ts')).toMatch(/table: T,/)
    expect(read('rpcArguments.ts')).toMatch(/fn: F,/)
  })
})
