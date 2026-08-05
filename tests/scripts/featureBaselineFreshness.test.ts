import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const baseline = readFileSync(
  resolve(process.cwd(), 'docs/quality/feature-baseline.md'),
  'utf8',
)

describe('feature baseline freshness', () => {
  it('delegates moving environment contracts to the live authorities', () => {
    expect(baseline).toContain(
      'Repository, development, production and Netlify contract values move independently.',
    )
    expect(baseline).toContain(
      'the fixed `euro-2028-baseline` tag remains the recoverable contract-63 tournament anchor',
    )
    expect(baseline).not.toContain(
      'Repository, development Supabase, production Supabase and every Netlify context are aligned at contract 60',
    )
    expect(baseline).not.toContain('exactly 60 canonical migrations')
    expect(baseline).not.toContain('every Netlify context declares contract 60')
  })

  it('records backend progress without inventing completed season surfaces', () => {
    expect(baseline).toContain(
      '## Platform backend overlay — not yet compact user features',
    )
    expect(baseline).toContain('idempotent LMS wipeout restart')
    expect(baseline).toContain('LMS successor-window scheduler')
    expect(baseline).toContain(
      'Backend presence must not be reclassified as a completed user journey',
    )
    expect(baseline).toContain(
      'describe the Contract 107 successor as playable before an authoritative next-round/window scheduler has populated it',
    )
  })

  it('keeps the stable compact identifier contract unchanged', () => {
    const compact = baseline.split(
      '## Identifier continuity and archived dispositions',
      1,
    )[0]
    const rows = compact
      .split('\n')
      .filter(
        (line) =>
          line.startsWith('| ') &&
          !line.startsWith('| ID |') &&
          !line.startsWith('| --- |'),
      )

    expect(rows).toHaveLength(61)
  })
})
