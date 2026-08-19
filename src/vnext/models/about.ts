/**
 * WHAT THE ABOUT & DISCLAIMER PAGE SAYS.
 *
 * ============================ WHY IT IS A MODEL ==========================
 *
 * Every other vNext surface takes a typed model and renders it, and this one is
 * no different — but for a second reason that matters more here. The wording on
 * this page is the product's public legal position, and a legal position spread
 * through JSX is a position nobody can read in one sitting, diff, or test a
 * claim against. `fixtures/about/content.ts` holds the sentences; this states
 * their shape; `about/VNextAbout.tsx` draws them and chooses none.
 *
 * ============================ WHAT IT MAY NOT BECOME =====================
 *
 * A claims register. Nothing here is generated, derived from a flag or
 * conditional on a competition: two versions of a disclaimer that differ by
 * build is two legal positions, and nobody would know which one a given reader
 * saw. The badge paragraph is written to be TRUE IN BOTH MODES for exactly that
 * reason — see `fixtures/about/content.ts`.
 */

type AboutSection = {
  /** Stable id, used for the heading and for anchoring a link at it. */
  readonly id: string
  readonly heading: string
  /** One or more paragraphs, in order. Rendered as written. */
  readonly paragraphs: readonly string[]
}

type AboutLink = {
  readonly label: string
  /**
   * An in-product route or an absolute URL.
   *
   * `null` MEANS THE DESTINATION DOES NOT EXIST YET, and the surface draws
   * nothing rather than a link to a page that answers Not Found. A dead legal
   * link is worse than an absent one: it reads as a document that exists and
   * was withheld.
   */
  readonly href: string | null
}

export type AboutModel = {
  readonly title: string
  /** One sentence under the title. The whole position, before the detail. */
  readonly summary: string
  readonly sections: readonly AboutSection[]
  /** Privacy, Terms and a rights-enquiry route, where each exists. */
  readonly links: readonly AboutLink[]
}

/**
 * THE ONE SENTENCE, AND THE ONE PLACE IT IS WRITTEN.
 *
 * The shell's footer line and the About page's own summary must be the SAME
 * claim rather than two paraphrases that drift apart — a product that states
 * its non-affiliation two slightly different ways has stated it badly. It lives
 * here, beside the shape of the page, because both the presentation lane's
 * shell and its About content need it and neither may import the other.
 *
 * IT DOES NOT SAY "NON-COMMERCIAL". ADR 0015 records that revenue is intended
 * — a premium tier, sponsorship, white-label licensing — so that word would be
 * a sentence which becomes false the first time a subscription exists.
 * INDEPENDENCE is the permanent claim and the one ADR 0017 actually asks for.
 */
export const NON_AFFILIATION_SHORT =
  'Unofficial football prediction game. Not affiliated with or endorsed by any league or club.'
