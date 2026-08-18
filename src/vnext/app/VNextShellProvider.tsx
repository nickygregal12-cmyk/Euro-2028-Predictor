import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { ShellIntent, VNextShellModel } from '../models/shell'

/**
 * HOW THE APPLICATION HANDS THE SHELL ITS WORLD.
 *
 * ================================ WHY A CONTEXT =============================
 *
 * `VNextHome` and `VNextMatchPredictor` each render `VNextShell` themselves —
 * that is Stage 5's shape and it is right: a page starts with the shell and
 * puts itself inside it. The consequence is that the shell is TWO components
 * below whoever knows which competitions the player has, and threading a shell
 * model through a page would make every page a courier for state it must never
 * read. `src/vnext/AGENTS.md` already forbids the shell learning anything about
 * a page; the reverse has to hold too.
 *
 * So the host wraps, the shell reads, and the page in between never sees it:
 *
 *   <VNextShellProvider model={shell} onIntent={…}>
 *     <VNextHome model={home} />
 *   </VNextShellProvider>
 *
 * ================================ WHY IT IS OPTIONAL ========================
 *
 * `VNextHome({ model })` STAYS RENDERABLE ALONE. That is Stage 6's rule and the
 * reason Storybook, the deterministic visual matrix and every render test can
 * hand a page a model and nothing else. Without a provider the shell composes
 * its competition-deck chrome from the page's own header and its
 * `competitionColours` — one football context, no switcher, no attention, no
 * Jump — which is exactly the one-competition shape and not a fallback to some
 * other information architecture. There is only one IA in the shell now.
 *
 * ================================ THE INTENT SEAM ===========================
 *
 * `onIntent` is the whole of the shell's outward edge and it is deliberately
 * route-agnostic. The shell says WHAT the player asked for; the host decides
 * what that means. In Storybook that is `useState`; in the dev harness it is a
 * state hook beside the connected page; after the production cutover stage it
 * will be a router. None of those are this stage's business, and a shell
 * holding six `onX` props would be re-plumbed for each of them.
 *
 * A host that supplies no `onIntent` gets controls that are still real,
 * focusable and named — they simply do nothing. That is honest for a review
 * surface and is what the neutral stories use.
 */

export type VNextShellContextValue = {
  readonly model: VNextShellModel
  readonly onIntent: ((intent: ShellIntent) => void) | undefined
}

const VNextShellContext = createContext<VNextShellContextValue | null>(null)

export type VNextShellProviderProps = {
  readonly model: VNextShellModel
  readonly onIntent?: ((intent: ShellIntent) => void) | undefined
  readonly children: ReactNode
}

export function VNextShellProvider({
  model,
  onIntent,
  children,
}: VNextShellProviderProps) {
  const value = useMemo<VNextShellContextValue>(
    () => ({ model, onIntent }),
    [model, onIntent],
  )
  return <VNextShellContext.Provider value={value}>{children}</VNextShellContext.Provider>
}

/**
 * The supplied world, or `null` where nobody supplied one.
 *
 * `null` IS NOT AN ERROR AND MUST NOT BECOME A THROW. A page rendered on its
 * own in a story is the ordinary case, not a mistake, and a hook that threw
 * would make the Gold Standard Home's own stories depend on application state
 * they exist to be independent of.
 */
export function useVNextShellContext(): VNextShellContextValue | null {
  return useContext(VNextShellContext)
}
