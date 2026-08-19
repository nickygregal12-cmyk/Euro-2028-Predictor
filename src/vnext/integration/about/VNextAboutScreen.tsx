import { useMemo } from 'react'
import { VNextAbout } from '../../about/VNextAbout'
import { VNextConnectedShell } from '../shell/VNextConnectedShell'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { aboutModel } from '../../fixtures/about/content'

/**
 * THE CONNECTED ABOUT & DISCLAIMER SURFACE.
 *
 * ============================ IT READS NOTHING ==========================
 *
 * The only adapter in this directory with no acquisition hook, no loading state
 * and no failure state — because the page has nothing to load. Its content is
 * the product's own published position, which is a fact about the product
 * rather than about a player, and a legal page that could fail to load would be
 * a legal page that sometimes is not there.
 *
 * It is here rather than in `about/` for one reason: the ONE thing it resolves
 * from the environment is the contact address, and reading `import.meta.env` is
 * application knowledge that the presentation lane may not hold.
 *
 * ============================ IT WORKS SIGNED OUT ========================
 *
 * `buildShellModel` with no competition, which is the shape Account and
 * Discovery already use — and the shape a signed-out visitor arriving from the
 * landing footer needs. Nothing on this page is about a player, so nothing on
 * it changes when there is not one.
 */

export type VNextAboutScreenProps = {
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  /** The player's name, where a host knows it. Chrome only; the page ignores it. */
  readonly playerName?: string | null | undefined
  /**
   * The player's OTHER competitions, where a host loads them. Absent is the
   * one-competition shape, which is also the signed-out shape.
   */
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
}

export function VNextAboutScreen(props: VNextAboutScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)

  const model = useMemo(
    () =>
      aboutModel({
        // OPTIONAL, AND ABSENT IS AN ANSWER. A deployment with no public
        // address draws no enquiry link rather than a `mailto:` to nowhere.
        supportEmail: import.meta.env.VITE_SUPPORT_EMAIL?.trim() || null,
      }),
    [],
  )

  const shell = useMemo(
    () =>
      buildShellModel({
        competition: null,
        playerName: props.playerName ?? null,
        outstandingPredictions: null,
        canNavigateAway: props.onShellIntent !== undefined,
        elsewhere,
      }),
    [props.playerName, props.onShellIntent, elsewhere],
  )

  return (
    <VNextConnectedShell model={shell} onIntent={props.onShellIntent}>
      <VNextAbout model={model} />
    </VNextConnectedShell>
  )
}
