import { clubBadgePolicy } from '../../../app/clubBadgePolicy'
import { resolveOfficialBadge } from '../../../domain/clubIdentity/officialBadge'
import type { ClubIdentityTokens } from '../../../domain/clubIdentity/clubIdentityTypes'
import { postponedScheduleNote } from '../../../shared/fixtures/scheduleNote'
import type {
  SeasonFixtureClub,
  SeasonListFixture,
} from '../../../services/supabase/seasonFixtureListModel'
import type { SeasonClubForm } from '../../../services/supabase/seasonClubFormModel'
import type { SeasonConsensusFixture } from '../../../services/supabase/seasonConsensusModel'
import type { ProjectionFixture } from '../../../services/supabase/seasonMatchweekProjectionModel'
import type {
  SeasonLeagueMovementRow,
  SeasonLeagueMovement,
} from '../../../services/supabase/seasonLeagueMovementModel'
import type {
  SeasonLeagueStandingsRow,
  SeasonLeagueStandingsYou,
} from '../../../services/supabase/seasonLeagueStandingsModel'
import type { SeasonProfileAccuracy } from '../../../services/supabase/seasonPlayerProfileModel'
import type {
  ConsensusGroup,
  FormResult,
  Match,
  MatchConsensus,
  MatchSide,
  MatchStatus,
  Scoreline,
  Team,
  TeamKitPattern,
  UserPrediction,
} from '../../models/football'
import type {
  CompetitionContext,
  HomeModel,
  HomeUser,
  PlayerRef,
  PredictionAccuracy,
  PrimaryAction,
  PrimaryActionType,
  PrimaryActionUrgency,
  PrivateLeague,
  PrivateLeagueStanding,
  RankMovement,
  MatchweekRecap,
  RecentPerformance,
  Rival,
  SinceLastVisit,
} from '../../models/home'
import { selectSinceLastVisit } from '../../../features/hub/sinceLastVisitModel'
import { presentMatchweekRecap } from '../../../features/hub/matchweekRecapModel'
import type { HomeSource, HomeSourceLeague } from './homeSource'

/**
 * REAL APPLICATION STATE → `HomeModel`.
 *
 * This is the whole of vNext Home's contact with the running product, and it is
 * a PURE FUNCTION: source in, model out, no network, no storage, no clock, no
 * React. That is what makes the integration testable — every case in
 * `tests/vnext/homeIntegration.test.ts` is a call to this function — and it is
 * also what keeps the boundary honest, because a mapper that cannot reach a
 * service cannot quietly acquire one more fact.
 *
 * WHAT IT IS NOT ALLOWED TO DO, and each of these has a real temptation behind
 * it:
 *
 *   IT DOES NOT DECIDE WHETHER A MATCH IS LIVE. Live is `live.kind === 'in_play'`
 *   — contract 135's neutral kind, normalised on the server from a provider's
 *   own token. It is never `kickoff < now < kickoff + 2h`. The application also
 *   supplies `full_time`, `postponed` and its own settled `status`, so there is
 *   nothing left for presentation to guess at.
 *
 *   IT DOES NOT DECIDE WHETHER A PREDICTION MAY BE CHANGED. That is
 *   `cardPresentation.editable`, which is `presentCard`'s answer over the
 *   server's own resolved lock. This file never compares `lockAt` to anything to
 *   reach a permission.
 *
 *   IT DOES NOT RANK ANYBODY. Season rank and field size come from contract
 *   151; league rank comes from contract 128, recomputed inside the league by
 *   the server because a private league is its own table. Nothing here sorts
 *   players by points — tie-breaks are the server's and would be lost.
 *
 *   IT DOES NOT SCORE ANYTHING. A fixture's points and, critically, whether
 *   those points rest on an OFFICIAL result or a PROVIDER opinion are both
 *   contract 175's `points` and `basis`. There is no arithmetic over scorelines
 *   here at all.
 *
 *   IT DOES NOT REVEAL A PREDICTION. Consensus arrives only when contract 130
 *   chose to answer, which it refuses before the matchweek's own lock. A null
 *   consensus is rendered as no consensus, never as an empty one.
 *
 * THE ARITHMETIC IT DOES DO, and why it is not a rule. Two numbers already on
 * the same screen may be subtracted: a gap to the leader, a points difference
 * against a rival, and the three-way split of an accuracy count whose parts
 * share one denominator. This is the precedent `rivalWatchModel` sets in terms —
 * "the same thing the player would do by looking" — and no point value, rank or
 * lock is produced by any of it.
 */

/* ------------------------------------------------------------------ *
 * Football identity
 * ------------------------------------------------------------------ */

/**
 * vNext expresses four shirt treatments; the domain expresses five.
 *
 * A `sash` is now drawn as one. It used to become `solid` — honest, and a lost
 * detail — because `TeamCrest` knew four patterns and the domain had five; the
 * crest learned the fifth for Stage 14, so the map carries it across rather
 * than flattening it. Anything the domain adds beyond these still falls to
 * `solid`, because drawing an unknown pattern as a known one would be
 * presentation inventing a kit.
 */
const KIT_PATTERN: Record<string, TeamKitPattern> = {
  solid: 'solid',
  stripes: 'stripes',
  hoops: 'hoops',
  halves: 'halves',
  sash: 'sash',
}

/**
 * Domain club identity → vNext `Team`.
 *
 * THE NAME IS THE ID, and that is deliberate rather than lazy. Contract 139's
 * fixture entry carries a club's name and its identity tokens but no team id, and
 * the repository already joins these reads by name on the stated grounds that
 * both sides come from `public.teams.name` — the same column of the same rows.
 * Minting a synthetic id would be a second identity for the same club.
 *
 * `accent` IS ONE OF THE CLUB'S OWN COLOURS, never a computed brighter shade.
 * The domain supplies a primary and sometimes a secondary; a club with only one
 * gets its primary in both roles. Deriving a highlight would be presentation
 * inventing a colour that no club plays in, and `onPrimary` exists precisely
 * because guessing at contrast is how a legibility failure ships.
 */
function teamOf(club: SeasonFixtureClub, competitionId: string | null): Team {
  const tokens: ClubIdentityTokens = club.tokens
  const primary = tokens.primary
  const secondary = tokens.secondary ?? primary

  return {
    id: club.name,
    name: club.name,
    // The application holds one name per club. There is no short form to prefer,
    // so the full name is used rather than a truncation invented here — Home's
    // dense rows wrap rather than clip, which is what makes that safe.
    shortName: club.name,
    abbreviation: tokens.monogram,
    colours: {
      primary,
      secondary,
      accent: secondary,
      // The domain's own default for a club with no overlay entry, stated in
      // `clubIdentityTokens.ts`: solid, provider colour, light monogram.
      onPrimary: tokens.onPrimary ?? 'light',
    },
    kitPattern: KIT_PATTERN[tokens.pattern ?? 'solid'] ?? 'solid',
    /**
     * THE POLICY'S ANSWER, NOT THIS FILE'S.
     *
     * `resolveOfficialBadge` is the one place badges-on, provider-approved,
     * competition-allowed and URL-usable are decided, and it is given a
     * candidate of `null` here because NOTHING IN THIS REPOSITORY DECODES A
     * PROVIDER BADGE FIELD — by decision rather than omission. The 8 August
     * 2026 provider capability audit found that all four configured providers
     * serve an image and disclaim the rights to it, and ADR 0017 decided the
     * product launches badge-free on that evidence.
     *
     * The seam is here so the day that changes, a provider adapter carries a
     * `ClubBadgeCandidate` into this call and no page changes at all.
     */
    officialBadge: resolveOfficialBadge(null, {
      policy: clubBadgePolicy(),
      competitionId,
    }),
  }
}

const FORM_RESULT: Record<string, FormResult> = {
  W: 'win',
  D: 'draw',
  L: 'loss',
}

/**
 * One side of a fixture.
 *
 * `form` IS THE SERVER'S LETTERS, mapped one for one. Contract 141 derives W/D/L
 * from settled fixtures only and this does not re-read a goal difference to
 * second-guess who won. An unread form table leaves the run empty, which the
 * card draws as no form rather than as a blank run of five.
 *
 * `leaguePosition` IS NULL THROUGHOUT. Home reads no competition standings table,
 * so it does not know where a club sits, and every surface that shows a position
 * already treats null as "do not print one".
 */
function sideOf(
  club: SeasonFixtureClub,
  form: SeasonClubForm | undefined,
  competitionId: string | null,
): MatchSide {
  return {
    team: teamOf(club, competitionId),
    form: (form?.form ?? [])
      .map((letter) => FORM_RESULT[letter])
      .filter((result): result is FormResult => result !== undefined),
    leaguePosition: null,
  }
}

/* ------------------------------------------------------------------ *
 * Match state
 * ------------------------------------------------------------------ */

/**
 * WHAT STATE THIS FIXTURE IS IN, entirely from what the application said.
 *
 * The precedence is the application's own, and it puts the platform above the
 * provider everywhere it has spoken:
 *
 *   1. `status` — the platform's administrative and settled truth. A postponed
 *      fixture is postponed however cheerfully a provider is reporting it, and a
 *      `played` fixture has a result the platform banked.
 *   2. `live.kind` — contract 135's neutral kind, for a fixture the platform has
 *      not settled. `in_play` is the only thing that makes a match live.
 *   3. Otherwise upcoming.
 *
 * THE ONE PLACE THIS LOSES INFORMATION, stated plainly because it is a real
 * limitation rather than an oversight. A fixture a provider calls `final` while
 * the platform has not settled it becomes `fullTime` carrying the provider's
 * scoreline, because `Match` has a single `score` field and no marker for a
 * provisional one. The football is right — the match did end — but Home cannot
 * show that the number is not yet the banked result. The POINTS beside it are
 * still labelled correctly, because those carry contract 175's `basis`. Giving
 * `Match.score` a provisional marker is a model change worth making when a
 * surface needs the distinction; Home does not currently draw one.
 */
function statusOf(fixture: SeasonListFixture): MatchStatus {
  if (fixture.status === 'postponed') return 'postponed'
  if (fixture.status === 'played') return 'fullTime'

  switch (fixture.live?.kind) {
    case 'in_play':
      return 'live'
    case 'final':
      return 'fullTime'
    default:
      // CONTRACT 209 REMOVED A `live.kind === 'postponed'` CASE FROM HERE, and
      // the removal is the point rather than a tidy-up. Home used to promote a
      // provider's postponement on its own while `buildMatchesModel` refused
      // to — so the same fixture could read "P–P" on Home and "15:00" in
      // Matches, from one payload, with nothing saying which was right.
      //
      // The provider's word now reaches `season_fixtures.status` through the
      // ingestion boundary, where it is recorded and reversible, so the first
      // line of this function already answers it. Both surfaces read the
      // platform, and there is one answer.
      return 'upcoming'
  }
}

/**
 * THE SENTENCE FOR A SLOT THAT IS NOT WHAT IT LOOKS LIKE.
 *
 * The postponed half comes from `postponedScheduleNote`, which Matches uses
 * too: one fixture must not be described in two ways on two surfaces.
 *
 * The going-ahead half is Home's own, and it is a different sentence rather
 * than the same one shortened. `Match` has no marker for a moved fixture the
 * way `MatchState` does, so on Home the note is the only place the fact can
 * live; in Matches the state carries it and the mark draws a chip.
 */
function scheduleNoteOf(fixture: SeasonListFixture): string | null {
  if (fixture.status === 'postponed') {
    return postponedScheduleNote(fixture.kickoffAt, fixture.schedule.rescheduled)
  }
  // A moved fixture that is going ahead says so; the date beside it is real and
  // needs no qualification, only an explanation of why it is not where the
  // reader last saw it.
  return fixture.schedule.rescheduled ? 'Rescheduled' : null
}

/**
 * The scoreline to show, official first.
 *
 * A provider's pair is only used where the platform has settled nothing, and
 * only when BOTH numbers arrived — one goal count is not a scoreline, which is
 * the same rule `fixtureListModel` applies to a provisional score.
 */
function scoreOf(fixture: SeasonListFixture): Scoreline | null {
  if (fixture.result) return { home: fixture.result.home, away: fixture.result.away }
  const live = fixture.live
  if (live && live.home !== null && live.away !== null) {
    return { home: live.home, away: live.away }
  }
  return null
}

/**
 * The player's own prediction on one fixture.
 *
 * AWARDED AND PROVISIONAL STAY APART, and contract 175 is the only reason this
 * can be said at all. Its per-fixture `basis` states whether a point value rests
 * on an official result or on a provider opinion, and `pointsAreProvisional` is
 * that word rather than an inference from whether the match looks finished. With
 * no projection read there are no points: null is "not scored yet as far as we
 * were told", which is true, and zero would be a claim.
 *
 * `outcome` IS ALWAYS NULL. Exact, right-result and missed is a classification
 * of a prediction against a result, and no read states it per fixture. Comparing
 * the two scorelines here would put a second opinion about what a prediction was
 * worth next to the server's own points, so Home shows the points and not a
 * verdict. The season-wide counts in `accuracy` are the server's and are used.
 *
 * `status` follows the application's editability rather than the clock: a
 * prediction on a card the server will still accept is `submitted`, one on a
 * closed card is `locked`, and one on a settled fixture is `settled`.
 */
function predictionOf(
  fixture: SeasonListFixture,
  saved: { home: number; away: number } | null,
  projection: ProjectionFixture | undefined,
  editable: boolean,
  jokerPlayed: boolean,
): UserPrediction | null {
  if (!saved) return null

  const provisional = projection?.basis === 'provisional'
  const scored = projection?.basis === 'official' || provisional

  return {
    score: { home: saved.home, away: saved.away },
    status: fixture.status === 'played' ? 'settled' : editable ? 'submitted' : 'locked',
    // The Joker is played on a MATCHWEEK, not on a fixture. Every prediction in
    // a jokered matchweek carries the flag because that is what the allowance
    // did; it is not a per-row choice the player made.
    isJoker: jokerPlayed,
    outcome: null,
    points: scored ? (projection?.points ?? null) : null,
    pointsAreProvisional: provisional,
  }
}

/**
 * Community consensus for one fixture, when contract 130 answered.
 *
 * THE READ IS THE REVEAL BOUNDARY. `get_season_prediction_consensus` refuses a
 * caller before the matchweek locks, and the acquisition layer turns that
 * refusal into `null` rather than into an empty group. So a consensus reaching
 * this function is one the server decided may be shown, and this function adds
 * no permission of its own.
 *
 * `friends` IS NULL. Contract 130's cohort is the competition's entrants, not a
 * private league, and there is no private-league consensus read wired here. An
 * empty friends group would read as "your league has no opinion", which is a
 * different and false statement.
 */
function consensusOf(fixture: SeasonConsensusFixture | undefined): MatchConsensus | null {
  if (!fixture || fixture.predicted <= 0) return null

  const community: ConsensusGroup = {
    label: 'Everyone playing',
    sampleSize: fixture.predicted,
    popular: fixture.topScores.map((entry) => ({
      score: { home: entry.home, away: entry.away },
      share: entry.picks / fixture.predicted,
    })),
    // The server counts; the decoder turned those counts into whole percentages.
    // Home wants 0–1, so the percentage is divided rather than recounted.
    homeWinShare: fixture.shares.homeWin / 100,
    drawShare: fixture.shares.draw / 100,
    awayWinShare: fixture.shares.awayWin / 100,
  }

  return { community, friends: null }
}

/**
 * One fixture, assembled.
 *
 * `venue`, `headToHead` and `broadcast` are null because no application read
 * supplies them to this surface. Contract 141 does hold a club head-to-head, but
 * it is addressed one PAIR at a time and a matchweek of fixtures would need one
 * request each — an N+1 on Home, which is the pattern §30 says to report rather
 * than normalise. It is reported instead.
 *
 * `isFeatured` IS FALSE THROUGHOUT. Nothing in the application nominates a match
 * of the day. `pickFeaturedLiveMatch` already falls back to the first live
 * fixture and calls that a presentation tie-break, which is exactly what it is.
 */
function matchOf(
  fixture: SeasonListFixture,
  source: HomeSource,
  formByName: ReadonlyMap<string, SeasonClubForm>,
  projectionByFixture: ReadonlyMap<string, ProjectionFixture>,
  consensusByFixture: ReadonlyMap<string, SeasonConsensusFixture>,
  savedByFixture: ReadonlyMap<string, { home: number; away: number }>,
): Match {
  const editable = source.cardPresentation?.editable ?? false

  return {
    id: fixture.id,
    competitionId: source.competition.tournamentId,
    // Contract 139 windows on `kickoff_at`, so an untimed fixture never reaches
    // this read at all. The fallback exists so a malformed payload cannot make
    // the type lie, and the caller filters these out.
    kickoff: fixture.kickoffAt ?? '',
    status: statusOf(fixture),
    scheduleNote: scheduleNoteOf(fixture),
    // No minute anywhere. `season_fixture_live_state` carries a status, a score
    // and an observation instant — no clock — so Home shows LIVE without a
    // minute. `LiveIndicator` and the ticker both already read a null clock as
    // "say live, say no number", so this costs the design nothing.
    clock: null,
    home: sideOf(fixture.home, formByName.get(fixture.home.name), source.competition.tournamentId),
    away: sideOf(fixture.away, formByName.get(fixture.away.name), source.competition.tournamentId),
    score: scoreOf(fixture),
    venue: null,
    headToHead: null,
    broadcast: null,
    prediction: predictionOf(
      fixture,
      savedByFixture.get(fixture.id) ?? null,
      projectionByFixture.get(fixture.id),
      editable,
      source.card?.joker.playedHere ?? false,
    ),
    consensus: consensusOf(consensusByFixture.get(fixture.id)),
    // The deadline for ENTERING a prediction, and only while entering is
    // something the application will still accept. Once it will not, the model
    // wants null rather than a past instant, and `editable` is the authority for
    // which side of that we are on — not a comparison performed here.
    lockAt: editable ? (source.card?.lock.lockAt ?? null) : null,
    isFeatured: false,
  }
}

/* ------------------------------------------------------------------ *
 * The user's competition
 * ------------------------------------------------------------------ */

function competitionOf(source: HomeSource, fixtures: readonly SeasonListFixture[]): CompetitionContext {
  const { competition } = source
  // The round label travels with each fixture and is the competition's own
  // wording — "Matchweek 5", "Group stage". It is preferred over composing one
  // from a number, because a competition that does not call its rounds
  // matchweeks would be renamed by a template.
  const roundLabel = fixtures[0]?.round.label ?? null
  const matchweekLabel =
    roundLabel ?? (competition.matchweek === null ? 'This season' : `Matchweek ${competition.matchweek}`)

  return {
    id: competition.tournamentId,
    name: competition.name,
    // One name exists. Using it in both roles is honest; abbreviating it here
    // would invent a short name the product has never agreed.
    shortName: competition.name,
    seasonLabel: competition.seasonLabel,
    stageLabel: matchweekLabel,
    matchweekLabel,
    matchweekNumber: competition.matchweek,
    colours: null,
  }
}

function userOf(source: HomeSource): HomeUser {
  const name = source.user.displayName?.trim()
  return playerRefOf(source.user.id, name && name.length > 0 ? name : 'You')
}

/**
 * A player, as Home refers to one.
 *
 * Initials are derived from the display name because that is a text operation on
 * a name the application supplied, not a fact about a person. `avatarUrl` and
 * `favouriteTeamId` are null: no read on this path carries either, and the model
 * has always said an avatar is the exception rather than the rule.
 */
function playerRefOf(id: string, displayName: string): PlayerRef {
  return {
    id,
    name: displayName,
    initials: initialsOf(displayName),
    avatarUrl: null,
    favouriteTeamId: null,
  }
}

function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word.length > 0)

  const [first] = words
  if (first === undefined) return '?'
  if (words.length === 1) return first.slice(0, 2).toUpperCase()
  const last = words[words.length - 1]
  if (last === undefined) return '?'
  return `${first[0]}${last[0]}`.toUpperCase()
}

/* ------------------------------------------------------------------ *
 * The primary action
 * ------------------------------------------------------------------ */

/**
 * URGENCY IS A PRESENTATION BAND OVER A SUPPLIED DEADLINE, and the distinction
 * from permission is the whole reason this is allowed to exist here.
 *
 * Whether the player MAY still predict is `cardPresentation.editable`, decided
 * by the server's own lock resolver, and this function is never consulted about
 * it — it is only ever called for an action the application has already said is
 * open. What it answers is how hard Home should shout, which is a question about
 * layout, and it answers it from two values that both arrived as inputs: the
 * lock instant the server resolved and the `generatedAt` the caller supplied.
 *
 * No clock is read. The bands are presentation and are deliberately coarse — a
 * boundary being an hour out changes how loud a banner is and nothing else.
 */
function urgencyOf(locksAt: string | null, generatedAt: string): PrimaryActionUrgency {
  if (!locksAt) return 'calm'
  const lock = Date.parse(locksAt)
  const now = Date.parse(generatedAt)
  if (!Number.isFinite(lock) || !Number.isFinite(now)) return 'calm'

  const hours = (lock - now) / 3_600_000
  if (hours <= 2) return 'urgent'
  if (hours <= 24) return 'soon'
  return 'calm'
}

/**
 * WHAT HOME OFFERS THE PLAYER, and it offers nothing the application has not
 * already said is available.
 *
 * `weekAction.outstanding` is the Hub's own week model over the card's resolved
 * lock — the same value the Hub's own summary orders itself by — and it is the
 * only thing that produces a `predict` action. `editable` is checked beside it
 * so a matchweek that became outstanding and then locked cannot leave a Predict
 * button on the page: presentation must never be the permission.
 *
 * The fallbacks are honest rather than encouraging. A player with nothing
 * outstanding and no private league is offered a league, because that is a real
 * thing to do and the application knows they have none. A player with neither is
 * offered a review of their own season, which asks nobody's permission.
 */
function primaryActionOf(source: HomeSource, liveCount: number): PrimaryAction {
  const editable = source.cardPresentation?.editable ?? false
  const action = source.weekAction
  const presentation = source.cardPresentation
  const progress =
    presentation === null
      ? null
      : { completed: presentation.entered, total: presentation.total }

  if (action?.outstanding && editable && presentation !== null) {
    const remaining = presentation.total - presentation.entered
    const label = source.competition.matchweek === null ? 'this matchweek' : `matchweek ${source.competition.matchweek}`
    return {
      type: 'predict',
      title: remaining === presentation.total ? `Predict ${label}` : `Finish ${label}`,
      description:
        remaining === 1
          ? 'One fixture still to predict.'
          : `${remaining} fixtures still to predict.`,
      deadline: action.locksAt,
      progress,
      routePlaceholder: 'fixtures',
      urgency: urgencyOf(action.locksAt, source.generatedAt),
    }
  }

  if (liveCount > 0) {
    return {
      type: 'watchLive',
      title: liveCount === 1 ? 'Your match is on' : `${liveCount} of your matches are on`,
      description: 'Your predictions are in and the football is under way.',
      deadline: null,
      progress,
      routePlaceholder: 'fixtures',
      urgency: 'calm',
    }
  }

  const type: PrimaryActionType = source.leagues.length === 0 ? 'joinLeague' : 'review'
  return type === 'joinLeague'
    ? {
        type,
        title: 'Play against someone',
        description: 'Private leagues are where the game gets its edge.',
        deadline: null,
        progress: null,
        routePlaceholder: 'leagues',
        urgency: 'calm',
      }
    : {
        type,
        title: 'Your season so far',
        description: 'Nothing to enter. See where the matchweek left you.',
        deadline: null,
        progress,
        routePlaceholder: 'season',
        urgency: 'calm',
      }
}

/* ------------------------------------------------------------------ *
 * Performance
 * ------------------------------------------------------------------ */

/**
 * The three-way accuracy split, from the server's two counts.
 *
 * `correct_outcomes` counts predictions whose result sign matched, which
 * NECESSARILY includes every exact score — an exact score has the same sign by
 * definition. So the exact count subtracts out of it to leave right-result-only,
 * and both subtract out of the denominator to leave missed. Three parts of one
 * count the server already made, not a second scoring pass.
 */
function accuracyOf(accuracy: SeasonProfileAccuracy | null): PredictionAccuracy {
  if (!accuracy) return { predicted: 0, exact: 0, resultOnly: 0, missed: 0 }
  const resultOnly = Math.max(0, accuracy.correctOutcomes - accuracy.exactScores)
  return {
    predicted: accuracy.fixturesPredicted,
    exact: accuracy.exactScores,
    resultOnly,
    missed: Math.max(0, accuracy.fixturesPredicted - accuracy.correctOutcomes),
  }
}

/**
 * The user's season.
 *
 * WHAT IS NULL HERE IS A CAPABILITY GAP, NOT A LOADING STATE, and it is worth
 * naming each one because the next data stage is exactly this list:
 *
 *   `rank` / `rankOutOf` — null only for a player with no banked standing.
 *   Contract 151 supplies both the moment one exists, and does not need paging
 *   through a leaderboard to find the caller's own row.
 *
 *   `rankMovement` — ABSENT. Contract 150 states movement inside a PRIVATE
 *   LEAGUE, over one settled matchweek. Nothing states how a player moved in the
 *   season-wide table, and inferring it from two totals would need the table as
 *   it stood before, which Home does not have.
 *
 *   `pointsToday` — ABSENT. Season points are banked per matchweek, and no read
 *   attributes them to a day. The tournament product has a score-event read that
 *   can do this; the season product has no equivalent.
 *
 *   `provisionalPoints` — ABSENT AS THIS FIELD MEANS IT. Contract 175 does state
 *   a projected matchweek total, post-Joker, and that number is authoritative —
 *   but it is a TOTAL, and this field is what is currently on the pitch. Home
 *   prints it as "N more on the pitch", so passing a total would produce a false
 *   sentence from a true number. The per-fixture `basis` that same read supplies
 *   IS used, on each prediction, which is where the awarded/provisional
 *   distinction actually has to hold.
 *
 * `matchweekPoints` is the card's own settled figure and is zero until the
 * matchweek settles, which is a true statement about points awarded.
 */
function performanceOf(source: HomeSource): RecentPerformance {
  const season = source.profile?.season ?? null

  return {
    totalPoints: season?.points ?? 0,
    matchweekPoints: source.card?.settledPoints ?? 0,
    pointsToday: null,
    provisionalPoints: null,
    rank: season?.rank ?? null,
    rankOutOf: season?.fieldSize ?? null,
    rankMovement: null,
    accuracy: accuracyOf(source.profile?.accuracy ?? null),
    // Oldest first, and only matchweeks that actually settled. The server sends
    // most recent first and sends an unsettled matchweek with null points; a
    // sparkline plotting those as zero would draw a collapse that never happened.
    matchweekHistory: [...(source.profile?.history ?? [])]
      .filter((entry) => entry.points !== null)
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((entry) => ({ matchweek: entry.ordinal, points: entry.points as number })),
  }
}

/* ------------------------------------------------------------------ *
 * Private leagues and rivals
 * ------------------------------------------------------------------ */

/**
 * How a member moved over the last settled matchweek, from contract 150.
 *
 * NO ROW MEANS NO MOVEMENT CLAIM. The read answers `settled: false` with no rows
 * for a matchweek still being scored, the acquisition layer turns that into
 * null, and a member absent from a settled answer is one who was not in the
 * table before. Both produce null here, and Home draws no arrow — which is
 * different from drawing a flat one, because a flat arrow asserts they held a
 * position and kept it.
 */
function movementOf(row: SeasonLeagueMovementRow | undefined): RankMovement | null {
  if (!row) return null
  if (row.movement > 0) return { direction: 'up', places: row.movement }
  if (row.movement < 0) return { direction: 'down', places: Math.abs(row.movement) }
  return { direction: 'none', places: 0 }
}

function movementRows(movement: SeasonLeagueMovement | null): ReadonlyMap<string, SeasonLeagueMovementRow> {
  if (!movement || !movement.settled) return new Map()
  return new Map(movement.members.map((row) => [row.userId, row]))
}

/**
 * A window of the league table around the user.
 *
 * THE SERVER'S ORDER IS KEPT, AND SO IS ITS RANK. Contract 128 recomputes rank
 * inside the league because a private league is its own table, and tie-breaks
 * live in that computation. This slices the rows the server sent, in the order it
 * sent them; it never sorts by points, which would silently replace the server's
 * tie-break with "whichever came first".
 *
 * A member who joined the league and never entered the game is kept, because the
 * read includes them deliberately and dropping them would hide a league from the
 * person who created it.
 */
function standingsWindow(
  rows: readonly SeasonLeagueStandingsRow[],
  movement: ReadonlyMap<string, SeasonLeagueMovementRow>,
): readonly PrivateLeagueStanding[] {
  const index = rows.findIndex((row) => row.isYou)
  const from = index < 0 ? 0 : Math.max(0, index - 1)
  const window = index < 0 ? rows.slice(0, 3) : rows.slice(from, from + 3)

  return window.map((row) => ({
    player: playerRefOf(row.userId, row.displayName),
    rank: row.rank,
    points: row.points,
    movement: movementOf(movement.get(row.userId)),
    isUser: row.isYou,
  }))
}

function leagueOf(source: HomeSourceLeague): PrivateLeague | null {
  const rows = source.standings.rows
  const you: SeasonLeagueStandingsYou | null =
    source.standings.you ?? rows.find((row) => row.isYou) ?? null

  // A league table the caller has no row in cannot carry a race. The read
  // includes league members who never entered the game, so this is reachable,
  // and `presentRivalWatch` refuses the same case for the same reason.
  if (!you) return null

  const movement = movementRows(source.movement)
  const leader = rows[0] ?? null

  return {
    id: source.id,
    name: source.name,
    // The league's REAL size, from the read's own total rather than from how
    // many rows one page happened to carry.
    participantCount: source.standings.totalCount,
    userRank: you.rank,
    userPoints: you.points,
    userMovement: movementOf(movement.get(you.userId)),
    // Both totals are on the same table. Subtracting them is what the player
    // would do by looking, and it produces no points of its own.
    gapToLeader: leader ? Math.max(0, leader.points - you.points) : 0,
    leaderName: leader?.displayName ?? you.displayName,
    standings: standingsWindow(rows, movement),
  }
}

/**
 * THE MATCHWEEK RECAP, from reads Home already holds.
 *
 * `presentMatchweekRecap` is the Hub's own rule — which matchweek counts as
 * settled, which league movements describe THAT matchweek, and which figures
 * the profile read is allowed to state — imported rather than rewritten. This
 * function's whole job is to drop the two fields that belong to a router
 * (`href`) and to a cross-competition list (`competitionKey`), neither of which
 * a vNext presentation model may carry.
 *
 * IT COSTS NO READ. The profile and every league's movement are already in the
 * source because Home's standing block and league ladder need them.
 */
function recapOf(source: HomeSource): MatchweekRecap | null {
  if (source.profile === null) return null

  const movements = source.leagues
    .filter((league) => league.movement !== null)
    .map((league) => ({
      leagueId: league.id,
      leagueName: league.name,
      // Narrowed by the filter above; `movement` is non-null here.
      movement: league.movement as NonNullable<HomeSourceLeague['movement']>,
    }))

  const recap = presentMatchweekRecap(
    source.competition.tournamentId,
    source.competition.name,
    // A PLACEHOLDER THE MAPPER THROWS AWAY. The Hub's model carries a route
    // because the Hub's card is a link; vNext has no router in this lane and
    // the field is dropped below rather than filled with something plausible.
    '',
    source.profile,
    movements,
  )
  if (recap === null) return null

  return {
    matchweekLabel: recap.matchweekLabel,
    matchweekOrdinal: recap.matchweekOrdinal,
    points: recap.points,
    jokerPlayed: recap.jokerPlayed,
    seasonPoints: recap.seasonPoints,
    seasonRank: recap.seasonRank,
    fieldSize: recap.fieldSize,
    exactScores: recap.exactScores,
    correctOutcomes: recap.correctOutcomes,
    leagues: recap.leagues.map((league) => ({
      leagueId: league.leagueId,
      leagueName: league.leagueName,
      rankBefore: league.rankBefore,
      rankAfter: league.rankAfter,
      movement: league.movement,
      fieldSize: league.fieldSize,
      gapToLeader: league.gapToLeaderAfter,
    })),
  }
}

/**
 * Who the user is actually racing, from the table they are already looking at.
 *
 * ADJACENCY IS THE SERVER'S ORDER, not a re-sort: the row above the user in the
 * league's own ranking is the rival above. The leader is included when they are
 * somebody else, because leading is the fact a league table is about.
 *
 * `sharedLeagueName` is always a league the caller is a member of — this only
 * ever reads a table `get_season_league_standings` returned, which is bounded by
 * membership. There is no player directory here and this must never become one.
 */
function rivalsOf(league: HomeSourceLeague, model: PrivateLeague): readonly Rival[] {
  const rows = league.standings.rows
  const index = rows.findIndex((row) => row.isYou)
  if (index < 0) return []

  const movement = movementRows(league.movement)
  const you = rows[index]
  if (you === undefined) return []
  const picked: { row: SeasonLeagueStandingsRow; relation: Rival['relation'] }[] = []

  const above = rows[index - 1]
  const below = rows[index + 1]
  const leader = rows[0]

  if (above) picked.push({ row: above, relation: 'closestAbove' })
  if (below) picked.push({ row: below, relation: 'closestBelow' })
  if (leader && !leader.isYou && leader !== above) {
    picked.push({ row: leader, relation: 'leagueLeader' })
  }

  return picked.map(({ row, relation }) => {
    const difference = row.points - you.points
    return {
      player: playerRefOf(row.userId, row.displayName),
      relation,
      rank: row.rank,
      points: row.points,
      movement: movementOf(movement.get(row.userId)),
      pointsDifference: difference,
      sharedLeagueName: model.name,
      headline: headlineFor(difference, row.displayName),
    }
  })
}

/** "2 points to catch Jamie" — a sentence about a subtraction, not a prediction. */
function headlineFor(difference: number, name: string): string | null {
  if (difference === 0) return `Level with ${name}`
  const gap = Math.abs(difference)
  const points = gap === 1 ? 'point' : 'points'
  return difference > 0 ? `${gap} ${points} to catch ${name}` : `${gap} ${points} ahead of ${name}`
}

/* ------------------------------------------------------------------ *
 * The model
 * ------------------------------------------------------------------ */

/**
 * Build the Home model from real application state.
 *
 * THE PARTITIONS ARE THE APPLICATION'S. `selectHomeEmphasis` chooses Home's
 * emphasis by asking whether `liveMatches` is empty, so which bucket a fixture
 * lands in here decides what the whole page looks like. That is precisely why
 * this function refuses to guess: a match is live because contract 135 says
 * `in_play`, finished because the platform settled it or a provider called it
 * final, and upcoming otherwise.
 *
 * `activity` IS EMPTY, and empty is honest. Home's activity feed wants settled
 * predictions, rank changes, rival moves and league invites as a dated stream;
 * the application has no such read. The Hub's since-last-visit and matchweek
 * recap models answer nearby questions with different shapes, and reshaping one
 * of them into an event stream would be Home inventing a history. The zone
 * removes itself when the list is empty.
 */
export function buildHomeModel(source: HomeSource): HomeModel {
  const formByName = new Map((source.clubForm?.clubs ?? []).map((club) => [club.name, club]))
  const projectionByFixture = new Map(
    (source.projection?.fixtures ?? []).map((fixture) => [fixture.fixtureId, fixture]),
  )
  const consensusByFixture = new Map(
    (source.consensus?.suppressed ? [] : (source.consensus?.fixtures ?? [])).map((fixture) => [
      fixture.id,
      fixture,
    ]),
  )
  const savedByFixture = new Map(
    (source.card?.fixtures ?? [])
      .filter((fixture) => fixture.prediction !== null)
      .map((fixture) => [
        fixture.fixtureId,
        fixture.prediction as { home: number; away: number },
      ]),
  )

  const matches = source.fixtures
    // Contract 139 cannot return an untimed fixture, so this drops nothing in
    // practice. It is here because `Match.kickoff` is not nullable and a fixture
    // with no instant cannot be placed on a surface ordered by kickoff.
    .filter((fixture) => fixture.kickoffAt !== null)
    .map((fixture) =>
      matchOf(
        fixture,
        source,
        formByName,
        projectionByFixture,
        consensusByFixture,
        savedByFixture,
      ),
    )

  const liveMatches = matches.filter((match) => match.status === 'live')
  const recentResults = matches.filter((match) => match.status === 'fullTime')

  /*
   * SINCE YOU WERE LAST HERE.
   *
   * Selected from `recentResults` rather than from a read of its own, which is
   * the whole reason this costs nothing: the football is already on the page
   * and the only new information is which of it the reader has not seen.
   * `selectSinceLastVisit` is the Hub's own rule, imported rather than
   * reimplemented, so the cap and the first-visit case cannot drift apart
   * between the two surfaces that show them.
   *
   * `status === 'fullTime'` is the server's settlement, never a clock
   * comparison, so a postponed or abandoned match cannot appear here as a
   * finished one. The kickoff decides ORDER and recency and nothing else.
   */
  const since = selectSinceLastVisit(
    recentResults,
    { settled: () => true, at: (match) => match.kickoff },
    source.lastVisitAt ?? null,
  )
  const sinceLastVisit: SinceLastVisit | null =
    since.available && since.results.length > 0
      ? { results: since.results, more: since.more }
      : null
  const upcomingMatches = matches.filter(
    (match) => match.status === 'upcoming' || match.status === 'postponed',
  )

  const leagues = source.leagues
    .map((league) => ({ source: league, model: leagueOf(league) }))
    .filter((entry): entry is { source: HomeSourceLeague; model: PrivateLeague } =>
      entry.model !== null,
    )

  const leadLeague = leagues[0]

  return {
    generatedAt: source.generatedAt,
    user: userOf(source),
    competition: competitionOf(source, source.fixtures),
    primaryAction: primaryActionOf(source, liveMatches.length),
    liveMatches,
    upcomingMatches,
    recentResults,
    sinceLastVisit,
    matchweekRecap: recapOf(source),
    recentPerformance: performanceOf(source),
    privateLeagues: leagues.map((entry) => entry.model),
    // Rivals come from the league Home leads with. Every league's adjacent rows
    // would be a longer list saying the same thing about a smaller race.
    rivals: leadLeague ? rivalsOf(leadLeague.source, leadLeague.model) : [],
    activity: [],
  }
}
