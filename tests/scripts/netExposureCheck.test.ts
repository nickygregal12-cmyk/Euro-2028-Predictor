import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `DB-004`'s hosted assertion, and the properties that make it safe to point at
 * Production.
 *
 * The check itself cannot run here — it reads a hosted database. What CAN be
 * proved from the repository is the part that would be dangerous to get wrong,
 * and it is the reason these assertions exist rather than a comment saying
 * "this is read-only":
 *
 *   1. **It writes nothing.** It runs against Production. A stray `update` in a
 *      file nobody re-reads is exactly the kind of thing that gets added later
 *      by someone extending a check.
 *   2. **It fails closed.** A check that cannot see the exposed schema list
 *      must fail, not pass. "Unknown" and "safe" are different answers, and
 *      only one of them is true when the connection is misconfigured.
 *   3. **It runs against BOTH environments**, which is what `DB-004` asks for
 *      in as many words. One environment checked and the other assumed is how
 *      Production ends up being the one nobody looked at.
 */

const repositoryRoot = process.cwd()

const checkSql = readFileSync(
  resolve(repositoryRoot, 'supabase/checks/net-exposure.sql'),
  'utf8',
)
const workflow = readFileSync(
  resolve(repositoryRoot, '.github/workflows/net-exposure-check.yml'),
  'utf8',
)

/** The check's SQL with `--` comments stripped, so prose cannot parse as DDL. */
const executable = checkSql
  .split('\n')
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n')

describe('the net-exposure check is safe to run against Production', () => {
  it('contains no statement that writes', () => {
    // Deliberately matched over the comment-stripped source: the header
    // explains what it does NOT do, and those sentences must not be what makes
    // this pass or fail.
    const writes = [
      /\binsert\s+into\b/i,
      /\bupdate\s+\w+\s+set\b/i,
      /\bdelete\s+from\b/i,
      /\bcreate\s+(?:table|function|index|trigger|schema|extension|role)\b/i,
      /\balter\s+(?:table|function|role|schema|database)\b/i,
      /\bdrop\s+(?:table|function|index|trigger|schema|extension|role)\b/i,
      /\b(?:grant|revoke)\b/i,
      /\btruncate\b/i,
      /\bset_config\s*\(/i,
    ]

    const found = writes.filter((pattern) => pattern.test(executable)).map(String)

    expect(found, `Write statements found in a check that runs against Production:\n  ${found.join('\n  ')}`)
      .toEqual([])
  })

  it('reads the exposed schema list from where PostgREST reads it', () => {
    // Not from a copy. `pgrst.db_schemas` on the `authenticator` role IS the
    // setting; anything else would be a second statement of the same fact,
    // which is the shape of defect AUD-36 recorded.
    expect(executable).toMatch(/pg_catalog\.pg_roles/)
    expect(executable).toMatch(/rolname\s*=\s*'authenticator'/)
    expect(executable).toMatch(/pgrst\\?\.db_schemas/)
  })

  it('treats an unreadable schema list as a failure, not a pass', () => {
    // The assertion that decides whether this check is worth anything. If the
    // role config cannot be read, the exposed list is UNKNOWN — and a check
    // that reports unknown as safe is worse than no check, because it is
    // believed.
    expect(executable).toMatch(/if\s+v_config\s+is\s+null\s+then[\s\S]{0,400}raise\s+exception/i)
    expect(executable).toMatch(/if\s+v_schemas\s+is\s+null\s+then[\s\S]{0,400}raise\s+exception/i)
  })

  it('raises rather than notices when net is exposed', () => {
    const exposedBranch =
      /btrim\(s\)\s*=\s*'net'[\s\S]{0,600}?(raise\s+(?:exception|notice))/i.exec(executable)?.[1] ??
      ''

    expect(exposedBranch.toLowerCase()).toContain('exception')
  })

  it('scopes the function check to whatever is actually exposed', () => {
    // Hard-coding `('public', 'graphql_public')` would leave a third exposed
    // schema's functions outside the check at the exact moment someone had just
    // exposed one.
    expect(executable).toMatch(/nspname\s*=\s*any\s*\([\s\S]{0,200}v_schemas/i)
    expect(executable, 'the exposed schema list must not be hard-coded').not.toMatch(
      /nspname\s+in\s*\(\s*'public'\s*,\s*'graphql_public'\s*\)/i,
    )
  })

  it('reports the platform-owned residue instead of failing on it', () => {
    // `anon` and `authenticated` keep usage on `net` because the platform owns
    // the extension and `postgres` cannot revoke it. Failing on that would make
    // this permanently red on a condition nobody here can change, which is how
    // a check stops being read.
    const residualBranch =
      /v_residual\s+is\s+not\s+null\s+then[\s\S]{0,600}?(raise\s+(?:exception|notice))/i.exec(
        executable,
      )?.[1] ?? ''

    expect(residualBranch.toLowerCase()).toContain('notice')
  })
})

describe('the workflow runs it where DB-004 asks', () => {
  it('covers Development and Production', () => {
    expect(workflow).toMatch(/environment:\s*Development/)
    expect(workflow).toMatch(/environment:\s*Production/)
    expect(workflow).toContain('SUPABASE_DEV_DB_URL')
    expect(workflow).toContain('SUPABASE_PROD_DB_URL')
  })

  it('does not stop at the first failing environment', () => {
    // If Development is exposed, the Production answer is the one somebody
    // needs next.
    expect(workflow).toMatch(/fail-fast:\s*false/)
  })

  it('fails rather than skips when a target secret is missing', () => {
    // A check that could not reach its target has not passed. Skipping would
    // show a green tick for an environment nobody looked at.
    expect(workflow).toMatch(/if\s+\[\s+-z\s+"\$\{TARGET_DB_URL\}"\s+\][\s\S]{0,400}exit 1/)
  })

  it('runs on a schedule, because the setting it watches changes outside a pull request', () => {
    // The whole failure mode is a console change with no commit behind it.
    expect(workflow).toMatch(/schedule:\s*\n\s*(?:#[^\n]*\n\s*)*- cron:/)
  })

  it('does NOT run on pull requests, and that is deliberate', () => {
    // The first version of this workflow did, and it failed on the pull request
    // that introduced it. The cause is structural rather than a missing setting:
    // the job needs a database URL and FAILS rather than skips without one, so a
    // pull-request run can only be red or meaningless. A permanently red check
    // is one people learn to scroll past, which is the failure `DB-004` is
    // actually about — a control that stops being read.
    //
    // Everything a pull request can honestly verify about this check is verified
    // by THIS FILE, which does run on every pull request. The trigger only added
    // the part that needs credentials.
    //
    // Restoring it is fine once the secrets are exposed to pull-request runs.
    // That is an owner's decision about secret exposure, so it has to be made
    // deliberately — which is what this assertion forces.
    expect(workflow).not.toMatch(/^\s*pull_request:/m)
  })

  it('takes no write permission', () => {
    expect(workflow).toMatch(/permissions:\s*\n\s*contents:\s*read\s*\n/)
    expect(workflow).not.toMatch(/contents:\s*write/)
  })
})
