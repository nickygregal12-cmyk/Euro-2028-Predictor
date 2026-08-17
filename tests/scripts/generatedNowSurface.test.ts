import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * NOW.md against the sources it is generated from.
 *
 * `DOC-001` stayed open through two documentation reconciliations for one
 * reason: a page that STATES a moving value has to be edited whenever the value
 * moves, and the edit is what gets forgotten. Development sat at contract 120 on
 * `main` for two hours after the fast lane took it to 122 — the correct record
 * existed the whole time, on a branch nobody was reading.
 *
 * So the fix is a page nobody types into. These tests hold the properties that
 * make that fix real rather than nominal:
 *
 *   - it agrees with the machine-readable contracts;
 *   - the template hard-codes no contract number, so it cannot be right today
 *     and quietly wrong tomorrow;
 *   - production authorisation is READ, never inferred from repository progress;
 *   - production is read from PRODUCTION'S record, and there is only one of it;
 *   - the requirement register is linked, not copied into a second list;
 *   - it cannot silently remain stale after a contract file changes.
 *
 * The fourth of those was added on 10 August 2026, after the page spent a day
 * reporting production at 145 while production stood at 151. Nobody had typed
 * the wrong number: production's contract was stated in two files, the
 * generator read the copy in the *development* record, and `--check`
 * regenerated from that same copy — so the gate agreed with the error by
 * construction. A duplicated fact with a one-directional check cannot be caught
 * by that check. The copy is gone; these tests are what keeps it gone.
 */

const repositoryRoot = process.cwd()
const scriptPath = resolve(repositoryRoot, 'scripts/generate-now.mjs')

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

const deploymentContract = JSON.parse(read('config/deployment-contract.json')) as {
  contractVersion: number
  requiredMigrationCount: number
}
const hostedContract = JSON.parse(read('config/development-hosted-contract.json')) as {
  requiredMigrationCount: number
  productionContract?: number
  productionPromotionAuthorised?: boolean
  latestMigrationVersion: string
  latestMigrationName: string
}
const productionContract = JSON.parse(read('config/production-hosted-contract.json')) as {
  requiredMigrationCount: number
  promotionAuthorised: boolean
}
const now = read('NOW.md')

/**
 * A requirement row in the register: any uppercase prefix, which may itself
 * carry a hyphen (`MIG-UI`), and however many digits its section chose. It
 * deliberately does not enumerate the prefixes — enumerating them is the defect
 * this shape replaced.
 */
const REGISTER_ROW = /^\| `[A-Z][A-Z-]*-\d+` \|/

/** Run the generator against a tree, returning stdout or throwing with stderr. */
function generate(root: string, args: string[] = ['--stdout']): string {
  return execFileSync('node', [scriptPath, '--root', root, ...args], {
    encoding: 'utf8',
    cwd: repositoryRoot,
  })
}

function expectFailure(root: string, args: string[] = ['--stdout']): string {
  try {
    generate(root, args)
  } catch (error) {
    const failure = error as { status?: number; stderr?: string }
    expect(failure.status).toBe(1)
    return failure.stderr ?? ''
  }
  throw new Error('the generator was expected to fail closed and did not')
}

/** Production's own record, which is the only place production is stated. */
function writeProductionFixture(
  root: string,
  record: { requiredMigrationCount: number; promotionAuthorised: boolean },
): void {
  writeFileSync(
    resolve(root, 'config/production-hosted-contract.json'),
    JSON.stringify({
      projectRef: 'fixture-production',
      latestMigrationVersion: '20260801000000',
      latestMigrationName: 'fixture',
      verifiedAt: '2026-08-01T00:00:00.000Z',
      evidence: { source: 'fixture', workflowRunId: 2 },
      ...record,
    }),
  )
}

/**
 * A minimal tree the generator can read. Defaults describe a coherent
 * repository; each test perturbs exactly one fact.
 */
function writeFixture(options: {
  repositoryContract?: number
  migrationCount?: number
  developmentContract?: number
  productionContract?: number
  productionPromotionAuthorised?: boolean
}): string {
  const repositoryContract = options.repositoryContract ?? 3
  const migrationCount = options.migrationCount ?? repositoryContract
  const developmentContract = options.developmentContract ?? repositoryContract

  const root = mkdtempSync(resolve(tmpdir(), 'generated-now-'))
  mkdirSync(resolve(root, 'config'), { recursive: true })
  mkdirSync(resolve(root, 'supabase/migrations'), { recursive: true })
  mkdirSync(resolve(root, 'src/app'), { recursive: true })
  mkdirSync(resolve(root, 'docs/quality'), { recursive: true })

  const names = Array.from(
    { length: migrationCount },
    (_, index) => `2026080100${String(index).padStart(4, '0')}_fixture_${index}.sql`,
  )
  for (const name of names) {
    writeFileSync(resolve(root, 'supabase/migrations', name), '-- fixture\n')
  }

  writeFileSync(
    resolve(root, 'config/deployment-contract.json'),
    JSON.stringify({
      contractVersion: repositoryContract,
      requiredMigrationCount: repositoryContract,
      requiredRpcSignatures: [],
    }),
  )

  const hostedLatest = names[developmentContract - 1] ?? names.at(-1) ?? ''
  const [version, ...rest] = hostedLatest.replace(/\.sql$/, '').split('_')
  writeFileSync(
    resolve(root, 'config/development-hosted-contract.json'),
    JSON.stringify({
      projectRef: 'fixture',
      requiredMigrationCount: developmentContract,
      latestMigrationVersion: version,
      latestMigrationName: rest.join('_'),
      verifiedAt: '2026-08-01T00:00:00.000Z',
      evidence: { source: 'fixture', workflowRunId: 1 },
    }),
  )

  writeProductionFixture(root, {
    requiredMigrationCount: options.productionContract ?? 1,
    promotionAuthorised: options.productionPromotionAuthorised ?? false,
  })

  writeFileSync(
    resolve(root, 'src/app/routeFlags.ts'),
    'export const a = import.meta.env.VITE_UI_FIXTURE_FLAG\n',
  )
  writeFileSync(resolve(root, 'netlify.toml'), '[build.environment]\n')
  writeFileSync(
    resolve(root, 'docs/quality/accepted-requirements.md'),
    [
      '| ID | Requirement | Depends on | Acceptance evidence | Status |',
      '| --- | --- | --- | --- | --- |',
      '| `SITE-001` | one | — | proof | Accepted — unimplemented |',
      '| `PRIV-003` | two | — | proof | Accepted — **blocked** |',
      '| `INGEST-001` | three | — | proof | **Implemented** — retained |',
      '',
    ].join('\n'),
  )

  return root
}

describe('NOW.md agrees with the machine-readable contracts', () => {
  it('states the repository, development and production contracts it is given', () => {
    expect(now).toContain(`| Repository | **${deploymentContract.requiredMigrationCount}** |`)
    expect(now).toContain(`| Development hosted | **${hostedContract.requiredMigrationCount}** |`)
    expect(now).toContain(`| Production | **${productionContract.requiredMigrationCount}** |`)
  })

  it('names the migration the hosted record names', () => {
    expect(now).toContain(
      `${hostedContract.latestMigrationVersion}_${hostedContract.latestMigrationName}.sql`,
    )
  })

  it('offers the next free contract as one past the repository, not a guess', () => {
    expect(now).toContain(
      `**Next free contract number:** ${deploymentContract.requiredMigrationCount + 1}`,
    )
  })
})

describe('the template hard-codes no contract number', () => {
  it('contains no two- or three-digit literal that could become a stale contract', () => {
    const source = read('scripts/generate-now.mjs')

    // Everything after the last import is template and logic. A literal contract
    // number anywhere in it would be right today and silently wrong later, which
    // is exactly the failure this page exists to end.
    const body = source.slice(source.lastIndexOf('import '))
    const suspicious = [...body.matchAll(/\bcontract[- ](\d{2,3})\b/gi)].map((m) => at(m, 1))

    expect(suspicious).toEqual([])
  })

  it('derives a different tree without carrying this repository forward', () => {
    const output = generate(writeFixture({ repositoryContract: 7, developmentContract: 5 }))

    expect(output).toContain('| Repository | **7** |')
    expect(output).toContain('| Development hosted | **5** |')
    expect(output).not.toContain(`**${deploymentContract.requiredMigrationCount}**`)
  })
})

describe('production authorisation is read, never inferred', () => {
  it('keeps production unauthorised however far the repository has come', () => {
    const output = generate(
      writeFixture({
        repositoryContract: 400,
        developmentContract: 400,
        productionContract: 1,
        productionPromotionAuthorised: false,
      }),
    )

    expect(output).toContain('promotion **not authorised**')
    expect(output).not.toContain('promotion **AUTHORISED**')
  })

  it('reports authorisation only when the hosted record states it', () => {
    const output = generate(
      writeFixture({ productionPromotionAuthorised: true, productionContract: 2 }),
    )

    expect(output).toContain('promotion **AUTHORISED**')
  })

  it('refuses a production record whose authorisation flag is not a boolean', () => {
    const root = writeFixture({})
    const path = resolve(root, 'config/production-hosted-contract.json')
    const record = JSON.parse(readFileSync(path, 'utf8'))
    record.promotionAuthorised = 'yes'
    writeFileSync(path, JSON.stringify(record))

    expect(expectFailure(root)).toContain('promotionAuthorised')
  })

  it('states in the page itself that promotion is never inferred', () => {
    expect(now).toContain('never inferred')
  })
})

describe('production is stated once, in production’s own record', () => {
  it('carries no copy of production in the development hosted record', () => {
    // The copy was refreshed by the DEVELOPMENT follow-up, so a PRODUCTION
    // rollout left it behind with nothing to move it. Both fields are gone.
    expect(hostedContract.productionContract).toBeUndefined()
    expect(hostedContract.productionPromotionAuthorised).toBeUndefined()
  })

  it('reports the contract production’s own record states', () => {
    expect(now).toContain(`| Production | **${productionContract.requiredMigrationCount}** |`)
    expect(now).toContain(
      productionContract.promotionAuthorised
        ? 'promotion **AUTHORISED**'
        : 'promotion **not authorised**',
    )
  })

  it('moves the page when production’s record moves, with no other file touched', () => {
    // This is the property `--check` could not hold while the number was
    // duplicated: it regenerated from the stale copy and agreed with itself.
    const root = writeFixture({ repositoryContract: 9, productionContract: 4 })
    generate(root, [])
    expect(readFileSync(resolve(root, 'NOW.md'), 'utf8')).toContain('| Production | **4** |')

    writeProductionFixture(root, { requiredMigrationCount: 9, promotionAuthorised: false })

    expect(expectFailure(root, ['--check'])).toContain('out of date')
    generate(root, [])
    expect(readFileSync(resolve(root, 'NOW.md'), 'utf8')).toContain('| Production | **9** |')

    // "No other file touched" was in this test's name and in none of its
    // assertions. It matters now that the generator also manages a region in
    // `current-status.md`: this fixture holds no such document, and the
    // generator must leave it that way rather than inventing one.
    expect(existsSync(resolve(root, 'docs/quality/current-status.md'))).toBe(false)
  })

  describe('the hosted-state region in current-status.md', () => {
    const BEGIN = '<!-- BEGIN GENERATED hosted-state -->'
    const END = '<!-- END GENERATED hosted-state -->'
    const statusPath = 'docs/quality/current-status.md'

    function withStatusDocument(root: string, body: string): string {
      const path = resolve(root, statusPath)
      writeFileSync(path, `# Fixture status\n\n${body}\n\nHand-written evidence below.\n`)
      return path
    }

    it('writes the three contracts into the region, derived from the records', () => {
      const root = writeFixture({
        repositoryContract: 7,
        developmentContract: 5,
        productionContract: 6,
      })
      const path = withStatusDocument(root, `${BEGIN}\n${END}`)
      generate(root, [])

      const status = readFileSync(path, 'utf8')
      expect(status).toContain('The repository is at **contract 7**')
      expect(status).toContain('Development Supabase is hosted at **5**')
      expect(status).toContain('Production Supabase is hosted at **6**')
      // Nothing outside the markers is rewritten.
      expect(status).toContain('# Fixture status')
      expect(status).toContain('Hand-written evidence below.')
    })

    it('reports promotion authorisation from the record rather than from the numbers', () => {
      // Level contracts are not authorisation. The record says so or it does not.
      const authorised = writeFixture({
        repositoryContract: 4,
        productionContract: 4,
        productionPromotionAuthorised: true,
      })
      const authorisedPath = withStatusDocument(authorised, `${BEGIN}\n${END}`)
      generate(authorised, [])
      expect(readFileSync(authorisedPath, 'utf8')).toContain('further promotion is **authorised**')

      const refused = writeFixture({ repositoryContract: 4, productionContract: 4 })
      const refusedPath = withStatusDocument(refused, `${BEGIN}\n${END}`)
      generate(refused, [])
      expect(readFileSync(refusedPath, 'utf8')).toContain(
        'further promotion is **not authorised**',
      )
    })

    it('moves the region when a record moves, and --check fails until it does', () => {
      const root = writeFixture({ repositoryContract: 9, productionContract: 4 })
      const path = withStatusDocument(root, `${BEGIN}\n${END}`)
      generate(root, [])
      expect(readFileSync(path, 'utf8')).toContain('Production Supabase is hosted at **4**')

      writeProductionFixture(root, { requiredMigrationCount: 9, promotionAuthorised: false })

      expect(expectFailure(root, ['--check'])).toMatch(/out of date|disagrees with the machine records/)
      generate(root, [])
      expect(readFileSync(path, 'utf8')).toContain('Production Supabase is hosted at **9**')
    })

    it('fails --check when the region is hand-edited away from the records', () => {
      const root = writeFixture({ repositoryContract: 8, productionContract: 8 })
      const path = withStatusDocument(root, `${BEGIN}\n${END}`)
      generate(root, [])

      writeFileSync(
        path,
        readFileSync(path, 'utf8').replace(
          'Production Supabase is hosted at **8**',
          'Production Supabase is hosted at **7**',
        ),
      )

      expect(expectFailure(root, ['--check'])).toContain('disagrees with the machine records')
    })

    it('fails closed when the document exists without the markers', () => {
      // Not the same as absent. A status document that has lost its markers is
      // one where the numbers have gone back to being stated by hand, so
      // appending a second copy would recreate the original defect.
      const root = writeFixture({})
      withStatusDocument(root, 'Production Supabase is hosted at **99** by hand.')

      expect(expectFailure(root, [])).toContain('missing the generated hosted-state markers')
    })
  })

  it('fails closed rather than choosing, if a second copy is reintroduced', () => {
    const root = writeFixture({ productionContract: 2 })
    const path = resolve(root, 'config/development-hosted-contract.json')
    const hosted = JSON.parse(readFileSync(path, 'utf8'))
    hosted.productionContract = 2 // agreeing today, and that is not the point
    writeFileSync(path, JSON.stringify(hosted))

    const stderr = expectFailure(root)
    expect(stderr).toContain('restates production')
    expect(stderr).toContain('config/production-hosted-contract.json')
  })
})

describe('the requirement register is linked, not copied', () => {
  it('links the register and counts it without restating a requirement', () => {
    expect(now).toContain('docs/quality/accepted-requirements.md')
    expect(now).toContain('not** copied here')

    // A requirement's own prose must not appear. If a row were copied, the
    // register and this page would need keeping in step — a second list.
    const register = read('docs/quality/accepted-requirements.md')
    const rows = register.split('\n').filter((line) => REGISTER_ROW.test(line))
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(now).not.toContain(row)
    }
  })

  it('counts every identifier the register uses, not a list of remembered ones', () => {
    // The counter and this test both spelled out the prefixes they knew about —
    // SITE, ACCOUNT, EURO, AGE, PRIV, INGEST, CAP — and matched three digits
    // only. Measured on 11 August 2026 the register held 63 rows and the page
    // counted 35: every `DFA-0nn` row missing because nobody added its prefix,
    // and every `MIG-UI-nn` row because its number is two digits. The page's
    // stated design is that it fails closed when two sources disagree, and it
    // was under-reporting the gap by 28 requirements in the one number it
    // publishes about them.
    //
    // So the property is coverage, not a longer list: every prefix that appears
    // in the register appears in the page's breakdown, or is fully implemented.
    const register = read('docs/quality/accepted-requirements.md')
    const rows = register.split('\n').filter((line) => REGISTER_ROW.test(line))

    const outstanding = rows.filter((row) => !/\*\*Implemented/.test(row))
    const prefixes = new Set(
      outstanding.map((row) => /`([A-Z][A-Z-]*)-\d+`/.exec(row)?.[1]).filter(Boolean),
    )

    expect(prefixes.size).toBeGreaterThan(6)
    for (const prefix of prefixes) {
      expect(now, `${prefix} has outstanding rows but does not appear in NOW.md`).toContain(
        `${prefix} `,
      )
    }
    expect(now).toContain(`**${outstanding.length}** accepted requirements are outstanding`)
  })

  it('counts only what is outstanding, excluding rows marked implemented', () => {
    // The register retains implemented rows deliberately — deleting one destroys
    // the only trace the requirement existed — so a page headed "not built" must
    // exclude them. An earlier draft matched `**Implemented**` exactly and
    // silently counted `**Implemented and in force**` as outstanding.
    const output = generate(writeFixture({}))

    expect(output).toContain('**2** accepted requirements are outstanding')
    expect(output).toContain('A further 1 are marked implemented')
  })
})

describe('it cannot silently remain stale', () => {
  it('is current for the repository as it stands', () => {
    expect(() => generate(repositoryRoot, ['--check'])).not.toThrow()
  })

  it('fails --check once a contract file changes underneath it', () => {
    const root = writeFixture({ repositoryContract: 3 })
    generate(root, [])

    const contractPath = resolve(root, 'config/deployment-contract.json')
    const contract = JSON.parse(readFileSync(contractPath, 'utf8'))
    contract.contractVersion = 4
    contract.requiredMigrationCount = 4
    writeFileSync(contractPath, JSON.stringify(contract))
    writeFileSync(
      resolve(root, 'supabase/migrations/202608010000003_fixture_3.sql'),
      '-- fixture\n',
    )

    expect(expectFailure(root, ['--check'])).toContain('out of date')
  })

  it('declares its generator in the file, so a hand edit is visibly wrong', () => {
    expect(now).toContain('GENERATED BY scripts/generate-now.mjs')
    expect(now).toContain('DO NOT EDIT BY HAND')
  })
})

describe('it fails closed when two sources disagree', () => {
  it('refuses a contract count the migration chain does not support', () => {
    expect(expectFailure(writeFixture({ repositoryContract: 5, migrationCount: 4 }))).toContain(
      'the chain holds 4',
    )
  })

  it('refuses a development contract ahead of the repository', () => {
    // A migration cannot be applied before it exists.
    const root = writeFixture({ repositoryContract: 3 })
    const hostedPath = resolve(root, 'config/development-hosted-contract.json')
    const hosted = JSON.parse(readFileSync(hostedPath, 'utf8'))
    hosted.requiredMigrationCount = 9
    writeFileSync(hostedPath, JSON.stringify(hosted))

    expect(expectFailure(root)).toContain('ahead of the repository')
  })

  it('refuses a production contract ahead of the repository', () => {
    expect(
      expectFailure(writeFixture({ repositoryContract: 3, productionContract: 8 })),
    ).toContain('ahead of the repository')
  })

  it('refuses a hosted record naming a migration the chain does not hold', () => {
    const root = writeFixture({ repositoryContract: 3 })
    const hostedPath = resolve(root, 'config/development-hosted-contract.json')
    const hosted = JSON.parse(readFileSync(hostedPath, 'utf8'))
    hosted.latestMigrationName = 'a_migration_that_does_not_exist'
    writeFileSync(hostedPath, JSON.stringify(hosted))

    expect(expectFailure(root)).toContain('not in the migration chain')
  })
})
