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

/** The eight surfaces Appendix E.3 orders, top of page to bottom. */
export type LandingSectionId =
  | 'hero'
  | 'proof'
  | 'how'
  | 'experience'
  | 'leagues'
  | 'games'
  | 'euro'
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
  'euro',
  'final',
] as const

/**
 * The in-page anchors the public navigation offers.
 *
 * Four of the eight sections are linkable. The hero is the top of the page, the
 * proof band is a strip rather than a destination, and the Euro and final-CTA
 * bands are the end of the scroll — a nav link to any of them would be an
 * anchor to somewhere the visitor is already heading.
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
 * E.7 requires both to be visible before Euro 2028 and neither to be presented
 * as automatically joined — so these carry no membership language at all, and
 * the section they render in says what it is: the football the weekly product
 * is built around.
 */
export const DOMESTIC_COMPETITIONS: readonly { code: string; name: string }[] = [
  { code: 'SP', name: 'Scottish Premiership' },
  { code: 'PL', name: 'Premier League' },
] as const

export type HowStep = { readonly number: string; readonly title: string; readonly body: string }

/**
 * E.3's third surface: three concise steps — predict, compete, follow.
 *
 * The step copy stays deliberately close to behaviour the repository actually
 * implements: blanks remain blank, an untouched matchweek is not banked, one
 * card feeds the overall table and every league, and provisional points are
 * labelled as provisional. A landing page that promises something the product
 * does not do is a defect that surfaces on a player's first matchweek.
 */
export const HOW_STEPS: readonly HowStep[] = [
  {
    number: '01',
    title: 'Pick your scores',
    body: 'Enter scorelines before each fixture locks. Work saves quietly as you go, blanks stay blank, and a matchweek you never touched is never banked for you.',
  },
  {
    number: '02',
    title: 'Compete your way',
    body: 'One Match Predictor card feeds the overall table and every private league you join — no duplicate cards and no hidden differences between them.',
  },
  {
    number: '03',
    title: 'Watch it unfold',
    body: 'Follow clearly labelled provisional points and rank movement, then the settled result, without a live estimate ever being mistaken for the official one.',
  },
] as const

export type ExperienceFeature = { readonly title: string; readonly body: string }

/** E.3's fourth surface: what the signed-in product actually does for you. */
export const EXPERIENCE_FEATURES: readonly ExperienceFeature[] = [
  {
    title: 'One clear next action',
    body: 'Deadlines, unfinished picks and live events decide what appears first — not a wall of widgets you have to read.',
  },
  {
    title: 'Live rank movement',
    body: 'Standings movement and settled points are the moments worth watching. Ordinary background updates stay visually quiet.',
  },
  {
    title: 'Confidence in every state',
    body: 'Ambient save status, authoritative lock times and clear recovery messages mean you always know whether your predictions count.',
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
export const GAMES: readonly GameSummary[] = [
  {
    mark: '3–1',
    name: 'Match Predictor',
    body: 'Predict every scoreline, score for the right result and more for the exact score, then climb the overall table and your private leagues.',
    meta: 'The weekly foundation',
  },
  {
    mark: '1',
    name: 'Last Man Standing',
    body: 'Pick one winner each round, keep track of the clubs you have already used, and outlast everyone else. Joined separately.',
    meta: 'Independent game',
  },
  {
    mark: 'Cup',
    name: 'Predictor Championship',
    body: 'Your Match Predictor points become football-shaped fixtures, tables and ties — without asking you to fill in a second card.',
    meta: 'Same weekly points',
  },
] as const

export type PreviewLeagueRow = {
  readonly position: number
  readonly initials: string
  readonly name: string
  readonly form: string
  readonly points: number
  readonly movement: string
  readonly isViewer?: boolean
}

/**
 * Illustrative preview data for the private-league table.
 *
 * INVENTED, AND IT MUST STAY OBVIOUS THAT IT IS. This is a picture of the
 * product on a marketing page, not a read model — no request produces it, no
 * player owns these rows, and the surfaces that render it are labelled as
 * previews and exposed to assistive technology as a single described image
 * rather than as a table of results. The moment a real standing can reach this
 * page it must come from the standings authority instead, because a second
 * source of ranked football numbers is precisely what ADR 0011 forbids.
 */
export const PREVIEW_LEAGUE_ROWS: readonly PreviewLeagueRow[] = [
  { position: 1, initials: 'CM', name: 'Callum M.', form: '14 · 16 · 18', points: 176, movement: '▲1' },
  { position: 2, initials: 'JM', name: 'Jamie M.', form: '12 · 15 · 16', points: 169, movement: '—' },
  { position: 3, initials: 'LA', name: 'Lauren A.', form: '13 · 12 · 19', points: 163, movement: '▼1' },
  { position: 4, initials: 'NG', name: 'You', form: '8 · 17 · 16', points: 158, movement: '▲3', isViewer: true },
  { position: 5, initials: 'RS', name: 'Ryan S.', form: '10 · 11 · 12', points: 149, movement: '—' },
] as const

/**
 * The three contextual slots E.7 allows the desktop Hub preview, and only
 * three: time-critical, live and social. The checklist is explicit about the
 * count, so the shape is declared here where a fourth would have to be added
 * deliberately.
 */
export const PREVIEW_CONTEXT_SLOTS: readonly {
  readonly kind: 'time-critical' | 'live' | 'social'
  readonly label: string
  readonly value: string
  readonly detail: string
}[] = [
  { kind: 'time-critical', label: 'Deadline', value: '1d 04h', detail: 'Premier League Matchweek 1' },
  { kind: 'live', label: 'Live', value: '+8 pts', detail: 'Provisional · up three places' },
  { kind: 'social', label: 'League movement', value: '4th', detail: 'Six points off the lead' },
] as const

/**
 * The description assistive technology is given for the desktop Hub preview.
 *
 * The preview is exposed as one image with this label rather than as a tree of
 * headings, rows and numbers. Read aloud, the mock-up would otherwise announce
 * invented competitions, ranks and points as though the visitor held them —
 * which is both untrue and, for someone who cannot see that it is a picture of
 * a screen, indistinguishable from their own data.
 */
export const HUB_PREVIEW_DESCRIPTION =
  'Preview of the signed-in Hub: permanent global navigation, one prioritised next action, ' +
  'row-led competition and league summaries with rank and movement, an ambient saved-predictions ' +
  'status, and a contextual rail showing a deadline, live provisional points and league movement.'

/** The same treatment for the phone preview, for the same reason. */
export const PHONE_PREVIEW_DESCRIPTION =
  'Preview of the signed-in Hub on a phone: a greeting, one prioritised next action with its ' +
  'deadline, row-led competition and league summaries with rank, and the five-item bottom ' +
  'navigation — Hub, Predict, Leagues, Games and More.'
