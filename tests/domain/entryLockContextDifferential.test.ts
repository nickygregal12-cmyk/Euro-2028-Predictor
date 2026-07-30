import { describe, expect, it } from 'vitest'
import { resolveCompetitionContext } from '../../src/domain/competition/context'
import type { TournamentCompetitionConfig } from '../../src/domain/competition/kinds'
import { isEntryLocked } from '../../src/domain/tournament/entryLock'

const LOCK_AT = '2028-06-09T19:00:00.000Z'
const SCOPE_ID = 'home-entry'

const CONFIG: TournamentCompetitionConfig = {
  id: 'euro-2028',
  name: 'Euro 2028',
  kind: 'tournament',
  competitionTimeZone: 'Europe/London',
  bounds: {
    startsAt: '2028-06-09T00:00:00.000Z',
    endsAt: '2028-07-09T23:59:59.999Z',
  },
  primaryStage: 'groups',
  progression: 'groups_to_knockout',
  groupStage: { groupCount: 6, matchdayCount: 3 },
  knockoutStage: { roundCount: 4 },
  lockPolicy: { scope: 'entry', scopeCount: 1, bufferMinutes: 0 },
}

function legacyIsEntryLocked(lockAt: string | null, now: Date): boolean {
  if (!lockAt) return false
  return now.getTime() >= new Date(lockAt).getTime()
}

function resolvedContext(now: Date, validEntry = true) {
  const observedAt = now.toISOString()
  return resolveCompetitionContext(
    CONFIG,
    {
      progress: {
        hasStarted: now.getTime() >= Date.parse(LOCK_AT),
        regularStageComplete: false,
        nextStageReady: false,
        knockoutStarted: false,
        finalConfirmed: false,
        allCompetitionsSettled: false,
        markedComplete: false,
      },
      lockScopes: [
        {
          id: SCOPE_ID,
          type: 'entry',
          fixtureData: {
            observedAt,
            validUntil: observedAt,
            fixtures: [{ id: 'match-1', kickoffAt: LOCK_AT }],
          },
          previouslyLocked: false,
        },
      ],
      matches: [
        {
          id: 'match-1',
          lockScopeId: SCOPE_ID,
          kickoffAt: LOCK_AT,
          administrationState: 'scheduled',
          officialState: 'unconfirmed',
          corrected: false,
        },
      ],
    },
    { feedAvailable: false, matches: [] },
    {
      entry: {
        exists: true,
        complete: validEntry,
        valid: validEntry,
        submitted: validEntry,
        autoSubmitted: false,
        activeLockScopeId: SCOPE_ID,
      },
      competitions: [],
      actions: {
        accountOrEntryBlockingError: false,
        hasOutstandingPrediction: !validEntry,
        activeLiveMatchIds: [],
        cupTieBreakRequired: false,
        lmsSelectionRequired: false,
        sharedKnockoutPredictionRequired: false,
        matchAwaitingAttention: false,
        leagueInviteAvailable: false,
        urgentWindowMinutes: 0,
      },
    },
    now,
  )
}

describe('entry-lock context differential evidence', () => {
  it('matches the legacy open state before the inclusive boundary', () => {
    const now = new Date('2028-06-09T18:59:59.999Z')
    expect(legacyIsEntryLocked(LOCK_AT, now)).toBe(false)
    expect(isEntryLocked(resolvedContext(now))).toBe(false)
  })

  it('matches the legacy locked state exactly at the boundary', () => {
    const now = new Date(LOCK_AT)
    expect(legacyIsEntryLocked(LOCK_AT, now)).toBe(true)
    expect(isEntryLocked(resolvedContext(now))).toBe(true)
  })

  it('matches the legacy locked state after the boundary', () => {
    const now = new Date('2028-06-09T19:00:00.001Z')
    expect(legacyIsEntryLocked(LOCK_AT, now)).toBe(true)
    expect(isEntryLocked(resolvedContext(now))).toBe(true)
  })

  it('treats a post-lock missing valid entry as locked rather than editable', () => {
    const context = resolvedContext(new Date(LOCK_AT), false)
    expect(context.entryState).toBe('no_valid_entry')
    expect(isEntryLocked(context)).toBe(true)
  })
})
