import type { ReactNode } from 'react'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import { VNextViewerZoneProvider } from '../../foundations/presentationZone'
import type { ShellIntent, VNextShellModel } from '../../models/shell'

/**
 * WHAT EVERY CONNECTED vNEXT SURFACE IS WRAPPED IN.
 *
 * `VNextShellProvider` hands the shell its world. This adds the one other thing
 * that separates a connected surface from a workshop one, and it exists so
 * there is exactly ONE place that difference is stated rather than twelve.
 *
 * ============================ THE READER'S OWN ZONE ======================
 *
 * `src/shared/time/kickoff.ts` is the product-wide authority: a kickoff, a
 * deadline and a match day are printed in the VIEWER'S OWN DEVICE ZONE.
 * `foundations/format.ts` defaults to the workshop's pinned `Europe/London`
 * because a story that moved with the machine reviewing it would be worthless —
 * so the default is right for the workshop and wrong for the product, and this
 * is the boundary between them.
 *
 * Without it, Home printed `17:45` for a Berlin reader while Matches — whose
 * adapter already formats through `kickoff.ts` — printed `18:45` for the same
 * instant, and a 22:45 kickoff could land under a different day heading on each
 * page.
 *
 * ============================ WHY NOT IN THE PAGE HOST ===================
 *
 * A page host mounts above navigation and there is one of it; a screen is also
 * mounted alone, by a dev harness and by a browser spec, and those are just as
 * connected. Putting the zone here means a surface is correct wherever it is
 * mounted rather than only underneath the one composition that remembered.
 *
 * `tests/vnext/vnextViewerZone.test.tsx` proves every connected screen uses
 * this rather than reaching for `VNextShellProvider` directly, which is what
 * stops the safe default from quietly becoming a production pin.
 */
export type VNextConnectedShellProps = {
  readonly model: VNextShellModel
  readonly onIntent?: ((intent: ShellIntent) => void) | undefined
  readonly children: ReactNode
}

export function VNextConnectedShell({
  model,
  onIntent,
  children,
}: VNextConnectedShellProps) {
  return (
    <VNextViewerZoneProvider>
      <VNextShellProvider model={model} onIntent={onIntent}>
        {children}
      </VNextShellProvider>
    </VNextViewerZoneProvider>
  )
}
