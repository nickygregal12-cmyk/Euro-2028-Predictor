import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The league invite-code surface, before `ACQ-R10` is mitigated.
 *
 * `ACQ-R10` names *"cryptographic longer codes, preview throttling, reduced
 * disclosure and code rotation"*. None of those exist yet, and nothing failed
 * when a reader assumed otherwise — the risk register is prose, and the schema
 * was free to drift toward or away from it silently.
 *
 * This pins what the schema actually does today, so the mitigation has to
 * arrive as a visible edit here rather than as an unnoticed improvement or an
 * unnoticed regression. Same shape as `accountDeletionSemantics`: a before-state
 * contract, not an approval of the current design.
 *
 * The three properties that matter, and why:
 *
 *   - **the generator is `random()`**, which PostgreSQL documents as a
 *     deterministic PRNG explicitly unsuitable for cryptographic use. `pgcrypto`
 *     is already installed for `gen_random_uuid()`, so `gen_random_bytes()` is
 *     available whenever the swap is made;
 *   - **the keyspace is 31^6**, roughly 887 million. Large in isolation, but the
 *     probability of a *hit* scales with the number of leagues that exist, so
 *     this gets weaker exactly as the platform succeeds;
 *   - **`get_league_preview` is unthrottled.** Rate limiting is trigger-based on
 *     table writes, and preview is a read, so no trigger fires. Joining is
 *     limited to five per window; *probing* is unlimited.
 *
 * The alphabet deliberately omits `0/O` and `1/I/L` so a code can be read aloud.
 * That is a good decision and the mitigation should keep it — a longer code in
 * the same alphabet costs nothing in usability.
 *
 * Text-based over the committed migrations, so it needs no database.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

/** Migration SQL with `--` comments removed, so prose cannot parse as DDL. */
function migrationSql(): string {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) =>
      readFileSync(resolve(migrationsDirectory, file), 'utf8')
        .split('\n')
        .map((line) => line.replace(/--.*$/, ''))
        .join('\n'),
    )
    .join('\n')
}

const allSql = migrationSql()

/** The single definition of the invite-code generator. */
function generatorBody(): string {
  const definitions = [
    ...allSql.matchAll(
      /create\s+or\s+replace\s+function\s+(?:public\.)?gen_invite_code\s*\(\s*\)([\s\S]*?)\$\$;/gi,
    ),
  ]
  if (definitions.length !== 1) {
    throw new Error(
      `Expected exactly one gen_invite_code definition, found ${definitions.length}. ` +
        'If it is now defined twice, the last one wins and this test is reading the wrong body.',
    )
  }
  return definitions[0][1]
}

describe('invite-code generation — before-state', () => {
  it('parses the generator at all', () => {
    // Without this the assertions below could pass against an empty string.
    expect(generatorBody().length).toBeGreaterThan(50)
  })

  it('uses the non-cryptographic random() PRNG', () => {
    // Pinned, not fixed. Changing it is a migration, and production is a
    // contract behind, so the swap to pgcrypto belongs with the rest of the
    // ACQ-R10 mitigation rather than on its own.
    expect(generatorBody()).toMatch(/\brandom\s*\(\s*\)/i)
    expect(generatorBody()).not.toMatch(/gen_random_bytes|gen_random_uuid/i)
  })

  it('pins the alphabet and length that set the keyspace', () => {
    const body = generatorBody()
    const alphabet = /alphabet\s+text\s*:=\s*'([^']+)'/i.exec(body)?.[1] ?? ''
    const length = /for\s+\w+\s+in\s+1\.\.(\d+)\s+loop/i.exec(body)?.[1] ?? ''

    expect(alphabet).toBe('ABCDEFGHJKMNPQRSTUVWXYZ23456789')
    expect(alphabet).toHaveLength(31)
    expect(length).toBe('6')

    // 31^6 = 887,503,681. Stated as an assertion so a shortened code or a
    // narrowed alphabet cannot quietly reduce it.
    expect(alphabet.length ** Number(length)).toBe(887_503_681)
  })

  it('keeps the read-aloud alphabet free of ambiguous characters', () => {
    // Worth keeping through the mitigation: length is the cheap lever, not
    // alphabet size.
    const alphabet = /alphabet\s+text\s*:=\s*'([^']+)'/i.exec(generatorBody())?.[1] ?? ''
    for (const ambiguous of ['0', 'O', '1', 'I', 'L']) {
      expect(alphabet, `alphabet should omit ${ambiguous}`).not.toContain(ambiguous)
    }
  })

  it('retries on collision rather than failing the first attempt', () => {
    // Relevant to any keyspace change: shrinking the code without keeping this
    // loop would turn a rare retry into a user-visible failure.
    expect(allSql).toMatch(/exception\s+when\s+unique_violation/i)
  })
})

describe('invite-code probing — before-state', () => {
  /** Every action name passed to the rate limiter, with its ceiling. */
  function rateLimitedActions(): Record<string, number> {
    const found: Record<string, number> = {}
    for (const match of allSql.matchAll(/enforce_rate_limit\s*\(\s*'([a-z_]+)'\s*,\s*(\d+)\s*\)/gi)) {
      found[match[1]] = Number(match[2])
    }
    return found
  }

  it('rate-limits exactly two actions, both of them writes', () => {
    // The whole throttling surface. Naming it makes the omission visible:
    // there is no read-side limit anywhere in the schema.
    expect(rateLimitedActions()).toEqual({
      prediction_save: 60,
      league_membership: 5,
    })
  })

  it('leaves get_league_preview unthrottled', () => {
    // Rate limiting is implemented as triggers on table writes. `get_league_preview`
    // is a `language sql ... stable` read, so no trigger fires and no limit
    // applies. Joining is five per window; guessing codes is unlimited.
    //
    // This is the assertion the mitigation must break.
    const preview =
      /create\s+or\s+replace\s+function\s+(?:public\.)?get_league_preview[\s\S]*?\$\$;/i.exec(
        allSql,
      )?.[0] ?? ''

    expect(preview.length).toBeGreaterThan(50)
    expect(preview).not.toMatch(/enforce_rate_limit/i)
    expect(preview).toMatch(/\bstable\b/i)
  })

  it('pins what an unauthenticated-to-the-league caller learns from one guess', () => {
    // Reduced disclosure is the other half of ACQ-R10. A correct guess currently
    // returns the league name, its size and the owner's display name — enough to
    // identify a private group, not just confirm a code exists.
    const preview =
      /create\s+or\s+replace\s+function\s+(?:public\.)?get_league_preview\s*\(\s*p_code\s+text\s*\)\s*returns\s+table\s*\(([^)]*)\)/i.exec(
        allSql,
      )?.[1] ?? ''

    const columns = [...preview.matchAll(/([a-z_]+)\s+(?:uuid|text|int|boolean)/gi)].map(
      (match) => match[1],
    )
    expect(columns).toEqual(['id', 'name', 'member_count', 'owner_name', 'is_member'])
  })

  it('grants preview to every authenticated user', () => {
    // Not owner- or member-scoped: any signed-in account can probe. That is
    // required for the join flow to work, which is why the mitigation is
    // throttling and disclosure rather than revoking the grant.
    expect(allSql).toMatch(
      /grant\s+execute\s+on\s+function\s+(?:public\.)?get_league_preview\s*\(\s*text\s*\)\s*\n?\s*to\s+authenticated/i,
    )
  })
})
