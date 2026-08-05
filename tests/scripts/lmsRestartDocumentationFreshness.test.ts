import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

// Contracts 107–109 form one lifecycle: successor creation, past-window
// refusal, then authoritative future-window scheduling. Keep those roles distinct.
describe('LMS restart documentation freshness', () => {
  it('records Contract 108 as the guard and Contract 109 as the scheduler', () => {
    for (const path of [
      'CLAUDE.md',
      'MASTER-TODO.md',
      'docs/roadmap.md',
      'docs/competition-structure.md',
      'docs/architecture/programme-plan.md',
      'docs/architecture/multi-competition-hub-build-plan.md',
      'docs/design/README.md',
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

    expect(read('MASTER-TODO.md')).toContain(
      '[x] Add the separate calendar authority/driver',
    )
    expect(read('docs/design/README.md')).toContain('| 109 |')
    expect(read('docs/roadmap.md')).not.toContain(
      'Schedule the LMS restart successor',
    )
    expect(read('CLAUDE.md')).not.toContain(
      'includes the LMS successor-window scheduler',
    )
    expect(
      read(
        'docs/adr/0025-lms-restart-lifecycle-cup-split-persistence-and-reveal-scope.md',
      ),
    ).toContain('- **Status:** Implemented')
  })
})
