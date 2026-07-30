import type { CompetitionContext } from '../competition/context'

/**
 * Compatibility adapter for tournament surfaces that still need a simple
 * locked/unlocked answer. Time and fixture validation are resolved upstream by
 * the shared competition-context engine; this module performs no clock reads
 * and derives no deadline of its own.
 *
 * `no_valid_entry` is a locked spectator state: once the active entry scope is
 * closed, the absence of a valid entry must never make the UI appear editable.
 */
export function isEntryLocked(
  context: Pick<CompetitionContext, 'entryState'>,
): boolean {
  return context.entryState === 'locked' || context.entryState === 'no_valid_entry'
}
