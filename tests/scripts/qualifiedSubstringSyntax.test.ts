import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..', '..')

const sqlFiles = execFileSync('git', ['ls-files', 'supabase/migrations/*.sql', 'supabase/tests/*.sql'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)

/**
 * `substring(x FROM pattern)` is SQL-standard syntax, and PostgreSQL recognises
 * it ONLY for the unqualified name. Write `pg_catalog.substring(x from y)` and
 * the parser reads `from` as the start of a FROM clause and rejects the
 * statement outright:
 *
 *     ERROR: syntax error at or near "from" (SQLSTATE 42601)
 *
 * Contract 169 shipped that in a DO block and Database parity refused the whole
 * migration chain over it — `supabase start` could not apply the migrations, so
 * no pgTAP suite ran at all and the failure looked like infrastructure.
 *
 * It survived local verification because that run applied the migration's
 * FUNCTIONS and skipped its assertion block, which is the only place the
 * expression appeared. A DO block is executable code and has to be executed.
 *
 * The rule is mechanical, so it is checked mechanically: schema-qualify and use
 * the two-argument form, or leave the name unqualified. `pg_catalog` is always
 * on the search path implicitly, so the unqualified form is not a search-path
 * risk either way.
 */
const QUALIFIED_SUBSTRING_WITH_FROM = /\b\w+\.substring\s*\([^()]*?\bfrom\b/is

describe('qualified substring never uses the FROM form', () => {
  it.each(sqlFiles)('%s', (file) => {
    const source = readFileSync(resolve(root, file), 'utf8')
    const offender = QUALIFIED_SUBSTRING_WITH_FROM.exec(source)

    expect(
      offender?.[0],
      `${file} uses the schema-qualified substring(x FROM y) form, which PostgreSQL refuses with ` +
        'SQLSTATE 42601. Use the two-argument form substring(x, y), or drop the schema qualifier.',
    ).toBeUndefined()
  })
})
