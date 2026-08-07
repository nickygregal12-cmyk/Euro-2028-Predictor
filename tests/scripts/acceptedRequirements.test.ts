import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The register of decisions that were ACCEPTED and never BUILT.
//
// This exists because the failure it guards has already happened here. An
// external audit found requirements that had been agreed in ADR prose, never
// implemented, and never tracked anywhere an agent would look — so they were
// rediscovered by audit rather than delivered. `DOC-AI-008` is the written rule;
// this file is the part of it a future session cannot talk its way past.
//
// What it deliberately does NOT check: whether any requirement is correct, or
// wise, or scheduled. It checks that the register exists, that its identifiers
// are unique and stable, that the planning authorities point at it, and that a
// row cannot be deleted to make a list look shorter.

const root = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

const register = read('docs/quality/accepted-requirements.md')

// The identifier space this register owns. FEAT/PLAN/SAFE belong to
// feature-baseline.md and are deliberately excluded — a requirement that is not
// built has no capability to classify there. DFA is the Domestic Frontend Alpha
// namespace accepted by ADR 0023 on 7 August 2026.
const REGISTER_ID = /\b(?:SITE|ACCOUNT|EURO|AGE|PRIV|INGEST|CAP|DFA)-\d{3}\b/g
const REGISTER_ROW = /^\| `(?:SITE|ACCOUNT|EURO|AGE|PRIV|INGEST|CAP|DFA)-\d{3}` \|/

/**
 * Identifiers a document DEFINES, i.e. that lead one of its table rows —
 * as opposed to ones it merely cites. The distinction is the point: a
 * cross-reference between registers is wanted, a second definition is not.
 */
function definedIds(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => REGISTER_ROW.test(line))
    .map((line) => line.match(REGISTER_ID)?.[0] ?? '')
    .filter(Boolean)
}

describe('accepted-but-unimplemented requirement register', () => {
  it('declares the control block every active authority carries', () => {
    for (const field of [
      '| Authority | Primary |',
      '| Last verified |',
      '| Governs |',
      '| Does not govern |',
      '| Implementation truth |',
    ]) {
      expect(register).toContain(field)
    }
  })

  it('gives every requirement a unique identifier', () => {
    const defined = definedIds(register)

    expect(defined.length).toBeGreaterThan(0)
    expect(new Set(defined).size).toBe(defined.length)
  })

  it('does not redefine an identifier the risk register already allocated', () => {
    // PRIV-001 and PRIV-002 are risk-register findings. Reusing either number
    // would make two different things answer to one name. Citing this register's
    // own PRIV-003..007 from there is the opposite — a wanted cross-reference —
    // so this compares definitions, not mentions.
    const allocatedElsewhere = new Set(definedIds(read('docs/quality/risk-register.md')))
    const redefined = definedIds(register).filter((id) => allocatedElsewhere.has(id))

    expect(redefined).toEqual([])
    // Guard the guard: if the risk register stops defining its PRIV rows in
    // table form, the check above would pass vacuously.
    expect(allocatedElsewhere.size).toBeGreaterThan(0)
  })

  it('gives every requirement a dependency and acceptance-evidence column', () => {
    const rows = register.split('\n').filter((line) => REGISTER_ROW.test(line))

    for (const row of rows) {
      // | ID | Requirement | Depends on | Acceptance evidence | Status |
      const cells = row.split('|').map((cell) => cell.trim())
      expect(cells.filter(Boolean).length).toBeGreaterThanOrEqual(5)
    }
  })

  it('states in the register that a row is never deleted', () => {
    expect(register).toMatch(/marked implemented, superseded or rejected in place/i)
    expect(register).toMatch(/Deleting a row/i)
  })

  it('is reachable from every planning and status authority that should point at it', () => {
    const target = 'accepted-requirements.md'

    for (const authority of [
      'README.md',
      'MASTER-TODO.md',
      'docs/roadmap.md',
      'docs/quality/current-status.md',
      'docs/quality/feature-baseline.md',
      'docs/architecture/programme-plan.md',
    ]) {
      expect(read(authority), `${authority} must link the register`).toContain(target)
    }
  })

  it('keeps the decision that created it indexed as an ADR', () => {
    const adr = '0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md'

    expect(read('docs/adr/README.md')).toContain(adr)
    expect(read(`docs/adr/${adr}`)).toContain('- **Status:** Accepted direction — unimplemented')
  })

  it('records the documentation safeguards in their own authority, not here', () => {
    const safeguards = read('docs/ops/documentation-authorities.md')

    for (let n = 1; n <= 10; n += 1) {
      expect(safeguards).toContain(`DOC-AI-${String(n).padStart(3, '0')}`)
    }
  })

  it('does not claim independent approval for the blocked data-protection work', () => {
    // PRIV-007 blocks PRIV-003..006. The product direction was approved by the
    // owner; the legal position was not, and no document may imply otherwise.
    const governance = read('docs/architecture/stage-c1-c2-governance.md')

    expect(governance).toMatch(/no independent data-protection approval is claimed|This is a product decision, not a legal one/i)
    expect(register).toContain('no legal approval is claimed')
  })
})
