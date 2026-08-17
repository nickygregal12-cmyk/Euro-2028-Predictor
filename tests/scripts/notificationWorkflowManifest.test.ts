import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_EVENT_KINDS,
} from '../../supabase/functions/_shared/notifications/notificationEvents'

/**
 * The workflow manifest an operator creates the Novu environment from.
 *
 * It is derived from the source rather than maintained by hand, and this
 * asserts the derivation still works. The failure it prevents is quiet: a
 * workflow that exists in the code and not in the provider does not error, it
 * makes Novu answer 2xx with `trigger_not_active` and send nothing.
 */

interface ManifestRow {
  readonly workflowId: string
  readonly kind: string
  readonly category: string
  readonly payload: readonly string[]
}

function manifest(): ManifestRow[] {
  return JSON.parse(
    execFileSync(
      process.execPath,
      ['scripts/list-notification-workflows.mjs', '--json'],
      { cwd: process.cwd(), encoding: 'utf8' },
    ),
  ) as ManifestRow[]
}

describe('notification workflow manifest', () => {
  const rows = manifest()

  it('covers every declared event kind, and nothing else', () => {
    expect(rows.map((row) => row.kind).sort()).toEqual(
      [...NOTIFICATION_EVENT_KINDS].sort(),
    )
  })

  it('gives every kind a distinct workflow identifier', () => {
    const ids = rows.map((row) => row.workflowId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/)
  })

  it('reports the category the code will send', () => {
    for (const row of rows) {
      expect(row.category).toBe(
        NOTIFICATION_CATEGORIES[row.kind as keyof typeof NOTIFICATION_CATEGORIES],
      )
    }
  })

  it('lists the payload variables a template can reference', () => {
    for (const row of rows) {
      // Every payload carries these three, whatever the kind.
      expect(row.payload).toContain('competitionId')
      expect(row.payload).toContain('occurredAt')
      expect(row.payload).toContain('category')
      // The recipient addresses the notification; it is not template data.
      expect(row.payload).not.toContain('recipientId')
      expect(row.payload).not.toContain('kind')
    }
  })

  it('names the fields that make each notification worth sending', () => {
    const byId = new Map(rows.map((row) => [row.workflowId, row]))
    expect(byId.get('lms-eliminated')?.payload).toContain('selectionLabel')
    expect(byId.get('results-matchweek-points')?.payload).toContain('basis')
    expect(byId.get('leagues-overtaken')?.payload).toContain('pointsBehind')
  })
})
