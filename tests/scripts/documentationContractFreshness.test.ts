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
    // The deploy gate checks this too, but only during a Netlify build. Here it
    // fails in CI on the commit that breaks it, which is where a contract bump
    // that forgets a migration (or the reverse) actually gets made.
    expect(contract.requiredMigrationCount).toBe(migrationCount)
    expect(contract.contractVersion).toBe(migrationCount)
  })
})

describe('live-authority documents state the current contract', () => {
  it.each(LIVE_AUTHORITIES)(`%s names contract ${contract.contractVersion}`, (file) => {
    // Deliberately a presence check rather than an exact-sentence match. These
    // are prose documents and pinning a phrasing would fail on every reword,
    // which trains people to weaken the test. The failure mode being caught is
    // a document that has never heard of the current contract at all.
    expect(
      namesContract(read(file), contract.contractVersion),
      `${file} never names contract ${contract.contractVersion}`,
    ).toBe(true)
  })

  it('does not let the tag contract be mistaken for the repository contract', () => {
    // `euro-2028-baseline` is contract 63 and stays there forever, so 63 keeps
    // appearing legitimately. What must not happen is a live document naming
    // only the tag number once `main` has moved past it — that is exactly how
    // "repository contract 63" survived the bump to 64.
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

/**
 * A live authority must not contradict itself.
 *
 * The presence check above asks only whether the current contract appears
 * *somewhere* in the file. On 3 August 2026 `AGENTS.md` satisfied it while its
 * own "Current baseline" section still said the repository was contract 73 and
 * development was 72 — two contracts behind a sentence twenty lines further
 * down the same document. A reader who stops at the first answer gets the wrong
 * one, and the guard was green throughout.
 *
 * So: every statement of the form "the repository is at contract N" must give
 * the current N, and a file's statements about the development contract must at
 * least agree with each other. Development is deliberately not pinned to the
 * repository contract — it legitimately trails between a merge and its
 * fast-lane run, which is a fact these documents exist to record.
 */
/**
 * Present tense only. "The repository **is** at contract 74" is a claim about
 * now; "merged to `main` at repository contract 65 (PR #317)" is dated history
 * and must stay exactly as written. Dropping the `is` from this pattern makes
 * the guard fail on every historical row, which is how a guard gets weakened
 * into uselessness rather than fixed.
 */
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

/**
 * Documents that name an authority for their facts, and then restate them.
 *
 * `current-status.md` is the single place the contract numbers live. Several
 * planning documents say so in their own header — "Current facts:", "Live
 * status authority:", "Implementation authority:" — and then print their own
 * copy a few lines below. Every one of those copies had rotted by 3 August
 * 2026: the roadmap claimed contract 65 nine releases late, the risk register
 * claimed 64, and the build plan claimed 63. The roadmap managed it one line
 * under a bullet explaining that a pinned SHA in a live document goes stale,
 * while itself pinning a deploy id and a short commit.
 *
 * A document that delegates a fact and then repeats it gives two answers to one
 * question, and the reader has no way to tell which is older. So a block that
 * presents itself as CURRENT, inside a document that has named someone else as
 * the authority, may not carry a contract number bound to an environment, nor
 * pin a commit or deploy id. It must link.
 *
 * Deliberately narrow, because a guard that cries wolf gets deleted:
 *
 *   - only documents that actually delegate. Dated audits, reconciliations and
 *     ADRs record the numbers of their day on purpose and are untouched;
 *   - only "current" blocks. Historical rows inside a delegating document —
 *     "merged at contract 65 (PR #317)" — are history, not a claim about today;
 *   - only contract numbers bound to an environment. "Deploys are paused from
 *     contract 64 onward" describes a gate threshold, not a position;
 *   - H1 titles do not open a current block. "Current Risk Register" means the
 *     register is current, not that every citation inside it is;
 *   - pure-digit strings are not commits. Workflow run ids and migration
 *     timestamps are both long runs of digits and neither goes stale;
 *   - the `euro-2028-baseline` commit is a fixed anchor and always allowed.
 */
const DELEGATES =
  /\*\*(current facts|live status authority|implementation authority)\s*:?\s*\*\*[^\n]*current-status\.md/i
const ENVIRONMENT_CONTRACT =
  /(repository|development|production|hosted|main)[^.\n]{0,40}?contracts?\b[\s:*]*\d+/i
/** Backticked hex of commit length carrying at least one letter, so run ids and timestamps are excluded. */
const PINNED_REVISION = /`(?=[0-9a-f]{7,40}`)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}`/
const BASELINE_TAG_COMMIT = '1fb8ffd36ad113079181829a8bcc47175c43b6da'

/** Line numbers that present themselves as stating the current position. */
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

/**
 * The two documents that both state the development contract must agree.
 *
 * `current-status.md` says "Development Supabase is hosted at N" and
 * `ops-pending-migrations.md` carries a row per applied contract. Nothing
 * related them, and on 3 August 2026 they drifted apart twice in one sitting:
 * the current-status number stopped being updated at 74 while its own evidence
 * list grew to 76, and a rollout row claimed contract 77 had been applied
 * through the fast lane when that run had never been dispatched — work had
 * moved straight from the merge into the next slice.
 *
 * The second is the worse failure. "No hosted claim without evidence" is a hard
 * boundary in this repository, and a document asserting an apply that did not
 * happen is exactly the claim that boundary exists to prevent. A human reading
 * it would have believed development was two contracts further along than it
 * was.
 *
 * Both numbers are mechanical, so this compares them. The highest development
 * contract named in the rollout inventory is the current one, because rows are
 * only ever added.
 */
describe('the two documents that state the development contract agree', () => {
  it('current-status and the rollout inventory name the same development contract', () => {
    const stated = /Development Supabase is hosted at \*\*(\d+)\*\*/.exec(
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
    // Development can legitimately trail between a merge and its fast-lane
    // run. It can never lead: a migration cannot be applied before it exists.
    const stated = Number(
      /Development Supabase is hosted at \*\*(\d+)\*\*/.exec(
        read('docs/quality/current-status.md'),
      )?.[1],
    )
    expect(stated).toBeLessThanOrEqual(contract.contractVersion)
  })
})

/**
 * The Netlify contract declaration, which is the one hosted number with **no
 * repository-side read path**.
 *
 * `EURO28_DEPLOYED_DB_CONTRACT` is a Netlify team-console environment variable.
 * CI never sees it, and the protected-preview gate reads only the commit
 * *status*, so a green `netlify/euro28predictor/deploy-preview` cannot tell 86
 * from 97 — `validate-deployment-contract.mjs` deliberately waves a *trailing*
 * non-production context through, because a schema-advancing pull request
 * cannot make its preview go green before merge (ADR 0024).
 *
 * So the declaration is owner-reported, and the only thing this repository can
 * enforce is that its two written records of it do not disagree. They are
 * `ops-pending-migrations.md` (a row per environment) and
 * `netlify-deploy-access.md` (a row per deploy context), and on 4 August 2026
 * both had to be edited by hand to move 86 → 97. Updating one and not the other
 * leaves a reader two answers with no way to date them — the same failure the
 * development-contract check above exists for.
 *
 * What this cannot check, stated so the coverage is not overread: whether
 * Netlify actually carries either number. Nothing in this repository can.
 */
describe('the two documents that state the Netlify declaration agree', () => {
  const inventory = read('docs/ops/ops-pending-migrations.md')
  const runbook = read('docs/ops/netlify-deploy-access.md')

  /** `| Netlify `euro28predictor` <label> | **N hosted declaration** |` */
  const inventoryRows = new Map(
    [...inventory.matchAll(/\|\s*Netlify\s+`euro28predictor`\s+([^|]+?)\s*\|\s*\*\*(\d+) hosted declaration\*\*/g)].map(
      (match) => [match[1], Number(match[2])],
    ),
  )

  /** `| `dev` | Development | N |` */
  const runbookRows = new Map(
    [...runbook.matchAll(/\|\s*`([a-z-]+)`\s*\|\s*(?:Development|Production)\s*\|\s*(\d+)\s*\|/g)].map(
      (match) => [match[1], Number(match[2])],
    ),
  )

  const nonProduction = (label: string) => label.includes('non-production')
  const inventoryNonProduction = [...inventoryRows].filter(([label]) => nonProduction(label))
  const inventoryProduction = [...inventoryRows].filter(([label]) => !nonProduction(label))
  const runbookNonProduction = ['dev', 'branch-deploy', 'deploy-preview']

  it('finds both tables', () => {
    // If either regex stops matching, every assertion below passes vacuously.
    expect(inventoryNonProduction, 'no non-production row in the migration inventory').toHaveLength(1)
    expect(inventoryProduction, 'no production row in the migration inventory').toHaveLength(1)
    for (const context of [...runbookNonProduction, 'production']) {
      expect(runbookRows.has(context), `${context} missing from the deploy-access table`).toBe(true)
    }
  })

  it('declares one value across all three non-production contexts', () => {
    const declared = new Set(runbookNonProduction.map((context) => runbookRows.get(context)))
    expect([...declared], 'dev, branch-deploy and deploy-preview declare different contracts').toHaveLength(1)
    expect(inventoryNonProduction[0]?.[1]).toBe([...declared][0])
  })

  it('keeps production at the Euro baseline contract in both documents', () => {
    // Production is pinned at 63 with a fatal gate until an explicitly approved
    // promotion. Raising it in a document is how the real one gets raised next.
    expect(runbookRows.get('production')).toBe(63)
    expect(inventoryProduction[0]?.[1]).toBe(63)
  })

  it('never declares a context ahead of the repository contract', () => {
    // A database AHEAD of the application is not a pre-rollout state — it means
    // the target has migrations this build does not know about, and
    // validate-deployment-contract.mjs fails it fatally in EVERY context,
    // production and preview alike. Trailing is fine and expected; leading is a
    // build outage waiting for the next deploy.
    for (const [context, declared] of runbookRows) {
      expect(declared, `${context} declares contract ${declared} above the repository`).toBeLessThanOrEqual(
        contract.contractVersion,
      )
    }
  })
})

describe('a document that delegates its facts does not restate them', () => {
  it('finds the delegating documents', () => {
    // If this drops to nothing the suite below is silently inert.
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

describe('live-authority documents do not pin a moving commit', () => {
  it.each(LIVE_AUTHORITIES)('%s does not present a hand-copied SHA as current main', (file) => {
    // A 40-character SHA next to "current main" is stale the next time anything
    // merges, and cannot be kept correct by any commit that contains it — a
    // commit cannot know its own merge SHA. The fix is not a fresher SHA; it is
    // not stating one. Fixed anchors (the `euro-2028-baseline` tag, dated
    // per-PR rows) are unaffected because they genuinely do not move.
    const source = read(file)
    // Same line, but pipes must be crossed rather than excluded: in a markdown
    // table `| Current `main` | <sha> |` the SHA is in the *next cell*, so a
    // pattern that stopped at `|` matched nothing and the guard was dead. That
    // is how the first draft of this test passed while the offending row was
    // still present.
    const offenders = [...source.matchAll(/current\s*`?main`?[^\n]*?\b([0-9a-f]{40})\b/gi)]
    expect(
      offenders.map((match) => match[1]),
      `${file} pins a commit as current main; read it from git instead`,
    ).toEqual([])
  })
})
