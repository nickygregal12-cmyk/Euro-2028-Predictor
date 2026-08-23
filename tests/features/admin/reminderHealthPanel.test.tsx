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
    expect(
      screen.getByText(/A queue here is the expected state rather than a backlog/),
    ).toBeInTheDocument()
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

describe('the sender and dispatch sections', () => {
  it('keeps "the scheduler could not be read" apart from "no secrets"', async () => {
    render(
      <ReminderHealthPanel
        load={async () =>
          health({
            sender: { configured: false, secrets_present: true, job_active: null, error: null },
          })
        }
      />,
    )
    await waitFor(() =>
      expect(screen.getByText(/Whether the sender runs is unknown/)).toBeInTheDocument(),
    )
    // The wrong answer is the reassuring-sounding one: sending an operator to
    // re-enter secrets the server just confirmed are present.
    expect(screen.queryByText(/no endpoint or caller key is recorded/)).not.toBeInTheDocument()
  })

  it('says which half is missing when the job is measured as off', async () => {
    render(
      <ReminderHealthPanel
        load={async () =>
          health({
            sender: { configured: false, secrets_present: true, job_active: false, error: null },
          })
        }
      />,
    )
    await waitFor(() =>
      expect(screen.getByText(/the dispatch job is not active/)).toBeInTheDocument(),
    )
  })

  it('reports a sender that cannot start, with the reason', async () => {
    render(
      <ReminderHealthPanel
        load={async () =>
          health({
            sender: {
              configured: false,
              secrets_present: true,
              job_active: true,
              error: 'notification_dispatch_function_url must be an https URL',
            },
          })
        }
      />,
    )
    await waitFor(() =>
      expect(screen.getByText(/configured but cannot start/)).toBeInTheDocument(),
    )
    expect(screen.getByText(/must be an https URL/)).toBeInTheDocument()
  })

  it('warns about a run the sender never answered, and says why the other ledger cannot show it', async () => {
    render(
      <ReminderHealthPanel
        load={async () =>
          health({
            dispatch: {
              runs_total: 5,
              runs_last_hour: 5,
              unreported_over_ten_minutes: 2,
              last_requested_at: '2026-08-12T19:34:00Z',
              last_outcome: null,
              delivery_disabled_last_hour: 0,
              not_configured_last_hour: 0,
            },
          })
        }
      />,
    )
    await waitFor(() =>
      expect(screen.getByText(/never reported back/)).toBeInTheDocument(),
    )
    expect(screen.getByText(/those runs never claimed anything/)).toBeInTheDocument()
  })

  it('renders a refusal as a refusal rather than as a failure', async () => {
    render(
      <ReminderHealthPanel
        load={async () =>
          health({
            dispatch: {
              runs_total: 12,
              runs_last_hour: 12,
              unreported_over_ten_minutes: 0,
              last_requested_at: '2026-08-12T19:34:00Z',
              last_outcome: 'delivery-disabled',
              delivery_disabled_last_hour: 12,
              not_configured_last_hour: 0,
            },
          })
        }
      />,
    )
    await waitFor(() =>
      expect(
        screen.getByText(/delivery is not enabled on that deployment/),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText(/never reported back/)).not.toBeInTheDocument()
  })

  it('says the dispatch state is unknown when the read returned no section', async () => {
    render(<ReminderHealthPanel load={async () => health()} />)
    await waitFor(() =>
      expect(
        screen.getByText(/what the sender has been asked to do is unknown/),
      ).toBeInTheDocument(),
    )
  })

  it('still offers no control on any of the new sections', async () => {
    render(
      <ReminderHealthPanel
        load={async () =>
          health({
            dispatch: {
              runs_total: 1,
              runs_last_hour: 1,
              unreported_over_ten_minutes: 1,
              last_requested_at: '2026-08-12T19:34:00Z',
              last_outcome: 'dispatch-failed',
              delivery_disabled_last_hour: 0,
              not_configured_last_hour: 0,
            },
          })
        }
      />,
    )
    await waitFor(() => expect(screen.getByText(/Dispatch runs/)).toBeInTheDocument())
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})

describe('presentReminderJobs', () => {
  it('keeps "could not look" and "looked and found none" apart', () => {
    expect(presentReminderJobs(health({ jobs: null })).missing).toBeNull()
    expect(presentReminderJobs(health({ jobs: [] })).missing).toHaveLength(4)
  })

  it('reports every expected job whether or not the server returned it', () => {
    const answer = presentReminderJobs(health({ jobs: [] }))
    expect(answer.jobs.map((job) => job.name)).toEqual([
      'player-action-centre-generate',
      'player-reminder-schedule',
      'player-reminder-reclaim-stalled',
      'player-reminder-dispatch',
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

  it('keeps a sender that cannot start apart from a sender that was never set up', () => {
    const missing = mapReminderDeliveryHealth({
      sender: { configured: false, secrets_present: false, job_active: true, error: null },
    })
    expect(missing.sender?.configured).toBe(false)
    expect(missing.sender?.error).toBeNull()
    expect(missing.sender?.secretsPresent).toBe(false)

    const broken = mapReminderDeliveryHealth({
      sender: { configured: false, error: 'must be an https URL' },
    })
    expect(broken.sender?.configured).toBe(false)
    // The difference between the two: one has nothing to fix, the other does.
    expect(broken.sender?.error).toBe('must be an https URL')
  })

  it('reports an unreadable job flag as unknown rather than as off', () => {
    const answer = mapReminderDeliveryHealth({
      sender: { configured: false, secrets_present: true, job_active: null, error: null },
    })
    expect(answer.sender?.jobActive).toBeNull()
  })

  it('decodes the dispatch runs, and an absent section as "could not look"', () => {
    expect(mapReminderDeliveryHealth({}).dispatch).toBeNull()

    const answer = mapReminderDeliveryHealth({
      dispatch: {
        runs_total: 12,
        runs_last_hour: 3,
        unreported_over_ten_minutes: 1,
        last_outcome: 'delivery-disabled',
        last_configured: true,
        last_due_at_request: 4,
        last_claimed: null,
        delivery_disabled_last_hour: 3,
        not_configured_last_hour: 0,
      },
    })
    expect(answer.dispatch?.runsTotal).toBe(12)
    expect(answer.dispatch?.unreportedOverTenMinutes).toBe(1)
    expect(answer.dispatch?.lastOutcome).toBe('delivery-disabled')
    // Null, not zero: a run that reported nothing has not claimed nothing.
    expect(answer.dispatch?.lastClaimed).toBeNull()
    expect(answer.dispatch?.lastDueAtRequest).toBe(4)
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
