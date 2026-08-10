import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Progress of the `TYPE-001` migration, and the two ways it could go wrong
 * quietly.
 *
 * `client.ts` exports the same client twice: `db` carries the generated schema
 * types, `supabase` has them erased. Modules move from the second to the first
 * in groups, because applying the types everywhere at once surfaces 27
 * disagreements across 17 modules that want genuinely different fixes.
 *
 * A staged migration has two silent failure modes, and this file exists for
 * both:
 *
 *   1. **It stalls.** A seam introduced "temporarily" is still there a year
 *      later, and nothing fails while half the codebase is untyped — which is
 *      the same "built the gate and never closed it" pattern this repository
 *      keeps recording against itself. So the migrated set is pinned by name:
 *      finishing a group means editing this list, which makes the remaining
 *      work countable and visible in every diff that touches it.
 *   2. **It goes backwards.** A module that has been reconciled can be edited
 *      back onto the untyped export by anyone reaching for the import they are
 *      used to, and it would compile perfectly. Then its types are gone and
 *      nothing says so.
 *
 * The list below is the record. Adding a name to it is how a group is declared
 * done; nothing else in the repository tracks that.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')
const serviceDirectory = resolve(repositoryRoot, 'src/services/supabase')

/**
 * Modules reconciled with the generated schema and using the typed client.
 *
 * Group 1 (AUD-10-b-i) — the RPC-argument cluster. Every one of these passed an
 * explicit `null` for an optional parameter whose generated type is `T | undefined`.
 * The fix is omission rather than `null`, and it is behaviour-identical ONLY
 * because each parameter's SQL default was checked and found to be `null`:
 * `p_after text default null` on the four paged reads, `p_note text default
 * null`, and `p_from`/`p_to timestamptz default null`. Had any default been a
 * value — `p_limit integer default 50` is the counter-example sitting right
 * beside them — omitting the argument would have sent something different.
 */
const MIGRATED = [
  'koPredictorStandings.ts',
  'leaderboard.ts',
  'leagues.ts',
  'providerReviewQueues.ts',
  'seasonFixtureList.ts',
  'seasonLeaderboard.ts',
  'seasonLeagueStandings.ts',
]

function read(name: string): string {
  return readFileSync(resolve(serviceDirectory, name), 'utf8')
}

function serviceModules(): string[] {
  return readdirSync(serviceDirectory).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.d.ts') && name !== 'client.ts',
  )
}

/** Modules importing the untyped export. */
function untypedConsumers(): string[] {
  return serviceModules().filter((name) => /import \{[^}]*\bsupabase\b[^}]*\} from '\.\/client'/.test(read(name)))
}

describe('TYPE-001 migration to the typed client', () => {
  it('offers both clients from one instance', () => {
    // The property that makes a staged migration safe at runtime: there is one
    // client, so auth state, realtime and storage cannot diverge between the
    // migrated and unmigrated halves. Two `createClient` calls would give two
    // GoTrue instances racing over the same session.
    const client = read('client.ts')

    expect((client.match(/createClient</g) ?? []).length).toBe(1)
    expect(client).toMatch(/export const db = client/)
    expect(client).toMatch(/export const supabase: SupabaseClient = client/)
    // Checked by the compiler, not asserted past it.
    expect(client, 'the untyped view must not be a cast').not.toMatch(/client as /)
  })

  it('has every declared module actually on the typed client', () => {
    // Catches the backslide. A migrated module that imports `supabase` again
    // compiles fine and silently loses its types.
    for (const name of MIGRATED) {
      const source = read(name)
      expect(source, `${name} is declared migrated but imports the untyped client`).toMatch(
        /import \{ db \} from '\.\/client'/,
      )
      expect(source, `${name} is declared migrated but still calls supabase.`).not.toMatch(
        /\bsupabase\./,
      )
    }
  })

  it('names only modules that exist', () => {
    // A renamed or deleted module would otherwise sit in the list for ever,
    // reporting progress that no longer exists.
    const present = new Set(serviceModules())
    for (const name of MIGRATED) {
      expect(present.has(name), `${name} is declared migrated but is not a service module`).toBe(true)
    }
  })

  it('reports the remaining work rather than letting the seam go quiet', () => {
    // Not a threshold to tighten — a statement of position. The count moves as
    // groups land, and this assertion has to be edited each time, which is the
    // point: the seam cannot be forgotten while a test names what is left.
    //
    // When this reaches zero, `client.ts` should drop the `supabase` export and
    // this file should be deleted with it.
    const remaining = untypedConsumers()

    expect(
      remaining.length,
      `Modules still on the untyped client:\n  ${remaining.join('\n  ')}`,
    ).toBe(39)

    // And none of them is one we have already declared done.
    for (const name of MIGRATED) {
      expect(remaining, `${name} is both migrated and untyped`).not.toContain(name)
    }
  })
})
