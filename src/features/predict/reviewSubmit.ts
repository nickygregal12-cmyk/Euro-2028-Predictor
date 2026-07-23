// What still blocks submission, derived from the hub status. Pure so the Review
// submit zone's "Fix N → [first blocker]" router has one testable source of truth
// (design-system §6 Review amendment, 2026-07-22 audit). Order mirrors the Review
// checklist / computeHubStatus exactly: groups → finalise standings → bracket.
// Jokers are optional and never block.

import type { HubStatus } from './hubStatus'

export type SubmitBlocker = { label: string; route: string }

export function submitBlockers(status: HubStatus): SubmitBlocker[] {
  const out: SubmitBlocker[] = []
  if (!status.groups.complete) {
    out.push({ label: 'Groups A–F', route: '/predict/groups/A' })
  }
  if (status.thirdPlace.state !== 'settled') {
    out.push({
      label: 'Finalise Group Standings',
      route: '/predict/third-place',
    })
  }
  if (status.bracket.picked !== status.bracket.total) {
    out.push({ label: 'Knockout bracket', route: '/predict/bracket' })
  }
  return out
}

/** The first incomplete stage (checklist order), or null when the entry is submittable. */
export function firstBlocker(status: HubStatus): SubmitBlocker | null {
  return submitBlockers(status)[0] ?? null
}
