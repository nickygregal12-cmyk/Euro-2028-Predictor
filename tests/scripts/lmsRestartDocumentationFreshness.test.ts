import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

// Contracts 107–109 form one lifecycle: successor creation, past-window
// refusal, then authoritative future-window scheduling. Keep those roles distinct
// in domain authorities without forcing live backlog/root routers to carry the
// historical contract narrative.
describe('LMS restart documentation freshness', () => {
  it('records Contract 108 as the guard and Contract 109 as the scheduler in domain authorities', () => {
    for (const path of [
      'docs/roadmap.md',
      'docs/competition-structure.md',
      'docs/architecture/programme-plan.md',
      'docs/architecture/multi-competition-hub-build-plan.md',
      'docs/adr/README.md',
      'docs/adr/0013-last-man-standing-season-rules.md',
      'docs/adr/0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md',
      'docs/quality/feature-baseline.md',
    ]) {
      // A range counts. `docs/architecture/programme-plan.md` writes "Contract
      // 107–109", which names 109 perfectly well; a guard that only accepts the
      // number standing alone would force the prose to be worse to satisfy it.
      expect(read(path), path).toMatch(/[Cc]ontracts?[-\s][\d\s–—-]*109/)
    }

    expect(read('docs/roadmap.md')).not.toContain(
      'Schedule the LMS restart successor',
    )
    expect(
      read(
        'docs/adr/0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md',
      ),
    ).toContain('- **Status:** Implemented')
  })

  it('keeps completed LMS checklist history recoverable without making it live work', () => {
    const archived = read(
      'docs/history/context-reset-2026-08-19/MASTER-TODO.pre-reconciliation.txt',
    )
    expect(archived).toContain('[x] Add the separate calendar authority/driver')
    expect(archived).toMatch(/[Cc]ontracts?[-\s][\d\s–—-]*109/)
    expect(read('MASTER-TODO.md')).not.toContain(
      '[x] Add the separate calendar authority/driver',
    )
  })

  it('keeps the LMS contract history out of default root and design routers', () => {
    expect(read('CLAUDE.md')).not.toMatch(/[Cc]ontracts?[-\s][\d\s–—-]*109/)
    expect(read('docs/design/README.md')).not.toContain('| 109 |')
    expect(
      read('docs/history/context-reset-2026-08-16/design-README.pre-reset.txt'),
      'the removed design-router chronology should remain recoverable as historical evidence',
    ).toContain('| 109 |')
  })
})
