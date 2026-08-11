import type { PlayInbox } from '../features/hub/playInboxModel'

/**
 * How many things the player actually owes.
 *
 * OUTSTANDING, NOT UNREAD. It counts the two groups that are outstanding by
 * construction and deliberately excludes `settled`, which is where an action
 * goes once it has been done. A count that included settled items would tell a
 * player they have work left the moment after they finished it.
 *
 * IT LIVES APART FROM THE PANEL, and the separation is a bundle decision with a
 * user-facing reason. The badge must be correct on first paint — a count that
 * appears late reads as "nothing to do" for as long as it is missing — so this
 * stays in the entry chunk while `ActionCentre` is loaded only when somebody
 * opens it. Keeping them in one module put the entry chunk over its compressed
 * budget.
 */
export function outstandingCount(inbox: PlayInbox | null): number {
  if (!inbox) return 0
  return inbox.urgent.length + inbox.thisWeek.length
}
