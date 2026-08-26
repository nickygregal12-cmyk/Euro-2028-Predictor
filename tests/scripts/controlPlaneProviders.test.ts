import { describe, expect, it } from 'vitest'

import {
  COOLDOWN_MS,
  NO_PROVIDER_STATE,
  healthAfter,
  isReady,
  permittedProvider,
  readProviderRecord,
  selectProvider,
} from '../../scripts/control-plane/providers.mjs'

const NOW = '2026-08-26T03:00:00.000Z'
const LATER = '2026-08-26T04:00:00.000Z'

function record(overrides: Record<string, unknown> = {}) {
  return {
    paidUseAuthorised: false,
    budget: { maxRequestsPerRun: 500 },
    lanes: {
      repository: { providers: [{ id: 'github-rest', billing: 'INCLUDED' }] },
      model: { providers: [] },
    },
    ...overrides,
  }
}

describe('the refusals that are code rather than data', () => {
  it('will not select a paid provider while paid use is unauthorised', () => {
    const paid = { id: 'expensive', billing: 'PAID' }

    expect(permittedProvider(paid, { now: NOW })).toMatchObject({ permitted: false })
    expect(permittedProvider(paid, { now: NOW }).reason).toContain('paid use is not authorised')
    // Two edits are needed to spend money, and the second is not about a provider.
    expect(permittedProvider(paid, { now: NOW, paidUseAuthorised: true }).permitted).toBe(true)
  })

  it('treats a free claim as a claim about a moment, not a property', () => {
    // Nothing may assume a free model stays free.
    expect(permittedProvider({ id: 'f', billing: 'FREE' }, { now: NOW }).reason).toContain('no freeUntil')
    expect(permittedProvider({ id: 'f', billing: 'FREE', freeUntil: 'soon' }, { now: NOW }).reason)
      .toContain('unreadable freeUntil')
    expect(permittedProvider({ id: 'f', billing: 'FREE', freeUntil: LATER }, { now: NOW }).permitted).toBe(true)
    expect(permittedProvider({ id: 'f', billing: 'FREE', freeUntil: NOW }, { now: LATER }))
      .toMatchObject({ permitted: false, reason: expect.stringContaining('has expired') })
  })

  it('refuses a billing tier it does not recognise rather than assuming the cheapest', () => {
    for (const billing of [undefined, null, 'free', 'CHEAP', '']) {
      expect(permittedProvider({ id: 'x', billing }, { now: NOW }).permitted, String(billing)).toBe(false)
    }
  })

  it('never treats an unavailable lane as a reason to reach further', () => {
    // The failure mode "silently switched to paid billing" is exactly this: a
    // fallback that widens the tier instead of stopping.
    const exhausted = selectProvider({
      record: record({ lanes: { repository: { providers: [{ id: 'p', billing: 'PAID' }] } } }),
      lane: 'repository', now: NOW,
    })

    expect(exhausted.selected).toBe(null)
    expect(exhausted.rejected[0]?.reason).toContain('paid use is not authorised')
    expect(NO_PROVIDER_STATE).toBe('WAITING_PROVIDER')
  })
})

describe('health follows from what was actually observed', () => {
  it('does not retry a credential that was refused', () => {
    // Nothing about the next attempt is different, so waiting cannot help.
    const health = healthAfter(undefined, { id: 'p', failureClass: 'AUTH_REQUIRED', at: NOW })

    expect(health).toMatchObject({ state: 'UNUSABLE', reason: 'AUTH_REQUIRED' })
    expect(isReady(health, LATER)).toBe(false)
  })

  it('rests a rate limit for longer than an outage, and both for a bounded time', () => {
    const limited = healthAfter(undefined, { id: 'p', failureClass: 'PROVIDER_LIMIT', at: NOW })
    const down = healthAfter(undefined, { id: 'p', failureClass: 'PROVIDER_OUTAGE', at: NOW })

    expect(COOLDOWN_MS.PROVIDER_LIMIT).toBeGreaterThan(COOLDOWN_MS.PROVIDER_OUTAGE)
    expect(isReady(limited, NOW)).toBe(false)
    expect(isReady(limited, LATER)).toBe(true)
    expect(isReady(down, NOW)).toBe(false)
  })

  it('leaves health alone for a failure that is not the provider\'s fault', () => {
    const ready = healthAfter(undefined, { id: 'p', failureClass: undefined, at: NOW })
    const cooling = healthAfter(undefined, { id: 'p', failureClass: 'PROVIDER_LIMIT', at: NOW })

    // A failing test says nothing about GitHub.
    expect(healthAfter(cooling, { id: 'p', failureClass: 'BRANCH_TEST_FAILURE', at: NOW })).toBe(cooling)
    expect(ready.state).toBe('READY')
  })
})

describe('selection is declaration order, and the record is auditable', () => {
  it('takes the first permitted, ready provider', () => {
    const three = record({
      lanes: { repository: { providers: [
        { id: 'first', billing: 'PAID' },
        { id: 'second', billing: 'FREE', freeUntil: NOW },
        { id: 'third', billing: 'INCLUDED' },
      ] } },
    })

    const chosen = selectProvider({ record: three, lane: 'repository', now: LATER })

    expect(chosen.selected?.id).toBe('third')
    // Both rejections are reported, so a selection can be explained afterwards.
    expect(chosen.rejected.map((entry) => entry.id)).toEqual(['first', 'second'])
  })

  it('skips a cooling provider and comes back to it', () => {
    const two = record({
      lanes: { repository: { providers: [{ id: 'a', billing: 'INCLUDED' }, { id: 'b', billing: 'INCLUDED' }] } },
    })
    const health = { a: healthAfter(undefined, { id: 'a', failureClass: 'PROVIDER_LIMIT', at: NOW }) }

    expect(selectProvider({ record: two, lane: 'repository', now: NOW, health }).selected?.id).toBe('b')
    expect(selectProvider({ record: two, lane: 'repository', now: LATER, health }).selected?.id).toBe('a')
  })

  it('stops at the run budget instead of finding something else to spend', () => {
    const spent = selectProvider({ record: record(), lane: 'repository', now: NOW, requestsMade: 500 })

    expect(spent.selected).toBe(null)
    expect(spent.reason).toContain('budget')
  })

  it('says an unprovisioned lane is unprovisioned rather than unavailable', () => {
    const model = selectProvider({ record: record(), lane: 'model', now: NOW })

    // Declared and empty, the same shape Stage 3 used for the deployment
    // identity lane: a lane that exists and can hold nothing.
    expect(model.selected).toBe(null)
    expect(model.reason).toContain('unprovisioned')
    expect(selectProvider({ record: record(), lane: 'imaginary', now: NOW }).reason).toContain('no lane')
  })
})

describe('the tracked record', () => {
  it('declares the one provider the control plane actually reaches, and no paid use', () => {
    const tracked = readProviderRecord()

    expect(tracked.paidUseAuthorised).toBe(false)
    expect(tracked.lanes.repository.providers.map((p: any) => p.id)).toEqual(['github-rest'])
    // The model lane is declared and empty on purpose: there is no model
    // dispatch in this control plane, and a lane nobody wrote down is a lane
    // nobody checks.
    expect(tracked.lanes.model.providers).toEqual([])
    expect(selectProvider({ record: tracked, lane: 'repository', now: NOW }).selected?.id).toBe('github-rest')
  })
})
