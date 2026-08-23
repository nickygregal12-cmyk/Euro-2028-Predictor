import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * Documents that declare themselves live authorities, against the contract they
 * claim to state.
 *
 * Two files in this repository intentionally state moving contract truth:
 * `current-status.md` calls itself *"the only live implementation and
 * hosted-status authority"*, and `ops-pending-migrations.md` calls itself the
 * *"live source of truth for repository migration count"*. Root `AGENTS.md`
 * used to duplicate the same moving values because every agent reads it first;
 * the context reset turns it into a stable router to generated `NOW.md` instead.
 *
 * On 30 July 2026 the old live documents were stale together: the contract had
 * moved 63 → 64 while copied values still said 63, and two documents also
 * pinned a `main` SHA that roughly twenty-five merges had passed. A document
 * that claims to be live truth and is not is worse than no document, because it
 * is read instead of checking.
 *
 * This is the freshness check for the part that can be checked mechanically.
 * It also protects the new router boundary: root agent instructions must point
 * at current-state authority rather than becoming another contract ledger.
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

/** Files that intentionally assert moving contract truth, and must be current. */
const LIVE_AUTHORITIES = [
  'docs/quality/current-status.md',
  'docs/ops/ops-pending-migrations.md',
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

const ROOT_ROUTER_CONTRACT =
  /\b(?:repository|development|production|hosted)(?:\s+Supabase)?[^\n]{0,40}?\bcontracts?\b[\s:*]*(\d+)/gi

describe('root agent instructions delegate moving contract state', () => {
  const agents = read('AGENTS.md')

  it('routes agents to generated current state', () => {
    expect(agents).toContain('Read [`NOW.md`](NOW.md)')
  })

  it('does not become a second moving contract ledger', () => {
    expect(
      [...agents.matchAll(ROOT_ROUTER_CONTRACT)].map((match) => Number(match[1])),
      'AGENTS.md must route moving repository/hosted contract state rather than copy it',
    ).toEqual([])
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
    // current-status.md deliberately retains one long-form historical baseline
    // row. Its moving contract truth lives only in the generated "repository is
    // at contract N" sentence above it; treating the legacy row as a second
    // ledger makes every new repository contract fail until old history is
    // rewritten. Other live authorities still have their Repository contract
    // table fields checked normally.
    const stated = [
      ...statedVersions(source, REPOSITORY_CONTRACT),
      ...(file === 'docs/quality/current-status.md'
        ? []
        : statedVersions(source, REPOSITORY_CONTRACT_FIELD)),
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
    const heading = /^(#{2,6})\s+(.*\bcurrent\b.*)$/i.exec(at(lines, index))
    if (heading === null) continue
    const level = at(heading, 1).length
    let end = index + 1
    while (end < lines.length) {
      const next = /^(#{1,6})\s/.exec(at(lines, end))
      if (next !== null && at(next, 1).length <= level) break
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

const PRODUCTION_CONTRACT =
  /production(?:\s+Supabase)?\s+is\s+hosted\s+at\s+(?:contract\s*)?\**(\d+)/gi

/**
 * The hosted contract a document currently claims, out of every value it states.
 *
 * WHY THE MAXIMUM AND NOT THE FIRST MATCH. `current-status.md` keeps historical
 * hosted evidence in the same file as its current claim — it states "Production
 * Supabase is hosted at **131**" four times in a contract-131 passage that is
 * still true *of 131*. A rule that read every match as a current claim would
 * fail on correct history, and a rule that read only the first would be silently
 * defeated by anyone appending a newer paragraph below an older one. Hosted
 * contracts only ever move forward, so the highest value a document names is the
 * one it is claiming now, and every lower mention is history.
 */
function currentHostedClaim(source: string, pattern: RegExp): number | null {
  const stated = statedVersions(source, pattern)
  return stated.length > 0 ? Math.max(...stated) : null
}

/**
 * Whether a document's current hosted claim equals the machine record.
 *
 * A SEPARATE PURE FUNCTION SO THE MUTATION CAN BE ASSERTED. The bug this exists
 * for was not a missing test but a test that could not fail: on 17 August 2026
 * `current-status.md` — which calls itself the only hosted-status authority —
 * said hosted Production was 189 while `config/production-hosted-contract.json`
 * recorded 190, verified three days earlier, and this suite was green. The
 * Production record was loaded and used only to check that the *Netlify
 * declaration* did not lead it, through `declarationMayTargetHostedContract`,
 * which permits trailing by design. Nothing compared the prose to the record,
 * and no `PRODUCTION_CONTRACT` pattern existed at all while `REPOSITORY_CONTRACT`
 * and `DEVELOPMENT_CONTRACT` did.
 *
 * Returning `false` for "states nothing" is deliberate and is half the point. A
 * regex that stops matching because the sentence was reworded would otherwise
 * turn this check into dead control that reports success — the exact failure the
 * `namesContract` docstring above already records once.
 */
function hostedProseMatchesRecord(source: string, pattern: RegExp, record: number): boolean {
  const claim = currentHostedClaim(source, pattern)
  return claim !== null && claim === record
}

describe('the hosted-status authority agrees with the hosted records', () => {
  const status = 'docs/quality/current-status.md'

  it('states the hosted Production contract, and it is the recorded one', () => {
    const claim = currentHostedClaim(read(status), PRODUCTION_CONTRACT)
    expect(claim, `${status} no longer states a hosted Production contract`).not.toBeNull()
    expect(
      claim,
      `${status} says hosted Production is ${claim} while config/production-hosted-contract.json records ${productionHosted.requiredMigrationCount}`,
    ).toBe(productionHosted.requiredMigrationCount)
  })

  it('states the hosted Development contract, and it is the recorded one', () => {
    const claim = currentHostedClaim(read(status), DEVELOPMENT_CONTRACT)
    expect(claim, `${status} no longer states a hosted Development contract`).not.toBeNull()
    expect(
      claim,
      `${status} says hosted Development is ${claim} while config/development-hosted-contract.json records ${developmentHosted.requiredMigrationCount}`,
    ).toBe(developmentHosted.requiredMigrationCount)
  })

  it('never claims a hosted environment is ahead of the repository', () => {
    for (const [label, pattern] of [
      ['Production', PRODUCTION_CONTRACT],
      ['Development', DEVELOPMENT_CONTRACT],
    ] as const) {
      const claim = currentHostedClaim(read(status), pattern)
      expect(claim, `${status} states no hosted ${label} contract`).not.toBeNull()
      expect(
        claim as number,
        `${status} claims hosted ${label} ${claim} is ahead of the repository at ${contract.contractVersion}`,
      ).toBeLessThanOrEqual(contract.contractVersion)
    }
  })

  it('current-status and the rollout inventory name the same Production contract', () => {
    const claim = currentHostedClaim(read(status), PRODUCTION_CONTRACT)
    const inventoryRows = [
      ...read('docs/ops/ops-pending-migrations.md').matchAll(
        /\|\s*Production Supabase[^|]*\|\s*\*\*(\d+)\*\*/g,
      ),
    ].map((match) => Number(match[1]))
    expect(inventoryRows.length, 'the rollout inventory names no Production contract').toBeGreaterThan(0)
    expect(
      claim,
      'current-status.md and ops-pending-migrations.md disagree about the Production contract',
    ).toBe(Math.max(...inventoryRows))
  })
})

describe('the hosted-prose check can actually fail', () => {
  // Mutation coverage. Each case is the assertion above run against fabricated
  // prose, because a freshness rule that has never been observed to reject
  // anything is indistinguishable from one that cannot.
  const record = 190

  it('accepts prose that names the recorded contract', () => {
    expect(
      hostedProseMatchesRecord('Production Supabase is hosted at **190**.', PRODUCTION_CONTRACT, record),
    ).toBe(true)
  })

  it('rejects the exact stale state that shipped: Production 190 recorded, 189 written', () => {
    expect(
      hostedProseMatchesRecord('Production Supabase is hosted at **189**.', PRODUCTION_CONTRACT, record),
    ).toBe(false)
  })

  it('rejects a claim ahead of the record as well as behind it', () => {
    expect(
      hostedProseMatchesRecord('Production Supabase is hosted at **191**.', PRODUCTION_CONTRACT, record),
    ).toBe(false)
  })

  it('keeps accepting correct history beside the current claim', () => {
    expect(
      hostedProseMatchesRecord(
        'Production Supabase is hosted at **131** after guard work. Later: Production Supabase is hosted at **190**.',
        PRODUCTION_CONTRACT,
        record,
      ),
    ).toBe(true)
  })

  it('is not defeated by a newer paragraph appended below an older one', () => {
    expect(
      hostedProseMatchesRecord(
        'Production Supabase is hosted at **190**. An older note: Production Supabase is hosted at **189**.',
        PRODUCTION_CONTRACT,
        record,
      ),
    ).toBe(true)
  })

  it('fails closed when the sentence is reworded out of recognition', () => {
    expect(hostedProseMatchesRecord('Production is fully up to date.', PRODUCTION_CONTRACT, record)).toBe(
      false,
    )
  })

  it('rejects stale Development prose on the same rule', () => {
    expect(
      hostedProseMatchesRecord('Development Supabase is hosted at **188**.', DEVELOPMENT_CONTRACT, 189),
    ).toBe(false)
    expect(
      hostedProseMatchesRecord('Development Supabase is hosted at **189**.', DEVELOPMENT_CONTRACT, 189),
    ).toBe(true)
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
    if (!inventoryRows.has(at(match, 1))) inventoryRows.set(at(match, 1), Number(match[2]))
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
      offenders.map((match) => at(match, 1)),
      `${file} pins a commit as current main; read it from git instead`,
    ).toEqual([])
  })
})