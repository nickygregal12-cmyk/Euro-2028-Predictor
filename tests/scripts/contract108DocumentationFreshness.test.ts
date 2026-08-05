import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

describe('Contract 108 documentation freshness', () => {
  it('records the past-window guard without pretending it schedules the successor', () => {
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
      expect(read(path), path).toMatch(/Contract[- ]108|contract 108/)
    }

    expect(read('docs/roadmap.md')).toContain('the guard is not the scheduler')
    expect(read('MASTER-TODO.md')).toContain('safety guard only, not scheduling')
    expect(read('docs/design/README.md')).toContain('the actual scheduler remains separate')
    expect(read('docs/roadmap.md')).not.toContain('The next contract must identify')
  })
})
