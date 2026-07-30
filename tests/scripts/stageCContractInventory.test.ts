import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The Stage C pre-migration contract inventory, against the documents that
 * report its progress.
 *
 * Roadmap step 4 lists seven contracts that must exist before a Stage C
 * migration is written, and `current-status.md` reports how many have landed.
 * Both are prose. Nothing related either to the files on disk, so both drifted
 * within ninety minutes of being corrected: PRs #286 and #292 landed the last
 * two suites, and the roadmap still marked one "draft PR #286" and the other
 * "not started".
 *
 * That is a worse failure than a stale contract number. A reader deciding what
 * to work on next sees two outstanding test suites and builds one that already
 * exists — or, in the other direction, a suite is quietly dropped and the
 * roadmap still claims seven.
 *
 * `documentationContractFreshness` does not cover this: it checks contract
 * numbers and pinned SHAs, and both were correct while this was wrong.
 *
 * The guard is deliberately inventory-based rather than count-based. Asserting
 * "seven have landed" would pass if one were deleted and another added, which
 * is exactly the substitution worth catching.
 */

const repositoryRoot = process.cwd()

/** Stage C artefacts, discovered rather than hard-coded, so a new one is seen. */
function stageCArtefacts(): string[] {
  const pgTap = readdirSync(resolve(repositoryRoot, 'supabase/tests'))
    .filter((file) => /^\d+_stage_c_.*\.sql$/.test(file))
    .sort()

  const parity = readdirSync(resolve(repositoryRoot, 'tests/database-parity'))
    .filter((file) => /^stageC.*\.test\.ts$/.test(file))
    .sort()

  return [...parity, ...pgTap]
}

/**
 * The token each artefact must be findable by in prose.
 *
 * pgTAP suites are named in full because the filename is how they are run.
 * TypeScript suites are named without the `.test.ts` suffix, because that is
 * how every existing document already refers to them and forcing the extension
 * would be churn for no added precision.
 */
function documentedToken(artefact: string): string {
  return artefact.endsWith('.test.ts') ? artefact.replace(/\.test\.ts$/, '') : artefact
}

const REPORTING_DOCUMENTS = ['docs/roadmap.md', 'docs/quality/current-status.md'] as const

function read(file: string): string {
  return readFileSync(resolve(repositoryRoot, file), 'utf8')
}

describe('Stage C pre-migration contract inventory', () => {
  it('finds the artefacts at all', () => {
    // Without this, a renamed directory or changed naming convention would
    // empty the inventory and make every assertion below pass vacuously — the
    // failure mode that made two guards in `documentationContractFreshness`
    // dead on arrival.
    const artefacts = stageCArtefacts()
    expect(artefacts.length, 'no Stage C artefacts discovered').toBeGreaterThanOrEqual(7)
    expect(artefacts.filter((file) => file.endsWith('.sql')).length).toBeGreaterThanOrEqual(2)
    expect(artefacts.filter((file) => file.endsWith('.test.ts')).length).toBeGreaterThanOrEqual(5)
  })

  it.each(REPORTING_DOCUMENTS)('%s names every Stage C contract that exists', (file) => {
    const source = read(file)
    const missing = stageCArtefacts().filter(
      (artefact) => !source.includes(documentedToken(artefact)),
    )

    expect(
      missing,
      `${file} does not mention: ${missing.join(', ')}. A Stage C contract landed ` +
        'without the progress reporting changing, which is how "not started" ' +
        'survived the suite being merged.',
    ).toEqual([])
  })

  it('does not describe a landed contract as outstanding', () => {
    // The specific drift observed: an artefact present on disk, named in the
    // roadmap, but still carrying the "not started"/"draft PR" wording beside
    // it. Naming alone is not enough — the status has to move too.
    const roadmap = read('docs/roadmap.md')
    for (const artefact of stageCArtefacts()) {
      const token = documentedToken(artefact)
      for (const line of roadmap.split('\n')) {
        if (!line.includes(token)) continue
        expect(
          /not started|draft PR|⬜/i.test(line),
          `docs/roadmap.md still calls ${token} outstanding, but the file exists`,
        ).toBe(false)
      }
    }
  })
})
