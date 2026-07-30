import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The Stage C database-contract inventory, against the documents that report its
 * progress.
 *
 * The roadmap originally listed seven contracts that had to exist before a
 * Stage C migration could be written. PRs #286 and #292 landed the final two,
 * but the prose still called them outstanding. The C1/C2 split later added the
 * `stageC1NonInterference` boundary guard, so the inventory now covers the seven
 * original suites plus that required C1 guard.
 *
 * This is deliberately inventory-based rather than a prose count. A reader must
 * be able to discover every executable database contract from both the roadmap
 * and current status, and the C1 boundary guard may not disappear while the
 * original count still happens to look plausible.
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
 * TypeScript suites are named without the `.test.ts` suffix, because that is how
 * the live documents refer to them.
 */
function documentedToken(artefact: string): string {
  return artefact.endsWith('.test.ts') ? artefact.replace(/\.test\.ts$/, '') : artefact
}

const REPORTING_DOCUMENTS = ['docs/roadmap.md', 'docs/quality/current-status.md'] as const

function read(file: string): string {
  return readFileSync(resolve(repositoryRoot, file), 'utf8')
}

describe('Stage C database-contract inventory', () => {
  it('finds the original suites and the C1 boundary guard', () => {
    // Without positive controls, a renamed directory or changed naming
    // convention would empty the inventory and make every assertion below pass.
    const artefacts = stageCArtefacts()
    expect(artefacts.length, 'no Stage C artefacts discovered').toBeGreaterThanOrEqual(8)
    expect(artefacts.filter((file) => file.endsWith('.sql')).length).toBeGreaterThanOrEqual(2)
    expect(artefacts.filter((file) => file.endsWith('.test.ts')).length).toBeGreaterThanOrEqual(6)
    expect(artefacts).toContain('stageC1NonInterference.test.ts')
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
    // Naming alone is not enough — the status has to move too.
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
