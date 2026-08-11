import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  classify,
  loadManifest,
  trackedMarkdown,
} from '../../scripts/check-documentation-authorities.mjs'

/**
 * No two live documents may say the same long thing in the same words.
 *
 * WHY THIS EXISTS, MEASURED. On 11 August 2026 the same nine paragraphs —
 * 10,839 characters of contract narrative — appeared byte-identical in
 * `CLAUDE.md`, `docs/architecture/programme-plan.md` and
 * `docs/architecture/multi-competition-hub-build-plan.md`. Three copies of one
 * narrative, maintained so that each file could append a single clause of its
 * own: "no phase moves", "Stage D", "serves DFA-003". Thirty-two per cent of one
 * plan's long-form content and twenty-eight per cent of the other's was a copy
 * of a third file.
 *
 * The build plan's own § 18 had already written the rule it was breaking —
 * *maintaining the same decision in two documents creates competing authority* —
 * which is what a convention gets you. `DOC-AI-001` says the same thing and is
 * marked "Convention" in the safeguards table. This is the half of it that can
 * be checked.
 *
 * IT CHECKS AUTHORITIES ONLY. Dated evidence repeats itself by design: an audit
 * quotes the document it audited, and a reconciliation restates what it
 * reconciled. Freezing those is the whole point of `DOC-AI-006`, so they are out
 * of scope here for the same reason they are exempt from freshness.
 *
 * IT IS A DUPLICATION RULE, NOT A SIMILARITY RULE. Only byte-identical
 * paragraphs count, after whitespace is collapsed. Two documents describing one
 * subject in their own words is not the failure — it is often the point. Copying
 * is.
 */

const repositoryRoot = process.cwd()
const manifest = loadManifest()

/**
 * Long enough that sharing it verbatim is a copy rather than a coincidence.
 * A shared table header, a one-line status field or a repeated link line is
 * neither surprising nor a maintenance burden.
 */
const LONG = 400

function paragraphs(path: string): string[] {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter((block) => block.length >= LONG)
}

function authorityDocuments(): string[] {
  return trackedMarkdown().filter((path: string) => {
    const resolved = classify(manifest, path)
    return resolved.state === 'authority'
  })
}

function fingerprint(block: string): string {
  return createHash('sha1').update(block).digest('hex').slice(0, 12)
}

/**
 * What was already duplicated when this guard landed, and may only shrink.
 *
 * A RATCHET, NOT AN EXEMPTION — the same shape as `knip-baseline.md` and
 * `lighthouse-baseline.md`. New duplication fails; removing a listed one fails
 * until its line is deleted, so the list cannot quietly stop being true.
 *
 * **The sweep rule is what produced most of this, and that is worth naming.** A
 * contract must touch all seven `sweep: true` documents, and the cheapest way to
 * satisfy that is to paste the same boundary blockquote into all seven — which
 * is how one paragraph came to exist in `CLAUDE.md`, `MASTER-TODO.md`,
 * `docs/roadmap.md`, `docs/adr/README.md`, `docs/competition-structure.md`,
 * `docs/design/README.md` and `docs/quality/feature-baseline.md` at once. The
 * control against staleness produced the duplication, and
 * `docs/ops/documentation-authorities.md` had already predicted the shape:
 * marking everything "would train people to add a meaningless line to pass the
 * gate". It trained a meaningful-looking one instead, which is harder to spot.
 *
 * Working the list down means each of those documents saying, in its own words,
 * what the contract meant FOR IT — as the two architecture plans now do — rather
 * than restating what the contract is. That is seven live authorities' worth of
 * editing and is deliberately not done here.
 */
const BASELINE = new Set([
  'c17d183e14c7', // ×7, 1352 chars — contract 147–148 boundary
  'c47033bc2fe8', // ×7, 1302 chars — contract 151 boundary
  '5b62dcf65dfb', // ×7, 1293 chars — contract 149 boundary
  'fc5a72d4b95f', // ×7, 1242 chars — contract 145 boundary
  '958f47addc74', // ×7, 1131 chars — contract 146 boundary
  'be44e17515e2', // ×7, 1093 chars — contract 150 boundary
  '2201f59a5834', // ×7,  802 chars — contract 152–157 boundary
  '1d6f88e0958b', // ×6, 1464 chars — contract 144 boundary
  '0f4c7b75dcc3', // ×6, 1160 chars — contract 143 boundary
  '6523db66f93a', // ×3,  548 chars — contract 142 boundary
  '65cbce76347b', // ×2,  910 chars — contract 138–139 boundary
  'dca7b2638223', // ×2,  653 chars — contract 140–141 boundary
  'b67ca745dc75', // ×2,  603 chars — contract 137 boundary
  'bd904f0ef915', // ×2,  550 chars — contract 144 repository candidate
  '4c66cbc289b1', // ×2,  536 chars — contract 143 repository candidate
  '3d47535a38db', // ×2,  446 chars — Stage C schema object inventory

  // Arrived with contract 158 while this branch was open, which is the
  // mechanism rather than an exception: its pull request pasted both of these
  // into the same seven `sweep: true` documents, one paste per contract, exactly
  // as the rows above were produced. They are baselined rather than fixed
  // because fixing them is the seven-authority edit deferred below.
  //
  // The first is also MISNUMBERED: it is headed "Contract 152 boundary" and
  // describes contract 158's `SEC-001` work, a leftover from that change being
  // rebased. Contract 152 is the private container's identity. The freshness
  // rule cannot see it — 152 exists — and it is left for its own author rather
  // than rewritten here.
  '7e5a6c2bd89e', // ×7 — "Contract 152 boundary", describing contract 158
  'c2fad682127c', // ×7 — contract 158 boundary
])

describe('one fact, one home', () => {
  it('finds the authorities to check', () => {
    // Guard the guard: if the classification stopped returning documents, the
    // assertion below would pass by comparing nothing.
    const documents = authorityDocuments()
    expect(documents.length).toBeGreaterThan(50)
    expect(documents).toContain('CLAUDE.md')
    expect(documents).toContain('docs/architecture/programme-plan.md')
  })

  /** Every long paragraph carried verbatim by more than one authority. */
  function duplicated(): Map<string, { carriers: string[]; excerpt: string }> {
    const seen = new Map<string, { carriers: string[]; excerpt: string }>()

    for (const path of authorityDocuments()) {
      for (const block of paragraphs(path)) {
        const key = fingerprint(block)
        const entry = seen.get(key) ?? { carriers: [], excerpt: block.slice(0, 110) }
        if (!entry.carriers.includes(path)) entry.carriers.push(path)
        seen.set(key, entry)
      }
    }

    for (const [key, entry] of seen) if (entry.carriers.length < 2) seen.delete(key)
    return seen
  }

  it('adds no duplication beyond the recorded baseline', () => {
    const fresh = [...duplicated().entries()]
      .filter(([key]) => !BASELINE.has(key))
      .map(([key, { carriers, excerpt }]) => `${key}  ${carriers.join(' + ')}\n      "${excerpt}…"`)

    expect(
      fresh,
      'A long paragraph is now carried verbatim by more than one authority. Give the ' +
        'fact one home and link to it from the others — a second copy is a second thing ' +
        'to keep in step, and the one nobody updates is indistinguishable from the one ' +
        'that is. If a document needs to say what a change meant FOR IT, say that, in ' +
        'its own words; do not restate what the change was.',
    ).toEqual([])
  })

  it('keeps the baseline honest: no entry outlives the duplication it records', () => {
    // Without this the list would become an exemption. A duplication that is
    // fixed must have its line deleted, so the count can only fall.
    const live = duplicated()
    const stale = [...BASELINE].filter((key) => !live.has(key))

    expect(
      stale,
      'These baseline entries no longer duplicate anything — remove them from BASELINE. ' +
        'The list is a ratchet, and it only works while every line in it is still true.',
    ).toEqual([])
  })

  it('holds the two planning documents clear, which is what it was written for', () => {
    // CLAUDE.md and these two carried nine identical paragraphs — 10,839
    // characters — until 11 August 2026. Whatever the baseline still tolerates
    // elsewhere, this particular copy must not come back: each plan now records
    // what a contract meant for its own phases or stages, in its own words.
    const PLANS = [
      'docs/architecture/programme-plan.md',
      'docs/architecture/multi-competition-hub-build-plan.md',
    ]

    const offenders = [...duplicated().values()]
      .filter(({ carriers }) => carriers.some((path) => PLANS.includes(path)))
      .map(({ carriers, excerpt }) => `${carriers.join(' + ')}\n      "${excerpt}…"`)

    expect(
      offenders,
      'A paragraph has been copied back into the programme plan or the build plan. ' +
        'Record what the change meant for that plan\'s phases or stages instead — ' +
        'the narrative belongs to CLAUDE.md and current-status.md.',
    ).toEqual([])
  })
})
