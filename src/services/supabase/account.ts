import { supabase } from './client'
import {
  mapAccountSettings,
  mapClearEntryResult,
  type AccountSettings,
  type ClearEntryResult,
} from './accountModel'

export type { AccountSettings, ClearEntryResult } from './accountModel'

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
