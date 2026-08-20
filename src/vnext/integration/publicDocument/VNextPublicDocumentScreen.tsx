import { useMemo } from 'react'
import { VNextPublicDocument } from '../../publicDocument/VNextPublicDocument'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { ShellIntent } from '../../models/shell'
import type { PublicDocumentModel } from '../../models/publicDocument'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'

export type VNextPublicDocumentScreenProps = {
  readonly model: PublicDocumentModel
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  readonly playerName?: string | null | undefined
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
}

/**
 * Connected host for public policy documents.
 *
 * The content has no application read and therefore no loading/error state.
 * The only player-shaped information is optional chrome identity supplied by
 * the host; policy wording is identical signed in and signed out.
 */
export function VNextPublicDocumentScreen(props: VNextPublicDocumentScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
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
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      <VNextPublicDocument model={props.model} />
    </VNextShellProvider>
  )
}
