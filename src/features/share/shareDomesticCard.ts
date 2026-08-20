import { canvasToBlob, shareOrDownloadImage, type ShareImageResult } from './shareImage'
import {
  domesticCardCopy,
  domesticCardFileName,
  type DomesticCardFacts,
} from './domesticShareCard'
import { renderDomesticShareCard } from './renderDomesticShareCard'

/**
 * Turning a card into something a player can actually send.
 *
 * THE FALLBACK ORDER IS DELIBERATE AND IS `shareImage.ts`'s, unchanged: the
 * native share sheet where the platform can share files, a download where it
 * cannot, and a cancellation reported as a cancellation rather than as a
 * failure. Rebuilding that here would be a second answer to a question this
 * repository has already answered for the Euro card.
 *
 * THE COMPANION TEXT COMES FROM THE CARD'S OWN COPY, not from
 * `shareTextModel.ts`. That module is the allow-list for a TEXT-only share from
 * a surface with no image; a card already has an allow-list — its own — and
 * running the same facts through two sentence-writers is exactly how the words
 * on the image and the words beside it drift apart. One set of facts, one
 * sentence.
 *
 * THE URL IS THE CALLER'S AND IS NEVER BUILT HERE. Whoever raised the share
 * knows which surface it describes; this has no router and no site
 * configuration, and a URL guessed from either would be the wrong one on the
 * other deployment. It must never be an invite link — a card is a boast, and an
 * invite is a credential.
 *
 * NOTHING HAPPENS WITHOUT A PRESS. There is no auto-share, no share on
 * settlement and no "share your result?" interruption. The player asks, or this
 * is not called.
 */

export type ShareDomesticCardResult = ShareImageResult | 'unavailable'

/**
 * The sentence that travels beside the image.
 *
 * Short on purpose: most targets truncate, and the image already carries the
 * detail. It repeats only the headline and what it was.
 */
export function domesticCardShareText(facts: DomesticCardFacts): {
  title: string
  text: string
} {
  const copy = domesticCardCopy(facts)
  return {
    title: `${copy.headline} ${copy.headlineLabel} — ${copy.eyebrow}`,
    text: `${copy.headline} ${copy.headlineLabel}. ${copy.eyebrow}.`,
  }
}

export async function shareDomesticCard(
  facts: DomesticCardFacts,
  url: string,
): Promise<ShareDomesticCardResult> {
  const canvas = renderDomesticShareCard(facts)
  const blob = await canvasToBlob(canvas)
  // `toBlob` yields null only where the canvas could not be encoded at all.
  // Reporting that as a cancellation would tell the player they changed their
  // mind, which they did not.
  if (!blob) return 'unavailable'

  const { title, text } = domesticCardShareText(facts)
  return shareOrDownloadImage(blob, domesticCardFileName(facts), { title, text, url })
}
