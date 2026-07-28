import { describe, expect, it } from 'vitest'
import {
  mapAccountSettings,
  mapClearEntryResult,
} from '../../src/services/supabase/accountModel'

describe('Account response models', () => {
  it('maps account settings', () => {
    expect(
      mapAccountSettings({
        display_name: 'Nicky',
        deadline_reminder_emails_enabled: false,
      }),
    ).toEqual({
      displayName: 'Nicky',
      deadlineReminderEmailsEnabled: false,
    })
  })

  it('rejects malformed account settings', () => {
    expect(() => mapAccountSettings(null)).toThrow(/malformed/i)
    expect(() =>
      mapAccountSettings({
        display_name: 'Nicky',
        deadline_reminder_emails_enabled: 'yes',
      }),
    ).toThrow(/malformed/i)
  })

  it('maps a bounded clear-entry result', () => {
    expect(
      mapClearEntryResult({
        entry_id: 'entry-1',
        match_predictions: 36,
        group_positions: 24,
        tie_resolutions: 2,
        progression: 16,
        award_picks: 1,
      }),
    ).toEqual({
      entryId: 'entry-1',
      matchPredictions: 36,
      groupPositions: 24,
      tieResolutions: 2,
      progression: 16,
      awardPicks: 1,
    })
  })

  it('accepts an already-empty entry response', () => {
    expect(
      mapClearEntryResult({
        entry_id: null,
        match_predictions: 0,
        group_positions: 0,
        tie_resolutions: 0,
        progression: 0,
        award_picks: 0,
      }),
    ).toEqual({
      entryId: null,
      matchPredictions: 0,
      groupPositions: 0,
      tieResolutions: 0,
      progression: 0,
      awardPicks: 0,
    })
  })

  it('rejects malformed or negative clear-entry counts', () => {
    expect(() =>
      mapClearEntryResult({
        entry_id: 12,
        match_predictions: 0,
        group_positions: 0,
        tie_resolutions: 0,
        progression: 0,
        award_picks: 0,
      }),
    ).toThrow(/entry id/i)

    expect(() =>
      mapClearEntryResult({
        entry_id: null,
        match_predictions: -1,
        group_positions: 0,
        tie_resolutions: 0,
        progression: 0,
        award_picks: 0,
      }),
    ).toThrow(/match count/i)
  })
})
