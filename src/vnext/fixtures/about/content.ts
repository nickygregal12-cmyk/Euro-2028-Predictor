import { NON_AFFILIATION_SHORT, type AboutModel } from '../../models/about'

/**
 * THE PUBLIC POSITION, IN THE WORDS IT IS PUBLISHED IN.
 *
 * ============================ WHY THIS FILE EXISTS =======================
 *
 * ADR 0017 asks for one thing this product has never had: *"Publish an
 * unambiguous non-affiliation statement in the footer and terms."* Nothing did.
 * The landing footer carried three navigation links and no position at all, and
 * a product that renders club names, competition names and club colours needs
 * to say plainly what it is not.
 *
 * ============================ EVERY CLAIM IS ONE THE RECORD SUPPORTS =====
 *
 * The temptation on a page like this is to write a stronger sentence than the
 * project can stand behind, because a stronger sentence sounds safer. It is
 * not: an inaccurate claim is a worse position than a modest true one.
 *
 *   * **INDEPENDENCE IS THE PERMANENT CLAIM.** It is true today, it will still
 *     be true at any scale, and it is the one the trade mark argument actually
 *     rests on — ADR 0017 records that a non-affiliation statement "does not
 *     cure infringement, but it speaks directly to passing off".
 *
 *   * **"NON-COMMERCIAL" IS DELIBERATELY ABSENT.** ADR 0015 says in terms that
 *     *"revenue is intended, from sources other than the act of competing"* —
 *     a premium tier, sponsorship, white-label licensing. Writing
 *     "non-commercial" here would be a sentence that becomes false the first
 *     time a subscription exists, and a disclaimer that has been quietly
 *     falsified is worth less than none.
 *
 *   * **THE BRANDING PARAGRAPH IS TRUE IN BOTH BADGE MODES.** Official badges
 *     are a switchable capability that ships off (ADR 0017, and
 *     `src/domain/clubIdentity/officialBadge.ts`). This page must not need
 *     rewriting the day that changes, so it says what the product does in
 *     either case rather than asserting which case is current — two versions of
 *     a legal position that differ by build flag is two positions, and nobody
 *     would know which one a reader saw.
 *
 *   * **NO PROVIDER IS NAMED AS A LICENSOR.** The 8 August 2026 provider
 *     capability audit found every configured provider disclaims the rights to
 *     the images it serves. Saying a provider "grants" anything would assert a
 *     licence that does not exist.
 *
 * ============================ POLICY LINKS ARE REAL =======================
 *
 * Privacy and Terms are now public routes. They are linked here rather than
 * copied into this page: About owns the non-affiliation position, while each
 * policy owns its own current-service wording.
 */

/** The product's operational umbrella identity — ADR 0031 § 6, owner-decided. */
const PRODUCT = 'Predictor Hub'

export function aboutModel(options: { readonly supportEmail: string | null } = { supportEmail: null }): AboutModel {
  return {
    title: 'About & Disclaimer',
    summary: NON_AFFILIATION_SHORT,
    sections: [
      {
        id: 'about',
        heading: `About ${PRODUCT}`,
        paragraphs: [
          `${PRODUCT} is a football prediction game. You predict scores across a season, ` +
            'play games like Last Man Standing and the Predictor Championship, and compare ' +
            'yourself with friends in private leagues.',
          'It is a game of skill played for points and position. There is no wagering, no ' +
            'stake and no cash prize.',
        ],
      },
      {
        id: 'independence',
        heading: 'Unofficial and independent',
        paragraphs: [
          `${PRODUCT} is an unofficial football prediction game and is not affiliated with, ` +
            'endorsed by, sponsored by, or connected with any football league, governing body, ' +
            'competition or club.',
        ],
      },
      {
        id: 'branding',
        heading: 'Club and competition branding',
        paragraphs: [
          'Competition names, club names, trademarks, logos and other third-party intellectual ' +
            'property remain the property of their respective owners. Their use, where ' +
            `applicable, is for identification of the relevant football competition or club and ` +
            `does not imply association with or endorsement of ${PRODUCT}.`,
          `${PRODUCT} does not claim ownership of third-party football brands or trademarks.`,
          'Where official club or competition branding is not available or authorised for use, ' +
            `${PRODUCT} uses independently created club identity treatments based on club names, ` +
            'colours and simple kit-style graphics. Official branding assets are only displayed ' +
            'where an appropriate authorised source is configured; otherwise these treatments ' +
            'are what you see.',
        ],
      },
      {
        id: 'data',
        heading: 'Football data',
        paragraphs: [
          'Fixtures, results and related football data come from third-party data providers and ' +
            'from the competition organisers who run each game here. Data can be late, ' +
            'incomplete or corrected after the fact.',
          `Scores and standings inside ${PRODUCT} are settled by ${PRODUCT}'s own rules against ` +
            'the result it holds. They are not an official record of any football match or ' +
            'competition, and nothing here should be relied on as one.',
        ],
      },
      {
        id: 'game',
        heading: 'Predictions and results',
        paragraphs: [
          'Deadlines, locks, scoring and settlement are decided by the server, not by your ' +
            'device. A prediction counts when the server has accepted it before that ' +
            "matchweek's deadline.",
          'Where a result is corrected, affected predictions are re-settled under the same ' +
            'rules. Positions can move after a matchweek looks finished.',
        ],
      },
    ],
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      {
        label: 'Rights and branding enquiries',
        href: options.supportEmail ? `mailto:${options.supportEmail}` : null,
      },
    ],
  }
}

/** The deterministic model the workshop, the stories and the render tests use. */
export const workshopAboutModel: AboutModel = aboutModel({
  supportEmail: 'hello@example.com',
})

/** The same page with no contact route configured — the ordinary deployment. */
export const minimalAboutModel: AboutModel = aboutModel({ supportEmail: null })
