import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const adr = (name: string) =>
  readFileSync(resolve(process.cwd(), 'docs/adr', name), 'utf8')

const index = adr('README.md')

const partiallyImplemented = [
  '0011-multi-competition-platform.md',
  '0012-season-predictor-rules.md',
  '0013-last-man-standing-season-rules.md',
  '0014-predictor-cup-season-formats.md',
  '0020-football-prediction-hub-product-model.md',
  '0023-hub-information-architecture.md',
  '0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md',
] as const

describe('ADR implementation-status freshness', () => {
  it('does not describe delivered platform backends as wholly unimplemented', () => {
    for (const file of partiallyImplemented) {
      const source = adr(file)
      expect(source).toContain(
        '- **Status:** Accepted direction — partially implemented',
      )
      expect(source).toContain('Implementation progress — 5 August 2026')
      expect(source).not.toContain(
        '- **Status:** Accepted direction — unimplemented',
      )
    }
  })

  it('records decisions whose complete present scope is implemented', () => {
    expect(adr('0022-season-preset-threshold-and-shared-cup-machinery.md')).toContain(
      '- **Status:** Implemented',
    )
    expect(adr('0024-development-environment-operating-model.md')).toContain(
      '- **Status:** Implemented for the current pre-cohort development operating model',
    )
  })

  it('keeps the Contract 107 lifecycle boundary honest', () => {
    const lms = adr('0013-last-man-standing-season-rules.md')
    const lifecycle = adr(
      '0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md',
    )

    expect(lms).toContain('The successor intentionally has no windows')
    expect(lifecycle).toContain('Contract 107 deliberately creates no windows')
    expect(index).toContain(
      'the separate next-eligible-round/window scheduler remains',
    )
  })

  it('updates capacity and background-job evidence beyond the first sample', () => {
    expect(adr('0003-asynchronous-incremental-scoring.md')).toContain(
      'roughly 884 ms',
    )
    expect(adr('0005-background-jobs.md')).toContain(
      'recurring season Match Predictor lock processing',
    )
  })

  it('keeps the index aligned with the record-level statuses', () => {
    expect(index).toContain(
      '| [0022](0022-season-preset-threshold-and-shared-cup-machinery.md) | Season presets, Cup launch threshold and shared Cup machinery | Implemented',
    )
    expect(index).toContain(
      '| [0024](0024-development-environment-operating-model.md) | Development environment operating model | Implemented for the current pre-cohort mode',
    )
    expect(index.match(/Accepted direction — unimplemented/g)?.length ?? 0).toBe(5)
  })
})
