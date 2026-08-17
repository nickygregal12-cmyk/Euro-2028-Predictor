import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

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
    expect(baseline).toContain(
      'complete Contract 107–109 LMS wipeout restart lifecycle',
    )
    expect(baseline).toContain('Championship phase driver')
    expect(baseline).toContain(
      'Backend presence must not be reclassified as a completed user journey',
    )
    expect(baseline).toContain(
      'describe the Contract 109 successor scheduler as absent',
    )
  })

  it('does not claim the unresolved ACQ-R09 controls are implemented', () => {
    expect(baseline).toContain('Turnstile integration remains opt-in')
    expect(baseline).toContain(
      'the production build does not require its key',
    )
    expect(baseline).toContain(
      'the six-character password floor remains tracked under `ACQ-R09`',
    )
    expect(baseline).not.toContain(
      'Turnstile and recovery delivery are implemented',
    )
  })

  it('keeps reminder delivery separate from password-recovery SMTP ownership', () => {
    expect(baseline).toContain(
      'no scheduled one-hour in-app/email reminder authority exists yet',
    )
    expect(baseline).not.toContain('delivery awaits Auth/SMTP ownership')
  })

  it('keeps the stable compact identifier contract unchanged', () => {
    const compact = at(
      baseline.split('## Identifier continuity and archived dispositions', 1),
      0,
    )
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
