// Contract 172's `admin_reminder_delivery_health` — whether the action centre's
// generators and the reminder ledger are actually running, for a competition
// administrator.
//
// IT IS A READ AND THERE IS DELIBERATELY NOTHING ELSE TO CALL. The three jobs
// contract 172 schedules run server-side; `process_player_action_items`,
// `process_reminder_schedule` and `reclaim_stalled_reminders` are
// `service_role`-only and none is wrapped here. `claim_due_reminders` is the
// one a sender would call and is emphatically not wrapped: nothing sends,
// `SITE-007` still blocks the transactional sender on the brand decision, and
// a browser wrapper would be the first step toward that being decided by
// accident.
//
// NO ARGUMENT. The health of the scheduler is a platform fact rather than a
// season's, so the read takes none and this passes none.

import { db } from './client'
import {
  mapReminderDeliveryHealth,
  type ReminderDeliveryHealth,
} from './reminderDeliveryHealthModel'

export type {
  ReminderDeliveryHealth,
  ReminderJob,
  ReminderJobHealth,
  ActionCentreCounts,
  ReminderDeliveryCounts,
} from './reminderDeliveryHealthModel'

export async function fetchReminderDeliveryHealth(): Promise<ReminderDeliveryHealth> {
  const { data, error } = await db.rpc('admin_reminder_delivery_health')
  if (error) throw error
  return mapReminderDeliveryHealth(data)
}
