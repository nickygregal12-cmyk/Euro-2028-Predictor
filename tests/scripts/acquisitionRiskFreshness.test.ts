import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const register = readFileSync(
  resolve(process.cwd(), 'docs/quality/acquisition-risk-register.md'),
  'utf8',
)

describe('acquisition risk register freshness', () => {
  it('delegates moving hosted state to the live authorities', () => {
    expect(register).toContain('**Last reconciled:** 6 August 2026')
    expect(register).toContain(
      'Moving repository, hosted-database and Netlify contract values remain in',
    )
    expect(register).toContain(
      'These are durable controls, not a second hosted-status table.',
    )
    expect(register).not.toContain(
      'Contracts 45–46 are development-hosted in draft PR #138',
    )
  })

  it('records the background jobs that have actually landed', () => {
    expect(register).toContain(
      'recurring season Match Predictor lock processing',
    )
    expect(register).toContain(
      'correction-aware season LMS settlement/replay',
    )
    expect(register).toContain(
      'The LMS wipeout restart is a separate idempotent lifecycle command rather than a cron side effect',
    )
    expect(register).toContain(
      'Incremental scoring drain, maintained-standings reconciliation, reminders and cross-job failure/delay observability remain open',
    )
  })

  it('does not call full-volume and concurrency evidence absent', () => {
    expect(register).toContain(
      'Full group-stage and full-tournament result volume',
    )
    expect(register).toContain('six-concurrent-reader evidence')
    expect(register).toContain('a genuine peak write/concurrent-user rehearsal')
    expect(register).not.toContain(
      'Connection-pool/concurrent peak testing and full-result-volume evidence remain',
    )
  })

  it('keeps the reminder gap separate from password-recovery delivery', () => {
    expect(register).toContain(
      'no scheduled in-app/email reminder authority is implemented',
    )
    expect(register).toContain(
      'This is not blocked on password-recovery SMTP ownership',
    )
    expect(register).not.toContain(
      'user notification/email remains pending Auth/SMTP ownership',
    )
  })

  it('does not silently re-rate unrelated unresolved risks', () => {
    for (const id of ['ACQ-R09', 'ACQ-R10', 'ACQ-R12', 'ACQ-R24']) {
      expect(register).toContain(`| ${id} |`)
    }
  })
})
