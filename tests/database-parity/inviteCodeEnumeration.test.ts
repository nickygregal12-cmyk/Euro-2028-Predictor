import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * The league invite-code surface, AFTER contract 152 mitigated it.
 *
 * THIS FILE WAS A BEFORE-STATE CONTRACT and did its job exactly as designed.
 * It pinned what the schema actually did while `ACQ-R10` and `SEC-001` were
 * only prose, so the mitigation had to arrive as a visible edit here rather
 * than as an unnoticed improvement — and contract 152 could not be written
 * without breaking five of its assertions on purpose. What it recorded, and
 * which is now history rather than current state:
 *
 *   - the generator was `random()`, which PostgreSQL documents as a
 *     deterministic PRNG explicitly unsuitable for cryptographic use;
 *   - the keyspace was 31^6 — 887,503,681 — and the probability of a *hit*
 *     scales with the number of leagues, so it got weaker as the platform
 *     succeeded;
 *   - `get_league_preview` was unthrottled, because rate limiting was
 *     trigger-based on table writes and a preview writes nothing. Joining was
 *     limited to five per window; *probing* was unlimited;
 *   - one guess returned `id`, `name`, `member_count`, `owner_name` and
 *     `is_member` — enough to identify a private group and name a real person,
 *     not merely to confirm a code existed.
 *
 * The assertions below are the same properties with their answers moved, so
 * this file keeps doing the same job in the other direction: a regression that
 * shortened the code, restored `random()`, widened the payload or dropped the
 * probe charge has to edit this file to land.
 *
 * ONE THING IS UNCHANGED AND SHOULD STAY THAT WAY. The alphabet still omits
 * `0/O` and `1/I/L` so a code can be read aloud. Length was the cheap lever, as
 * the before-state predicted; alphabet size was not.
 *
 * Text-based over the committed migrations, so it needs no database. The pgTAP
 * suite `201_invite_code_hardening.sql` covers the behaviour these assertions
 * can only see the shape of — in particular that the generator's output is
 * uniform rather than modulo-biased, which no amount of reading the SQL proves.
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

/**
 * The LIVE definition of the invite-code generator — the last one in migration
 * order, which is the one PostgreSQL is left holding.
 *
 * The before-state version of this helper threw unless there was exactly one
 * definition, with the note "if it is now defined twice, the last one wins and
 * this test is reading the wrong body". There are two now, so it takes the last
 * one; it still refuses zero, because reading no body would let every assertion
 * below pass against an empty string.
 */
function generatorBody(): string {
  const definitions = [
    ...allSql.matchAll(
      /create\s+or\s+replace\s+function\s+(?:public\.)?gen_invite_code\s*\(\s*\)([\s\S]*?)\$\$;/gi,
    ),
  ]
  if (definitions.length === 0) {
    throw new Error('No gen_invite_code definition found in the migration chain.')
  }
  return at(at(definitions, definitions.length - 1), 1)
}

/**
 * The live definition of a function, by name — the last one wins.
 *
 * Matches `create function` as well as `create or replace function`, because
 * contract 152 has to DROP `get_league_preview` before recreating it: narrowing
 * a return type is `cannot change return type of existing function` to
 * PostgreSQL, so replace is not available.
 */
function functionBody(name: string): string {
  const matches = [
    ...allSql.matchAll(
      new RegExp(
        `create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${name}[\\s\\S]*?\\$\\$;`,
        'gi',
      ),
    ),
  ]
  if (matches.length === 0) throw new Error(`No definition found for ${name}.`)
  return at(matches, matches.length - 1)[0]
}

describe('invite-code generation', () => {
  it('parses the generator at all', () => {
    // Without this the assertions below could pass against an empty string.
    expect(generatorBody().length).toBeGreaterThan(50)
  })

  it('draws from a cryptographic source, not the PRNG it used to', () => {
    const body = generatorBody()

    expect(body).toMatch(/gen_random_bytes/i)
    expect(body, 'random() is a deterministic PRNG and must not generate a secret').not.toMatch(
      /\brandom\s*\(\s*\)/i,
    )
  })

  it('rejects the biased bytes rather than taking a modulo of all of them', () => {
    // The subtle half. `byte % 31` is not uniform — 256 = 8*31 + 8, so the first
    // eight characters come up nine times in 256 and the rest eight, a 12.5%
    // bias on every character of every code. A biased code still looks random,
    // so nothing but this assertion and the pgTAP distribution check would
    // notice it.
    const body = generatorBody()

    expect(body, 'the generator must compute an unbiased ceiling').toMatch(
      /\(\s*256\s*\/\s*size\s*\)\s*\*\s*size/,
    )
    expect(body, 'bytes at or above the ceiling must be discarded').toMatch(/if\s+b\s*<\s*ceiling/i)
  })

  it('pins the alphabet and length that set the keyspace', () => {
    const body = generatorBody()
    const alphabet = /alphabet\s+text\s*:=\s*'([^']+)'/i.exec(body)?.[1] ?? ''
    const wanted = /wanted\s+int\s*:=\s*(\d+)/i.exec(body)?.[1] ?? ''

    expect(alphabet).toBe('ABCDEFGHJKMNPQRSTUVWXYZ23456789')
    expect(alphabet).toHaveLength(31)
    expect(wanted).toBe('12')

    // 31^12 ≈ 7.9e17, against the 887,503,681 the before-state recorded. Stated
    // as an assertion so a shortened code cannot quietly give the ground back.
    expect(alphabet.length ** Number(wanted)).toBeGreaterThan(1e17)
  })

  it('keeps the read-aloud alphabet free of ambiguous characters', () => {
    const alphabet = /alphabet\s+text\s*:=\s*'([^']+)'/i.exec(generatorBody())?.[1] ?? ''
    for (const ambiguous of ['0', 'O', '1', 'I', 'L']) {
      expect(alphabet, `alphabet should omit ${ambiguous}`).not.toContain(ambiguous)
    }
  })

  it('retries on collision rather than failing the first attempt', () => {
    expect(allSql).toMatch(/exception\s+when\s+unique_violation/i)
  })

  it('drops the preview rather than replacing it, because a narrowed return needs it', () => {
    // PostgreSQL answers `cannot change return type of existing function`
    // (42P13) to a `create or replace` that narrows OUT parameters, and five
    // columns to two is exactly that. Database parity found this by rebuilding
    // every migration on a disposable database; nothing that reads the SQL
    // could have. The drop is what makes contract 152 non-additive, so this
    // assertion is also the reason it takes the guarded rollout.
    expect(allSql).toMatch(/drop\s+function\s+if\s+exists\s+public\.get_league_preview\(text\)/i)
  })

  it('keeps the game-membership gate that join_league already enforced', () => {
    // An earlier draft of contract 152 rebuilt `join_league` from the 19 July
    // original instead of from `20260803070000_c1b_game_catalogue_memberships`,
    // and silently dropped this refusal along with the pinned empty
    // `search_path` — while claiming to add only a rate limit. Deleting a
    // membership rule is not something a rate-limit change gets to do.
    const join = functionBody('join_league')

    expect(join).toContain('Join this league game before joining its private league')
    expect(join).toMatch(/set\s+search_path\s*=\s*''/)
  })

  it('still accepts every code already issued', () => {
    // The constraint had to widen rather than move: a league created before
    // contract 152 holds a six-character code, and a migration that invalidated
    // it would break that league's invite for everyone holding it.
    expect(allSql).toMatch(/invite_code\s*~\s*'\^\[A-Z0-9\]\{6,16\}\$'/)
  })
})

describe('invite-code probing costs the caller', () => {
  /** Every action name passed to the rate limiter, with its ceiling. */
  function rateLimitedActions(): Record<string, number> {
    const found: Record<string, number> = {}
    for (const match of allSql.matchAll(/enforce_rate_limit\s*\(\s*'([a-z_]+)'\s*,\s*(\d+)\s*\)/gi)) {
      found[at(match, 1)] = Number(match[2])
    }
    return found
  }

  it('rate-limits three actions, one of which is a read', () => {
    // The before-state named exactly two, "both of them writes", and called the
    // absence of a read-side limit the omission that mattered. This is that
    // omission closed.
    expect(rateLimitedActions()).toEqual({
      prediction_save: 60,
      league_membership: 5,
      league_invite_probe: 20,
    })
  })

  it('charges the preview, which used to be free', () => {
    const preview = functionBody('get_league_preview')

    expect(preview).toMatch(/enforce_rate_limit\s*\(\s*'league_invite_probe'/i)
    // It was `language sql ... stable`, which is why no trigger could fire on
    // it. Charging the limiter is a write, so it cannot be stable any more.
    expect(preview, 'a stable function cannot charge a limiter').not.toMatch(/\bstable\b/i)
  })

  it('charges the join BEFORE the code is looked up, so a miss costs what a hit costs', () => {
    // The ordering IS the fix. A limiter charged after a successful lookup is
    // the one that was already there — it funded probing by only ever billing
    // for success.
    const join = functionBody('join_league')
    const charge = join.search(/enforce_rate_limit/i)
    const lookup = join.search(/where\s+league\.invite_code/i)

    expect(charge).toBeGreaterThan(-1)
    expect(lookup).toBeGreaterThan(-1)
    expect(charge).toBeLessThan(lookup)
  })

  it('tells one guess only what a join screen needs', () => {
    const signature =
      /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?get_league_preview\s*\(\s*p_code\s+text\s*\)\s*returns\s+table\s*\(([^)]*)\)/gi
    const matches = [...allSql.matchAll(signature)]
    const columns = [
      ...at(at(matches, matches.length - 1), 1).matchAll(/([a-z_]+)\s+(?:uuid|text|int|boolean)/gi),
    ].map((match) => at(match, 1))

    // Was `['id', 'name', 'member_count', 'owner_name', 'is_member']`.
    // `member_count` and `owner_name` are what identified WHICH private group a
    // guessed code belonged to; `owner_name` also disclosed a real person's
    // display name to whoever guessed. `id` was returned and never read.
    expect(columns).toEqual(['name', 'is_member'])
  })

  it('still grants preview to every authenticated user', () => {
    // Unchanged and deliberately so: the join flow needs it, which is why the
    // mitigation is throttling and disclosure rather than revoking the grant.
    expect(allSql).toMatch(
      /grant\s+execute\s+on\s+function\s+(?:public\.)?get_league_preview\s*\(\s*text\s*\)\s*\n?\s*to\s+authenticated/i,
    )
  })
})

describe('a leaked code is recoverable', () => {
  it('offers rotation, owner-only, and to nobody anonymous', () => {
    // The fourth thing `SEC-001` asks for. Before this, a code posted publicly
    // by mistake could only be escaped by deleting the league.
    const rotate = functionBody('rotate_league_invite_code')

    expect(rotate).toMatch(/owner_id\s*=\s*v_uid/i)
    expect(rotate).toMatch(/insufficient_privilege/)
    expect(allSql).toMatch(
      /grant\s+execute\s+on\s+function\s+(?:public\.)?rotate_league_invite_code\s*\(\s*uuid\s*\)\s*\n?\s*to\s+authenticated/i,
    )
  })

  it('refuses a league that is not yours and one that does not exist identically', () => {
    // Otherwise rotation becomes a probe of its own: two different refusals
    // would tell a caller which league ids are real.
    const rotate = functionBody('rotate_league_invite_code')
    const refusals = [...rotate.matchAll(/raise\s+exception\s+'([^']+)'/gi)].map((m) => at(m, 1))

    expect(refusals).toContain('Only the league owner can change its invite code')
    expect(
      refusals.filter((message) => /exist|not found|no such/i.test(message)),
      'a "no such league" refusal would distinguish the two cases',
    ).toEqual([])
  })
})
