import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReminderHealthPanel } from '../../../src/features/admin/ReminderHealthPanel'
import {
  mapReminderDeliveryHealth,
  presentReminderJobs,
} from '../../../src/services/supabase/reminderDeliveryHealthModel'

/**
 * Contract 172 on screen.
 *
 * THE PROPERTY THAT MATTERS IS A DISTINCTION, NOT A NUMBER. "No reminders are
 * scheduled" and "the scheduler is not running" produce identical counts, and
 * that ambiguity is how contracts 162, 163 and 170 each shipped a generator
 * with no caller and nobody noticed for three contracts. So the assertions
 * here are about telling three states apart:
 *
 *   * the jobs could not be read at all — unknown, and NEVER rendered as
 *     "nothing scheduled";
 *   * the jobs were read and one is missing — named, never counted;
 *   * the jobs are running and the ledger is simply quiet.
 *
 * AND ONE NEGATIVE: there is no control. Every driver is `service_role`-only
 * and no sender exists, so a button here would either do nothing or be the
 * first step toward the brand decision being taken by accident.
 */

const healthy = {
  as_of: '2026-08-12T19:35:00Z',
  jobs: [
    { jobname: 'player-action-centre-generate', schedule: '*/15 * * * *', active: true },
    { jobname: 'player-reminder-schedule', schedule: '*/5 * * * *', active: true },
    { jobname: 'player-reminder-reclaim-stalled', schedule: '7 * * * *', active: true },
  ],
  actions: {
    total: 8,
    open: 8,
    completed: 0,
    invalidated: 0,
    by_type: { matchweek_settled: 8 },
    last_generated_at: '2026-08-12T19:30:00Z',
    open_past_deadline: 0,
  },
  deliveries: {
    total: 0,
    by_status: {},
    pending_live: 0,
    pending_dry_run: 0,
    due_now: 0,
    in_flight: 0,
    stalled_over_an_hour: 0,
    oldest_pending_scheduled_for: null,
    last_updated_at: null,
    terminal_failures: 0,
    withdrawn: 0,
    max_attempts_seen: 0,
  },
  sender_configured: false,
}

const health = (over: Record<string, unknown> = {}) =>
  mapReminderDeliveryHealth({ ...healthy, ...over })

describe('ReminderHealthPanel', () => {
  it('reports an unreadable job table as unknown, never as nothing scheduled', async () => {
    render(<ReminderHealthPanel load={async () => health({ jobs: null })} />)
    await waitFor(() =>
      expect(screen.getByText(/could not be read/)).toBeInTheDocument(),
    )
    expect(
      screen.getByText(/not a report that nothing is scheduled/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Not every job is running/)).not.toBeInTheDocument()
  })

  it('names the job that is missing rather than counting them', async () => {
    render(
      <ReminderHealthPanel
        load={async () =>
          health({
            jobs: [
              {
                jobname: 'player-action-centre-generate',
                schedule: '*/15 * * * *',
                active: true,
              },
            ],
          })
        }
      />,
    )
    const alert = await screen.findByText(/Not every job is running/)
    // Both absent jobs by name, IN THE ALERT. A count of "2 of 3 missing"
    // tells an operator something is wrong and not what to restart.
    const summary = alert.closest('div')?.textContent ?? ''
    expect(summary).toContain('player-reminder-schedule')
    expect(summary).toContain('player-reminder-reclaim-stalled')
    expect(summary).not.toContain('player-action-centre-generate')
  })

  it('says that nothing sends, so a queue does not read as a backlog', async () => {
    render(<ReminderHealthPanel load={async () => health()} />)
    await waitFor(() =>
      expect(screen.getByText(/No sender is configured/)).toBeInTheDocument(),
    )
    expect(screen.getByText(/blocked on the brand decision/)).toBeInTheDocument()
  })

  it('offers no control at all', async () => {
    render(<ReminderHealthPanel load={async () => health()} />)
    await waitFor(() => expect(screen.getByText(/Open actions/)).toBeInTheDocument())
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('flags an item left open past its own deadline', async () => {
    render(
      <ReminderHealthPanel
        load={async () =>
          health({ actions: { ...healthy.actions, open_past_deadline: 3 } })
        }
      />,
    )
    await waitFor(() =>
      expect(screen.getByText(/open past their own deadline/)).toBeInTheDocument(),
    )
  })
})

describe('presentReminderJobs', () => {
  it('keeps "could not look" and "looked and found none" apart', () => {
    expect(presentReminderJobs(health({ jobs: null })).missing).toBeNull()
    expect(presentReminderJobs(health({ jobs: [] })).missing).toHaveLength(3)
  })

  it('reports every expected job whether or not the server returned it', () => {
    const answer = presentReminderJobs(health({ jobs: [] }))
    expect(answer.jobs.map((job) => job.name)).toEqual([
      'player-action-centre-generate',
      'player-reminder-schedule',
      'player-reminder-reclaim-stalled',
    ])
    expect(answer.jobs.every((job) => job.active === false)).toBe(true)
  })

  it('treats an inactive job as missing, because an inactive job runs nothing', () => {
    const answer = presentReminderJobs(
      health({
        jobs: [
          { jobname: 'player-reminder-schedule', schedule: '*/5 * * * *', active: false },
        ],
      }),
    )
    expect(answer.missing).toContain('player-reminder-schedule')
  })
})

describe('mapReminderDeliveryHealth', () => {
  it('decodes an absent sender flag as false rather than assuming one exists', () => {
    expect(mapReminderDeliveryHealth({}).senderConfigured).toBe(false)
  })

  it('refuses a non-integer count rather than rendering NaN', () => {
    const answer = mapReminderDeliveryHealth({
      deliveries: { total: 'lots', pending_live: -4, due_now: 2.5 },
    })
    expect(answer.deliveries.total).toBe(0)
    expect(answer.deliveries.pendingLive).toBe(0)
    expect(answer.deliveries.dueNow).toBe(0)
  })

  it('carries no player-identifying field, because the read returns none', () => {
    const answer = mapReminderDeliveryHealth({
      ...healthy,
      // Anything the server should never send is simply not decodable.
      user_id: 'u-1',
      last_error: 'smtp: 550 mailbox unavailable',
    })
    expect(JSON.stringify(answer)).not.toContain('u-1')
    expect(JSON.stringify(answer)).not.toContain('mailbox unavailable')
  })
})
