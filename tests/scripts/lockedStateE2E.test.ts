import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const fixture = readFileSync(resolve(root, 'e2e/locked-state-local.ts'), 'utf8')
const spec = readFileSync(resolve(root, 'e2e/locked-state.spec.ts'), 'utf8')

const forbiddenHostedRefs = [
  'vkfnsqdyhvtwyqkisxhk',
  'iouzoutneyjpugbbtdem',
  'gcfdwobpnanjchcnvdco',
]

describe('locked-state browser E2E', () => {
  it('inherits the disposable local guard and restores the tournament lock', () => {
    expect(fixture).toContain('createLocalAdmin')
    expect(fixture).toContain('locked-e2e@euro28.local')
    expect(fixture).toContain('prepareCompleteGroupEntry')
    expect(spec).toContain('prepared.futureLockAt')
    expect(spec).toContain('setDisposableTournamentLock')

    for (const ref of forbiddenHostedRefs) {
      expect(fixture).not.toContain(ref)
      expect(spec).not.toContain(ref)
    }
  })

  it('covers all locked write boundaries and post-lock readability', () => {
    expect(spec).toContain('/rest/v1/match_predictions')
    expect(spec).toContain('/rest/v1/rpc/delete_match_prediction')
    expect(spec).toContain('/rest/v1/rpc/replace_predicted_progression')
    expect(spec).toContain('/rest/v1/bonus_predictions')
    expect(spec).toContain('/rest/v1/rpc/submit_entry')
    expect(spec).toContain('Predictions are locked')
    expect(spec).toContain('Entry submission is closed')
    expect(spec).toContain('readBracketSnapshot')
  })
})
