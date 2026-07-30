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
