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
 * **The sweep rule is what produced it, and that is worth naming.** A contract
 * must touch all seven `sweep: true` documents, and the cheapest way to satisfy
 * that is to paste the same boundary blockquote into all seven — which is how one
 * paragraph came to exist in `CLAUDE.md`, `MASTER-TODO.md`, `docs/roadmap.md`,
 * `docs/adr/README.md`, `docs/competition-structure.md`, `docs/design/README.md`
 * and `docs/quality/feature-baseline.md` at once. The control against staleness
 * produced the duplication, and `docs/ops/documentation-authorities.md` had
 * already predicted the shape: marking everything "would train people to add a
 * meaningless line to pass the gate". It trained a meaningful-*looking* one
 * instead, which is harder to spot.
 *
 * **The baseline is empty, and that is the point.** It held 16 entries and
 * 67,204 characters on 11 August 2026; every one is gone. Six of the seven
 * documents now record what a contract meant FOR THEM — the question each one
 * exists to answer, which each was already answering in a trailing clause bolted
 * to a copy of the narrative. `CLAUDE.md` keeps the narrative, because stating
 * the current implementation boundary is the job its manifest entry names.
 *
 * An empty ratchet is a rule. Leave it empty: a new entry is not a way to record
 * duplication, it is a way to permit it, and the reason it drained is that
 * nobody was allowed to add one.
 */
const BASELINE = new Set<string>([])

/**
 * Correspondences a STRONGER check already holds, which must therefore stay
 * identical — the same reasoning the manifest's `structural` kind uses when it
 * exempts a schema inventory because a real database checks it.
 *
 * This is not the baseline wearing a different hat. A baseline entry is
 * duplication tolerated until someone removes it; an entry here is duplication
 * REQUIRED, and removing it breaks a passing test.
 *
 * The Stage C pair proved the difference the hard way. Deduplicating the
 * sixteen-function list looked obviously right — two documents, one inventory —
 * and it failed `stageC1SchemaOverlayCoverage.test.ts`, which asserts that every
 * function `stage-c-schema-coverage.md` names as reviewed is given a disposition
 * in `stage-c1-schema-overlay.md`. The list is not a copy of prose; it is a
 * per-function disposition, and a test keeps the two in step far more tightly
 * than comparing paragraphs ever could.
 */
const ENFORCED_ELSEWHERE = new Set([
  '3d47535a38db', // ×2, 446 chars — the Stage C reviewed-function inventory,
                  // held identical by tests/scripts/stageC1SchemaOverlayCoverage.test.ts
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
      .filter(([key]) => !BASELINE.has(key) && !ENFORCED_ELSEWHERE.has(key))
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

  /**
   * Every long paragraph a SINGLE authority carries more than once.
   *
   * WHY `duplicated()` COULD NOT SEE THIS. It records carriers with
   * `if (!entry.carriers.includes(path)) entry.carriers.push(path)`, so one file
   * counts once however many times it repeats a block, and the
   * `carriers.length < 2` sweep then deletes it. Repetition inside one document
   * was invisible by construction — not tolerated, not baselined, just unseen.
   *
   * On 17 August 2026 `docs/quality/current-status.md` — the document that calls
   * itself the only live implementation and hosted-status authority — carried an
   * identical seven-line run twice: the Contract 187, 186 and 185 paragraphs,
   * 4,099 characters, pasted in full a second time seven lines below the first.
   *
   * IT IS THE SAME DEFECT AS THE CROSS-FILE ONE and it arrives the same way. An
   * agent appends a status block that is individually correct, the file grows,
   * and eventually the old and new statements sit side by side with nothing
   * saying which is current. A single file is the easier place for that to hide,
   * because there is no second filename in the diff to make it obvious.
   */
  function repeatedWithinOneFile(): Map<string, { path: string; count: number; excerpt: string }> {
    const offenders = new Map<string, { path: string; count: number; excerpt: string }>()

    for (const path of authorityDocuments()) {
      const counts = new Map<string, { count: number; excerpt: string }>()
      for (const block of paragraphs(path)) {
        const key = fingerprint(block)
        const seen = counts.get(key)
        counts.set(key, { count: (seen?.count ?? 0) + 1, excerpt: seen?.excerpt ?? block.slice(0, 110) })
      }
      for (const [key, { count, excerpt }] of counts) {
        if (count > 1) offenders.set(`${path}:${key}`, { path, count, excerpt })
      }
    }

    return offenders
  }

  it('carries no long paragraph twice inside one authority', () => {
    const offenders = [...repeatedWithinOneFile().values()].map(
      ({ path, count, excerpt }) => `${path} carries it ${count}× \n      "${excerpt}…"`,
    )

    expect(
      offenders,
      'An authority repeats one of its own long paragraphs verbatim. Delete the ' +
        'copy that is no longer current: two statements of the same fact in one ' +
        'file is the same failure as two files stating it, and worse to spot, ' +
        'because a reader cannot tell which one the document means now. If both ' +
        'are meant to stand, one of them is history and should say so in its own ' +
        'words rather than repeat the other verbatim.',
    ).toEqual([])
  })

  it('would have caught the run that shipped, and is not vacuous', () => {
    // Mutation coverage for the checker itself. The cross-file rule was green
    // through the whole time that run existed, so a rule claiming to catch
    // intra-file repetition has to be shown rejecting one.
    const block = `${'Contract 187 implements CUP-002 and this sentence exists to exceed the four-hundred character threshold the checker uses. '.repeat(4)}`
    const repeated = [block, 'A paragraph in between that is entirely its own.', block]

    const counts = new Map<string, number>()
    for (const candidate of repeated.filter((entry) => entry.length >= LONG)) {
      const key = fingerprint(candidate.replace(/\s+/g, ' ').trim())
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    expect([...counts.values()].some((count) => count > 1)).toBe(true)
    // And the short paragraph between them is not counted at all.
    expect(counts.size).toBe(1)
  })

  it('keeps the baseline honest: no entry outlives the duplication it records', () => {
    // Without this the list would become an exemption. A duplication that is
    // fixed must have its line deleted, so the count can only fall.
    const live = duplicated()
    const stale = [...BASELINE, ...ENFORCED_ELSEWHERE].filter((key) => !live.has(key))

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
