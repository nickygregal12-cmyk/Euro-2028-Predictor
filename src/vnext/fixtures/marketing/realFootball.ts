/**
 * REAL CLUBS FOR THE PUBLIC PREVIEW, AND NOTHING ELSE REAL.
 *
 * ============================ THE DEFECT THIS CLOSES =====================
 *
 * The landing page's device showed the "Caledonian Premiership" and eleven
 * clubs nobody has ever supported. Everything ELSE on the page is a true claim
 * about a real product — it names the Scottish Premiership and the Premier
 * League as the football it covers — so a visitor met a page that advertised
 * one thing and demonstrated another. The single question an acquisition page
 * has to answer is "is this for my football?", and an invented league answers
 * no.
 *
 * ============================ THE LINE, AND IT IS THE WHOLE DESIGN =======
 *
 * REAL IDENTITY, ILLUSTRATIVE GAME DATA. A visitor may see "Rangers v Celtic"
 * and "your prediction: 2–1", because the first is a fixture between two clubs
 * that exist and the second is plainly the invented player's guess. A visitor
 * may NOT see a final score, a live score, a minute, a league position, a form
 * run or a head-to-head record, because each of those is a claim about football
 * that actually happened — and a mock-up that makes one is wrong in a way no
 * disclaimer repairs.
 *
 * `illustrativeFootball` below is what enforces that: it takes a workshop model
 * and returns one with every real-world football fact removed. It is applied to
 * every phase, so a scenario that later grows a scoreline cannot leak one onto
 * the public page by being added somewhere this file does not look.
 *
 * ============================ WHY THIS IS NOT A CLUB REGISTRY ============
 *
 * `MARKETING_CLUB_SNAPSHOT` looks like a list of club identities and must not
 * become one. Two things stop it:
 *
 *   1. NOTHING HERE DECIDES WHAT A CLUB LOOKS LIKE. The code and the colour
 *      string are handed to `resolveClubIdentity` — the application's own
 *      identity authority, the same function the production adapters call — and
 *      the monogram, hex colours, kit pattern and contrast treatment all come
 *      back from it. Change Celtic's overlay in `clubIdentityTokens.ts` and
 *      this page changes with it.
 *
 *   2. THE SNAPSHOT IS PROVED AGAINST THE CATALOGUE. Every row below is a copy
 *      of a row in `predictor_internal.club_identity_reference`, and
 *      `tests/features/landing/marketingClubIdentity.test.ts` parses the
 *      migration that seeds that table and refuses any disagreement. A page
 *      cannot be signed out and offline AND read the table, so the copy is
 *      unavoidable; a copy with an alarm on it is not a second authority.
 *
 * The page is public, anonymous and offline: no request, no session, no clock.
 * That is a hard requirement rather than a convenience — a visual baseline
 * needs a deterministic picture, and a signed-out visitor has no data to read.
 */

import { resolveClubIdentity } from '../../../domain/clubIdentity/clubIdentityTokens'
import { clubDisplayName } from '../../../domain/clubIdentity/clubName'
import type { HomeModel } from '../../models/home'
import type { MatchesModel } from '../../models/matches'
import type { Match, MatchSide, Team, TeamKitPattern } from '../../models/football'
import type { MatchListItem } from '../../models/matches'
import { workshopTeams } from '../teams/teams'

/**
 * The rows this page needs, copied from contract 136's seed.
 *
 * SCOTTISH PREMIERSHIP, because the preview shows ONE competition and the
 * product's own landing copy names that one first. The Premier League clubs in
 * the same reference are not here because they are not in this picture — the
 * snapshot carries what the page draws and nothing else.
 */
export const MARKETING_CLUB_SNAPSHOT = [
  { normalisedName: 'celtic', name: 'Celtic', shortCode: 'CEL', clubColours: 'Green / White' },
  { normalisedName: 'rangers', name: 'Rangers', shortCode: 'RAN', clubColours: 'Royal Blue / White' },
  { normalisedName: 'aberdeen', name: 'Aberdeen', shortCode: 'ABD', clubColours: 'Red / White' },
  {
    normalisedName: 'heartofmidlothian',
    name: 'Heart of Midlothian',
    shortCode: 'HEA',
    clubColours: 'Maroon / White',
  },
  { normalisedName: 'hibernian', name: 'Hibernian', shortCode: 'HIB', clubColours: 'Green / White' },
  { normalisedName: 'dundee', name: 'Dundee', shortCode: 'DEE', clubColours: 'Navy / White' },
  {
    normalisedName: 'dundeeunited',
    name: 'Dundee United',
    shortCode: 'DUU',
    clubColours: 'Orange / Black',
  },
  { normalisedName: 'kilmarnock', name: 'Kilmarnock', shortCode: 'KIL', clubColours: 'Blue / White' },
  { normalisedName: 'motherwell', name: 'Motherwell', shortCode: 'MOT', clubColours: 'Amber / Claret' },
  { normalisedName: 'stmirren', name: 'St Mirren', shortCode: 'STM', clubColours: 'Black / White' },
  { normalisedName: 'rosscounty', name: 'Ross County', shortCode: 'ROS', clubColours: 'Navy / White' },
  { normalisedName: 'stjohnstone', name: 'St Johnstone', shortCode: 'STJ', clubColours: 'Royal Blue / White' },
] as const

type MarketingClub = (typeof MARKETING_CLUB_SNAPSHOT)[number]

const KIT_PATTERN: Record<string, TeamKitPattern> = {
  solid: 'solid',
  stripes: 'stripes',
  hoops: 'hoops',
  halves: 'halves',
  sash: 'sash',
}

/**
 * One club, as the product's own adapters build one.
 *
 * The shape is `buildHomeModel`'s `teamOf`, deliberately: a club on the public
 * page should be assembled the way a club in the product is, including the rule
 * that `accent` is one of the club's OWN colours rather than a brighter shade
 * invented for it. A preview that resolved identity differently from the
 * product would be a preview of something else.
 */
function marketingTeam(club: MarketingClub): Team {
  const tokens = resolveClubIdentity({
    externalId: club.normalisedName,
    name: club.name,
    tla: club.shortCode,
    clubColors: club.clubColours,
  })
  const primary = tokens.primary
  const secondary = tokens.secondary ?? primary

  return {
    id: club.normalisedName,
    name: club.name,
    shortName: clubDisplayName(club.name),
    abbreviation: tokens.monogram,
    colours: {
      primary,
      secondary,
      accent: secondary,
      onPrimary: tokens.onPrimary ?? 'light',
    },
    kitPattern: KIT_PATTERN[tokens.pattern ?? 'solid'] ?? 'solid',
    // ADR 0017: the product ships badge-free, so the preview does too.
    officialBadge: null,
  }
}

/**
 * WHICH INVENTED CLUB BECOMES WHICH REAL ONE.
 *
 * Stated rather than derived from array order, so a club added to the workshop
 * cannot silently shift every fixture in the preview onto a different pairing.
 * A workshop club with no entry keeps its invented identity, which is the
 * conservative answer: an unmapped club renders as it always did rather than
 * borrowing a real name at random.
 */
const CLUB_FOR_WORKSHOP_TEAM: Record<string, MarketingClub['normalisedName']> = {
  [workshopTeams.glenmore.id]: 'celtic',
  [workshopTeams.strathkelvin.id]: 'rangers',
  [workshopTeams.carrickvale.id]: 'heartofmidlothian',
  [workshopTeams.balmorral.id]: 'motherwell',
  [workshopTeams.invercaledonian.id]: 'aberdeen',
  [workshopTeams.porthaven.id]: 'hibernian',
  [workshopTeams.eastcraig.id]: 'dundee',
  [workshopTeams.dunveggie.id]: 'dundeeunited',
  [workshopTeams.kirktonmuir.id]: 'kilmarnock',
  [workshopTeams.arbrennan.id]: 'stmirren',
  [workshopTeams.braemarloch.id]: 'stjohnstone',
}

const BY_NORMALISED = new Map(
  MARKETING_CLUB_SNAPSHOT.map((club) => [club.normalisedName, club] as const),
)

const TEAM_CACHE = new Map<string, Team>()

/** The real club a workshop club stands in for, or the workshop club itself. */
export function realTeam(team: Team): Team {
  const cached = TEAM_CACHE.get(team.id)
  if (cached) return cached

  const key = CLUB_FOR_WORKSHOP_TEAM[team.id]
  const club = key === undefined ? undefined : BY_NORMALISED.get(key)
  const resolved = club === undefined ? team : marketingTeam(club)
  TEAM_CACHE.set(team.id, resolved)
  return resolved
}


/* ==========================================================================
   THE SCRUB — every claim about football that actually happened
   ========================================================================== */

/**
 * The invented names, longest first, and what each becomes.
 *
 * A NAME REACHES THE SCREEN AS PROSE AS WELL AS AS A `Team`. Home's primary
 * action says "Glenmore Athletic v Strathkelvin United locks at kick-off" and
 * an activity line names a fixture in a sentence, so replacing the structured
 * clubs alone would leave the device showing Celtic's colours above a sentence
 * about Glenmore. Longest first, so "Glenmore Athletic" is replaced before
 * "Glenmore" and never leaves "Celtic Athletic" behind.
 */
const NAME_REPLACEMENTS: readonly (readonly [string, string])[] = Object.entries(
  CLUB_FOR_WORKSHOP_TEAM,
)
  .flatMap(([workshopId, normalised]) => {
    const workshop = Object.values(workshopTeams).find((team) => team.id === workshopId)
    const club = BY_NORMALISED.get(normalised)
    if (!workshop || !club) return []
    const real = marketingTeam(club)
    return [
      [workshop.name, real.name] as const,
      [workshop.shortName, real.shortName] as const,
    ]
  })
  .sort((a, b) => b[0].length - a[0].length)

/**
 * The competition too, because the invented one is named in prose exactly as
 * the invented clubs are — a Leagues context line, a Games heading, a shell
 * tempo label. A device that said "Scottish Premiership" in the chrome and
 * "Caledonian Premiership" in the page beneath it would be the one defect a
 * preview makes especially easy: a reader has no way to tell which of the two
 * is the product's real answer.
 */
const MARKETING_COMPETITION_NAME = 'Scottish Premiership'
const INVENTED_COMPETITION_NAME = 'Caledonian Premiership'

/** The same sentence, about football that exists. */
export function realFootballNames(text: string): string {
  let out = text.split(INVENTED_COMPETITION_NAME).join(MARKETING_COMPETITION_NAME)
  for (const [invented, real] of NAME_REPLACEMENTS) {
    out = out.split(invented).join(real)
  }
  return out
}

/**
 * A SENTENCE THAT STATES A FOOTBALL OUTCOME.
 *
 * ============================ WHY A PATTERN AND NOT A LIST ===============
 *
 * The structured scrub below removes scores, clocks, form and positions from
 * every model field that HAS one. Free text has none of that structure:
 * "Glenmore lead 2–1 on 63 minutes" is a headline, and no amount of nulling
 * fields removes it. A curated list of banned sentences would be a list to keep
 * in step with fixtures nobody edits together.
 *
 * So the rule is on the SHAPE of a claim — a scoreline, or a minute — and any
 * line carrying one is dropped rather than rewritten. The dash is an EN DASH
 * or a spaced hyphen, never a bare one, because `2027-08-21` is an instant and
 * a rule that could not tell the two apart would drop every fixture's kick-off. Dropping is the safe
 * direction: a preview one line shorter is a preview, and a preview with an
 * invented live score against a real club is the defect.
 *
 * A PLAYER'S OWN PREDICTION IS NOT CAUGHT BY THIS, because it is never free
 * text: it lives in `prediction.score` and in a `MatchPredictionBadge`, both of
 * which survive untouched. "Your prediction: 2–1" is the product working.
 */
const FOOTBALL_CLAIM =
  /(?<!\d)\d{1,2}\s*[–—−]\s*\d{1,2}(?!\d)|(?<!\d)\d{1,2}\s+-\s+\d{1,2}(?!\d)|\b\d{1,3}\s*(?:minutes|mins?)\b|\b\d{1,3}'/u

export function statesAFootballOutcome(text: string): boolean {
  return FOOTBALL_CLAIM.test(text)
}

/** A side, with its real club and none of its invented record. */
function illustrativeSide(side: MatchSide): MatchSide {
  return { ...side, team: realTeam(side.team), form: [], leaguePosition: null }
}

/**
 * One fixture in full: two real clubs, a kick-off, and the reader's prediction.
 *
 * WHAT SURVIVES. The clubs, the date and time, the deadline, and the invented
 * player's predicted scoreline — a guess is self-evidently a guess, and it is
 * the single most important thing the preview has to show, because predicting
 * is the product.
 *
 * WHAT DOES NOT. The score, the clock, the venue, the broadcaster, the
 * head-to-head record and the outcome of the prediction. A settled prediction
 * marked "exact, 6 points" implies a final score even where none is printed, so
 * the outcome goes with the rest and the prediction is shown as one that has
 * been MADE rather than one that has been marked.
 */
function illustrativeMatch(match: Match): Match {
  return {
    ...match,
    status: match.status === 'postponed' ? 'postponed' : 'upcoming',
    clock: null,
    score: null,
    venue: null,
    broadcast: null,
    headToHead: null,
    // Other players' guesses are invented people's invented guesses, which is
    // allowed — but a sample size printed against a real fixture reads as a
    // claim about how many people use this product, and that is not a claim a
    // marketing page should make inside a picture.
    consensus: null,
    home: illustrativeSide(match.home),
    away: illustrativeSide(match.away),
    prediction:
      match.prediction === null
        ? null
        : {
            ...match.prediction,
            status: match.prediction.status === 'notPredicted' ? 'notPredicted' : 'submitted',
            outcome: null,
            points: null,
            pointsAreProvisional: false,
          },
  }
}

/**
 * Home, made illustrative.
 *
 * `liveMatches` and `recentResults` are EMPTIED rather than scrubbed. A live
 * match with no score and no minute is not a live match, and a settled result
 * with no result is not one either — both zones exist to show a number this
 * page may not print, so the honest answer is that this picture does not have
 * them rather than a hollow version of them.
 *
 * The player's own standing — points, rank, movement, what is outstanding — is
 * untouched. It is a fact about an invented person in an invented private
 * league, which is exactly what a preview is for.
 */
export function illustrativeHome(model: HomeModel): HomeModel {
  return {
    ...model,
    competition: { ...model.competition, name: MARKETING_COMPETITION_NAME },
    primaryAction: {
      ...model.primaryAction,
      title: realFootballNames(model.primaryAction.title),
      description: realFootballNames(model.primaryAction.description),
    },
    liveMatches: [],
    recentResults: [],
    upcomingMatches: model.upcomingMatches.map(illustrativeMatch),
    activity: model.activity
      .map((item) => ({
        ...item,
        headline: realFootballNames(item.headline),
        detail: item.detail === null ? null : realFootballNames(item.detail),
      }))
      .filter(
        (item) =>
          !statesAFootballOutcome(item.headline) &&
          !(item.detail !== null && statesAFootballOutcome(item.detail)),
      ),
  }
}

/**
 * One fixture-list row.
 *
 * `state` collapses to `scheduled` for the same reason `status` does above:
 * `live`, `awaitingResult` and `finished` each REQUIRE an observation or a
 * result, so there is no way to render one of them without asserting football
 * that did not happen. A postponement carries no score and stays.
 *
 * The prediction badge keeps the player's scoreline and loses its marking: a
 * `settled` badge names an outcome the platform decided, and this page has no
 * platform behind it.
 */
function illustrativeRow(row: MatchListItem): MatchListItem {
  const badge = row.prediction
  return {
    ...row,
    competition: { ...row.competition, name: MARKETING_COMPETITION_NAME },
    home: realTeam(row.home),
    away: realTeam(row.away),
    state:
      row.state.kind === 'postponed'
        ? { ...row.state, note: row.state.note === null ? null : realFootballNames(row.state.note) }
        : { kind: 'scheduled', kickoff: row.state.kickoff, rescheduled: false },
    contextLabel: row.contextLabel === null ? null : realFootballNames(row.contextLabel),
    prediction:
      badge === null || badge.kind === 'needed'
        ? badge
        : { kind: 'entered', score: badge.score },
    // REBUILT, NOT RENAMED. The old sentence was "Glenmore Athletic 2, Porthaven
    // City 1, full time" — a result read aloud. Somebody who cannot see the
    // device must be told the same thing a sighted visitor is shown, which is
    // now a fixture and a kick-off time.
    accessibleSummary: [
      `${realTeam(row.home).name} versus ${realTeam(row.away).name}`,
      row.kickoffLabel === null ? null : `kicks off ${row.kickoffLabel}`,
    ]
      .filter((part): part is string => part !== null)
      .join(', '),
  }
}

/**
 * Matches, made illustrative.
 *
 * The counts are rebuilt from the rows rather than carried over: every row is
 * now scheduled, so a `Live 3` tab over a list with nothing live would be the
 * page contradicting itself in the one place a visitor can check.
 */
export function illustrativeMatches(model: MatchesModel): MatchesModel {
  const days = model.days.map((day) => ({
    ...day,
    matches: day.matches.map(illustrativeRow),
  }))
  const all = days.reduce((total, day) => total + day.matches.length, 0)

  return {
    ...model,
    competition: { ...model.competition, name: MARKETING_COMPETITION_NAME },
    days,
    counts: { ...model.counts, all, live: 0, upcoming: all, finished: 0 },
  }
}
