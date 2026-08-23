import { createContext, useContext, type ReactNode } from 'react'
import type { VNextActionItem, VNextActionsModel } from '../models/actions'

/**
 * HOW THE APPLICATION HANDS THE SHELL THE DURABLE ACTION FEED.
 *
 * ================================ WHY A CONTEXT =============================
 *
 * The same reason `VNextShellProvider` is one, and it is worth stating rather
 * than inheriting. Every page renders `VNextShell` itself, so the shell is two
 * components below whoever holds the feed; threading it as a prop would make
 * twenty screens couriers for state none of them may read. `src/vnext/AGENTS.md`
 * forbids the shell learning about a page and the reverse has to hold too.
 *
 * ================================ AND WHY THE CONTEXT LIVES HERE ============
 *
 * The DIRECTION. `integration/` is the application-facing boundary and `app/`
 * is presentation, so presentation may not import from integration — the
 * dependency-cruiser contract enforces it. The context therefore lives here
 * with the shell that consumes it, and `integration/actions/VNextActionsHost`
 * imports this file to fill it. Provider here, value from there, exactly as the
 * shell model already works.
 *
 * ================================ ABSENT IS ORDINARY ========================
 *
 * `undefined` means no host mounted one, and the shell then draws NO Action
 * Centre — no control, no panel, no empty state. That is the shape a story, a
 * render test or a `/dev` harness gets, and it is not a degraded product: a
 * shell that was never given a feed has nothing to show, which is different
 * from a feed that came back empty.
 */

/**
 * What a host hands the shell so it can draw the Action Centre.
 *
 * `model` is `null` while the read is out or after it failed, and `status`
 * carries which — the split `useVNextActionsSource` returns, passed through
 * rather than reinterpreted.
 */
export type VNextShellActions = {
  readonly model: VNextActionsModel | null
  readonly status: 'idle' | 'loading' | 'ready' | 'failed'
  /**
   * Called when the panel OPENS, so seen state is recorded on reading rather
   * than on loading. Marking when the feed arrives would record that a player
   * had seen a badge, which is not the same thing.
   */
  readonly onOpen?: (() => void) | undefined
  readonly onDismiss?: ((actionKey: string) => Promise<void>) | undefined
  readonly onRetry?: (() => void) | undefined
  /** Take the player to the item. Absent draws the row as plain information. */
  readonly onOpenItem?: ((item: VNextActionItem) => void) | undefined
}

const VNextActionsContext = createContext<VNextShellActions | undefined>(undefined)

export type VNextActionsProviderProps = {
  readonly value: VNextShellActions
  readonly children: ReactNode
}

export function VNextActionsProvider({ value, children }: VNextActionsProviderProps) {
  return <VNextActionsContext.Provider value={value}>{children}</VNextActionsContext.Provider>
}

/**
 * Resolve what the shell should draw.
 *
 * The prop is the override and the context is the host's answer, in that order
 * — so a story can hand the shell a world without a provider above it, and a
 * connected page inherits the host's without knowing it exists.
 */
export function useShellActions(
  supplied: VNextShellActions | undefined,
): VNextShellActions | undefined {
  const hosted = useContext(VNextActionsContext)
  return supplied ?? hosted
}
