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
] as const

describe('ADR implementation-status freshness', () => {
  it('does not describe delivered platform backends as wholly unimplemented', () => {
    for (const file of partiallyImplemented) {
      const source = adr(file)
      expect(source).toContain(
        '- **Status:** Accepted direction — partially implemented',
      )
      if (file === '0023-hub-information-architecture.md') {
        expect(source).toContain(
          'Implementation progress — current implementation belongs in',
        )
        expect(source).toContain('../quality/current-status.md')
      } else {
        expect(source).toContain('Implementation progress — 5 August 2026')
      }
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
    expect(
      adr('0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md'),
    ).toContain('- **Status:** Implemented')
  })

  it('records the complete Contract 107-109 LMS lifecycle without claiming surfaces', () => {
    const lms = adr('0013-last-man-standing-season-rules.md')
    const lifecycle = adr(
      '0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md',
    )

    expect(lms).toContain('Contracts 107–109 complete the public wipeout restart lifecycle')
    expect(lms).toContain('player-facing journeys remain unfinished')
    expect(lifecycle).toContain('Contract 109 closes the final lifecycle step')
    expect(index).toContain(
      '| [0025](0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md) | LMS restart lifecycle, Cup split-stage persistence and post-lock reveal scope | Implemented',
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
    // 0007, 0008, 0009, 0015 — and 0026, added 6 August 2026. This guard exists
    // to catch a DELIVERED backend still described as unimplemented, so it
    // moves only when a genuinely unbuilt decision is recorded, or when a
    // recorded one is delivered. ADR 0026 decides two frontend sites, one
    // shared account across them, a server-owned Euro publication state and an
    // 18+ first cohort; none of it is built.
    //
    // 0016 LEFT THIS SET ON 20 AUGUST 2026, which is the guard working rather
    // than being relaxed: its Phase 1 manifest, per-site icons, service worker,
    // offline shell and install and update flows are built. Its Phase 1 WEB
    // PUSH is not, and neither are Phases 2 and 3, so the record says
    // "Phase 1 partially implemented" and names the gap rather than claiming
    // the phase.
    expect(index.match(/Accepted direction — unimplemented/g)?.length ?? 0).toBe(5)
    expect(index).toContain(
      '| [0016](0016-client-and-distribution.md) | Client and distribution strategy | Accepted direction — Phase 1 partially implemented',
    )
    expect(adr('0016-client-and-distribution.md')).toContain(
      '- **Status:** Accepted direction — Phase 1 partially implemented',
    )
    // The claim that would be worth catching is the overclaim, so the record is
    // required to keep saying what did NOT land.
    expect(adr('0016-client-and-distribution.md')).toContain(
      "**Phase 1's installable web application exists; Phase 1's web push does not.**",
    )
  })
})
