import type { ReactNode } from 'react'
import { VNextRoot } from '../../vnext/foundations/VNextRoot'
import { useHapticsPreference } from '../providers/HapticsProvider'
import { useThemeChoice } from '../providers/ThemeProvider'

/**
 * `VNextRoot`, CONNECTED TO THE PREFERENCES THE APPLICATION ACTUALLY PERSISTS.
 *
 * ============================ THE SEAM THIS CLOSES ======================
 *
 * Every cut-over destination rendered a bare `<VNextRoot>`, whose `theme`
 * defaults to `system`. So a player who had chosen dark on a light device — or
 * light on a dark one — got their choice everywhere in the product EXCEPT the
 * nine surfaces the cutover had just moved them to. `DEC-016` settled that
 * question the other way: *"the player's choice outranks the device."*
 *
 * `VNextRoot` cannot read the provider itself. It is presentation and
 * `tests/vnext/vnextProductionBoundary.test.ts` forbids a vNext module from
 * importing `src/app/`; the direction of that boundary is the point. So the
 * reading happens here, in the application, and is handed down as a prop —
 * which is the same shape every other adapter in this directory has.
 *
 * BOTH READS DEGRADE RATHER THAN THROW. A story, a gallery or an isolated
 * render legitimately has neither provider, and a page that blanked because
 * nobody had told it which ramp to paint in would be a worse failure than the
 * one it was reporting.
 *
 * ============================ AND IT IS WHERE HAPTICS ARRIVE ============
 *
 * The same argument, for the same reason: `feedback.ts` resolves a semantic
 * against a preference, and the preference belongs to the device rather than to
 * the presentation lane. One provider, read once, above every vNext surface.
 */
export function VNextAppRoot({ children }: { children: ReactNode }) {
  const choice = useThemeChoice()
  const { preference } = useHapticsPreference()

  return (
    <VNextRoot theme={choice} haptics={preference}>
      {children}
    </VNextRoot>
  )
}
