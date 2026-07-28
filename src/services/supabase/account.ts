import { supabase } from './client'

export type AccountSettings = {
  displayName: string
  deadlineReminderEmailsEnabled: boolean
}

export type ClearEntryResult = {
  entryId: string | null
  matchPredictions: number
  groupPositions: number
  tieResolutions: number
  progression: number
  awardPicks: number
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown, label: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Malformed ${label} response.`)
  }
  return value as UnknownRecord
}

export function mapAccountSettings(value: unknown): AccountSettings {
  const row = asRecord(value, 'account settings')
  if (
    typeof row.display_name !== 'string' ||
    typeof row.deadline_reminder_emails_enabled !== 'boolean'
  ) {
    throw new Error('Malformed account settings response.')
  }
  return {
    displayName: row.display_name,
    deadlineReminderEmailsEnabled: row.deadline_reminder_emails_enabled,
  }
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`Malformed clear-entry ${field}.`)
  }
  return Number(value)
}

export function mapClearEntryResult(value: unknown): ClearEntryResult {
  const row = asRecord(value, 'clear-entry')
  if (row.entry_id !== null && typeof row.entry_id !== 'string') {
    throw new Error('Malformed clear-entry entry id.')
  }
  return {
    entryId: row.entry_id as string | null,
    matchPredictions: nonNegativeInteger(row.match_predictions, 'match count'),
    groupPositions: nonNegativeInteger(row.group_positions, 'group-position count'),
    tieResolutions: nonNegativeInteger(row.tie_resolutions, 'tie-resolution count'),
    progression: nonNegativeInteger(row.progression, 'progression count'),
    awardPicks: nonNegativeInteger(row.award_picks, 'award count'),
  }
}

export async function fetchAccountSettings(userId: string): Promise<AccountSettings> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, deadline_reminder_emails_enabled')
    .eq('id', userId)
    .single()
  if (error) throw error
  return mapAccountSettings(data)
}

export async function updateAccountDisplayName(
  userId: string,
  displayName: string,
): Promise<AccountSettings> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim() })
    .eq('id', userId)
    .select('display_name, deadline_reminder_emails_enabled')
    .single()
  if (error) throw error
  return mapAccountSettings(data)
}

export async function updateDeadlineReminderPreference(
  userId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ deadline_reminder_emails_enabled: enabled })
    .eq('id', userId)
  if (error) throw error
}

export async function clearMyEntry(tournamentId: string): Promise<ClearEntryResult> {
  const { data, error } = await supabase.rpc('clear_my_entry', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapClearEntryResult(data)
}
