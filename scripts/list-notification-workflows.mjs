#!/usr/bin/env node
// Print the workflow identifiers a Novu environment must define, and the
// payload variables each one receives.
//
// Setting up a provider means creating one workflow per identifier the code
// triggers. Getting a single one wrong does not fail loudly: Novu answers 2xx
// with `trigger_not_active` or `no_workflow_steps_defined`, so the mistake
// looks like silence rather than an error. This prints the list to work from,
// derived from the source rather than retyped, so it cannot drift from what
// the adapter actually sends.
//
//   npm run notifications:workflows
//   npm run notifications:workflows -- --json
//
// It reads files. It makes no network request and needs no credential.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('..', import.meta.url)

/** @param {string} relativePath */
function read(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, root)), 'utf8')
}

/** `'kind': 'workflow-id',` pairs from the WORKFLOW_IDS map. */
function workflowIds() {
  const source = read('src/services/notifications/notificationPayload.ts')
  const block = source.match(
    /const WORKFLOW_IDS: Record<\s*NotificationEventKind,\s*string\s*> = \{([\s\S]*?)\n\}/,
  )
  // Two separate failures, said separately: the map is missing, or it matched
  // and its body did not come back. Collapsing them into one `!` would silence
  // the checker and report neither.
  if (!block) throw new Error('WORKFLOW_IDS not found in notificationPayload.ts')
  const body = block[1]
  if (body === undefined) throw new Error('WORKFLOW_IDS matched without a body')

  return [...body.matchAll(/'([^']+)':\s*'([^']+)'/g)].flatMap((match) => {
    const kind = match[1]
    const workflowId = match[2]
    return kind && workflowId ? [{ kind, workflowId }] : []
  })
}

/** `'kind': 'category',` pairs from NOTIFICATION_CATEGORIES. */
function categories() {
  const source = read('src/services/notifications/notificationEvents.ts')
  const block = source.match(
    /export const NOTIFICATION_CATEGORIES: Record<[\s\S]*?> = \{([\s\S]*?)\n\}/,
  )
  if (!block) throw new Error('NOTIFICATION_CATEGORIES not found')
  const body = block[1]
  if (body === undefined) {
    throw new Error('NOTIFICATION_CATEGORIES matched without a body')
  }

  return new Map(
    [...body.matchAll(/'([^']+)':\s*'([^']+)'/g)].flatMap((match) => {
      const kind = match[1]
      const category = match[2]
      return kind && category ? [[kind, category]] : []
    }),
  )
}

/** The fields each event kind carries, so a template author knows what exists. */
function payloadFields() {
  const source = read('src/services/notifications/notificationEvents.ts')
  const fields = new Map()

  for (const match of source.matchAll(
    /interface \w+ extends NotificationEventBase \{([\s\S]*?)\n\}/g,
  )) {
    const body = match[1]
    // An interface whose body did not come back is skipped rather than read as
    // an interface with no fields, which would silently produce a workflow the
    // manifest says takes no payload.
    if (body === undefined) continue

    const kind = body.match(/readonly kind:\s*'([^']+)'/)?.[1]
    if (!kind) continue

    const own = [...body.matchAll(/readonly (\w+):/g)]
      .flatMap((field) => (field[1] === undefined ? [] : [field[1]]))
      .filter((name) => name !== 'kind')

    // `competitionId` and `occurredAt` reach every template; `recipientId`
    // does not, because it addresses the notification rather than describing
    // the fact.
    fields.set(kind, [...own, 'competitionId', 'occurredAt', 'category'])
  }
  return fields
}

const ids = workflowIds()
const category = categories()
const fields = payloadFields()

const rows = ids.map(({ kind, workflowId }) => ({
  workflowId,
  kind,
  category: category.get(kind) ?? 'unknown',
  payload: fields.get(kind) ?? [],
}))

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`)
} else {
  process.stdout.write(
    `${rows.length} workflow identifiers must exist in the Novu environment.\n\n`,
  )
  let current = null
  for (const row of rows) {
    if (row.category !== current) {
      current = row.category
      process.stdout.write(`\n── ${current} ──\n`)
    }
    process.stdout.write(`  ${row.workflowId}\n`)
    process.stdout.write(`      triggered by : ${row.kind}\n`)
    process.stdout.write(`      payload vars : ${row.payload.join(', ')}\n`)
  }
  process.stdout.write(
    '\nA workflow that is missing, disabled or has no channel steps makes Novu\n' +
      'answer 2xx without sending. The adapter reports that as\n' +
      '`provider-not-processed:<status>` rather than as a delivery.\n',
  )
}
