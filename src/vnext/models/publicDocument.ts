/**
 * A PUBLIC SERVICE DOCUMENT rendered inside the vNext platform shell.
 *
 * These pages are intentionally read-only and player-independent. The model is
 * prose plus real destinations; presentation does not decide policy wording,
 * processor state, retention promises or contact details.
 */
// Not exported: both are structural parts of `PublicDocumentModel`, which is
// what every surface imports. Exporting them added two names nothing referenced,
// which the dead-code gate reports rather than forgives. They stay named so the
// model reads as prose plus destinations rather than as two inline shapes.
type PublicDocumentSection = {
  readonly id: string
  readonly heading: string
  readonly paragraphs: readonly string[]
}

type PublicDocumentLink = {
  readonly label: string
  readonly href: string
}

export type PublicDocumentModel = {
  readonly title: string
  readonly context: string
  readonly summary: string
  readonly sections: readonly PublicDocumentSection[]
  readonly links: readonly PublicDocumentLink[]
}
