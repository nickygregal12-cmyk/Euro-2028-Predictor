import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  checkCoverage,
  checkFreshness,
  checkSweep,
  classify,
  currentContract,
  loadManifest,
  namedContracts,
  trackedMarkdown,
} from '../../scripts/check-documentation-authorities.mjs'

/**
 * The guard that replaces a habit.
 *
 * Every contract merged in this session made documents stale that had no
 * reason to be touched by it, and each was corrected afterwards by a separate
 * reconciliation pull request. Measured on 5 August 2026 at contract 109: ten
 * of the live-authority documents named 107 or older as their newest contract.
 *
 * The family of per-contract guards that grew alongside that had a second
 * problem. They asserted literal phrases, and two of them failed on prose
 * rather than content — one could not see "Contract 108" across a line wrap,
 * another could not see 109 inside "Contract 107–109". A guard that makes the
 * writing worse in order to pass is one that gets worked around, so the number
 * extraction below is tested against exactly those shapes.
 */

const manifest = loadManifest()

describe('contract mentions are read the way they are written', () => {
  it('reads a plain mention', () => {
    expect(namedContracts('applied at contract 109 today')).toEqual([109])
  })

  it('reads a range as naming every contract in it', () => {
    // The bug this pins: a lazy match stops at 107 and reports the document as
    // stale while it is describing 109 perfectly well.
    expect(namedContracts('the complete Contract 107–109 lifecycle')).toEqual([
      107, 109,
    ])
    expect(namedContracts('contracts 98-110 landed since')).toEqual([98, 110])
  })

  it('reads across a line wrap, because prose wraps', () => {
    expect(namedContracts('protected by Contract\n108 at the table')).toEqual([108])
  })

  it('reads the plural and the hyphen form', () => {
    expect(namedContracts('Contracts 104 and 105')).toEqual([104])
    expect(namedContracts('contract-103 prerequisite')).toEqual([103])
  })

  it('does not invent contracts from ordinary numbers', () => {
    expect(namedContracts('227 rows, 4014 characters, 30 minutes')).toEqual([])
    expect(namedContracts('ADR 0025 decision 1')).toEqual([])
  })

  it('does not read the front of a longer number as a contract', () => {
    // Found by the coverage rule on its first run, in a document nothing was
    // watching: a workflow run id inside a branch name read as "contract 314".
    // A contract number is a whole number or it is not one.
    expect(
      namedContracts('branch automation/development-hosted-contract-31417611501 is ahead'),
    ).toEqual([])
    expect(namedContracts('contract 1570 does not exist')).toEqual([])
    // And the ordinary forms still read exactly as before.
    expect(namedContracts('contract-157 landed')).toEqual([157])
    expect(namedContracts('Contracts 147–151 landed')).toEqual([147, 151])
  })
})

describe('freshness', () => {
  const authority = (path: string, kind: string) => ({
    authorities: [{ path, kind, sweep: false }],
  })

  it('accepts a live document naming the current contract', () => {
    expect(
      checkFreshness(authority('docs/quality/current-status.md', 'live'), currentContract()),
    ).toEqual([])
  })

  it('refuses a live document whose newest contract has been overtaken', () => {
    const problems = checkFreshness(authority('docs/quality/current-status.md', 'live'), 999)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('docs/quality/current-status.md')
    expect(problems[0]).toContain('999')
  })

  it('lets a disposition register name only what resolved an entry', () => {
    // A register has nothing to say about a contract that closed no entry.
    // Requiring it to name the current one would make it lie.
    expect(
      checkFreshness(authority('docs/quality/risk-register.md', 'dispositions'), 999),
    ).toEqual([])
  })

  it('still refuses a register that names a contract which does not exist', () => {
    const problems = checkFreshness(
      authority('docs/quality/risk-register.md', 'dispositions'),
      1,
    )
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('does not exist')
  })

  it('exempts structural inventories, which a real database checks instead', () => {
    expect(
      checkFreshness(
        authority('docs/architecture/stage-c-trigger-bindings.md', 'structural'),
        1,
      ),
    ).toEqual([])
  })

  it('holds every live authority in the committed manifest', () => {
    expect(checkFreshness(manifest, currentContract())).toEqual([])
  })
})

describe('the sweep gate', () => {
  const sweepManifest = {
    authorities: [
      { path: 'docs/quality/current-status.md', kind: 'live', sweep: true },
      { path: 'docs/roadmap.md', kind: 'live', sweep: true },
      { path: 'docs/quality/risk-register.md', kind: 'dispositions', sweep: false },
    ],
  }

  it('says nothing when no migration was added', () => {
    expect(checkSweep(sweepManifest, [], ['src/app.tsx'])).toEqual([])
  })

  it('refuses a migration that leaves a swept authority untouched', () => {
    const problems = checkSweep(
      sweepManifest,
      ['supabase/migrations/20260805060000_x.sql'],
      ['supabase/migrations/20260805060000_x.sql', 'docs/quality/current-status.md'],
    )
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('docs/roadmap.md')
    expect(problems[0]).not.toContain('- docs/quality/current-status.md')
  })

  it('accepts a migration that sweeps every one of them', () => {
    expect(
      checkSweep(
        sweepManifest,
        ['supabase/migrations/20260805060000_x.sql'],
        [
          'supabase/migrations/20260805060000_x.sql',
          'docs/quality/current-status.md',
          'docs/roadmap.md',
        ],
      ),
    ).toEqual([])
  })

  it('never demands a document that is not marked for sweeping', () => {
    // The registers are live but item-scoped. Demanding them on every contract
    // would train people to add a meaningless line to pass the gate.
    const problems = checkSweep(
      sweepManifest,
      ['supabase/migrations/20260805060000_x.sql'],
      ['supabase/migrations/20260805060000_x.sql'],
    )
    expect(problems[0]).not.toContain('risk-register')
  })
})

/**
 * The coverage rule, added 11 August 2026.
 *
 * The freshness and sweep rules were sound and were working. They only ever
 * applied to the documents someone had thought to list. Measured across the
 * whole repository at contract 157: 238 tracked markdown files, 15 declared
 * authorities, 122 declared evidence — and 101 governed by nothing, of which 51
 * named contract numbers and the oldest named 35.
 *
 * An unlisted document looks exactly like a governed one to a reader, which is
 * why the gap mattered more than its size suggests, and why the fix is a
 * property rather than a longer list: there is no fourth state.
 */
describe('coverage', () => {
  const files = trackedMarkdown()

  it('leaves no tracked document governed by nothing', () => {
    expect(checkCoverage(manifest, files)).toEqual([])
  })

  it('actually looked at the repository', () => {
    // Guard the guard. If `git ls-files` stopped returning documents, the
    // assertion above would pass by finding nothing at all.
    expect(files.length).toBeGreaterThan(200)
    expect(files).toContain('README.md')
    expect(files).toContain('docs/adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md')
  })

  it('reports an unclassified file rather than ignoring it', () => {
    const problems = checkCoverage(manifest, ['docs/something-nobody-listed.md'])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('docs/something-nobody-listed.md')
    expect(problems[0]).toContain('governed by nothing')
  })

  it('names a file over any directory it sits in', () => {
    // docs/adr/ is a reference directory; the index inside it is separately
    // live because each of its rows carries an implementation status.
    expect(classify(manifest, 'docs/adr/README.md')).toMatchObject({
      state: 'authority',
      kind: 'live',
    })
    expect(classify(manifest, 'docs/adr/0011-multi-competition-platform.md')).toMatchObject({
      state: 'authority',
      kind: 'reference',
    })
  })

  it('resolves a nested directory by the longer prefix, whichever list it came from', () => {
    // This single precedence rule is what lets docs/ops/ be procedures while
    // docs/ops/records/ inside it is evidence, with neither nesting written
    // down as an exception.
    expect(classify(manifest, 'docs/ops/ops-admin-bootstrap.md')).toMatchObject({
      state: 'authority',
      by: 'docs/ops/',
    })
    expect(classify(manifest, 'docs/ops/records/ops-prod-cutover.md')).toMatchObject({
      state: 'evidence',
      by: 'docs/ops/records/',
    })
    expect(classify(manifest, 'docs/quality/knip-baseline.md')).toMatchObject({
      state: 'authority',
      by: 'docs/quality/',
    })
    expect(classify(manifest, 'docs/quality/audits/2026-07-23-full-audit.md')).toMatchObject({
      state: 'evidence',
      by: 'docs/quality/audits/',
    })
  })

  it('holds a reference document to the rule that cannot be innocent', () => {
    // A reference names what BUILT the thing it describes, so it is never
    // required to name the current contract — but citing one that has never
    // existed is wrong on its face.
    const one = { authorities: [{ path: 'docs/scoring-rules.md', kind: 'reference' }] }
    expect(checkFreshness(one, currentContract())).toEqual([])
    const problems = checkFreshness(one, 1)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('does not exist')
  })

  it('checks the documents that only a directory rule classifies', () => {
    // Without the file list, freshness saw only what was listed individually —
    // which is how a directory-classified document could name contract 999 and
    // pass.
    expect(checkFreshness(manifest, currentContract(), process.cwd(), files)).toEqual([])
  })
})

describe('the manifest itself', () => {
  it('classifies every document that is allowed to name a contract', () => {
    for (const entry of manifest.authorities) {
      expect(['live', 'dispositions', 'structural', 'reference']).toContain(entry.kind)
      expect(entry.why, `${entry.path} needs a reason`).toBeTruthy()
      expect(
        readFileSync(resolve(process.cwd(), entry.path), 'utf8').length,
      ).toBeGreaterThan(0)
    }
  })

  it('names each path once', () => {
    // A path listed twice resolves by whichever entry `classify` reaches
    // first, which makes the second one invisible and the manifest quietly
    // ambiguous about what it decided. Promoting docs/design-system.md from
    // reference to live left exactly that.
    const paths = manifest.authorities.map((entry: { path: string }) => entry.path)
    expect(paths).toEqual([...new Set(paths)])

    const exempt = manifest.outOfScope.map((entry: { path: string }) => entry.path)
    expect(exempt).toEqual([...new Set(exempt)])
    expect(paths.filter((path: string) => exempt.includes(path))).toEqual([])
  })

  it('requires a reason from a directory rule and from an exemption too', () => {
    // A manifest entry without a reason is how a control becomes a ritual, and
    // that applies hardest to the entries that cover many files at once, or
    // that take a file out of the system altogether.
    for (const entry of manifest.authorityDirectories) {
      expect(['live', 'dispositions', 'structural', 'reference']).toContain(entry.kind)
      expect(entry.prefix.endsWith('/'), `${entry.prefix} must be a directory`).toBe(true)
      expect(entry.why, `${entry.prefix} needs a reason`).toBeTruthy()
    }
    for (const entry of manifest.outOfScope) {
      expect(entry.why, `${entry.path} needs a reason`).toBeTruthy()
    }
  })

  it('keeps the exemptions few enough to read', () => {
    // Out-of-scope is the one state with no check behind it, so its size is
    // the measure of how much of the repository is taken on trust.
    expect(manifest.outOfScope.length).toBeLessThanOrEqual(8)
  })

  it('keeps dated evidence out of the freshness rules by classification', () => {
    // Evidence must keep saying what was true when it was written. Listing the
    // directories makes that a decision rather than an oversight.
    expect(manifest.evidenceDirectories).toContain('docs/quality/investigations/')
    expect(manifest.evidenceDirectories).toContain('docs/automation-runs/')
    for (const directory of manifest.evidenceDirectories) {
      expect(
        manifest.authorities.some((entry: { path: string }) =>
          entry.path.startsWith(directory),
        ),
        `${directory} is evidence and must not also be an authority`,
      ).toBe(false)
    }
  })
})
