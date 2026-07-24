import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const fixture = readFileSync(resolve(root, 'e2e/bracket-conflict-local.ts'), 'utf8')
const spec = readFileSync(resolve(root, 'e2e/bracket-conflict.spec.ts'), 'utf8')

const forbiddenHostedRefs = [
  'vkfnsqdyhvtwyqkisxhk',
  'iouzoutneyjpugbbtdem',
  'gcfdwobpnanjchcnvdco',
]

describe('bracket conflict browser E2E', () => {
  it('inherits the disposable local Supabase guard and uses an isolated account', () => {
    expect(fixture).toContain("createLocalAdmin")
    expect(fixture).toContain("prepareCompleteGroupEntry")
    expect(fixture).toContain("bracket-e2e@euro28.local")
    expect(fixture).toContain("welcomed_at")

    for (const ref of forbiddenHostedRefs) expect(fixture).not.toContain(ref)
  })

  it('covers both explicit recovery choices and the atomic submission barrier', () => {
    expect(spec).toContain("Load latest")
    expect(spec).toContain("Keep mine")
    expect(spec).toContain("replace_predicted_progression")
    expect(spec).toContain("submit_entry")
    expect(spec).toContain("These picks were changed on another device")

    for (const ref of forbiddenHostedRefs) expect(spec).not.toContain(ref)
  })
})
