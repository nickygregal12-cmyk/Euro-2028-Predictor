import type { LeagueSeasonCompetitionConfig } from '../domain/competition/kinds'
import {
  resolveCompetitionContext,
  type CompetitionContext,
  type CompetitionLockScopeData,
  type CompetitionProgressData,
  type CompetitionMatchData,
  type CompetitionLiveData,
  type CompetitionUserData,
} from '../domain/competition/context'
import type { ClubIdentityTokens } from '../domain/clubIdentity/clubIdentityTypes'

/**
 * A synthetic league season, for driving the real competition engine.
 *
 * The platform is a multi-competition one, but everything a person can click is
 * still the Euro tournament. That makes the season half of the seam hard to have
 * an opinion about: `LeagueSeasonCompetitionConfig` has existed since the Stage B
 * context foundation, and nothing has ever handed it to `resolveCompetitionContext`
 * outside a unit test.
 *
 * This fixture does exactly that. Every rule below comes from
 * `src/domain/competition/` — the matchweek lock scope, the 30-minute buffer, the
 * match-state ladder — and none of it is reimplemented here. What is invented is
 * only the data: twenty clubs, a generated double round-robin and a standings
 * snapshot.
 *
 * ## What this deliberately does not do
 *
 * It does not compute standings. Position, points and goal difference are written
 * down, not derived. Season standings and season scoring are open authorities
 * (ADR 0012 and ADR 0013 and their future dedicated documents), and a preview is
 * the worst possible place for a rule to be invented — it would be reimplemented
 * later from the wrong source and nobody would know which came first. The table
 * below is a snapshot of what ingestion would one day supply.
 *
 * It is also DEV-only and imports nothing from `src/domain/tournament/`.
 */

export type SeasonClub = {
  id: string
  name: string
  tokens: ClubIdentityTokens
}

/**
 * Twenty clubs. Colours and monograms follow ADR 0017 — no crests, ever — and
 * the light primaries carry `onPrimary: 'dark'` so the monogram stays readable.
 */
export const SEASON_CLUBS: readonly SeasonClub[] = [
  { id: 'ARS', name: 'Arsenal', tokens: { monogram: 'ARS', primary: '#EF0107' } },
  { id: 'AVL', name: 'Aston Villa', tokens: { monogram: 'AVL', primary: '#95BFE5', secondary: '#670E36', onPrimary: 'dark' } },
  { id: 'BOU', name: 'Bournemouth', tokens: { monogram: 'BOU', primary: '#DA291C' } },
  { id: 'BRE', name: 'Brentford', tokens: { monogram: 'BRE', primary: '#E30613', secondary: '#FFFFFF', pattern: 'stripes' } },
  { id: 'BHA', name: 'Brighton', tokens: { monogram: 'BHA', primary: '#0057B8' } },
  { id: 'CHE', name: 'Chelsea', tokens: { monogram: 'CHE', primary: '#034694' } },
  { id: 'CRY', name: 'Crystal Palace', tokens: { monogram: 'CRY', primary: '#1B458F', secondary: '#C4122E', pattern: 'sash' } },
  { id: 'EVE', name: 'Everton', tokens: { monogram: 'EVE', primary: '#003399' } },
  { id: 'FUL', name: 'Fulham', tokens: { monogram: 'FUL', primary: '#FFFFFF', onPrimary: 'dark' } },
  { id: 'IPS', name: 'Ipswich', tokens: { monogram: 'IPS', primary: '#3A64A3' } },
  { id: 'LEI', name: 'Leicester', tokens: { monogram: 'LEI', primary: '#003090' } },
  { id: 'LIV', name: 'Liverpool', tokens: { monogram: 'LIV', primary: '#C8102E' } },
  { id: 'MCI', name: 'Man City', tokens: { monogram: 'MCI', primary: '#6CABDD', onPrimary: 'dark' } },
  { id: 'MUN', name: 'Man United', tokens: { monogram: 'MUN', primary: '#DA291C' } },
  { id: 'NEW', name: 'Newcastle', tokens: { monogram: 'NEW', primary: '#241F20', secondary: '#FFFFFF', pattern: 'stripes' } },
  { id: 'NFO', name: 'Nott’m Forest', tokens: { monogram: 'NFO', primary: '#DD0000' } },
  { id: 'SOU', name: 'Southampton', tokens: { monogram: 'SOU', primary: '#D71920' } },
  { id: 'TOT', name: 'Tottenham', tokens: { monogram: 'TOT', primary: '#FFFFFF', onPrimary: 'dark' } },
  { id: 'WHU', name: 'West Ham', tokens: { monogram: 'WHU', primary: '#7A263A' } },
  { id: 'WOL', name: 'Wolves', tokens: { monogram: 'WOL', primary: '#FDB913', onPrimary: 'dark' } },
]

/** Twenty clubs play each other home and away: 19 rounds doubled. */
export const MATCHWEEK_COUNT = (SEASON_CLUBS.length - 1) * 2

/** A Saturday. Matchweek N opens on this date plus 7×(N−1) days. */
const SEASON_FIRST_SATURDAY = '2027-08-14'

/**
 * The competition's own calendar zone — never the viewer's.
 *
 * Declared before the config because kickoff generation needs it: a wall-clock
 * kickoff has no instant until you know which zone it is stated in.
 */
const COMPETITION_TIME_ZONE = 'Europe/London'

/**
 * Kickoff slots within a matchweek, as wall-clock times in the competition's
 * own zone, offset in days from its Saturday.
 *
 * Ten fixtures across a real weekend rather than ten simultaneous kickoffs,
 * because the matchweek lock is derived from the *earliest* kickoff in the scope
 * and a flat slate would hide that entirely.
 *
 * These are wall-clock and not UTC on purpose. A 15:00 Saturday kickoff is 15:00
 * in August and 15:00 in January, and those are different instants — the season
 * crosses the October and March clock changes. Fixing an offset here would make
 * every fixture after the change an hour wrong, which is the exact failure the
 * `competitionTimeZone` seam exists to prevent, so the preview would be
 * demonstrating the bug rather than the rule.
 */
const KICKOFF_SLOTS: readonly { dayOffset: number; hour: number; minute: number }[] = [
  { dayOffset: 0, hour: 12, minute: 30 }, // Saturday 12:30
  { dayOffset: 0, hour: 15, minute: 0 }, // Saturday 15:00 ×4
  { dayOffset: 0, hour: 15, minute: 0 },
  { dayOffset: 0, hour: 15, minute: 0 },
  { dayOffset: 0, hour: 15, minute: 0 },
  { dayOffset: 0, hour: 17, minute: 30 }, // Saturday 17:30
  { dayOffset: 1, hour: 14, minute: 0 }, // Sunday 14:00 ×2
  { dayOffset: 1, hour: 14, minute: 0 },
  { dayOffset: 1, hour: 16, minute: 30 }, // Sunday 16:30
  { dayOffset: 2, hour: 20, minute: 0 }, // Monday 20:00
]

/** What `timeZone` was offset from UTC at a given instant, in milliseconds. */
function zoneOffsetMs(timeZone: string, instantMs: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs))

  const field = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  const asUtc = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    // `hour12: false` renders midnight as 24 in some ICU versions.
    field('hour') % 24,
    field('minute'),
    field('second'),
  )
  return asUtc - instantMs
}

/**
 * The instant at which a wall-clock time occurs in `timeZone`.
 *
 * Two passes, because the offset depends on the instant and the instant depends
 * on the offset. The first guess uses the offset at the naive UTC reading, which
 * is right except within an hour of a transition; re-reading the offset at that
 * candidate settles it.
 */
function instantForWallClock(timeZone: string, wallUtcMs: number): number {
  const firstGuess = wallUtcMs - zoneOffsetMs(timeZone, wallUtcMs)
  return wallUtcMs - zoneOffsetMs(timeZone, firstGuess)
}

export type SeasonFixture = {
  id: string
  matchweek: number
  lockScopeId: string
  home: SeasonClub
  away: SeasonClub
  kickoffAt: string
}

export function matchweekScopeId(matchweek: number): string {
  return `matchweek-${String(matchweek).padStart(2, '0')}`
}

const DAY_MS = 24 * 60 * 60 * 1000

function kickoffFor(matchweek: number, slotIndex: number): string {
  const slot = KICKOFF_SLOTS[slotIndex] ?? { dayOffset: 0, hour: 15, minute: 0 }
  // Step whole days in UTC to reach the calendar date, then read the wall-clock
  // time off that date. Doing the arithmetic on the instant instead would drift
  // by an hour across a clock change.
  const saturday = new Date(
    Date.parse(`${SEASON_FIRST_SATURDAY}T00:00:00.000Z`) +
      ((matchweek - 1) * 7 + slot.dayOffset) * DAY_MS,
  )
  const wallUtcMs = Date.UTC(
    saturday.getUTCFullYear(),
    saturday.getUTCMonth(),
    saturday.getUTCDate(),
    slot.hour,
    slot.minute,
  )
  return new Date(
    instantForWallClock(COMPETITION_TIME_ZONE, wallUtcMs),
  ).toISOString()
}

/**
 * A double round-robin by the circle method.
 *
 * One club is held fixed and the rest rotate, which pairs every club exactly
 * once per round. The second half repeats the first with home and away reversed,
 * so each club plays 38 and every fixture happens twice. Generated rather than
 * written out because 380 hand-typed fixtures would contain a mistake.
 */
function buildFixtures(): SeasonFixture[] {
  const clubs = [...SEASON_CLUBS]
  const half = clubs.length / 2
  const rotating = clubs.slice(1)
  const fixtures: SeasonFixture[] = []

  for (let round = 0; round < clubs.length - 1; round += 1) {
    const order = [clubs[0], ...rotating.slice(round), ...rotating.slice(0, round)]

    for (let pair = 0; pair < half; pair += 1) {
      const a = order[pair]
      const b = order[order.length - 1 - pair]
      // Alternate which side is at home across rounds, so no club is ever at
      // home for every fixture of the first half.
      const homeFirst = (round + pair) % 2 === 0

      for (const [matchweek, home, away] of [
        [round + 1, homeFirst ? a : b, homeFirst ? b : a],
        [round + clubs.length, homeFirst ? b : a, homeFirst ? a : b],
      ] as const) {
        fixtures.push({
          id: `mw${matchweek}-${home.id}-${away.id}`,
          matchweek,
          lockScopeId: matchweekScopeId(matchweek),
          home,
          away,
          kickoffAt: kickoffFor(matchweek, pair),
        })
      }
    }
  }

  return fixtures.sort((a, b) =>
    a.matchweek === b.matchweek
      ? a.kickoffAt.localeCompare(b.kickoffAt)
      : a.matchweek - b.matchweek,
  )
}

export const SEASON_FIXTURES: readonly SeasonFixture[] = buildFixtures()

export function fixturesForMatchweek(matchweek: number): readonly SeasonFixture[] {
  return SEASON_FIXTURES.filter((fixture) => fixture.matchweek === matchweek)
}

/**
 * The competition itself.
 *
 * Every field is checked by `isLeagueSeasonCompetitionConfig`, including the
 * rule that `lockPolicy.scopeCount` equals `matchweeks.count` — a season locks
 * per matchweek, so there are exactly as many lock scopes as matchweeks.
 *
 * `competitionTimeZone` is the competition's own calendar and is never the
 * viewer's zone. A season is where that distinction starts to bite: which
 * matchweek a fixture belongs to cannot have two answers.
 */
export const SEASON_CONFIG: LeagueSeasonCompetitionConfig = {
  id: 'preview-league-season',
  name: 'Preview League — 2027/28',
  kind: 'league_season',
  competitionTimeZone: COMPETITION_TIME_ZONE,
  bounds: {
    startsAt: `${SEASON_FIRST_SATURDAY}T00:00:00.000Z`,
    endsAt: kickoffFor(MATCHWEEK_COUNT, KICKOFF_SLOTS.length - 1),
  },
  primaryStage: 'league',
  progression: 'rolling_matchweeks',
  matchweeks: { count: MATCHWEEK_COUNT },
  lockPolicy: { scope: 'matchweek', scopeCount: MATCHWEEK_COUNT, bufferMinutes: 30 },
}

/**
 * Fixture data for one matchweek's lock scope.
 *
 * `validUntil` is what makes the lock fail closed: a scope whose fixture data
 * has expired locks with `stale_fixture_data` rather than staying open on an
 * old kickoff time. Kept generous here so the preview exercises the ordinary
 * path; `staleFixtureData` below is the switch for the other one.
 */
function scopeFor(matchweek: number, options: SeasonPreviewOptions): CompetitionLockScopeData {
  const fixtures = fixturesForMatchweek(matchweek)

  return {
    id: matchweekScopeId(matchweek),
    type: 'matchweek',
    fixtureData: options.missingFixtureData
      ? null
      : {
          observedAt: SEASON_CONFIG.bounds.startsAt,
          validUntil: options.staleFixtureData
            ? SEASON_CONFIG.bounds.startsAt
            : SEASON_CONFIG.bounds.endsAt,
          fixtures: fixtures.map((fixture) => ({
            id: fixture.id,
            kickoffAt: fixture.kickoffAt,
          })),
        },
    previouslyLocked: false,
  }
}

export type SeasonPreviewOptions = {
  /** The matchweek whose fixtures are handed to the engine. */
  matchweek: number
  /** Drop fixture data entirely — the scope should lock, not stay open. */
  missingFixtureData?: boolean
  /** Expire the fixture data — the scope should lock as stale. */
  staleFixtureData?: boolean
  /** Whether the live feed is reachable at all. */
  feedAvailable?: boolean
  /** Whether the viewer has a complete, submitted entry for this matchweek. */
  submitted?: boolean
}

export type SeasonPreviewInputs = {
  config: LeagueSeasonCompetitionConfig
  competitionData: {
    progress: CompetitionProgressData
    lockScopes: readonly CompetitionLockScopeData[]
    matches: readonly CompetitionMatchData[]
  }
  liveData: CompetitionLiveData
  userData: CompetitionUserData
}

/**
 * The four arguments `resolveCompetitionContext` takes, for a given instant.
 *
 * `now` is a parameter throughout. Nothing here reads a clock — the domain
 * forbids it, and a preview that read one could not be tested or scrubbed.
 */
export function buildSeasonPreviewInputs(
  now: Date,
  options: SeasonPreviewOptions,
): SeasonPreviewInputs {
  const nowMs = now.getTime()
  const visible = fixturesForMatchweek(options.matchweek)

  const matches: CompetitionMatchData[] = visible.map((fixture) => {
    const kickoffMs = Date.parse(fixture.kickoffAt)
    const minutesSinceKickoff = (nowMs - kickoffMs) / 60_000
    // Only the official state is asserted here. Whether a match reads as
    // in-play, full-time-unconfirmed or scored is the engine's decision, from
    // this plus the lock state and the feed.
    const officialState =
      minutesSinceKickoff > 24 * 60 ? 'scored' : minutesSinceKickoff > 150 ? 'confirmed' : 'unconfirmed'

    return {
      id: fixture.id,
      lockScopeId: fixture.lockScopeId,
      kickoffAt: fixture.kickoffAt,
      administrationState: 'scheduled',
      officialState,
      corrected: false,
    }
  })

  const liveMatches = visible
    .map((fixture) => {
      const minutes = (nowMs - Date.parse(fixture.kickoffAt)) / 60_000
      if (minutes < 0 || minutes > 115) return null
      return {
        matchId: fixture.id,
        state: minutes >= 95 ? ('full_time' as const) : ('in_play' as const),
        homeScore: 1,
        awayScore: 1,
        minute: Math.min(90, Math.floor(minutes)),
      }
    })
    .filter((match): match is NonNullable<typeof match> => match !== null)

  const submitted = options.submitted ?? true
  const activeScopeId = matchweekScopeId(options.matchweek)

  return {
    config: SEASON_CONFIG,
    competitionData: {
      progress: {
        hasStarted: nowMs >= Date.parse(SEASON_CONFIG.bounds.startsAt),
        // A league season has no group stage to complete and no knockout to
        // enter. These stay false for the whole season, which is what keeps the
        // phase at `stage_in_progress` with `stageKind: 'league'`.
        regularStageComplete: false,
        nextStageReady: false,
        knockoutStarted: false,
        finalConfirmed: false,
        allCompetitionsSettled: false,
        markedComplete: false,
      },
      lockScopes: Array.from({ length: MATCHWEEK_COUNT }, (_, index) =>
        scopeFor(index + 1, options),
      ),
      matches,
    },
    liveData: {
      feedAvailable: options.feedAvailable ?? true,
      matches: liveMatches,
    },
    userData: {
      entry: {
        exists: true,
        complete: submitted,
        valid: submitted,
        submitted,
        autoSubmitted: false,
        activeLockScopeId: activeScopeId,
      },
      competitions: [{ id: SEASON_CONFIG.id, candidateStatuses: ['entered'] }],
      actions: {
        accountOrEntryBlockingError: false,
        hasOutstandingPrediction: !submitted,
        activeLiveMatchIds: liveMatches.map((match) => match.matchId),
        cupTieBreakRequired: false,
        lmsSelectionRequired: false,
        sharedKnockoutPredictionRequired: false,
        matchAwaitingAttention: false,
        leagueInviteAvailable: false,
        urgentWindowMinutes: 60,
      },
    },
  }
}

/** The real engine, on the synthetic season. */
export function resolveSeasonPreview(
  now: Date,
  options: SeasonPreviewOptions,
): CompetitionContext {
  const inputs = buildSeasonPreviewInputs(now, options)
  return resolveCompetitionContext(
    inputs.config,
    inputs.competitionData,
    inputs.liveData,
    inputs.userData,
    now,
  )
}

/**
 * Instants worth looking at, relative to a matchweek's earliest kickoff.
 *
 * The 30-minute one is the point of the whole exercise: a tournament entry
 * locks once, at the competition's single deadline, while a season locks per
 * matchweek half an hour before its first kickoff and then does it again next
 * week. That is `lockPolicy` doing its job, not a branch anywhere in the UI.
 */
export const PREVIEW_INSTANTS: readonly {
  key: string
  label: string
  offsetMinutes: number
}[] = [
  { key: 'week-before', label: 'A week before', offsetMinutes: -7 * 24 * 60 },
  { key: 'hour-before', label: '60 min before', offsetMinutes: -60 },
  { key: 'buffer', label: '29 min before (locked)', offsetMinutes: -29 },
  { key: 'kickoff', label: 'First kickoff', offsetMinutes: 0 },
  { key: 'in-play', label: '60 min in', offsetMinutes: 60 },
  { key: 'full-time', label: 'Full time', offsetMinutes: 100 },
  { key: 'confirmed', label: 'Next day', offsetMinutes: 26 * 60 },
]

export function instantFor(matchweek: number, offsetMinutes: number): Date {
  const earliest = fixturesForMatchweek(matchweek)[0]?.kickoffAt ?? SEASON_CONFIG.bounds.startsAt
  return new Date(Date.parse(earliest) + offsetMinutes * 60_000)
}

/**
 * A standings snapshot.
 *
 * Written down, not computed — see the note at the top of this file. Season
 * standings are an open authority and a DEV preview must not become the place
 * one gets invented.
 */
export const SEASON_STANDINGS: readonly {
  position: number
  clubId: string
  played: number
  goalDifference: number
  points: number
  movement: 'up' | 'down' | 'none'
}[] = [
  { position: 1, clubId: 'LIV', played: 12, goalDifference: 18, points: 29, movement: 'none' },
  { position: 2, clubId: 'ARS', played: 12, goalDifference: 15, points: 27, movement: 'up' },
  { position: 3, clubId: 'MCI', played: 12, goalDifference: 14, points: 25, movement: 'down' },
  { position: 4, clubId: 'CHE', played: 12, goalDifference: 9, points: 23, movement: 'up' },
  { position: 5, clubId: 'NEW', played: 12, goalDifference: 7, points: 21, movement: 'down' },
  { position: 6, clubId: 'AVL', played: 12, goalDifference: 5, points: 20, movement: 'none' },
  { position: 7, clubId: 'NFO', played: 12, goalDifference: 3, points: 19, movement: 'up' },
  { position: 8, clubId: 'BHA', played: 12, goalDifference: 2, points: 18, movement: 'down' },
  { position: 9, clubId: 'BOU', played: 12, goalDifference: 1, points: 17, movement: 'none' },
  { position: 10, clubId: 'BRE', played: 12, goalDifference: 0, points: 16, movement: 'up' },
  { position: 11, clubId: 'FUL', played: 12, goalDifference: -1, points: 15, movement: 'down' },
  { position: 12, clubId: 'CRY', played: 12, goalDifference: -2, points: 14, movement: 'none' },
  { position: 13, clubId: 'EVE', played: 12, goalDifference: -4, points: 13, movement: 'up' },
  { position: 14, clubId: 'MUN', played: 12, goalDifference: -5, points: 12, movement: 'down' },
  { position: 15, clubId: 'TOT', played: 12, goalDifference: -7, points: 11, movement: 'down' },
  { position: 16, clubId: 'WHU', played: 12, goalDifference: -9, points: 10, movement: 'up' },
  { position: 17, clubId: 'WOL', played: 12, goalDifference: -12, points: 9, movement: 'none' },
  { position: 18, clubId: 'LEI', played: 12, goalDifference: -14, points: 7, movement: 'down' },
  { position: 19, clubId: 'IPS', played: 12, goalDifference: -16, points: 6, movement: 'none' },
  { position: 20, clubId: 'SOU', played: 12, goalDifference: -24, points: 3, movement: 'down' },
]
