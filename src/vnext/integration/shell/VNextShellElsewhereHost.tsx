import { createContext, useContext, type ReactNode } from 'react'
import { usePlayerCompetitions } from '../../../app/providers/PlayerCompetitionsProvider'
import type { ShellSourceElsewhere } from './shellSource'
import { useVNextShellElsewhere } from './useVNextShellElsewhere'

/**
 * WHERE THE CROSS-COMPETITION READ IS ACTUALLY MOUNTED.
 *
 * ============================ THE HALF THAT WAS MISSING ==================
 *
 * `useVNextShellElsewhere` says in its own header that it must be called by ONE
 * host, above page navigation, because `useGlobalPlayInbox` costs a play-context
 * read plus up to three game reads PER COMPETITION and a per-page host would pay
 * that again on every navigation. Every connected screen then grew a
 * `shellElsewhere` prop — and nothing passed one. So the hook was written,
 * tested and unreachable: the attention layer was empty in the running product
 * for the only reason that never shows up in a screenshot.
 *
 * This is that host. It is the persistent boundary — the thing that survives
 * movement between Home, Matches, Games and Leagues — so the reads happen once
 * per player rather than once per page, and switching destination does not
 * remount the inbox.
 *
 * ============================ WHY A CONTEXT AND A PROP ===================
 *
 * Under a router a host cannot hand a prop to a page it does not construct: the
 * page is an `<Outlet />`. So the value travels by context, and each screen
 * resolves `props.shellElsewhere ?? context`.
 *
 * BOTH ENDS STAY HONEST. A screen mounted with neither — a story, a render
 * test, a page-scoped `/dev` harness — gets `null`, which is the
 * ONE-COMPETITION SHAPE and not a degraded one: no switcher, no shortcut group,
 * no attention layer, no Jump. An explicit prop still wins, so a test can hand
 * a screen a world without a provider above it.
 *
 * ============================ IT ADDS NO READ ============================
 *
 * `usePlayerCompetitions` is the application's existing one-read-for-the-shell
 * provider, mounted by `AppShell` today. This host consumes it rather than
 * issuing a second membership read, and `useVNextShellElsewhere` consumes the
 * existing Global Play inbox rather than introducing a second rules engine.
 * Nothing here is a new capability; the capability existed and had no caller.
 */

const VNextShellElsewhereContext = createContext<ShellSourceElsewhere | null>(null)

/**
 * The host's answer, or `null` where no host mounted one.
 *
 * `null` IS NOT AN ERROR. A page rendered on its own is the ordinary case in
 * this lane and always has been — the same rule `useVNextShellContext` records.
 */
function useVNextShellElsewhereContext(): ShellSourceElsewhere | null {
  return useContext(VNextShellElsewhereContext)
}

/**
 * Resolve what a connected screen should build its shell from.
 *
 * The prop is the override and the context is the host's answer, in that order.
 * Both may be absent, and absent is the one-competition shape.
 */
export function useShellElsewhere(
  supplied: ShellSourceElsewhere | null | undefined,
): ShellSourceElsewhere | null {
  const hosted = useVNextShellElsewhereContext()
  return supplied ?? hosted
}

export type VNextShellElsewhereHostProps = {
  readonly children: ReactNode
}

/**
 * Mount ONCE, above whatever swaps the page.
 *
 * It renders its children unconditionally: the cross-competition layer is
 * secondary by the selected architecture, so a player must never wait on it to
 * see the page they asked for. While the reads are out the value is `null`,
 * which the attention layer draws as nothing — and `null` is deliberately not
 * an empty inbox, because "nothing is waiting" is a claim and the reads have
 * not made it yet.
 */
export function VNextShellElsewhereHost({ children }: VNextShellElsewhereHostProps) {
  const { player } = usePlayerCompetitions()
  const elsewhere = useVNextShellElsewhere(player)

  return (
    <VNextShellElsewhereContext.Provider value={elsewhere}>
      {children}
    </VNextShellElsewhereContext.Provider>
  )
}
