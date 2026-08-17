import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * The acquisition risk register, against the repository it describes.
 *
 * This register is the acquisition-facing document: it is what a technical
 * diligence exercise reads to learn what is and is not addressed. Its statuses
 * are prose, and prose drifts.
 *
 * A 31 July 2026 audit found four entries stale, all in the same direction —
 * work had landed and the register still said it had not:
 *
 *   - `ACQ-R07` said bare "Open" while its tournament-scoping half shipped in
 *     PR #228, which `current-status.md` had recorded as landed all along;
 *   - `ACQ-R14` said axe automation "remains" while the spec existed, ran in CI
 *     and failed the build on serious violations;
 *   - `ACQ-R15` said bare "Open" while return-to-foreground refresh was shipped,
 *     wired into two providers and tested;
 *   - `ACQ-R16` said bare "Open" while the small-sample suppression it names
 *     shipped at contract 63 and resolved `DEC-004`.
 *
 * Understating progress is a different failure from overstating it, and a less
 * obvious one: nobody checks a risk that already claims to be open, so the
 * entry stays wrong indefinitely and the register slowly stops being read.
 *
 * Statuses cannot be verified mechanically. What can be verified is that the
 * register stays *connected* to the repository — that its citations resolve,
 * that evidence written for it is actually referenced, and that it keeps to its
 * own declared vocabulary. Those are the joints where drift becomes visible.
 */

const repositoryRoot = process.cwd()
const registerPath = 'docs/quality/acquisition-risk-register.md'
const registerDirectory = 'docs/quality'

const register = readFileSync(resolve(repositoryRoot, registerPath), 'utf8')

/** Every `ACQ-Rnn` row, with the status cell isolated. */
function riskRows(): { id: string; status: string }[] {
  return [...register.matchAll(/^\| (ACQ-R\d+) \|(.*)$/gm)].map((match) => {
    const cells = at(match, 2).split('|').map((cell) => cell.trim())
    return { id: at(match, 1), status: cells[cells.length - 2] ?? '' }
  })
}

const rows = riskRows()

/** Whether a path cited relative to `base` resolves inside the repository. */
function existsFrom(base: string, relative: string): boolean {
  return existsSync(resolve(repositoryRoot, base, relative))
}


/** Status values the register declares for itself. */
const VOCABULARY = ['Open', 'In progress', 'Mitigated', 'Accepted', 'Closed'] as const

describe('the risk register is parseable at all', () => {
  it('finds every risk, so the assertions below are not vacuous', () => {
    // A reformatted table would otherwise empty the row list and make each
    // assertion pass by checking nothing.
    expect(rows.length).toBeGreaterThanOrEqual(27)
    expect(rows.every((row) => row.status.length > 0)).toBe(true)
  })
})

describe('the register stays connected to the repository', () => {
  it('resolves every relative link it cites', () => {
    // A broken citation is a claim to evidence that no longer exists — the
    // register would still read as substantiated.
    const links = [...register.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)].map((match) => at(match, 1))
    expect(links.length).toBeGreaterThan(0)

    const broken = links.filter(
      (link) => !existsFrom(registerDirectory, link),
    )
    expect(broken, `register links that do not resolve: ${broken.join(', ')}`).toEqual([])
  })

  it('cites only test and script files that exist', () => {
    // Statuses increasingly name the executable evidence behind them. If a test
    // is deleted or renamed, the status keeps asserting a guard that is gone.
    const cited = [
      ...new Set(
        [...register.matchAll(/`((?:tests|scripts|src|supabase|e2e)\/[A-Za-z0-9_./-]+)`/g)].map(
          (match) => match[1],
        ),
      ),
    ]
    expect(cited.length).toBeGreaterThan(3)

    const missing = cited.filter((path) => path !== undefined && !existsFrom('.', path))
    expect(missing, `register cites files that do not exist: ${missing.join(', ')}`).toEqual([])
  })

  it('references every risk investigation written for it', () => {
    // The inverse check, and the one that catches orphaned evidence: an
    // investigation written *about a risk* without any risk pointing back at it
    // means the work was done and the register never moved.
    //
    // Scoped to `acq-r`-named files deliberately. The investigations directory
    // also holds contract releases, promotion records and tag reconciliations,
    // which are operational evidence and have no reason to appear here — an
    // unscoped check would demand the register cite eleven documents that are
    // nothing to do with it.
    const investigations = readdirSync(
      resolve(repositoryRoot, 'docs/quality/investigations'),
    ).filter((file) => file.endsWith('.md') && /acq-r\d+/i.test(file))

    expect(investigations.length).toBeGreaterThan(0)

    const unreferenced = investigations.filter((file) => !register.includes(file))
    expect(
      unreferenced,
      `investigations in docs/quality/investigations/ that no risk references: ${unreferenced.join(', ')}`,
    ).toEqual([])
  })
})

describe('the register keeps to its own rules', () => {
  it('starts every status with a declared vocabulary value', () => {
    // The register declares five status values and a rule that planning text
    // alone does not mitigate. A status that starts with something else has
    // slipped out of that vocabulary.
    const offenders = rows
      .filter((row) => {
        const status = row.status.replace(/^\*+/, '')
        return !VOCABULARY.some((value) => status.startsWith(value))
      })
      .map((row) => `${row.id}: ${row.status.slice(0, 40)}`)

    expect(offenders, `statuses outside the declared vocabulary: ${offenders.join(' | ')}`).toEqual(
      [],
    )
  })

  it('still declares the vocabulary it is being held to', () => {
    // Positive control. If the status list were removed from the document, the
    // assertion above would be enforcing a rule the register no longer states.
    for (const value of VOCABULARY) {
      expect(register).toContain(`**${value}**`)
    }
  })
})

