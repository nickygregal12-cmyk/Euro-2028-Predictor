import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Documents that declare themselves live authorities, against the contract they
 * claim to state.
 *
 * Three files in this repository assert, in their own words, that they are the
 * current truth: `current-status.md` calls itself *"the only live implementation
 * and hosted-status authority"*, `ops-pending-migrations.md` calls itself
 * *"live source of truth for repository migration count"*, and `AGENTS.md` is
 * the standing brief every agent session reads first.
 *
 * Nothing related any of them to `config/deployment-contract.json`. On 30 July
 * 2026 all three were stale in the same way at the same time: the contract had
 * moved 63 → 64 and every one of them still said 63, while two also pinned a
 * `main` SHA that roughly twenty-five merges had passed. A document that claims
 * to be the live source of truth and is not is worse than no document, because
 * it is read *instead of* checking.
 *
 * This is the freshness check for the part that can be checked mechanically.
 *
 * What it cannot check, stated so the coverage is not overread: whether the
 * prose is *correct*, whether hosted environments actually match, or whether a
 * document is stale in some way that is not a number. It checks that the
 * contract number these files state is the contract number the repository has,
 * and that they do not reintroduce a pinned `main` SHA — which is the specific
 * rot that produced today's drift.
 */

const repositoryRoot = process.cwd()

const contract = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'config/deployment-contract.json'), 'utf8'),
) as { contractVersion: number; requiredMigrationCount: number }

const developmentHosted = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'config/development-hosted-contract.json'), 'utf8'),
) as { requiredMigrationCount: number }

const productionHosted = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'config/production-hosted-contract.json'), 'utf8'),
) as { requiredMigrationCount: number }

const migrationCount = readdirSync(resolve(repositoryRoot, 'supabase/migrations')).filter((file) =>
  file.endsWith('.sql'),
).length

/** Files that assert they are current truth, and must therefore be current. */
const LIVE_AUTHORITIES = [
  'docs/quality/current-status.md',
  'docs/ops/ops-pending-migrations.md',
  'AGENTS.md',
] as const

function read(file: string): string {
  return readFileSync(resolve(repositoryRoot, file), 'utf8')
}

/**
 * Whether a document names a contract number *as a contract*.
 *
 * A bare substring search is not good enough and the first draft of this file
 * proved it: `toContain('64')` passes on a date, a byte count, or the `64` in a
 * commit SHA. Reverting the document to say 63 everywhere still passed, so the
 * test asserted nothing — the exact shape of dead control this suite exists to
 * catch. The number has to be attached to the word "contract", or to
 * "canonical migrations", to count.
 */
function namesContract(source: string, version: number): boolean {
  const patterns = [
    new RegExp(`contracts?\\s*\\**\\s*${version}\\b`, 'i'),
    new RegExp(`\\*{0,2}${version}\\*{0,2}\\s*canonical`, 'i'),
    new RegExp(`contract\\s*\\**\\s*is\\s*\\**\\s*${version}\\b`, 'i'),
    new RegExp(`EURO28_DEPLOYED_DB_CONTRACT=${version}\\b`),
  ]
  return patterns.some((pattern) => pattern.test(source))
}

describe('the deployment contract is internally consistent', () => {
  it('agrees with the committed migration count', () => {
    expect(contract.requiredMigrationCount).toBe(migrationCount)
    expect(contract.contractVersion).toBe(migrationCount)
  })
})

describe('live-authority documents state the current contract', () => {
  it.each(LIVE_AUTHORITIES)(`%s names contract ${contract.contractVersion}`, (file) => {
    expect(
      namesContract(read(file), contract.contractVersion),
      `${file} never names contract ${contract.contractVersion}`,
    ).toBe(true)
  })

  it('does not let the tag contract be mistaken for the repository contract', () => {
    if (contract.contractVersion === 63) return
    for (const file of LIVE_AUTHORITIES) {
      const source = read(file)
      if (!namesContract(source, 63)) continue
      expect(
        namesContract(source, contract.contractVersion),
        `${file} names the tag contract 63 but never the current contract ${contract.contractVersion}`,
      ).toBe(true)
    }
  })
})

const REPOSITORY_CONTRACT = /repository\s+is\s+(?:at\s+)?\**contract\**\s*\**(\d+)/gi
const REPOSITORY_CONTRACT_FIELD = /\|\s*Repository contract\s*\|\s*\**(\d+)/gi
const DEVELOPMENT_CONTRACT =
  /development(?:\s+Supabase)?\s+is\s+hosted\s+at\s+(?:contract\s*)?\**(\d+)/gi

function statedVersions(source: string, pattern: RegExp): number[] {
  return [...source.matchAll(pattern)].map((match) => Number(match[1]))
}

describe('a live authority does not contradict itself', () => {
  it.each(LIVE_AUTHORITIES)('%s states one repository contract, and it is current', (file) => {
    const source = read(file)
    const stated = [
      ...statedVersions(source, REPOSITORY_CONTRACT),
      ...statedVersions(source, REPOSITORY_CONTRACT_FIELD),
    ]
    const wrong = stated.filter((version) => version !== contract.contractVersion)
    expect(
      wrong,
      `${file} states repository contract ${wrong.join(', ')} while the repository is at ${contract.contractVersion}`,
    ).toEqual([])
  })

  it.each(LIVE_AUTHORITIES)('%s does not give two answers for the development contract', (file) => {
    const stated = new Set(statedVersions(read(file), DEVELOPMENT_CONTRACT))
    expect(
      [...stated],
      `${file} says development is hosted at ${[...stated].join(' and ')}`,
    ).toHaveLength(Math.min(stated.size, 1))
  })
})

const DELEGATES =
  /\*\*(current facts|live status authority|implementation authority)\s*:?\s*\*\*[^\n]*current-status\.md/i
const ENVIRONMENT_CONTRACT =
  /(repository|development|production|hosted|main)[^.\n]{0,40}?contracts?\b[\s:*]*\d+/i
const PINNED_REVISION = /`(?=[0-9a-f]{7,40}`)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}`/
const BASELINE_TAG_COMMIT = '1fb8ffd36ad113079181829a8bcc47175c43b6da'

function currentLines(source: string): Map<number, string> {
  const lines = source.split('\n')
  const found = new Map<number, string>()

  lines.forEach((line, index) => {
    if (
      /^\s*\*\*current\b[^:]*:?\*\*/i.test(line) ||
      /current\s+`?main`?|current baseline|currently (?:at|sits at)/i.test(line)
    ) {
      found.set(index + 1, line)
    }
  })

  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^(#{2,6})\s+(.*\bcurrent\b.*)$/i.exec(lines[index])
    if (heading === null) continue
    const level = heading[1].length
    let end = index + 1
    while (end < lines.length) {
      const next = /^(#{1,6})\s/.exec(lines[end])
      if (next !== null && next[1].length <= level) break
      end += 1
    }
    lines.slice(index + 1, end).forEach((line, offset) => found.set(index + 2 + offset, line))
  }

  return found
}

const delegatingDocuments = execFileSync('git', ['ls-files', '*.md'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter((file) => !(LIVE_AUTHORITIES as readonly string[]).includes(file))
  .filter((file) => DELEGATES.test(read(file)))

describe('the two documents that state the development contract agree', () => {
  it('current-status and the rollout inventory name the same development contract', () => {
    const stated = /Development Supabase(?: is| and Production Supabase are both) hosted at \*\*(\d+)\*\*/.exec(
      read('docs/quality/current-status.md'),
    )?.[1]
    expect(stated, 'current-status.md no longer states a development contract').toBeDefined()

    const inventoryRows = [
      ...read('docs/ops/ops-pending-migrations.md').matchAll(
        /\|\s*Development Supabase[^|]*\|\s*\*\*(\d+)\*\*/g,
      ),
    ].map((match) => Number(match[1]))
    expect(inventoryRows.length, 'the rollout inventory names no development contract').toBeGreaterThan(0)

    expect(
      Number(stated),
      'current-status.md and ops-pending-migrations.md disagree about the development contract',
    ).toBe(Math.max(...inventoryRows))
  })

  it('never claims development is ahead of the repository', () => {
    const stated = Number(
      /Development Supabase(?: is| and Production Supabase are both) hosted at \*\*(\d+)\*\*/.exec(
        read('docs/quality/current-status.md'),
      )?.[1],
    )
    expect(stated).toBeLessThanOrEqual(contract.contractVersion)
  })
})

function declarationMayTargetHostedContract(declared: number, hosted: number): boolean {
  return declared <= hosted
}

describe('the two documents that state the Netlify declaration agree', () => {
  const inventory = read('docs/ops/ops-pending-migrations.md')
  const runbook = read('docs/ops/netlify-deploy-access.md')

  // NEWEST wins, and that is a correction rather than a preference. The
  // inventory is written newest-entry-first and every entry carries these two
  // rows, so `new Map(...)` over the matches in document order kept the LAST
  // occurrence — the OLDEST entry in the file. The assertion below therefore
  // compared the live runbook against a historical declaration, and only
  // passed because the number had not moved since. It went red the first time
  // it did, on 12 August 2026, which is how it was found.
  const inventoryRows = new Map<string, number>()
  for (const match of inventory.matchAll(
    /\|\s*Netlify\s+`euro28predictor`\s+([^|]+?)\s*\|\s*\*\*(\d+) hosted declaration\*\*/g,
  )) {
    if (!inventoryRows.has(match[1])) inventoryRows.set(match[1], Number(match[2]))
  }

  const runbookRows = new Map(
    [...runbook.matchAll(/\|\s*`([a-z-]+)`\s*\|\s*(?:Development|Production)\s*\|\s*(\d+)\s*\|/g)].map(
      (match) => [match[1], Number(match[2])],
    ),
  )

  const nonProduction = (label: string) => label.includes('non-production')
  const inventoryNonProduction = [...inventoryRows].filter(([label]) => nonProduction(label))
  const inventoryProduction = [...inventoryRows].filter(([label]) => !nonProduction(label))
  const runbookNonProduction = ['dev', 'branch-deploy', 'deploy-preview']

  it('finds both documentation tables', () => {
    expect(inventoryNonProduction, 'no non-production row in the migration inventory').toHaveLength(1)
    expect(inventoryProduction, 'no production row in the migration inventory').toHaveLength(1)
    for (const context of [...runbookNonProduction, 'production']) {
      expect(runbookRows.has(context), `${context} missing from the deploy-access table`).toBe(true)
    }
  })

  it('declares one documented value across all three non-production contexts', () => {
    const declared = new Set(runbookNonProduction.map((context) => runbookRows.get(context)))
    expect([...declared], 'dev, branch-deploy and deploy-preview declare different contracts').toHaveLength(1)
    expect(inventoryNonProduction[0]?.[1]).toBe([...declared][0])
  })

  it('keeps the documented production declaration consistent across both documents', () => {
    expect(inventoryProduction[0]?.[1]).toBe(runbookRows.get('production'))
  })

  it('allows a declaration equal to its hosted database contract', () => {
    expect(declarationMayTargetHostedContract(133, 133)).toBe(true)
  })

  it('allows a declaration to trail its hosted database contract', () => {
    expect(declarationMayTargetHostedContract(132, 133)).toBe(true)
  })

  it('rejects a declaration ahead of its hosted database contract', () => {
    expect(declarationMayTargetHostedContract(134, 133)).toBe(false)
  })

  it('never lets a non-production declaration lead hosted Development', () => {
    const hosted = developmentHosted.requiredMigrationCount
    for (const context of runbookNonProduction) {
      const declared = runbookRows.get(context)
      expect(declared, `${context} is missing a declaration`).toBeDefined()
      expect(
        declarationMayTargetHostedContract(declared as number, hosted),
        `${context} declares contract ${declared} ahead of hosted Development ${hosted}`,
      ).toBe(true)
    }
    const inventoryDeclared = inventoryNonProduction[0]?.[1]
    expect(inventoryDeclared).toBeDefined()
    expect(declarationMayTargetHostedContract(inventoryDeclared as number, hosted)).toBe(true)
  })

  it('never lets the production declaration lead hosted Production', () => {
    const declared = runbookRows.get('production')
    const hosted = productionHosted.requiredMigrationCount
    expect(declared, 'production is missing a declaration').toBeDefined()
    expect(
      declarationMayTargetHostedContract(declared as number, hosted),
      `production declares contract ${declared} ahead of hosted Production ${hosted}`,
    ).toBe(true)
  })

  it('never declares a context ahead of the repository contract', () => {
    for (const [context, declared] of runbookRows) {
      expect(declared, `${context} declares contract ${declared} above the repository`).toBeLessThanOrEqual(
        contract.contractVersion,
      )
    }
  })
})

describe('a document that delegates its facts does not restate them', () => {
  it('finds the delegating documents', () => {
    expect(delegatingDocuments.length).toBeGreaterThan(0)
    expect(delegatingDocuments).toContain('docs/roadmap.md')
  })

  it.each(delegatingDocuments)('%s states no contract or commit as current', (file) => {
    const offenders: string[] = []
    for (const [at, line] of currentLines(read(file))) {
      const text = line.replaceAll(BASELINE_TAG_COMMIT, 'euro-2028-baseline')
      const environment = ENVIRONMENT_CONTRACT.exec(text)
      const pinned = PINNED_REVISION.exec(text)
      if (environment !== null) offenders.push(`${file}:${at} states "${environment[0].trim()}"`)
      if (pinned !== null) offenders.push(`${file}:${at} pins ${pinned[0]}`)
    }
    expect(
      offenders,
      `${file} names an authority for its facts and then restates them; link instead`,
    ).toEqual([])
  })
})

describe('agent documentation closeout control', () => {
  it('requires every implementation or hosted-state change to close its documentation impact', () => {
    const agents = read('AGENTS.md')
    expect(agents).toContain('## Documentation-impact closeout')
    expect(agents).toContain('No documentation impact')
    expect(agents).toContain('npm run generate:now')
    expect(agents).toContain('dated audits, investigations or rollout evidence')
  })
})

describe('live-authority documents do not pin a moving commit', () => {
  it.each(LIVE_AUTHORITIES)('%s does not present a hand-copied SHA as current main', (file) => {
    const source = read(file)
    const offenders = [...source.matchAll(/current\s*`?main`?[^\n]*?\b([0-9a-f]{40})\b/gi)]
    expect(
      offenders.map((match) => match[1]),
      `${file} pins a commit as current main; read it from git instead`,
    ).toEqual([])
  })
})
