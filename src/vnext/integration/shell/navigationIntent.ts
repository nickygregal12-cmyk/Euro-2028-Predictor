import type { ShellIntent } from '../../models/shell'

/**
 * Navigation requests that can be emitted from a connected vNext surface.
 *
 * `ShellIntent` remains the vocabulary of the shell itself. Match Centre is not
 * a fifth shell destination and the shell never emits it, but Home owns fixture
 * controls that already carry an authoritative fixture id. Keeping this as an
 * integration-level extension lets those controls ask for the exact fixture
 * without teaching presentation a URL or pretending Match Centre belongs in
 * permanent navigation.
 */
export type VNextNavigationIntent =
  | ShellIntent
  | {
      readonly kind: 'match-centre'
      readonly contextId: string
      readonly fixtureId: string
    }
