/**
 * Content model for the public landing page (modernisation plan Appendix E).
 *
 * The copy lives here rather than inline in the page for one reason: Appendix
 * E.3 fixes the ORDER of the landing page's surfaces, and E.7 fixes properties
 * of what they may contain. An order written only as JSX nesting can be
 * reshuffled by anyone tidying a component, and nothing would notice. Declared
 * as data, `tests/features/landing/landingContent.test.ts` can hold both the
 * order and the E.7 checklist against the authority.
 *
 * Nothing here is a rule. This is presentation copy and illustrative preview
 * data; it cannot change a scoring, lock, membership, settlement, progression
 * or reveal rule, and it does not describe one authoritatively — where copy
 * refers to product behaviour it paraphrases the ADRs rather than restating
 * them as a specification.
 */

/**
 * The surfaces Appendix E.3 orders, top of page to bottom.
 *
 * SEVEN, NOT THE EIGHT THE APPENDIX WROTE. Revision 1.5 placed a Euro 2028
 * acquisition band after the domestic competitions; ADR 0026 superseded that
 * positioning and `EURO-003` requires Euro absent from the weekly platform
 * entirely — landing content included — until an owner-approved publication
 * state exists. The band is gone from here, from the prototype, from its
 * contract test and from the page, which is the atomic change the plan's own
 * reconciliation note asked for rather than four files disagreeing.
 */
export type LandingSectionId =
  | 'hero'
  | 'proof'
  | 'how'
  | 'experience'
  | 'leagues'
  | 'games'
  | 'final'

/**
 * Appendix E.3's content order, verbatim.
 *
 * The page renders its sections from this array's order, so the two cannot
 * drift: reordering the page means reordering the authority's list, which is a
 * visible decision rather than a silent one.
 */
export const LANDING_SECTION_ORDER: readonly LandingSectionId[] = [
  'hero',
  'proof',
  'how',
  'experience',
  'leagues',
  'games',
  'final',
] as const

/**
 * The in-page anchors the public navigation offers.
 *
 * Four of the seven sections are linkable. The hero is the top of the page, the
 * proof band is a strip rather than a destination, and the final-CTA band is the
 * end of the scroll — a nav link to it would be an anchor to somewhere the
 * visitor is already heading.
 */
export const LANDING_NAV: readonly { id: LandingSectionId; label: string }[] = [
  { id: 'how', label: 'How it works' },
  { id: 'experience', label: 'The experience' },
  { id: 'leagues', label: 'Private leagues' },
  { id: 'games', label: 'Games' },
] as const

/**
 * The two domestic competitions, in the order Appendix E.3 names them.
 *
 * E.7 required both to be visible before the Euro band and neither to be
 * presented as automatically joined. The band is gone under `EURO-003`, so only
 * the second half of that rule still has anything to bite on — these carry no
 * membership language at all, and the section they render in says what it is:
 * the football the weekly product is built around.
 */
export const DOMESTIC_COMPETITIONS: readonly { code: string; name: string }[] = [
  { code: 'SP', name: 'Scottish Premiership' },
  { code: 'PL', name: 'Premier League' },
] as const

export type HowStep = { readonly number: string; readonly title: string; readonly body: string }

/**
 * E.3's third surface: three steps somebody can understand in one read.
 *
 * ============================ WHO THIS IS WRITTEN FOR ====================
 *
 * A visitor who has never seen this repository. The step copy used to be
 * accurate in the way a specification is accurate — "blanks stay blank", "a
 * matchweek you never touched is never banked", "one card feeds the overall
 * table and every private league you join, with no duplicate cards and no
 * hidden differences between them". Every clause of that is TRUE, and every
 * clause of it exists because somebody had to settle a product rule. None of it
 * makes a stranger want to predict some football.
 *
 * Those truths did not go anywhere: they are enforced by the application and by
 * its tests, which is where a rule belongs. What changed is that they stopped
 * being the sales pitch.
 *
 * The one claim that stays, because it is the one a visitor can be MISLED by
 * rather than merely uninformed about: nothing joins you to anything. E.6
 * requires that, `landingContent.test.ts` holds it, and it is said in the words
 * a person would use.
 */
export const HOW_STEPS: readonly HowStep[] = [
  {
    number: '01',
    title: 'Pick your scores',
    body: 'Put a scoreline on every match before it kicks off. A correct result scores, and calling the exact score scores more.',
  },
  {
    number: '02',
    title: 'Compete with your friends',
    body: 'Start a private league, invite the group chat, and climb the overall table at the same time. Each game is its own competition, so you play the ones you fancy.',
  },
  {
    number: '03',
    title: 'Watch it unfold',
    body: 'Saturday afternoon turns into your points, your position, and the rival you are one result away from catching.',
  },
] as const

export type ExperienceFeature = { readonly title: string; readonly body: string }

/**
 * E.3's fourth surface: what it FEELS like to have an account.
 *
 * Written as experiences rather than as properties of the implementation. The
 * previous version described "ambient save status", "authoritative lock times"
 * and "ordinary background updates staying visually quiet" — three sentences
 * about how the software behaves, aimed at somebody who already cares that it
 * does.
 */
export const EXPERIENCE_FEATURES: readonly ExperienceFeature[] = [
  {
    title: 'The one thing that needs you',
    body: 'Open it and the deadline you were about to miss is the first thing you see, not the twentieth.',
  },
  {
    title: 'Your table, moving',
    body: 'Watch your position climb — or slip — as the results land, with the gap to the player above you right beside it.',
  },
  {
    title: 'Who you are chasing',
    body: 'See exactly who you need to catch this week, and who is closing in on you.',
  },
] as const

export type GameSummary = {
  readonly mark: string
  readonly name: string
  readonly body: string
  readonly meta: string
}

/**
 * E.3's sixth surface: Match Predictor first, the rest disclosed after it.
 *
 * E.6 and ADR 0011 are the reason the `meta` column reads the way it does.
 * Each game is joined separately and scored separately, so "Independent game"
 * is a membership fact rather than marketing texture, and nothing here may
 * suggest that joining one enrols you in another.
 */
/**
 * The three weekly games, given equal weight.
 *
 * WHY THE ORDER AND THE COPY CHANGED. This list used to lead with "the weekly
 * foundation" and describe the other two as optional extras to "discover
 * later". That is not what the product is: ADR 0012, 0013 and 0014 make Match
 * Predictor, Last Man Standing and the Predictor Championship three separate
 * games, each joined on its own, each with its own rules and its own standings.
 * A landing page that ranks them teaches a visitor to expect one product with
 * two add-ons, and then the Hub shows them three games and disagrees with the
 * page that sold it.
 *
 * So each entry now says the same KIND of thing — what you do, how often, and
 * what you are chasing — and none of them is described relative to another. The
 * one genuine relationship that remains is the Championship's, which really is
 * decided by Match Predictor points; that is a fact about the format and is
 * stated as one rather than as a hierarchy.
 */
export const GAMES: readonly GameSummary[] = [
  {
    mark: '3–1',
    name: 'Match Predictor',
    body: 'Call every scoreline before the matchweek kicks off. Right result scores, exact score scores more, and one table runs all season.',
    meta: 'Every matchweek',
  },
  {
    mark: '1',
    name: 'Last Man Standing',
    body: 'Pick one club to win each round and survive to the next. You can never lean on the same club twice, so the easy ones run out.',
    meta: 'Every round',
  },
  {
    mark: 'Cup',
    name: 'Predictor Championship',
    body: 'Your weekly predictions become a head-to-head tie against one other player. Group tables, and then the knockouts.',
    meta: 'Every matchweek',
  },
] as const

/**
 * WHERE THE HAND-BUILT PREVIEW DATA WENT.
 *
 * Three constants stood here — `PreviewLeagueRow`, `PREVIEW_LEAGUE_ROWS` and
 * `PREVIEW_CONTEXT_SLOTS` — and together they were a small, second
 * implementation of the product: a league table with its own row shape, and the
 * three contextual slots Appendix E.7 allowed the desktop Hub preview.
 *
 * They are gone because the page no longer DRAWS the product. It mounts it. The
 * league table a visitor sees is `VNextLeagues` rendering a real `LeaguesModel`,
 * and the shell around it is the real shell — so there is no second row shape to
 * keep in step and no slot count for this file to declare. E.7's three-slot rule
 * described a hand-built device that no longer exists; the surface it was
 * bounding is now the product's own, and the product's own contracts bound it.
 *
 * The invented-data rule those constants carried has NOT gone anywhere. It moved
 * to `src/vnext/fixtures/marketing/story.ts`, which states it at length: no
 * request produces these rows, no player owns them, nothing computes them, and
 * every device is exposed to assistive technology as one described picture
 * rather than as a table of results. The moment a real standing could reach this
 * page it would have to come from the standings authority, because a second
 * source of ranked football numbers is precisely what ADR 0011 forbids.
 */

/**
 * THE LEGAL ROW IN THE FOOTER.
 *
 * These are real public routes now, so the landing page publishes all three
 * destinations rather than suppressing policy names behind `null`. Keeping the
 * addresses in this one array means the footer cannot quietly drift away from
 * the documents it says exist.
 */
export const LEGAL_LINKS: readonly {
  readonly label: string
  readonly to: string
}[] = [
  { label: 'About & Disclaimer', to: '/about' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
] as const

/**
 * WHERE THE PREVIEW DESCRIPTIONS WENT.
 *
 * Two constants stood here — `HUB_PREVIEW_DESCRIPTION` and
 * `PHONE_PREVIEW_DESCRIPTION` — each the single accessible name for a still
 * device. The previews are now a scripted sequence, and one fixed label across
 * four different pictures is a description that is wrong three quarters of the
 * time: it would say "seven of ten predicted" while the device showed a
 * settled matchweek.
 *
 * So the description travels WITH the frame, in `landingPreviewScript.ts`, and
 * `landingContent.test.ts` holds every frame to the same rule those two
 * constants were held to. The rule itself has not moved: each preview is
 * exposed as ONE image with a written description rather than as a tree of
 * headings, rows and numbers, because read aloud the mock-up would otherwise
 * announce invented competitions, ranks and points as though the visitor held
 * them — untrue, and for somebody who cannot see that it is a picture of a
 * screen, indistinguishable from their own data.
 */