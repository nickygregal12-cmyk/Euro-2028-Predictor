import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { viewerTimeZone } from '../../shared/time/kickoff'

/**
 * WHICH ZONE A vNEXT SURFACE PRINTS A TIME IN.
 *
 * ============================ THE DEFECT THIS CLOSES =====================
 *
 * `src/shared/time/kickoff.ts` is the product-wide authority and its rule has
 * one sentence: **the viewer's own device zone**. Matches already obeys it,
 * because its adapter formats through that module. Home, the Match Predictor,
 * Last Man Standing and the Championship did not: they call
 * `foundations/format.ts` at render, and that module pins `en-GB` and
 * `Europe/London` for the workshop's benefit.
 *
 * So one instant could print as `17:45` on Home and `18:45` on Matches for the
 * same reader in Berlin, and a 22:45 kickoff could sit under one day heading on
 * one page and another on the next. That is a cutover defect rather than a
 * workshop one: the pin was correct while the lane was screenshots, and stops
 * being correct the moment the lane is the product.
 *
 * ============================ WHY A CONTEXT, NOT A DEFAULT SWAP ==========
 *
 * The obvious fix — make `format.ts` read `viewerTimeZone()` — would take the
 * determinism the workshop is built on with it. Every story, every visual
 * matrix board and every render test would print whatever zone the machine
 * running it happened to be in, and a screenshot comparison across two machines
 * would be worthless. The pin is not a mistake; it is a REVIEW requirement that
 * production must not inherit.
 *
 * So the zone is a value a surface is rendered inside, and the DEFAULT IS THE
 * WORKSHOP PIN. A component rendered on its own — in Storybook, in the matrix,
 * in jsdom — keeps the deterministic zone it has always had and no test moves.
 * A connected surface is rendered inside `VNextViewerZoneProvider`, and every
 * formatter beneath it resolves in the reader's own zone.
 *
 * `tests/vnext/vnextViewerZone.test.tsx` holds the half a default cannot: every
 * connected screen must actually be inside the provider, so the safe default
 * cannot become a silent production pin.
 *
 * ============================ IT IS NEVER A RULE =========================
 *
 * Same sentence `kickoff.ts` carries and for the same reason: nothing here
 * decides what is locked, open, played or settled. The server decides that, and
 * no caller may compare one of these strings — or the clock behind them —
 * against a rule.
 */
export type VNextPresentationZone = {
  /**
   * `undefined` means the reader's own locale, which is what production wants:
   * month order is genuinely a reading preference. The workshop pins `en-GB` so
   * two machines draw the same board.
   */
  readonly locale: string | undefined
  /** An IANA zone name. Never a UTC offset — offsets do not know about summer time. */
  readonly timeZone: string
}

/** The deterministic zone the design workshop reviews in. */
export const WORKSHOP_PRESENTATION_ZONE: VNextPresentationZone = {
  locale: 'en-GB',
  timeZone: 'Europe/London',
}

const VNextPresentationZoneContext = createContext<VNextPresentationZone>(
  WORKSHOP_PRESENTATION_ZONE,
)

/** The zone the surface beneath this call should print in. */
export function useVNextPresentationZone(): VNextPresentationZone {
  return useContext(VNextPresentationZoneContext)
}

export type VNextPresentationZoneProviderProps = {
  readonly zone: VNextPresentationZone
  readonly children: ReactNode
}

/**
 * An explicit zone. Used by the workshop to review a second zone beside the
 * pinned one, and by tests that prove two readers see one instant differently.
 */
export function VNextPresentationZoneProvider({
  zone,
  children,
}: VNextPresentationZoneProviderProps) {
  return (
    <VNextPresentationZoneContext.Provider value={zone}>
      {children}
    </VNextPresentationZoneContext.Provider>
  )
}

/**
 * THE PRODUCTION WRAPPER. Resolves the reader's zone once and holds it.
 *
 * Once, because `Intl.DateTimeFormat().resolvedOptions()` is not free and a
 * fixture list calls a formatter per row; and because a zone that re-resolved
 * mid-render could group a list by one day and print another, which is the
 * exact failure `kickoff.ts` exists to prevent.
 */
export function VNextViewerZoneProvider({ children }: { readonly children: ReactNode }) {
  const zone = useMemo<VNextPresentationZone>(
    () => ({ locale: undefined, timeZone: viewerTimeZone() }),
    [],
  )
  return (
    <VNextPresentationZoneContext.Provider value={zone}>
      {children}
    </VNextPresentationZoneContext.Provider>
  )
}
