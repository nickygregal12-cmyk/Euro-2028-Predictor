import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { sectionAnchor } from './sectionAnchor'
import styles from './ComponentsPreview.module.css'
import { renderShareCard } from '../features/share/renderShareCard'
import type { ShareCardModel, ShareVariant } from '../features/share/shareModel'
import {
  AppBar,
  Button,
  TextInput,
  EmptyState,
  EmptyIllustration,
  Masthead,
  PageShell,
  BottomNav,
  type NavKey,
  Alert,
  Toast,
  Skeleton,
  Modal,
  ConfirmModal,
  ProgressBar,
  StatusBadge,
  ScoreInput,
  TeamFlag,
  JokerButton,
  JokerCounter,
  ClubMatchCard,
  MatchCard,
  GroupTable,
  ThirdPlaceTable,
  TieResolver,
  PlayerChip,
  StatCard,
  ClubIdentity,
  LeagueTable,
  SideRail,
  type JokerButtonState,
  type TieResolverTeam,
  type ClubIdentityTokens,
  type LeagueTableRow,
  type LeagueZone,
} from '../design-system'
import { InfoIcon } from '../design-system/icons'
import { railGroups } from '../app/railDestinations'
import { SeasonLmsFormGuide } from '../features/season/SeasonLmsFormGuide'
import { SeasonFixtureConsensus } from '../features/season/SeasonFixtureConsensus'
import type { LmsFormGuide } from '../features/season/lmsFormGuideModel'
import type { SeasonConsensus } from '../services/supabase/seasonConsensusModel'
import { twentyCompetitionPlayer } from './scaleFixture'
import { OnboardingCompetitionStep } from '../features/onboarding/OnboardingCompetitionStep'
import { OnboardingFavouriteStep } from '../features/onboarding/OnboardingFavouriteStep'
import { OnboardingGamesStep } from '../features/onboarding/OnboardingGamesStep'
import { OnboardingReviewStep } from '../features/onboarding/OnboardingReviewStep'
import {
  EMPTY_DRAFT,
  applyGamesToAll,
  toggleFollowed,
  toggleGame,
  type OnboardingDraft,
} from '../features/onboarding/onboardingDraft'
import { ONBOARDING_GAME_OFFERS, ONBOARDING_TEAMS } from './onboardingFixture'
import { CreateLeagueJourney } from '../features/leagues/CreateLeagueJourney'
import { presentCreateJourney } from '../features/leagues/createJourneyModel'
import { GameRulesDisclosure } from '../features/season/GameRulesDisclosure'
import { seasonGameRules } from '../features/season/gameRules'
import { presentPlayerCompetitions } from '../features/hub/playerCompetitions'
import { HUB_COMPETITIONS } from '../features/hub/competitionCatalogue'
import { PointsBreakdown } from '../features/scoring'
import type { ScoreEvent } from '../domain/tournament/scoreEvents'
import {
  RoundSwitcher,
  TieCard,
  ChampionCard,
  type RoundKey,
  type TieSide,
} from '../features/bracket'
import { PlacedJokerCard } from '../features/predict/PlacedJokerCard'
import { GoldenBootPicker } from '../features/predict/GoldenBootPicker'
import { rankLeaderboard } from '../domain/tournament/rankLeaderboard'
import { LeaderboardRow } from '../features/league/LeaderboardRow'
import { LeagueMemberRow } from '../features/leagues/LeagueMemberRow'
import { MyLeagueCard } from '../features/leagues/MyLeagueCard'
import { LeaguePreviewCard } from '../features/leagues/LeaguePreviewCard'
import { InvitePanel } from '../features/leagues/InvitePanel'
import { LoginForm } from '../features/auth/LoginForm'
import { SeasonMatchesPage } from '../features/season/SeasonMatchesPage'
import { SeasonMatchCentre } from '../features/season/SeasonMatchCentre'
import { SeasonFixturePreview } from '../features/season/SeasonFixturePreview'
import { presentFixtureList } from '../features/season/fixtureListModel'
import type { MatchPredictorPage } from '../features/season/matchPredictorModel'
import { mapSeasonFixtureList } from '../services/supabase/seasonFixtureListModel'
import {
  mapClubHeadToHead,
  mapSeasonClubForm,
} from '../services/supabase/seasonClubFormModel'
import { ProviderReviewPanel } from '../features/admin/ProviderReviewPanel'
import { mapProviderReviewQueues } from '../services/supabase/providerReviewQueuesModel'
import { resolveClubIdentity } from '../domain/clubIdentity/clubIdentityTokens'
import { SignUpForm } from '../features/auth/SignUpForm'
import { ResetRequestForm } from '../features/auth/ResetRequestForm'
import { UpdatePasswordForm } from '../features/auth/UpdatePasswordForm'
import { TurnstileWidget } from '../features/auth/TurnstileWidget'
import { WelcomeScreen } from '../features/welcome/WelcomeScreen'
import { ProfileScreen } from '../features/profile/ProfileScreen'
import { H2HScreen } from '../features/h2h/H2HScreen'
import { MatchCentreScreen } from '../features/matches/MatchCentreScreen'
import { matchCentreLifecycleContent } from '../domain/tournament/matchCentreLifecycleContent'
import { presentMatchLifecycle } from '../domain/tournament/matchCentrePresentation'
import { MatchesScreen } from '../features/matches/MatchesScreen'
import { StatStrip } from '../features/home/StatStrip'
import { TodayCard } from '../features/home/TodayCard'
import { CatchUpLine } from '../features/home/CatchUpLine'
import { LeagueSnapshot } from '../features/home/LeagueSnapshot'
import type { TodaySection } from '../features/home/useHomeData'

// Sample data — real flag-icons codes so the outline is visible on white-heavy
// flags (England). This is a dev harness only; no domain logic here.
const ENG = { name: 'England', countryCode: 'gb-eng' }
const SCO = { name: 'Scotland', countryCode: 'gb-sct' }
const WAL = { name: 'Wales', countryCode: 'gb-wls' }
const ESP = { name: 'Spain', countryCode: 'es' }
const FRA = { name: 'France', countryCode: 'fr' }
const GER = { name: 'Germany', countryCode: 'de' }
const ITA = { name: 'Italy', countryCode: 'it' }
const POR = { name: 'Portugal', countryCode: 'pt' }

// Sample scored events for the Points breakdown — a plausible mid-tournament
// slice: exact scores, a jokered match (gold pill), a group order, knockout
// progression. Awards stays empty so the "0 · pending" category shows.
const SAMPLE_SCORE_EVENTS: ScoreEvent[] = [
  {
    id: 'gm1',
    category: 'group_matches',
    explanation: 'Sco 2–1 Eng · exact score',
    flag: SCO,
    points: 5,
  },
  {
    id: 'gm2',
    category: 'group_matches',
    explanation: 'Esp 3–1 Ita · correct result',
    flag: ESP,
    points: 3,
  },
  {
    id: 'gm3',
    category: 'group_matches',
    explanation: 'Fra 2–0 Ger · exact score',
    flag: FRA,
    points: 10,
    joker: true,
  },
  {
    id: 'gm4',
    category: 'group_matches',
    explanation: 'Por 0–2 Wal · wrong',
    flag: POR,
    points: 0,
  },
  {
    id: 'gp1',
    category: 'group_positions',
    explanation: 'Group A · full order correct',
    points: 13,
  },
  {
    id: 'ko1',
    category: 'knockout',
    explanation: 'Spain · reached the semi-finals',
    flag: ESP,
    points: 45,
  },
]

/**
 * Club marks for the gallery. Hand-written rather than resolved, because the
 * gallery's job is to show the component's states — including ones the resolver
 * would never produce, such as a pattern with no secondary colour.
 *
 * The patterned and dark-monogram entries match the reviewed overlay so the
 * gallery and the resolver do not drift into showing different things.
 */
const CLUB: Record<string, ClubIdentityTokens> = {
  ARS: { monogram: 'ARS', primary: '#EF0107' },
  NEW: { monogram: 'NEW', primary: '#241F20', secondary: '#FFFFFF', pattern: 'stripes' },
  CEL: { monogram: 'CEL', primary: '#018749', secondary: '#FFFFFF', pattern: 'hoops' },
  CRY: { monogram: 'CRY', primary: '#1B458F', secondary: '#C4122E', pattern: 'sash' },
  BRE: { monogram: 'BRE', primary: '#E30613', secondary: '#FFFFFF', pattern: 'stripes' },
  WBA: { monogram: 'WBA', primary: '#122F67', secondary: '#FFFFFF', pattern: 'halves' },
  // Light primaries: the monogram must go dark or it is unreadable.
  MCI: { monogram: 'MCI', primary: '#6CABDD', onPrimary: 'dark' },
  WOL: { monogram: 'WOL', primary: '#FDB913', onPrimary: 'dark' },
  TOT: { monogram: 'TOT', primary: '#FFFFFF', onPrimary: 'dark' },
  LIV: { monogram: 'LIV', primary: '#C8102E' },
  CHE: { monogram: 'CHE', primary: '#034694' },
  EVE: { monogram: 'EVE', primary: '#003399' },
  MUN: { monogram: 'MUN', primary: '#DA291C' },
  AVL: { monogram: 'AVL', primary: '#95BFE5', secondary: '#670E36', onPrimary: 'dark' },
  WHU: { monogram: 'WHU', primary: '#7A263A' },
  BHA: { monogram: 'BHA', primary: '#0057B8' },
  FUL: { monogram: 'FUL', primary: '#FFFFFF', onPrimary: 'dark' },
  NFO: { monogram: 'NFO', primary: '#DD0000' },
  BOU: { monogram: 'BOU', primary: '#DA291C' },
  LEI: { monogram: 'LEI', primary: '#003090' },
  SOU: { monogram: 'SOU', primary: '#D71920' },
  IPS: { monogram: 'IPS', primary: '#3A64A3' },
  RAN: { monogram: 'RAN', primary: '#1B458F' },
  HEA: { monogram: 'HEA', primary: '#7D2B36' },
  HIB: { monogram: 'HIB', primary: '#005E38' },
  ABE: { monogram: 'ABE', primary: '#E31B23' },
  // Degenerate: a pattern with no secondary colour. Must fall back to solid
  // rather than render a gradient against `undefined`.
  BAD: { monogram: 'BAD', primary: '#7A5FB0', pattern: 'stripes' },
}

const PREMIER_LEAGUE_ZONES: LeagueZone[] = [
  { from: 1, to: 1, kind: 'champion', label: 'Champions' },
  { from: 2, to: 4, kind: 'europe', label: 'Champions League' },
  { from: 5, to: 5, kind: 'playoff', label: 'Europa League' },
  { from: 18, to: 20, kind: 'relegation', label: 'Relegation' },
]

const PREMIER_LEAGUE_ROWS: LeagueTableRow[] = [
  { position: 1, name: 'Liverpool', club: CLUB.LIV, played: 38, goalDifference: 45, points: 84, movement: 'none' },
  { position: 2, name: 'Arsenal', club: CLUB.ARS, played: 38, goalDifference: 39, points: 81, movement: 'up' },
  { position: 3, name: 'Man City', club: CLUB.MCI, played: 38, goalDifference: 34, points: 76, movement: 'down' },
  { position: 4, name: 'Chelsea', club: CLUB.CHE, played: 38, goalDifference: 21, points: 69, movement: 'up' },
  { position: 5, name: 'Newcastle', club: CLUB.NEW, played: 38, goalDifference: 18, points: 66, movement: 'down' },
  { position: 6, name: 'Aston Villa', club: CLUB.AVL, played: 38, goalDifference: 9, points: 63, movement: 'none' },
  { position: 7, name: 'Nott’m Forest', club: CLUB.NFO, played: 38, goalDifference: 7, points: 61, movement: 'up' },
  { position: 8, name: 'Brighton', club: CLUB.BHA, played: 38, goalDifference: 4, points: 58, movement: 'down' },
  { position: 9, name: 'Bournemouth', club: CLUB.BOU, played: 38, goalDifference: 2, points: 55, movement: 'none' },
  { position: 10, name: 'Brentford', club: CLUB.BRE, played: 38, goalDifference: 0, points: 51, movement: 'up' },
  { position: 11, name: 'Fulham', club: CLUB.FUL, played: 38, goalDifference: -1, points: 48, movement: 'down' },
  { position: 12, name: 'Crystal Palace', club: CLUB.CRY, played: 38, goalDifference: -3, points: 47, movement: 'none' },
  { position: 13, name: 'Everton', club: CLUB.EVE, played: 38, goalDifference: -6, points: 44, movement: 'up' },
  { position: 14, name: 'Man United', club: CLUB.MUN, played: 38, goalDifference: -8, points: 42, movement: 'down' },
  { position: 15, name: 'Tottenham', club: CLUB.TOT, played: 38, goalDifference: -11, points: 39, movement: 'down' },
  { position: 16, name: 'West Ham', club: CLUB.WHU, played: 38, goalDifference: -17, points: 36, movement: 'up' },
  { position: 17, name: 'Wolves', club: CLUB.WOL, played: 38, goalDifference: -24, points: 33, movement: 'none' },
  { position: 18, name: 'Leicester', club: CLUB.LEI, played: 38, goalDifference: -31, points: 25, movement: 'down' },
  { position: 19, name: 'Ipswich', club: CLUB.IPS, played: 38, goalDifference: -38, points: 22, movement: 'none' },
  { position: 20, name: 'Southampton', club: CLUB.SOU, played: 38, goalDifference: -40, points: 12, movement: 'down' },
]

const SCOTTISH_ROWS: LeagueTableRow[] = [
  { position: 1, name: 'Celtic', club: CLUB.CEL, played: 33, goalDifference: 58, points: 79, movement: 'none' },
  { position: 2, name: 'Rangers', club: CLUB.RAN, played: 33, goalDifference: 34, points: 65, movement: 'none' },
  { position: 3, name: 'Hibernian', club: CLUB.HIB, played: 33, goalDifference: 12, points: 54, movement: 'up' },
  { position: 4, name: 'Aberdeen', club: CLUB.ABE, played: 33, goalDifference: 3, points: 48, movement: 'down' },
  { position: 5, name: 'Hearts', club: CLUB.HEA, played: 33, goalDifference: -2, points: 41, movement: 'up' },
  { position: 6, name: 'Dundee United', club: CLUB.WBA, played: 33, goalDifference: -5, points: 40, movement: 'down' },
  { position: 7, name: 'St Mirren', club: CLUB.EVE, played: 33, goalDifference: -9, points: 36, movement: 'none' },
  { position: 8, name: 'Motherwell', club: CLUB.WOL, played: 33, goalDifference: -14, points: 33, movement: 'up' },
  { position: 9, name: 'Kilmarnock', club: CLUB.BHA, played: 33, goalDifference: -18, points: 30, movement: 'down' },
  { position: 10, name: 'Ross County', club: CLUB.MUN, played: 33, goalDifference: -21, points: 27, movement: 'none' },
  { position: 11, name: 'Dundee', club: CLUB.NEW, played: 33, goalDifference: -25, points: 24, movement: 'down' },
  { position: 12, name: 'St Johnstone', club: CLUB.CHE, played: 33, goalDifference: -33, points: 18, movement: 'none' },
]

const SCOTTISH_ZONES: LeagueZone[] = [
  { from: 1, to: 1, kind: 'champion', label: 'Champions' },
  { from: 2, to: 3, kind: 'europe', label: 'European qualification' },
  { from: 11, to: 11, kind: 'playoff', label: 'Relegation play-off' },
  { from: 12, to: 12, kind: 'relegation', label: 'Relegation' },
]

/** Longest registered names, three-digit GD and three-digit points. */
const HOSTILE_ROWS: LeagueTableRow[] = [
  {
    position: 1,
    name: 'Wolverhampton Wanderers Football Club',
    club: CLUB.WOL,
    played: 138,
    goalDifference: 145,
    points: 384,
    movement: 'up',
  },
  {
    position: 2,
    name: 'Brighton & Hove Albion Football Club',
    club: CLUB.BHA,
    played: 138,
    goalDifference: 0,
    points: 201,
    movement: 'none',
  },
  {
    position: 3,
    name: 'West Bromwich Albion Football Club',
    club: CLUB.WBA,
    played: 138,
    goalDifference: -145,
    points: 100,
    movement: 'down',
  },
]


/**
 * A competition season's fixtures, as contract 139's read sends them.
 *
 * Deliberately not a tidy Saturday. It carries a rescheduled matchweek 3 match
 * sitting among matchweek 5's, a fixture in play with a provider score and no
 * official result, and a settled one — the three cases the day list, the
 * provisional rule and the Match Centre are each there to get right.
 */
const SEASON_ZONE = 'Europe/London'

const SEASON_FIXTURE_PAGE = mapSeasonFixtureList({
  competition: {
    id: 'season-1',
    name: 'Scottish Premiership',
    season_key: '2026-27',
    time_zone: SEASON_ZONE,
  },
  window: { from: '2026-08-01T00:00:00Z', to: '2026-08-22T00:00:00Z' },
  server_now: '2026-08-08T16:30:00Z',
  fixtures: [
    {
      id: 'sf-settled',
      kickoff_at: '2026-08-08T11:30:00Z',
      status: 'played',
      round: { id: 'r5', ordinal: 5, label: 'Matchweek 5' },
      home: { name: 'Celtic', short_code: 'CEL', club_colours: 'Green / White' },
      away: { name: 'Hibernian', short_code: 'HIB', club_colours: 'Green / White' },
      result: { home: 3, away: 1 },
      live: null,
    },
    {
      id: 'sf-live',
      kickoff_at: '2026-08-08T14:00:00Z',
      status: 'live',
      round: { id: 'r5', ordinal: 5, label: 'Matchweek 5' },
      home: { name: 'Rangers', short_code: 'RAN', club_colours: 'Blue / White' },
      away: { name: 'Aberdeen', short_code: 'ABE', club_colours: 'Red / White' },
      result: null,
      live: { kind: 'in_play', home: 2, away: 1, observed_at: '2026-08-08T15:12:00Z' },
    },
    {
      id: 'sf-rescheduled',
      kickoff_at: '2026-08-08T14:00:00Z',
      status: 'scheduled',
      round: { id: 'r3', ordinal: 3, label: 'Matchweek 3' },
      home: { name: 'Dundee', short_code: 'DUN', club_colours: 'Navy / White' },
      away: { name: 'Hearts', short_code: 'HEA', club_colours: 'Maroon / White' },
      result: null,
      live: null,
    },
    {
      id: 'sf-later',
      kickoff_at: '2026-08-09T15:00:00Z',
      status: 'scheduled',
      round: { id: 'r5', ordinal: 5, label: 'Matchweek 5' },
      home: { name: 'St Mirren', short_code: 'STM', club_colours: 'Black / White' },
      away: { name: 'Motherwell', short_code: 'MOT', club_colours: 'Claret / Amber' },
      result: null,
      live: null,
    },
  ],
})

const seasonFixtureGateway = { load: async () => SEASON_FIXTURE_PAGE }

const SEASON_ROWS = presentFixtureList(SEASON_FIXTURE_PAGE, SEASON_ZONE).days.flatMap(
  (day) => day.rows,
)
const seasonRow = (id: string) => {
  const found = SEASON_ROWS.find((row) => row.id === id)
  if (!found) throw new Error(`the gallery fixture ${id} is not in the season window`)
  return found
}
const seasonScoredRow = seasonRow('sf-settled')
const seasonLiveRow = seasonRow('sf-live')

const seasonClub = (name: string) => ({
  name,
  shortName: name,
  tokens: resolveClubIdentity({ externalId: name, name }),
})

/** The caller's own matchweek 5 card: an exact score on one, blank on another. */
const SEASON_CARD: MatchPredictorPage = {
  competition: { name: 'Scottish Premiership', seasonLabel: '2026/27', timeZone: SEASON_ZONE },
  matchweek: { number: 5, of: 38 },
  fixtures: [
    {
      fixtureId: 'sf-settled',
      kickoffAt: '2026-08-08T11:30:00Z',
      home: seasonClub('Celtic'),
      away: seasonClub('Hibernian'),
      prediction: { home: 3, away: 1 },
      result: { home: 3, away: 1 },
      points: null,
    },
    {
      fixtureId: 'sf-live',
      kickoffAt: '2026-08-08T14:00:00Z',
      home: seasonClub('Rangers'),
      away: seasonClub('Aberdeen'),
      prediction: { home: 2, away: 1 },
      result: null,
      points: null,
    },
  ],
  cardStatus: 'confirmed',
  lock: { status: 'locked', locked: true, lockAt: '2026-08-08T11:30:00Z', reason: 'match_kickoff_reached' },
  joker: { playedHere: true, remainingThisHalf: 4, playable: false },
  settledPoints: 24,
}

const seasonCardReader = async () => SEASON_CARD

/**
 * Contract 141's football beside the player's own side of the fixture: one club
 * with a run of results, one that has not played yet, and a meeting earlier in
 * the season. The second is the case that matters — a club with nothing settled
 * must not render as a row of empty pills, which reads as defeats.
 */
const SEASON_CLUB_FORM = mapSeasonClubForm({
  server_now: '2026-08-08T16:30:00Z',
  matches: 6,
  clubs: [
    {
      team_id: 't-celtic',
      name: 'Celtic',
      short_code: 'CEL',
      club_colours: 'Green / White',
      played: 6,
      won: 4,
      drawn: 1,
      lost: 1,
      goals_for: 13,
      goals_against: 6,
      form: ['W', 'W', 'D', 'L', 'W', 'W'],
    },
    {
      team_id: 't-hibs',
      name: 'Hibernian',
      short_code: 'HIB',
      club_colours: 'Green / White',
      played: 6,
      won: 2,
      drawn: 2,
      lost: 2,
      goals_for: 7,
      goals_against: 8,
      form: ['L', 'D', 'W', 'W', 'D', 'L'],
    },
    {
      team_id: 't-rangers',
      name: 'Rangers',
      short_code: 'RAN',
      club_colours: 'Blue / White',
      played: 5,
      won: 3,
      drawn: 1,
      lost: 1,
      goals_for: 11,
      goals_against: 5,
      form: ['W', 'W', 'D', 'W', 'L'],
    },
    {
      team_id: 't-aberdeen',
      name: 'Aberdeen',
      short_code: 'ABE',
      club_colours: 'Red / White',
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      form: [],
    },
  ],
})

const SEASON_FORM_BY_NAME = new Map(
  SEASON_CLUB_FORM.clubs.map((club) => [club.name, club] as const),
)

const SEASON_FORM_BY_ID = new Map(
  SEASON_CLUB_FORM.clubs.map((club) => [club.teamId, club] as const),
)

/**
 * The caller's current Last Man Standing round, so both panels can show a
 * different stake: one fixture holds their pick, the other is in the same round
 * and does not. Those are the two sentences worth a picture.
 */
const SEASON_LMS_ROUND = {
  available: true,
  entered: true,
  entryOutcome: 'active' as const,
  round: {
    windowId: 'w5',
    sequence: 5,
    label: 'Round 5',
    opensAt: '2026-08-05T09:00:00Z',
    locksAt: '2026-08-08T11:00:00Z',
  },
  fixtures: [
    {
      fixtureId: 'sf-settled',
      kickoffAt: '2026-08-08T11:30:00Z',
      status: 'played',
      home: { teamId: 't-celtic', name: 'Celtic', used: false },
      away: { teamId: 't-hibs', name: 'Hibernian', used: false },
      score: { home: 3, away: 1 },
    },
    {
      fixtureId: 'sf-live',
      kickoffAt: '2026-08-08T14:00:00Z',
      status: 'live',
      home: { teamId: 't-rangers', name: 'Rangers', used: false },
      away: { teamId: 't-aberdeen', name: 'Aberdeen', used: false },
      score: null,
    },
  ],
  pick: { teamId: 't-rangers' },
  pickOutcome: null,
}

const seasonFootball = {
  lmsRound: SEASON_LMS_ROUND,
  formFor: (name: string) => SEASON_FORM_BY_NAME.get(name) ?? null,
  /**
   * Answers for the PAIR it was asked about, rather than returning one fixed
   * meeting. The first draft did the latter and the gallery rendered "Rangers ·
   * Matchweek 1 · won 2 - 0" under the headline "Celtic and Hibernian have met
   * once this season" — a fixture stub telling two stories about one result.
   * The panel no longer allows that (the club name comes from the read), and
   * the harness should not model it either.
   */
  headToHead: async (teamId: string, opponentId: string) => {
    const team = SEASON_FORM_BY_ID.get(teamId)
    const opponent = SEASON_FORM_BY_ID.get(opponentId)
    const met = (team?.played ?? 0) > 0 && (opponent?.played ?? 0) > 0

    return mapClubHeadToHead({
      team: { team_id: teamId, name: team?.name ?? 'Home' },
      opponent: { team_id: opponentId, name: opponent?.name ?? 'Away' },
      summary: met
        ? { played: 1, won: 1, drawn: 0, lost: 0, goals_for: 2, goals_against: 0 }
        : { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0 },
      meetings: met
        ? [
            {
              season_fixture_id: 'sf-earlier',
              kickoff_at: '2026-08-01T14:00:00Z',
              at_home: false,
              goals_for: 2,
              goals_against: 0,
              outcome: 'W',
              round: 'Matchweek 1',
            },
          ]
        : [],
    })
  },
}

/** Contract 138's queues: one section with work, and everything clear. */
const PROVIDER_QUEUES_CLEAR = {
  competition: { id: 'season-1', name: 'Scottish Premiership', season_key: '2026-27' },
  limit: 20,
  result_refusals: { unreviewed: 0, items: [] },
  status_observations: { unreviewed: 0, items: [] },
  consumption_problems: { unreviewed: 0, items: [] },
  kickoff_revisions: { unreviewed: 0, items: [] },
  window_conflicts: { unreviewed: 0, items: [] },
  pending_calendar_proposals: 0,
  recent_result_changes: [],
}

const PROVIDER_QUEUES_BUSY = {
  ...PROVIDER_QUEUES_CLEAR,
  result_refusals: {
    unreviewed: 4,
    items: [
      {
        id: 'rr-1',
        reason: 'protected_confirmation',
        provider: 'sportmonks',
        provider_status: 'FT',
        detail: {},
        refused_at: '2026-08-08T16:00:00Z',
        fixture: {
          id: 'sf-live',
          home: 'Rangers',
          away: 'Aberdeen',
          kickoff_at: '2026-08-08T14:00:00Z',
        },
      },
    ],
  },
  window_conflicts: {
    unreviewed: 1,
    items: [
      {
        id: 'wc-1',
        round: 'Matchweek 5',
        blocked_by: 'Matchweek 6',
        detected_at: '2026-08-08T10:00:00Z',
      },
    ],
  },
  pending_calendar_proposals: 380,
}

/**
 * Fixture data for the two game panels. Fixed, so the screenshots are
 * deterministic, and shaped exactly like what the models return.
 */
const LMS_FORM_GUIDE: LmsFormGuide = {
  empty: false,
  rows: [
    {
      teamId: 't-celtic',
      name: 'Celtic',
      picked: false,
      used: false,
      opponent: 'Rangers',
      summary: {
        letters: ['W', 'W', 'W', 'D', 'W'],
        record: 'Won 4, drawn 1, lost 0 of the last 5',
        goalDifference: '+9',
        played: 5,
      },
    },
    {
      teamId: 't-hearts',
      name: 'Hearts',
      picked: true,
      used: false,
      opponent: 'Hibernian',
      summary: {
        letters: ['W', 'D', 'L', 'W', 'D'],
        record: 'Won 2, drawn 2, lost 1 of the last 5',
        goalDifference: '+1',
        played: 5,
      },
    },
    {
      teamId: 't-rangers',
      name: 'Rangers',
      picked: false,
      used: true,
      opponent: 'Celtic',
      summary: {
        letters: ['L', 'W', 'D'],
        record: 'Won 1, drawn 1, lost 1 of the last 3',
        goalDifference: '0',
        played: 3,
      },
    },
    {
      teamId: 't-dundee',
      name: 'Dundee United',
      picked: false,
      used: false,
      opponent: 'Aberdeen',
      summary: { letters: [], record: null, goalDifference: null, played: 0 },
    },
  ],
}

const CONSENSUS_READY: SeasonConsensus = {
  suppressed: false,
  matchweek: 2,
  minimumEntries: 10,
  submittedEntries: 47,
  lockedAt: '2026-08-15T14:00:00.000Z',
  fixtures: [
    {
      id: 'fx-1',
      homeName: 'Celtic',
      awayName: 'Rangers',
      kickoffAt: '2026-08-15T14:00:00.000Z',
      resultHome: null,
      resultAway: null,
      predicted: 47,
      homeWin: 30,
      draw: 11,
      awayWin: 6,
      shares: { homeWin: 64, draw: 23, awayWin: 13 },
      topScores: [
        { home: 2, away: 1, picks: 21 },
        { home: 1, away: 0, picks: 15 },
        { home: 2, away: 0, picks: 11 },
      ],
    },
  ],
}

const CONSENSUS_SUPPRESSED: SeasonConsensus = {
  ...CONSENSUS_READY,
  suppressed: true,
  submittedEntries: 6,
  fixtures: [],
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section} data-section={sectionAnchor(title)}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.stack}>{children}</div>
    </section>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <span className={styles.label}>{children}</span>
}

function ScoreInputDemo() {
  const [v, setV] = useState<number | null>(2)
  return <ScoreInput value={v} ariaLabel="Home score" onChange={setV} />
}

// Home exists as a stub; every other section is not built yet and routes to a
// "coming soon" EmptyState (per the design-system brief).
const COMING_SOON: Record<Exclude<NavKey, 'home'>, string> = {
  predict: 'Predict',
  matches: 'Matches',
  league: 'League',
  more: 'More',
}

// Draws a shareable card to a visible canvas (the ShareSheet uses the same
// renderer inside a modal). Hostile data — accented/emoji-free, real flags.
function ShareCardDemo({ model, variant }: { model: ShareCardModel; variant: ShareVariant }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) void renderShareCard(ref.current, model, variant)
  }, [model, variant])
  return (
    <canvas
      ref={ref}
      width={1080}
      height={1080}
      style={{ width: '100%', maxWidth: 300, aspectRatio: '1', borderRadius: 14, border: '1px solid var(--line)' }}
    />
  )
}

const SHARE_MODEL: ShareCardModel = {
  header: { playerName: 'Søren Kjær-Nielsen', locked: true },
  champion: { name: 'Spain', countryCode: 'es' },
  finalists: [
    { name: 'Spain', countryCode: 'es' },
    { name: 'France', countryCode: 'fr' },
  ],
  venue: 'Wembley, London',
  dateLabel: '9 Jul 2028',
  stats: { goalsPredicted: 89, jokersArmed: 5 },
  awards: { goldenBootName: 'Kylian Mbappé', groupGoals: 89 },
  survivors: [
    { stage: 'R16', teams: [{ name: 'Spain', countryCode: 'es' }, { name: 'France', countryCode: 'fr' }, { name: 'Germany', countryCode: 'de' }, { name: 'Italy', countryCode: 'it' }, { name: 'Scotland', countryCode: 'gb-sct' }, { name: 'England', countryCode: 'gb-eng' }, { name: 'Croatia', countryCode: 'hr' }, { name: 'Portugal', countryCode: 'pt' }] },
    { stage: 'QF', teams: [{ name: 'Spain', countryCode: 'es' }, { name: 'France', countryCode: 'fr' }, { name: 'Germany', countryCode: 'de' }, { name: 'England', countryCode: 'gb-eng' }] },
    { stage: 'SF', teams: [{ name: 'Spain', countryCode: 'es' }, { name: 'France', countryCode: 'fr' }] },
  ],
  brag: { points: 112, rank: 89, total: 2140 },
  url: 'euro28predictor.com',
}

/**
 * The persistent desktop rail, at both widths, out of its media query.
 *
 * IT IS RENDERED HERE UNCONDITIONALLY. In the application the rail is hidden
 * below 1024px by `PageShell`, which means a gallery panel — 340px wide, or 390
 * pinned — would never show it at all. The component itself carries no width
 * rule, so mounting it directly is the honest way to review it, and reviewing
 * both states side by side is the only way to see that a collapsed link still
 * has a name.
 *
 * The destinations are the real ones, from the same `railGroups` the shell
 * calls, so a change to the catalogue or the route authority shows up here
 * rather than in a copy that quietly stops matching.
 */
function SideRailDemo() {
  const [collapsed, setCollapsed] = useState(false)
  // THE TWENTY-COMPETITION PLATFORM, not the two-competition one. The binding
  // scalability requirement is that seventeen extra published competitions do
  // not make ordinary navigation noisy, and the only way to see whether the
  // rail holds it is to render it against that catalogue. The player plays in
  // three; the rail should show three rows and one Explore link.
  const player = twentyCompetitionPlayer()
  return (
    <div className={styles.railFrame}>
      <SideRail
        groups={railGroups(player)}
        pathname="/competitions/premier-league/2026-27/games/lms"
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
      />
      <SideRail
        groups={railGroups(player)}
        pathname="/"
        collapsed
        onToggleCollapsed={() => {}}
      />
    </div>
  )
}

/**
 * The onboarding steps, driven by a real draft.
 *
 * STATEFUL ON PURPOSE. The whole point of these components is the separation
 * between following, joining and favouriting, and that separation is only
 * visible when the controls actually move: press a competition and no game
 * appears; press Apply to all and the review changes. A static render of four
 * steps would photograph the layout and prove nothing about the rule.
 *
 * IT IS NOT A LIVE JOURNEY. There is no step sequencer, no Finish and no
 * persistence — the review step is rendered without `onFinish`, so it says in
 * words that nothing is saved. `MIG-UI-10` owns that; until it lands, wiring
 * this into first sign-in would collect three decisions and lose them on
 * refresh, which is worse than not asking.
 */
function OnboardingDemo() {
  const player = twentyCompetitionPlayer()
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    toggleFollowed(EMPTY_DRAFT, ONBOARDING_GAME_OFFERS[0]?.key ?? ''),
  )
  return (
    <>
      <Label>twenty published competitions, three followed by the fixture player</Label>
      <OnboardingCompetitionStep
        player={player}
        draft={draft}
        onToggle={(key) => setDraft((current) => toggleFollowed(current, key))}
      />
      <Label>reading the catalogue</Label>
      <OnboardingCompetitionStep player={null} draft={EMPTY_DRAFT} onToggle={() => {}} />
      <Label>catalogue read failed</Label>
      <OnboardingCompetitionStep player={null} failed draft={EMPTY_DRAFT} onToggle={() => {}} />
      <Label>nothing published yet</Label>
      <OnboardingCompetitionStep
        player={presentPlayerCompetitions([], [], undefined, [])}
        draft={EMPTY_DRAFT}
        onToggle={() => {}}
      />
      <Label>a published competition this build cannot open (MIG-UI-12)</Label>
      <OnboardingCompetitionStep
        player={presentPlayerCompetitions(HUB_COMPETITIONS, [], undefined, [
          {
            id: 'unroutable-demo',
            name: 'Bundesliga 2026/27',
            seasonKey: '2026-27',
            status: 'active',
            timeZone: 'Europe/Berlin',
          },
        ])}
        draft={EMPTY_DRAFT}
        onToggle={() => {}}
      />
    </>
  )
}

function OnboardingFavouriteDemo() {
  const [teamId, setTeamId] = useState<string | null>(null)
  return (
    <>
      <Label>optional, with a real skip</Label>
      <OnboardingFavouriteStep
        teams={ONBOARDING_TEAMS}
        selectedTeamId={teamId}
        onSelect={setTeamId}
      />
      <Label>no teams to choose from</Label>
      <OnboardingFavouriteStep teams={[]} selectedTeamId={null} onSelect={() => {}} />
    </>
  )
}

function OnboardingGamesDemo() {
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    let next = EMPTY_DRAFT
    for (const offer of ONBOARDING_GAME_OFFERS) next = toggleFollowed(next, offer.key)
    return next
  })
  return (
    <>
      <Label>three followed — bulk and per-competition</Label>
      <OnboardingGamesStep
        competitions={ONBOARDING_GAME_OFFERS}
        draft={draft}
        onToggleGame={(key, game) => setDraft((current) => toggleGame(current, key, game))}
        onApplyToAll={(games) => setDraft((current) => applyGamesToAll(current, games))}
      />
      <Label>one competition — no mode switch, and one game already joined</Label>
      <OnboardingGamesStep
        competitions={ONBOARDING_GAME_OFFERS.slice(2)}
        draft={draft}
        onToggleGame={(key, game) => setDraft((current) => toggleGame(current, key, game))}
        onApplyToAll={() => {}}
      />
      <Label>no competition selected yet</Label>
      <OnboardingGamesStep
        competitions={[]}
        draft={EMPTY_DRAFT}
        onToggleGame={() => {}}
        onApplyToAll={() => {}}
      />
      <Label>the same draft, reviewed — nothing is saved</Label>
      <OnboardingReviewStep
        competitions={ONBOARDING_GAME_OFFERS}
        teams={ONBOARDING_TEAMS}
        draft={draft}
      />
    </>
  )
}

/**
 * The mobile bottom bar, photographed on its own.
 *
 * IT NEEDS ITS OWN SECTION BECAUSE THE GALLERY CANNOT SIMULATE A PHONE
 * VIEWPORT. `PageShell` hides the bar above 1024px, and that is a VIEWPORT
 * media query, while the gallery pins each panel's WIDTH in CSS — so the
 * runner's 1280px window puts both panels above the breakpoint and the
 * "PageShell + BottomNav" section photographs a shell with no bar in it. The
 * first runner render of the new baselines is what showed this: that section's
 * image lost the five tabs and shrank by a fifth.
 *
 * Rendering the component directly is the same thing `SideRailDemo` does for
 * the rail, and it restores the coverage rather than relaxing it: the bar's
 * five destinations, its selected state and both themes are back under a
 * baseline.
 */
function BottomNavDemo() {
  const [active, setActive] = useState<NavKey>('home')
  return (
    <div className={styles.bottomNavFrame}>
      <BottomNav active={active} onNavigate={setActive} />
    </div>
  )
}

function PageShellDemo() {
  const [active, setActive] = useState<NavKey>('home')
  const [demoTheme, setDemoTheme] = useState<'dark' | 'light'>('dark')
  return (
    <div className={styles.shellFrame}>
      <PageShell
        active={active}
        onNavigate={setActive}
        topBar={
          <AppBar
            context={active === 'home' ? 'Home' : COMING_SOON[active]}
            theme={demoTheme}
            onToggleTheme={() => setDemoTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            displayName="Dev Tester"
            onOpenProfile={() => {}}
          />
        }
      >
        {active === 'home' ? (
          <EmptyState
            icon={<InfoIcon size={22} />}
            title="Welcome to the predictor"
            description="Pick a tab below. Sections that aren't built yet show a coming-soon state."
          />
        ) : (
          <EmptyState
            title={`${COMING_SOON[active]} — coming soon`}
            description="This section arrives in a later tier of the build plan."
          />
        )}
      </PageShell>
    </div>
  )
}

function ModalDemo() {
  const [plainOpen, setPlainOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  return (
    <div className={styles.row}>
      <Button variant="secondary" onClick={() => setPlainOpen(true)}>
        Open modal
      </Button>
      <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
        Leave league…
      </Button>
      <Modal
        open={plainOpen}
        onClose={() => setPlainOpen(false)}
        title="How scoring works"
        footer={
          <Button variant="primary" onClick={() => setPlainOpen(false)}>
            Got it
          </Button>
        }
      >
        Exact score earns 5 points, correct result earns 3. Jokers double a
        match's points.
      </Modal>
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Leave this league?"
        confirmLabel="Leave league"
        destructive
      >
        You'll lose your place on the table and can only rejoin with a new
        invite.
      </ConfirmModal>
    </div>
  )
}

function ToastDemo() {
  const [open, setOpen] = useState(true)
  return (
    <div className={styles.stack}>
      {open ? (
        <Toast variant="success" message="Prediction saved." onDismiss={() => setOpen(false)} />
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Show toast
        </Button>
      )}
    </div>
  )
}

function TextInputDemo() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  return (
    <div className={styles.stack}>
      <TextInput
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextInput
        label="Display name"
        hint="Shown on league tables."
        value=""
        onChange={() => {}}
      />
      <TextInput
        label="Password"
        type="password"
        placeholder="••••••••"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      <TextInput
        label="Email"
        type="email"
        value="not-an-email"
        onChange={() => {}}
        error="Enter a valid email address."
      />
    </div>
  )
}

function JokerToggleDemo() {
  const [state, setState] = useState<JokerButtonState>('available')
  return (
    <JokerButton state={state} onToggle={() => setState((s) => (s === 'available' ? 'on' : 'available'))} />
  )
}

function EditableCardDemo() {
  // Starts empty (accent borders) so this card is the live surface for the §5
  // keyboard flow: type one digit in home → focus jumps to away → one more → done,
  // and each box calms from accent to --line as it fills.
  const [home, setHome] = useState<number | null>(null)
  const [away, setAway] = useState<number | null>(null)
  const [joker, setJoker] = useState<'available' | 'on'>('available')
  return (
    <MatchCard
      state="editable"
      group="A"
      matchday={2}
      date="14 Jun"
      venue="Cardiff"
      venueCountryCode="gb-wls"
      home={SCO}
      away={WAL}
      homeScore={home}
      awayScore={away}
      onHomeScoreChange={setHome}
      onAwayScoreChange={setAway}
      saveStatus="saved"
      jokerState={joker}
      onToggleJoker={() => setJoker((j) => (j === 'available' ? 'on' : 'available'))}
    />
  )
}

function TieResolverDemo() {
  const teams: TieResolverTeam[] = [
    { id: 'ger', name: 'Germany', countryCode: 'de' },
    { id: 'ita', name: 'Italy', countryCode: 'it' },
  ]
  const [resolved, setResolved] = useState(false)
  return (
    <TieResolver
      title="Group A"
      reason="These teams can't be split by predicted results — in the real tournament this would come down to things like disciplinary records that can't be predicted. Choose the order you expect."
      teams={teams}
      resolved={resolved}
      saveStatus={resolved ? 'saved' : 'idle'}
      onResolve={() => setResolved(true)}
    />
  )
}

// Bracket tie sides. Real teams pre-draw have no flag (empty countryCode), same
// as the live app, so these use the placeholder-flag look throughout.
const sideEng: TieSide = { kind: 'team', teamId: 'eng', name: 'England', countryCode: 'gb-eng' }
const sideEsp: TieSide = { kind: 'team', teamId: 'esp', name: 'Spain', countryCode: 'es' }
const placeholderSide: TieSide = {
  kind: 'placeholder',
  feederRef: 'R16-3',
  label: 'Winner R16 · Newcastle tie',
}

function RoundSwitcherDemo() {
  const [active, setActive] = useState<RoundKey>('R16')
  return (
    <RoundSwitcher
      active={active}
      onSelect={setActive}
      rounds={[
        { key: 'R16', label: 'R16', picked: 8, total: 8 },
        { key: 'QF', label: 'QF', picked: 3, total: 4 },
        { key: 'SF', label: 'SF', picked: 0, total: 2 },
        { key: 'FINAL', label: 'Final', picked: 0, total: 1 },
      ]}
    />
  )
}

function TieCardPickDemo() {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <TieCard
      provenance="R16 · Winner A v Runner-up C"
      date="24 Jun"
      venue="Cardiff"
      venueCountryCode="gb-wls"
      home={sideEng}
      away={sideEsp}
      pickedTeamId={picked}
      onPick={setPicked}
    />
  )
}

// Hostile-data league members (design-system §6 hostile-data rule): 20+ members,
// longest plausible names, ties, the user mid-table, non-submitters. Ranked with
// the real domain (rankLeaderboard) so shared ranks + null-pre-results are honest.
const LEAGUE_MEMBERS = [
  { userId: 'u1', displayName: 'The Undisputed Champion Of All Groups', totalPoints: 148, latest: 22, isYou: false, hasEntry: true },
  { userId: 'u2', displayName: 'Anne-Marie Ndlovu-Okonkwo', totalPoints: 142, latest: 18, isYou: false, hasEntry: true },
  { userId: 'u3', displayName: 'Zoë Müller', totalPoints: 142, latest: 18, isYou: false, hasEntry: true },
  { userId: 'u4', displayName: 'xX_Predictor_Xx', totalPoints: 131, latest: 12, isYou: true, hasEntry: true },
  { userId: 'u5', displayName: 'Ng', totalPoints: 131, latest: 12, isYou: false, hasEntry: true },
  { userId: 'u6', displayName: "O'Sullivan", totalPoints: 96, latest: 6, isYou: false, hasEntry: true },
  { userId: 'u7', displayName: 'Al', totalPoints: 0, latest: null, isYou: false, hasEntry: false, predictedCount: 12 },
  { userId: 'u8', displayName: 'María-José da Silva', totalPoints: 0, latest: null, isYou: false, hasEntry: false, predictedCount: 0 },
]

function LeagueMembersDemo({ revealed }: { revealed: boolean }) {
  const [expanded, setExpanded] = useState<string | null>('u4')
  const ranked = rankLeagueMembersDemo(LEAGUE_MEMBERS)
  return (
    <div className={styles.leagueTable}>
      {ranked.map((m) => (
        <LeagueMemberRow
          key={m.userId}
          rank={m.rank}
          name={m.displayName}
          totalPoints={m.totalPoints}
          latestPoints={m.latest}
          isYou={m.isYou}
          movement={m.rank === 1 ? 'up' : m.userId === 'u5' ? 'down' : 'none'}
          hasEntry={m.hasEntry}
          progress={
            !m.hasEntry && !revealed ? { predicted: m.predictedCount ?? 0, total: 36 } : null
          }
          championPick={revealed && m.hasEntry ? (m.userId === 'u1' ? ESP : ENG) : undefined}
          championEliminated={revealed && m.userId === 'u2'}
          expanded={expanded === m.userId}
          onToggle={() => setExpanded((c) => (c === m.userId ? null : m.userId))}
          revealed={revealed}
          stats={{ exact: 9, correct: 14, maxLeft: 512 }}
          onProfile={() => {}}
          onHeadToHead={() => {}}
        />
      ))}
    </div>
  )
}

// Local copy of the ranking call so the demo carries the extra member fields.
function rankLeagueMembersDemo<T extends { displayName: string; totalPoints: number; isYou: boolean }>(
  rows: T[],
) {
  return rankLeaderboard(rows)
}

// Hostile-data Home fixtures for the Today card. Longest plausible team names,
// live + upcoming + full-time rows, a missing prediction.
const HOME_FIXTURE = (over: Partial<import('../features/home/useHomeData').TodayFixture> = {}) => ({
  matchId: Math.random().toString(),
  matchRef: 'GA-1',
  group: 'A',
  matchday: 1,
  home: SCO,
  away: ENG,
  kickoffAt: '2028-06-14T19:00:00Z',
  matchDate: '2028-06-14',
  prediction: { home: 2, away: 1 },
  result: null,
  live: false,
  ...over,
})

const TODAY_LIVE: TodaySection = {
  kind: 'today',
  anyLive: true,
  fixtures: [
    HOME_FIXTURE({ live: true, result: { home: 1, away: 0 }, home: SCO, away: ENG }),
    HOME_FIXTURE({ kickoffAt: '2028-06-14T16:00:00Z', home: ESP, away: ITA, prediction: null }),
    HOME_FIXTURE({ result: { home: 2, away: 2 }, home: FRA, away: GER, prediction: { home: 1, away: 2 } }),
  ],
}
const TODAY_NEXT: TodaySection = {
  kind: 'next',
  dateISO: '2028-06-09',
  fixtures: [HOME_FIXTURE({ home: WAL, away: POR, prediction: { home: 0, away: 3 } })],
}

const RAMP_STEPS = Array.from({ length: 12 }, (_, index) => index + 1)

const TYPE_STEPS = [
  { step: 1, use: 'Micro label, legal' },
  { step: 2, use: 'Secondary body, table cells' },
  { step: 3, use: 'Body' },
  { step: 4, use: 'Section heading' },
  { step: 5, use: 'Page heading, scoreline' },
  { step: 6, use: 'Masthead, stat moment' },
] as const

/**
 * The target foundations, on screen and side by side with the palette in force.
 *
 * These tokens are deliberately consumed by nothing in production yet. A ramp
 * is reviewable as twelve swatches in a row and effectively unreviewable as
 * twenty-four hex values in a stylesheet, so it is rendered here first and
 * adopted afterwards, one component at a time.
 */
function Foundations() {
  return (
    <>
      <Section title="Target — neutral ramp (12 steps)">
        <div className={styles.rampGrid}>
          {RAMP_STEPS.map((step) => (
            <div key={step} className={styles.rampSwatch}>
              <div
                className={styles.rampChip}
                style={{ background: `var(--n-${step})` }}
                aria-hidden="true"
              />
              <span className={styles.label}>n-{step}</span>
            </div>
          ))}
        </div>
        <Label>
          Ordered by contrast from step 1, so a step number means the same thing in both themes.
        </Label>
      </Section>

      <Section title="Target — surfaces, borders and text">
        <div className={styles.row}>
          {(['page', 'raised', 'sunken'] as const).map((level) => (
            <div
              key={level}
              className={styles.surfaceSample}
              style={{
                background: `var(--surface-${level})`,
                borderColor: 'var(--border-hairline)',
              }}
            >
              <span style={{ color: 'var(--text-1)' }}>surface-{level}</span>
              <span style={{ color: 'var(--text-2)' }}>secondary text</span>
              <span style={{ color: 'var(--text-3)' }}>tertiary text</span>
            </div>
          ))}
        </div>
        <Label>
          Every text step clears AA on every surface; hairlines come from the border ramp, never
          from a text or accent token.
        </Label>
      </Section>

      <Section title="Target — type scale and tabular numerals">
        {TYPE_STEPS.map(({ step, use }) => (
          <div key={step} className={styles.row}>
            <Label>fs-{step}</Label>
            <span
              style={{
                fontSize: `var(--fs-${step})`,
                letterSpacing:
                  step >= 5
                    ? 'var(--tracking-tight)'
                    : step === 1
                      ? 'var(--tracking-open)'
                      : 'var(--tracking-normal)',
                color: 'var(--tx)',
                fontFamily: step >= 5 ? 'var(--font-display)' : 'var(--font-body)',
              }}
            >
              {use}
            </span>
          </div>
        ))}
        <div className={styles.row}>
          <Label>tabular</Label>
          {/* The jitter this prevents is only visible when the digits change,
              so both rows are shown: same width, different values. */}
          <span style={{ fontVariantNumeric: 'var(--numeric)', color: 'var(--tx)' }}>
            111 · 8 · 100
          </span>
          <span style={{ fontVariantNumeric: 'var(--numeric)', color: 'var(--tx)' }}>
            999 · 3 · 128
          </span>
        </div>
      </Section>

      <Section title="Target — motion and layering">
        <div className={styles.row}>
          <Label>micro 120ms</Label>
          <Label>enter 180ms</Label>
          <Label>sheet 240ms</Label>
          <Label>signature 400ms</Label>
        </div>
        <Label>
          Ease-out entering, ease-in exiting. Reduced motion removes travel, not feedback.
        </Label>
        <div className={styles.row}>
          <Label>content → sticky → navigation → overlay → modal → toast</Label>
        </div>
      </Section>
    </>
  )
}

/** Every component in every state — rendered once per theme by ComponentsPreview. */
function Gallery() {
  return (
    <div className={styles.gallery}>
      <Foundations />

      <Section title="Button">
        <div className={styles.row}>
          <Label>primary</Label>
          <Button variant="primary">Save prediction</Button>
          <Button variant="primary" loading>
            Save prediction
          </Button>
          <Button variant="primary" disabled>
            Save prediction
          </Button>
        </div>
        <div className={styles.row}>
          <Label>secondary</Label>
          <Button variant="secondary">Cancel</Button>
          <Button variant="secondary" loading>
            Cancel
          </Button>
          <Button variant="secondary" disabled>
            Cancel
          </Button>
        </div>
        <div className={styles.row}>
          <Label>destructive</Label>
          <Button variant="destructive">Leave league</Button>
          <Button variant="destructive" loading>
            Leave league
          </Button>
        </div>
        <div className={styles.row}>
          <Label>full width</Label>
          <Button variant="primary" fullWidth>
            Continue
          </Button>
        </div>
      </Section>

      <Section title="TextInput">
        <TextInputDemo />
      </Section>

      <Section title="PageShell + BottomNav">
        <PageShellDemo />
      </Section>

      <Section title="Mobile bottom navigation">
        <BottomNavDemo />
      </Section>

      <Section title="Desktop navigation rail">
        <SideRailDemo />
      </Section>

      {/* The two game contextual panels. They live at route level in the
          application — the routes own the reads — so the DEV page harnesses
          never render them, and without a gallery section they would have no
          visual coverage in either theme at all. */}
      <Section title="LMS form guide panel">
        <SeasonLmsFormGuide guide={LMS_FORM_GUIDE} />
        <Label>no settled matches</Label>
        <SeasonLmsFormGuide guide={{ rows: LMS_FORM_GUIDE.rows, empty: true }} />
      </Section>

      <Section title="Fixture consensus panel">
        <Label>after lock</Label>
        <SeasonFixtureConsensus
          matchweek={2}
          fixtureId="fx-1"
          load={() => Promise.resolve(CONSENSUS_READY)}
        />
        <Label>short cohort</Label>
        <SeasonFixtureConsensus
          matchweek={2}
          fixtureId="fx-1"
          load={() => Promise.resolve(CONSENSUS_SUPPRESSED)}
        />
        <Label>failed</Label>
        <SeasonFixtureConsensus
          matchweek={2}
          fixtureId="fx-1"
          load={() => Promise.reject(new Error('network'))}
        />
      </Section>

      {/* First sign-in, as components. Mounted here rather than on a route
          because there is nowhere truthful to save the answers yet
          (MIG-UI-10), and a journey that asks three questions and forgets them
          would look finished while being worse than not asking. */}
      <Section title="Onboarding — choose competitions">
        <OnboardingDemo />
      </Section>

      <Section title="Onboarding — favourite team">
        <OnboardingFavouriteDemo />
      </Section>

      <Section title="Onboarding — games and review">
        <OnboardingGamesDemo />
      </Section>

      {/* Creating a private league. The gallery is the only place both the
          offer and the refusals are visible at once — a real player sees one
          game they can create and two they cannot, and the refusals are the
          part that is easy to get wrong. */}
      <Section title="Create a league journey">
        <CreateLeagueJourney
          journey={presentCreateJourney(twentyCompetitionPlayer())}
          create={async (_id, leagueName) => ({
            id: 'demo',
            name: leagueName,
            inviteCode: 'ABC234',
          })}
          onCancel={() => {}}
        />
        <Label>nothing joined yet — every game refused, with the reason</Label>
        <CreateLeagueJourney
          journey={presentCreateJourney(null)}
          create={async () => ({ id: 'demo', name: 'demo', inviteCode: 'ABC234' })}
          onCancel={() => {}}
        />
      </Section>

      <Section title="Game rules disclosure">
        <GameRulesDisclosure rules={seasonGameRules('main_predictor')} defaultOpen />
        <GameRulesDisclosure rules={seasonGameRules('last_man_standing')} defaultOpen />
        <GameRulesDisclosure rules={seasonGameRules('predictor_cup')} />
      </Section>

      <Section title="Masthead">
        <Masthead>
          <div>
            <span style={{ display: 'block' }}>Football Prediction Hub</span>
            <h3 style={{ margin: 0 }}>Choose your competition</h3>
          </div>
        </Masthead>
      </Section>

      <Section title="EmptyIllustration">
        <Label>list</Label>
        <EmptyIllustration variant="list" />
        <Label>complete</Label>
        <EmptyIllustration variant="complete" />
      </Section>

      <Section title="ProgressBar">
        <ProgressBar value={18} max={36} label="Predictions" showValue />
        <ProgressBar value={100} max={100} label="Group A" showValue />
        <ProgressBar value={0} max={36} ariaLabel="Predictions complete" />
      </Section>

      <Section title="StatusBadge">
        <div className={styles.row}>
          <StatusBadge variant="locked" />
          <StatusBadge variant="live" />
          <StatusBadge variant="submitted" />
        </div>
      </Section>

      <Section title="Modal">
        <ModalDemo />
      </Section>

      <Section title="Alert">
        <Alert variant="info">Deadlines are shown in your local time.</Alert>
        <Alert variant="success" title="Predictions submitted">
          Your group-stage picks are locked in.
        </Alert>
        <Alert variant="warning">Entry closes in 2 hours — unsaved picks won't count.</Alert>
        <Alert variant="error" title="Couldn't save" onDismiss={() => {}}>
          Check your connection and try again.
        </Alert>
      </Section>

      <Section title="Toast">
        <ToastDemo />
        <Toast variant="error" message="Save failed — retry." onDismiss={() => {}} />
        <Toast variant="info" message="You're back online." />
      </Section>

      <Section title="Skeleton">
        <div className={styles.row}>
          <Skeleton width={30} height={20} radius="input" />
          <Skeleton width={120} height={16} />
          <Skeleton width={44} height={44} radius="circle" />
        </div>
        <Skeleton lines={3} />
      </Section>

      <Section title="EmptyState">
        <EmptyState
          icon={<InfoIcon size={22} />}
          title="No predictions yet"
          description="Your group-stage picks will show up here once you start."
          action={<Button variant="primary">Start predicting</Button>}
        />
        <EmptyState title="Leagues — coming soon" description="Private leagues arrive in a later update." />
      </Section>

      <Section title="TeamFlag">
        <div className={styles.row}>
          <Label>card 30×20</Label>
          <TeamFlag countryCode="gb-eng" label="England" size="card" />
          <TeamFlag countryCode="fr" label="France" size="card" />
        </div>
        <div className={styles.row}>
          <Label>table 26×17</Label>
          <TeamFlag countryCode="es" label="Spain" size="table" />
          <TeamFlag countryCode="gb-eng" label="England" size="table" />
        </div>
        <div className={styles.row}>
          <Label>venue 18×12</Label>
          <TeamFlag countryCode="gb-wls" label="Cardiff (host venue)" size="venue" />
        </div>
      </Section>

      <Section title="ScoreInput">
        <div className={styles.row}>
          {/* Border signals state (§5, 2026-07-22 audit): empty = 1.5px accent
              "act here"; filled = 1px --line "settled". Type in the first box to
              watch it calm from accent to line. */}
          <Label>empty (accent)</Label>
          <ScoreInput value={null} ariaLabel="Empty score" onChange={() => {}} />
          <Label>filled (line)</Label>
          <ScoreInput value={2} ariaLabel="Filled score" onChange={() => {}} />
          <Label>interactive</Label>
          <ScoreInputDemo />
          <Label>locked</Label>
          <ScoreInput value={1} ariaLabel="Locked score" locked />
        </div>
      </Section>

      <Section title="JokerCounter">
        <div className={styles.row}>
          <Label>0 used</Label>
          <JokerCounter used={0} />
        </div>
        <div className={styles.row}>
          <Label>2 used</Label>
          <JokerCounter used={2} />
        </div>
        <div className={styles.row}>
          <Label>all used</Label>
          <JokerCounter used={5} />
        </div>
      </Section>

      <Section title="JokerButton">
        <div className={styles.row}>
          <Label>available</Label>
          <JokerButton state="available" />
          <Label>on</Label>
          <JokerButton state="on" />
          <Label>toggle</Label>
          <JokerToggleDemo />
        </div>
      </Section>

      <Section title="MatchCard — editable">
        <EditableCardDemo />
        <MatchCard
          state="editable"
          group="B"
          matchday={1}
          date="10 Jun"
          venue="Manchester"
          venueCountryCode="gb-eng"
          home={ENG}
          away={ESP}
          homeScore={1}
          awayScore={1}
          saveStatus="saving"
          // Editable, so the steppers appear with `−` ENABLED. The card above
          // covers the empty box where `−` is at its floor; without a filled
          // one the baseline would never photograph the live state of the
          // control this section exists to show.
          onHomeScoreChange={() => {}}
          onAwayScoreChange={() => {}}
        />
        <MatchCard
          state="editable"
          group="B"
          matchday={1}
          date="10 Jun"
          venue="Dublin"
          venueCountryCode="ie"
          home={GER}
          away={ITA}
          homeScore={0}
          awayScore={2}
          saveStatus="error"
          onRetrySave={() => {}}
        />
        <MatchCard
          state="editable"
          group="C"
          matchday={1}
          date="11 Jun"
          venue="Wembley"
          venueCountryCode="gb-eng"
          home={FRA}
          away={POR}
          homeScore={2}
          awayScore={0}
          saveStatus="saved"
          jokerState="on"
          onToggleJoker={() => {}}
        />
        <MatchCard
          state="editable"
          group="C"
          matchday={1}
          date="11 Jun"
          venue="Wembley"
          venueCountryCode="gb-eng"
          home={FRA}
          away={POR}
          homeScore={2}
          awayScore={0}
          saveStatus="idle"
          showChevron
          onOpen={() => {}}
        />
      </Section>

      <Section title="MatchCard — locked">
        <MatchCard
          state="locked"
          group="A"
          matchday={1}
          date="9 Jun"
          venue="Cardiff"
          venueCountryCode="gb-wls"
          home={SCO}
          away={WAL}
          homeScore={1}
          awayScore={1}
          countdown="2d 4h"
          jokerState="available"
          onToggleJoker={() => {}}
        />
      </Section>

      <Section title="MatchCard — scored">
        <MatchCard
          state="scored"
          group="A"
          matchday={1}
          date="9 Jun"
          venue="Cardiff"
          venueCountryCode="gb-wls"
          home={SCO}
          away={WAL}
          homeScore={2}
          awayScore={1}
          result={{ home: 2, away: 1 }}
          score={{ kind: 'exact', points: 5, joker: false }}
        />
        <MatchCard
          state="scored"
          group="B"
          matchday={1}
          date="10 Jun"
          venue="Manchester"
          venueCountryCode="gb-eng"
          home={ENG}
          away={ESP}
          homeScore={2}
          awayScore={0}
          result={{ home: 3, away: 1 }}
          score={{ kind: 'correct', points: 3, joker: false }}
        />
        <MatchCard
          state="scored"
          group="C"
          matchday={1}
          date="11 Jun"
          venue="Wembley"
          venueCountryCode="gb-eng"
          home={FRA}
          away={POR}
          homeScore={0}
          awayScore={0}
          result={{ home: 2, away: 1 }}
          score={{ kind: 'wrong', points: 0, joker: false }}
        />
        <MatchCard
          state="scored"
          group="A"
          matchday={2}
          date="14 Jun"
          venue="Cardiff"
          venueCountryCode="gb-wls"
          home={SCO}
          away={GER}
          homeScore={2}
          awayScore={1}
          result={{ home: 2, away: 1 }}
          score={{ kind: 'exact', points: 10, joker: true }}
          jokerState="committed"
        />
      </Section>

      <Section title="ClubMatchCard — editable / locked / scored">
        <ClubMatchCard
          state="editable"
          matchweek={5}
          kickoff="Sat 15:00"
          venue="Emirates Stadium"
          home={{ name: 'Arsenal', tokens: CLUB.ARS }}
          away={{ name: 'Newcastle', tokens: CLUB.NEW }}
          homeScore={2}
          awayScore={1}
          saveStatus="saved"
          // Editable means the score can be STEPPED as well as typed, and this
          // is the season card a player actually predicts on. The harness used
          // to omit the handlers, so the gallery showed a card no player sees
          // and the tap controls went unphotographed on the surface that
          // matters most.
          onHomeScoreChange={() => {}}
          onAwayScoreChange={() => {}}
        />
        <ClubMatchCard
          state="editable"
          matchweek={5}
          kickoff="Sat 15:00"
          home={{ name: 'Crystal Palace', tokens: CLUB.CRY }}
          away={{ name: 'Brentford', tokens: CLUB.BRE }}
          homeScore={null}
          awayScore={null}
          saveStatus="error"
          onRetrySave={() => {}}
          // Empty, so `−` sits at its floor and disabled — the other half of
          // the control's state, beside the filled card above.
          onHomeScoreChange={() => {}}
          onAwayScoreChange={() => {}}
        />
        <ClubMatchCard
          state="locked"
          matchweek={5}
          kickoff="Sat 17:30"
          home={{ name: 'Man City', tokens: CLUB.MCI }}
          away={{ name: 'Arsenal', tokens: CLUB.ARS }}
          homeScore={1}
          awayScore={1}
          countdown="24m"
        />
        <ClubMatchCard
          state="scored"
          matchweek={4}
          kickoff="Sat 15:00"
          home={{ name: 'Newcastle', tokens: CLUB.NEW }}
          away={{ name: 'Brentford', tokens: CLUB.BRE }}
          homeScore={2}
          awayScore={0}
          result={{ home: 2, away: 0 }}
          score={{ kind: 'exact', points: 5, jokerDoubled: false }}
        />
        <ClubMatchCard
          state="scored"
          matchweek={4}
          kickoff="Sun 14:00"
          home={{ name: 'Celtic', tokens: CLUB.CEL }}
          away={{ name: 'Crystal Palace', tokens: CLUB.CRY }}
          homeScore={1}
          awayScore={0}
          result={{ home: 3, away: 1 }}
          score={{ kind: 'correct', points: 6, jokerDoubled: true }}
        />
        <ClubMatchCard
          state="scored"
          matchweek={4}
          kickoff="Mon 20:00"
          home={{ name: 'West Brom', tokens: CLUB.WBA }}
          away={{ name: 'Man City', tokens: CLUB.MCI }}
          homeScore={2}
          awayScore={2}
          result={{ home: 0, away: 3 }}
          score={{ kind: 'wrong', points: 0, jokerDoubled: false }}
          showChevron
          onOpen={() => {}}
        />
      </Section>

      <Section title="GroupTable">
        <GroupTable
          caption="Group A"
          rows={[
            { position: 1, team: ESP, played: 3, goalDifference: 5, points: 9 },
            { position: 2, team: ITA, played: 3, goalDifference: 1, points: 4 },
            { position: 3, team: SCO, played: 3, goalDifference: -1, points: 4 },
            { position: 4, team: WAL, played: 3, goalDifference: -5, points: 1 },
          ]}
        />
      </Section>

      <Section title="ClubIdentity — patterns">
        <Label>solid · stripes · hoops · halves · sash</Label>
        <div className={styles.row}>
          <ClubIdentity name="Arsenal" tokens={CLUB.ARS} />
          <ClubIdentity name="Newcastle United" tokens={CLUB.NEW} />
          <ClubIdentity name="Celtic" tokens={CLUB.CEL} />
          <ClubIdentity name="West Bromwich Albion" tokens={CLUB.WBA} />
          <ClubIdentity name="Crystal Palace" tokens={CLUB.CRY} />
        </div>

        <Label>sizes — card 30 · table 26 · venue 18 · champion 38</Label>
        <div className={styles.row}>
          <ClubIdentity name="Newcastle United" tokens={CLUB.NEW} size="card" />
          <ClubIdentity name="Newcastle United" tokens={CLUB.NEW} size="table" />
          <ClubIdentity name="Newcastle United" tokens={CLUB.NEW} size="venue" />
          <ClubIdentity name="Newcastle United" tokens={CLUB.NEW} size="champion" />
        </div>

        <Label>onPrimary=&quot;dark&quot; — light primaries need a dark monogram</Label>
        <div className={styles.row}>
          <ClubIdentity name="Manchester City" tokens={CLUB.MCI} />
          <ClubIdentity name="Wolverhampton Wanderers" tokens={CLUB.WOL} />
          <ClubIdentity name="Tottenham Hotspur" tokens={CLUB.TOT} />
          <ClubIdentity name="Aston Villa" tokens={CLUB.AVL} />
        </div>

        <Label>hideMonogram — adjacent text already names the club</Label>
        <div className={styles.row}>
          <ClubIdentity name="Arsenal" tokens={CLUB.ARS} hideMonogram />
          <ClubIdentity name="Newcastle United" tokens={CLUB.NEW} hideMonogram />
          <ClubIdentity name="Manchester City" tokens={CLUB.MCI} hideMonogram />
        </div>

        <Label>
          degenerate — pattern with no secondary colour must fall back to solid, not render
          against undefined
        </Label>
        <div className={styles.row}>
          <ClubIdentity name="Pattern without secondary" tokens={CLUB.BAD} />
          <ClubIdentity name="Pattern without secondary" tokens={CLUB.BAD} size="champion" />
        </div>
      </Section>

      <Section title="LeagueTable — full twenty-row league">
        <LeagueTable
          caption="Premier League"
          rows={PREMIER_LEAGUE_ROWS}
          zones={PREMIER_LEAGUE_ZONES}
        />
      </Section>

      <Section title="LeagueTable — Scottish split after 6">
        <LeagueTable
          caption="Scottish Premiership"
          rows={SCOTTISH_ROWS}
          zones={SCOTTISH_ZONES}
          splitAfter={6}
          splitLabels={{ top: 'Championship round', bottom: 'Relegation round' }}
        />
      </Section>

      <Section title="LeagueTable — no zones">
        <LeagueTable caption="Friendly league, no qualification" rows={SCOTTISH_ROWS.slice(0, 6)} />
      </Section>

      <Section title="LeagueTable — no movement data">
        <Label>A dash is honest; an arrow that always points up is not.</Label>
        <LeagueTable
          caption="Opening weekend, no previous round"
          rows={PREMIER_LEAGUE_ROWS.slice(0, 6).map(({ movement: _movement, ...rest }) => rest)}
          zones={PREMIER_LEAGUE_ZONES}
        />
      </Section>

      <Section title="LeagueTable — hostile data">
        <Label>
          Full registered names, three-digit goal difference and three-digit points. Names truncate
          rather than wrap: a two-line row breaks the scan down twenty positions.
        </Label>
        <LeagueTable caption="Hostile data" rows={HOSTILE_ROWS} zones={PREMIER_LEAGUE_ZONES} />
      </Section>

      <Section title="ThirdPlaceTable">
        <ThirdPlaceTable
          rows={[
            { position: 1, groupLetter: 'C', team: FRA, played: 3, goalDifference: 2, points: 4 },
            { position: 2, groupLetter: 'A', team: SCO, played: 3, goalDifference: 1, points: 4 },
            { position: 3, groupLetter: 'E', team: POR, played: 3, goalDifference: 0, points: 4 },
            { position: 4, groupLetter: 'B', team: GER, played: 3, goalDifference: 0, points: 3 },
            { position: 5, groupLetter: 'D', team: ITA, played: 3, goalDifference: -1, points: 3 },
            { position: 6, groupLetter: 'F', team: ENG, played: 3, goalDifference: -3, points: 2 },
          ]}
        />
        <ThirdPlaceTable
          rows={[
            { position: 1, groupLetter: 'C', team: FRA, played: 3, goalDifference: 2, points: 4 },
            { position: 2, groupLetter: 'A', team: SCO, played: 3, goalDifference: 1, points: 4 },
            { position: 3, groupLetter: 'E', team: POR, played: 3, goalDifference: 0, points: 4 },
            { position: 4, groupLetter: 'B', team: GER, played: 3, goalDifference: 0, points: 3 },
            { position: 5, groupLetter: 'D', team: ITA, played: 3, goalDifference: 0, points: 3 },
            { position: 6, groupLetter: 'F', team: ENG, played: 3, goalDifference: -3, points: 2 },
          ]}
          tieResolutionSlot={
            <span className={styles.tieNote}>
              Germany and Italy are tied on every criterion — resolve their order to continue.
            </span>
          }
        />
      </Section>

      <Section title="TieResolver">
        <Label>pending (interactive)</Label>
        <TieResolverDemo />
        <Label>resolved</Label>
        <TieResolver
          title="Best thirds · positions 4 & 5"
          reason="These third-placed teams are level on every criterion we can predict. Choose which you expect to advance."
          teams={[
            { id: 'ned', name: 'Netherlands', countryCode: 'nl' },
            { id: 'cro', name: 'Croatia', countryCode: 'hr' },
          ]}
          resolved
          saveStatus="saved"
          onResolve={() => {}}
        />
        <Label>save failed</Label>
        <TieResolver
          title="Group D"
          reason="These teams can't be split by predicted results. Choose the order you expect."
          teams={[
            { id: 'a', name: 'Team 1', countryCode: '' },
            { id: 'b', name: 'Team 2', countryCode: '' },
            { id: 'c', name: 'Team 3', countryCode: '' },
          ]}
          resolved={false}
          saveStatus="error"
          onResolve={() => {}}
        />
      </Section>

      <Section title="Knockout bracket">
        <Label>round switcher (interactive)</Label>
        <RoundSwitcherDemo />

        <Label>tie — pick a winner (interactive)</Label>
        <TieCardPickDemo />

        <Label>tie — unpicked</Label>
        <TieCard
          provenance="R16 · Winner B v 3rd Group D"
          date="25 Jun"
          venue="Newcastle"
          venueCountryCode="gb-eng"
          home={sideEng}
          away={sideEsp}
          pickedTeamId={null}
          onPick={() => {}}
        />

        <Label>tie — picked (winner + loser)</Label>
        <TieCard
          provenance="R16 · Winner A v Runner-up C"
          date="24 Jun"
          venue="Cardiff"
          venueCountryCode="gb-wls"
          home={sideEng}
          away={sideEsp}
          pickedTeamId="eng"
          onPick={() => {}}
        />

        <Label>tie — one feeder undecided (placeholder)</Label>
        <TieCard
          provenance="QF · Winner R16-3 v Winner R16-1"
          date="30 Jun"
          venue="Wembley"
          venueCountryCode="gb-eng"
          home={placeholderSide}
          away={sideEsp}
          pickedTeamId={null}
        />

        <Label>tie — both feeders undecided (placeholders)</Label>
        <TieCard
          provenance="SF · Winner QF-1 v Winner QF-2"
          date="4 Jul"
          venue="Wembley"
          venueCountryCode="gb-eng"
          home={{ kind: 'placeholder', feederRef: 'QF-1', label: 'Winner QF · Wembley tie' }}
          away={{ kind: 'placeholder', feederRef: 'QF-2', label: 'Winner QF · Dublin tie' }}
          pickedTeamId={null}
        />

        <Label>champion card (Final, picked)</Label>
        <ChampionCard name="England" countryCode="gb-eng" />
      </Section>

      <Section title="Placed joker (Jokers overview)">
        <Label>movable — before kickoff (remove / move)</Label>
        <PlacedJokerCard
          group="A"
          matchday={1}
          date="9 Jun"
          home={ENG}
          away={ESP}
          homeScore={2}
          awayScore={1}
          committed={false}
          onRemove={() => {}}
          onMove={() => {}}
        />

        <Label>committed — after kickoff (gold, permanent)</Label>
        <PlacedJokerCard
          group="C"
          matchday={2}
          date="14 Jun"
          home={GER}
          away={ITA}
          homeScore={0}
          awayScore={0}
          committed
        />
      </Section>

      <Section title="Golden boot picker (Review · Awards)">
        <Label>empty — squads not confirmed yet</Label>
        <GoldenBootPicker
          points={25}
          query=""
          onQueryChange={() => {}}
          results={[]}
          selected={null}
          onSelect={() => {}}
          onClear={() => {}}
          emptyNote="Player search available once squads are confirmed — closer to the tournament."
        />

        <Label>with results (squads confirmed — future data)</Label>
        <GoldenBootPicker
          points={25}
          query="kane"
          onQueryChange={() => {}}
          results={[
            { id: '1', name: 'Harry Kane', teamName: 'England' },
            { id: '2', name: 'Harvey Barnes', teamName: 'England' },
          ]}
          selected={null}
          onSelect={() => {}}
          onClear={() => {}}
          emptyNote="No players match."
        />

        <Label>selected (removable chip)</Label>
        <GoldenBootPicker
          points={25}
          query=""
          onQueryChange={() => {}}
          results={[]}
          selected={{ id: '1', name: 'Harry Kane', teamName: 'England' }}
          onSelect={() => {}}
          onClear={() => {}}
          emptyNote=""
        />
      </Section>

      <Section title="Leaderboard row (League)">
        <Label>pre-results (rank dash, all level)</Label>
        <div>
          <LeaderboardRow rank={null} name="Alex Turner" points={0} />
          <LeaderboardRow rank={null} name="Jordan Blake" points={0} isYou />
          <LeaderboardRow rank={null} name="Priya Shah" points={0} />
        </div>

        <Label>ranked (shared rank on ties, current user + movement)</Label>
        <div>
          <LeaderboardRow rank={1} name="Priya Shah" points={128} movement="up" />
          <LeaderboardRow rank={2} name="Alex Turner" points={115} movement="down" />
          <LeaderboardRow rank={2} name="Jordan Blake" points={115} isYou movement="none" />
          <LeaderboardRow rank={4} name="Sam Okafor" points={98} movement="up" />
        </div>

        <Label>league rows (champion-pick flag; hostile-long name truncates)</Label>
        <div>
          <LeaderboardRow rank={1} name="Priya Shah" points={128} movement="up" championPick={ESP} />
          <LeaderboardRow
            rank={2}
            name="Maximilian von Habsburg-Lothringen"
            points={115}
            movement="down"
            championPick={FRA}
          />
          <LeaderboardRow
            rank={3}
            name="Jordan Blake"
            points={98}
            isYou
            championPick={GER}
            championEliminated
          />
        </div>
      </Section>

      <Section title="PlayerChip">
        <Label>sizes (sm / md / lg)</Label>
        <div className={styles.row}>
          <PlayerChip name="Alex Turner" size="sm" />
          <PlayerChip name="Alex Turner" size="md" />
          <PlayerChip name="Alex Turner" size="lg" />
        </div>
        <Label>current user, single-word, and hostile-long (truncates)</Label>
        <div className={styles.stack} style={{ maxWidth: 260 }}>
          <PlayerChip name="Jordan Blake" you />
          <PlayerChip name="Cristiano" />
          <PlayerChip name="Maximilian von Habsburg-Lothringen III" />
          <PlayerChip name="🦁 Leo" />
        </div>
      </Section>

      <Section title="StatCard (profile stat grid)">
        <div className={styles.statGrid}>
          <StatCard label="Points" value={128} />
          <StatCard label="Overall rank" value="#3" accent movement="up" />
          <StatCard label="Exact scores" value={7} />
          <StatCard label="Accuracy" value="61%" />
        </div>
        <Label>empty / pre-results (dashes) + tappable</Label>
        <div className={styles.statGrid}>
          <StatCard label="Points" value="—" />
          <StatCard label="Overall rank" value="—" />
          <StatCard label="Points today" value={12} accent onClick={() => {}} />
          <StatCard label="Best league" value="2nd" movement="down" />
        </div>
      </Section>

      <Section title="Points breakdown (Profile / own points)">
        <Label>mid-tournament (categories, joker pill, pending Awards)</Label>
        <PointsBreakdown events={SAMPLE_SCORE_EVENTS} defaultExpanded />
        <Label>no results yet (every category pending, total 0)</Label>
        <PointsBreakdown events={[]} />
      </Section>

      <Section title="Auth — log in (docs/auth-plan.md §3)">
        <Label>default</Label>
        <LoginForm onSubmit={() => {}} />

        <Label>submitting</Label>
        <LoginForm onSubmit={() => {}} submitting />

        <Label>error (wrong password)</Label>
        <LoginForm
          onSubmit={() => {}}
          error="That email or password isn't right. Please try again."
        />
      </Section>

      <Section title="Auth — sign up">
        <Label>default</Label>
        <SignUpForm onSubmit={() => {}} />

        <Label>submitting</Label>
        <SignUpForm onSubmit={() => {}} submitting />

        <Label>error (existing account)</Label>
        <SignUpForm
          onSubmit={() => {}}
          error="An account with this email already exists. Try logging in instead."
        />
      </Section>

      <Section title="Auth — reset password (request)">
        <Label>default</Label>
        <ResetRequestForm onSubmit={() => {}} />

        <Label>submitting</Label>
        <ResetRequestForm onSubmit={() => {}} submitting />

        <Label>error (rate limited)</Label>
        <ResetRequestForm
          onSubmit={() => {}}
          error="Too many attempts. Please wait a moment and try again."
        />

        <Label>sent (neutral confirmation)</Label>
        <ResetRequestForm onSubmit={() => {}} sent />
      </Section>

      <Section title="Auth — set new password (from reset link)">
        <Label>default</Label>
        <UpdatePasswordForm onSubmit={() => {}} />

        <Label>submitting</Label>
        <UpdatePasswordForm onSubmit={() => {}} submitting />

        <Label>error (link expired)</Label>
        <UpdatePasswordForm
          onSubmit={() => {}}
          error="Your reset link has expired or was already used. Please request a new one."
        />

        <Label>done</Label>
        <UpdatePasswordForm onSubmit={() => {}} done />
      </Section>

      <Section title="Turnstile widget (dormant unless VITE_TURNSTILE_SITE_KEY set)">
        <Label>rendered with Cloudflare's always-pass TEST site key</Label>
        <TurnstileWidget
          siteKey="1x00000000000000000000AA"
          onToken={(t) => console.log('[dev] turnstile token', t?.slice(0, 12))}
        />
      </Section>

      <Section title="My-league card (League hub)">
        <MyLeagueCard name="The Office Sweepstake" memberCount={14} isOwner rank={1} movement="up" onOpen={() => {}} />
        <MyLeagueCard name="The Undisputed Champions Of All Group Stages Ever" memberCount={22} isOwner={false} rank={null} onOpen={() => {}} />
        <MyLeagueCard name="Fam" memberCount={1} isOwner rank={null} onOpen={() => {}} />
      </Section>

      <Section title="Invite panel (share moment / header chip)">
        <Label>full — post-create share moment</Label>
        <InvitePanel leagueName="The Office Sweepstake" code="ABC234" mode="full" />
        <Label>chip — detail header</Label>
        <InvitePanel leagueName="The Office Sweepstake" code="ABC234" mode="chip" />
      </Section>

      <Section title="League preview (join / deep link)">
        <LeaguePreviewCard
          preview={{ name: 'The Office Sweepstake', isMember: false }}
          onJoin={() => {}}
          onDecline={() => {}}
        />
        <Label>already a member</Label>
        <LeaguePreviewCard
          preview={{ name: 'The Office Sweepstake', isMember: true }}
          onJoin={() => {}}
          onDecline={() => {}}
        />
      </Section>

      <Section title="League member rows — pre-lock (stats hidden, no champion flag)">
        <LeagueMembersDemo revealed={false} />
      </Section>

      <Section title="League member rows — post-lock (champion flags, stats revealed)">
        <LeagueMembersDemo revealed />
      </Section>

      <Section title="H2H pass 1 — champion split, different stats">
        <H2HScreen
          you={{ displayName: 'Alex Turner', champion: ESP, championEliminated: false, totalPoints: 112, exactScores: 9, koPicksAlive: 14, maxPossible: 340 }}
          rival={{ displayName: 'José Peña', champion: GER, championEliminated: false, totalPoints: 96, exactScores: 6, koPicksAlive: 15, maxPossible: 352 }}
          split={{
            champion: { agree: false, mine: ESP, theirs: GER },
            sharedFinalists: [FRA],
            mineOnlyFinalists: [ESP],
            theirsOnlyFinalists: [GER],
          }}
        />
      </Section>

      <Section title="H2H pass 1 — identical stats (tie, no accent), hostile long names">
        <H2HScreen
          you={{ displayName: 'Maximilian von Habsburg-Lothringen III', champion: ESP, championEliminated: false, totalPoints: 96, exactScores: 7, koPicksAlive: 12, maxPossible: 300 }}
          rival={{ displayName: 'Anne-Marie Ndlovu-Okonkwo', champion: ESP, championEliminated: true, totalPoints: 96, exactScores: 7, koPicksAlive: 12, maxPossible: 300 }}
          split={{
            champion: { agree: true, mine: ESP, theirs: ESP },
            sharedFinalists: [ESP, FRA],
            mineOnlyFinalists: [],
            theirsOnlyFinalists: [],
          }}
        />
      </Section>

      <Section title="H2H pass 1 — rival with zero predictions">
        <H2HScreen
          you={{ displayName: 'Ng', champion: SCO, championEliminated: false, totalPoints: 9, exactScores: 0, koPicksAlive: 8, maxPossible: 180 }}
          rival={{ displayName: 'Bo', champion: null, championEliminated: false, totalPoints: 0, exactScores: 0, koPicksAlive: 0, maxPossible: 65 }}
          split={{
            champion: { agree: false, mine: SCO, theirs: null },
            sharedFinalists: [],
            mineOnlyFinalists: [SCO],
            theirsOnlyFinalists: [],
          }}
        />
      </Section>

      <Section title="Shareable cards — quick tease / full bracket / during-tournament brag">
        <Label>tease (champion hero + final line + stat line + challenge chip)</Label>
        <ShareCardDemo model={SHARE_MODEL} variant="tease" />
        <Label>full bracket (survivors funnel + awards strip)</Label>
        <ShareCardDemo model={SHARE_MODEL} variant="bracket" />
        <Label>during-tournament brag (points + rank)</Label>
        <ShareCardDemo model={SHARE_MODEL} variant="brag" />
        <Label>brag — champion eliminated (tombstone)</Label>
        <ShareCardDemo model={{ ...SHARE_MODEL, champion: { ...SHARE_MODEL.champion!, eliminated: true } }} variant="brag" />
        <Label>tease — league recruitment (chip = invite)</Label>
        <ShareCardDemo model={{ ...SHARE_MODEL, header: { ...SHARE_MODEL.header, leagueName: 'The Office Sweepstake' } }} variant="tease" />
      </Section>

      <Section title="Matches tab — browser (upcoming / live / played, group + KO, filters)">
        <MatchesScreen
          filter="all"
          onFilter={() => {}}
          onOpen={() => {}}
          groups={[
            {
              key: 'MD1',
              label: 'Matchday 1',
              dateLabel: 'Wed 10 Jun',
              rows: [
                { matchRef: 'GA-1', home: SCO, away: ENG, state: 'after', timeLabel: '', result: { home: 2, away: 1 }, yourPick: 'You said 2–1', points: 10, joker: true, jokerPaid: true, outcome: 'exact' },
                { matchRef: 'GC-1', home: ESP, away: FRA, state: 'after', timeLabel: '', result: { home: 0, away: 2 }, yourPick: 'You said 2–0', points: 0, joker: false, outcome: 'wrong' },
                { matchRef: 'GB-1', home: GER, away: SCO, state: 'during', timeLabel: '', result: null, liveMinute: "63'", yourPick: 'You said 1–1', points: null, joker: true, jokerPaid: false, outcome: 'neutral' },
                { matchRef: 'GA-2', home: ENG, away: ESP, state: 'before', timeLabel: 'Fri 12 Jun · 20:00', result: null, yourPick: 'You said 1–0', points: null, joker: false, outcome: 'neutral' },
                { matchRef: 'GD-1', home: FRA, away: GER, state: 'before', timeLabel: 'Fri 12 Jun · 17:00', result: null, yourPick: null, points: null, joker: false, outcome: 'neutral' },
              ],
            },
            {
              key: 'R16',
              label: 'Round of 16',
              dateLabel: 'Sat 27 Jun',
              rows: [
                { matchRef: 'R16-1', home: SCO, away: GER, state: 'after', timeLabel: '', result: { home: 1, away: 0 }, yourPick: 'You had Scotland through', points: 15, joker: false, outcome: 'good' },
                { matchRef: 'R16-2', home: ESP, away: FRA, state: 'before', timeLabel: 'Sat 27 Jun · 20:00', result: null, yourPick: 'You had Spain through', points: null, joker: false, outcome: 'neutral' },
              ],
            },
          ]}
        />
      </Section>

      <Section title="Matches tab — empty (My jokers filter, none placed)">
        <MatchesScreen filter="jokers" onFilter={() => {}} onOpen={() => {}} groups={[]} emptyMessage="No jokers placed yet — place them on your group predictions." />
      </Section>

      <Section title="Match Centre — group · after · league scope (named rows)">
        <MatchCentreScreen
          eyebrow="Group A · Full time"
          venue="Glasgow"
          venueCountryCode="gb-sct"
          home={SCO}
          away={ENG}
          lifecycleContent={matchCentreLifecycleContent('FULL_TIME')}
          statusPresentation={presentMatchLifecycle('FULL_TIME')}
          result={{ home: 2, away: 1 }}
          stake={{ kind: 'group', stake: { kind: 'group', pick: { homeScore: 2, awayScore: 1, joker: true }, outcome: 'exact', points: 10 } }}
          scope={{ type: 'league', id: 'l1', name: 'The Office Sweepstake' }}
          leagues={[{ id: 'l1', name: 'The Office Sweepstake' }, { id: 'l2', name: 'Fam' }]}
          said={{
            revealed: true,
            kind: 'league-group',
            rows: [
              { displayName: 'Alex Turner', isYou: true, homeScore: 2, awayScore: 1, joker: true, outcome: 'exact', points: 10 },
              { displayName: 'Søren Kjær-Nielsen', isYou: false, homeScore: 2, awayScore: 0, joker: false, outcome: 'correct', points: 3 },
              { displayName: 'Maximilian von Habsburg-Lothringen III', isYou: false, homeScore: 1, awayScore: 0, joker: true, outcome: 'correct', points: 6 },
              { displayName: '🦁 Leo the Lion', isYou: false, homeScore: 0, awayScore: 2, joker: false, outcome: 'wrong', points: 0 },
              { displayName: 'Bo', isYou: false, homeScore: 1, awayScore: 3, joker: true, outcome: 'wrong', points: 0 },
            ],
          }}
          scoreEvents={[{ id: 'e1', category: 'group_matches', explanation: 'Scotland 2–1 England · exact score', points: 10, joker: true }]}
        />
      </Section>

      <Section title="Match Centre — group · after · overall scope (anonymous bars)">
        <MatchCentreScreen
          eyebrow="Group A · Full time"
          venue="Glasgow"
          venueCountryCode="gb-sct"
          home={SCO}
          away={ENG}
          lifecycleContent={matchCentreLifecycleContent('FULL_TIME')}
          statusPresentation={presentMatchLifecycle('FULL_TIME')}
          result={{ home: 2, away: 1 }}
          stake={{ kind: 'group', stake: { kind: 'group', pick: { homeScore: 1, awayScore: 1, joker: false }, outcome: 'wrong', points: 0 } }}
          scope={{ type: 'overall' }}
          leagues={[{ id: 'l1', name: 'The Office Sweepstake' }]}
          said={{
            revealed: true,
            kind: 'overall-group',
            total: 21,
            bars: [
              { homeScore: 2, awayScore: 1, count: 8, isYou: false, outcome: 'exact' },
              { homeScore: 1, awayScore: 1, count: 6, isYou: true, outcome: 'wrong' },
              { homeScore: 2, awayScore: 0, count: 4, isYou: false, outcome: 'correct' },
              { homeScore: 0, awayScore: 0, count: 3, isYou: false, outcome: 'wrong' },
            ],
          }}
          scoreEvents={[]}
        />
      </Section>

      <Section title="Match Centre — group · before · pre-lock (counts only, editable stake)">
        <MatchCentreScreen
          eyebrow="Group C · Upcoming"
          venue="Cardiff"
          venueCountryCode="gb-wls"
          home={ESP}
          away={FRA}
          lifecycleContent={matchCentreLifecycleContent('SCHEDULED')}
          statusPresentation={presentMatchLifecycle('SCHEDULED')}
          result={null}
          countdownLabel="Kick-off 12 Jun"
          stake={{ kind: 'group', stake: { kind: 'group', pick: { homeScore: 1, awayScore: 0, joker: false }, outcome: 'unknown', points: null } }}
          scope={{ type: 'league', id: 'l1', name: 'Fam' }}
          leagues={[{ id: 'l1', name: 'Fam' }]}
          said={{ revealed: false, predicted: 18, total: 20 }}
          scoreEvents={[]}
        />
      </Section>

      <Section title="Match Centre — knockout · after · league scope (Had X ✓/✗ + casualties)">
        <MatchCentreScreen
          eyebrow="Round of 16 · Full time"
          venue="Dublin"
          venueCountryCode="ie"
          home={SCO}
          away={GER}
          lifecycleContent={matchCentreLifecycleContent('FULL_TIME')}
          statusPresentation={presentMatchLifecycle('FULL_TIME')}
          result={{ home: 1, away: 0 }}
          koDetail="Scotland win 4–3 on penalties"
          stake={{ kind: 'knockout', stake: { kind: 'knockout', backed: 'home', correct: true, points: 15 }, teamName: 'Scotland' }}
          scope={{ type: 'league', id: 'l1', name: 'The Office Sweepstake' }}
          leagues={[{ id: 'l1', name: 'The Office Sweepstake' }]}
          said={{
            revealed: true,
            kind: 'league-ko',
            homeName: 'Scotland',
            awayName: 'Germany',
            rows: [
              { displayName: 'Alex Turner', isYou: true, backed: 'home', correct: true },
              { displayName: 'Priya Shah', isYou: false, backed: 'home', correct: true },
              { displayName: 'Wojciech Szczęsny', isYou: false, backed: 'away', correct: false },
              { displayName: 'renée', isYou: false, backed: null, correct: null },
            ],
          }}
          consequence={{ casualties: 1, example: 'Wojciech Szczęsny' }}
          scoreEvents={[{ id: 'e1', category: 'knockout', explanation: 'Scotland · through to the quarter-finals', points: 15 }]}
        />
      </Section>

      <Section title="Match Centre — knockout · during · overall scope (live, split bar)">
        <MatchCentreScreen
          eyebrow="Quarter-final · Live"
          venue="London"
          venueCountryCode="gb-eng"
          home={ESP}
          away={FRA}
          lifecycleContent={matchCentreLifecycleContent('LIVE_SECOND_HALF')}
          statusPresentation={presentMatchLifecycle('LIVE_SECOND_HALF')}
          result={null}
          liveMinute="63'"
          stake={{ kind: 'knockout', stake: { kind: 'knockout', backed: 'home', correct: null, points: null }, teamName: 'Spain' }}
          scope={{ type: 'overall' }}
          leagues={[{ id: 'l1', name: 'Fam' }]}
          said={{
            revealed: true,
            kind: 'overall-ko',
            homeName: 'Spain',
            awayName: 'France',
            split: { homeCount: 13, awayCount: 8, total: 21, youBacked: 'home', actualWinner: null },
          }}
          scoreEvents={[]}
        />
      </Section>

      <Section title="Profile — own, populated (full group stage of history)">
        <ProfileScreen
          kind="full"
          header={{ displayName: 'Alex Turner', isOwn: true, champion: SCO, championEliminated: false, leaguesCount: 3 }}
          stats={{ totalPoints: 148, rank: 4, exactScores: 9, correctResults: 14, scoredMatches: 30, accuracyPercent: 77 }}
          events={SAMPLE_SCORE_EVENTS}
          locked
          onViewEntry={() => {}}
        />
      </Section>

      <Section title="Profile — hostile name, champion eliminated (tombstone)">
        <ProfileScreen
          kind="full"
          header={{
            displayName: 'Maximilian von Habsburg-Lothringen III',
            isOwn: false,
            champion: SCO,
            championEliminated: true,
            leaguesCount: 1,
          }}
          stats={{ totalPoints: 96, rank: 96, exactScores: 3, correctResults: 8, scoredMatches: 24, accuracyPercent: 46 }}
          events={SAMPLE_SCORE_EVENTS}
          locked={false}
          onH2H={() => {}}
        />
      </Section>

      <Section title="Profile — new user (zero history, pre-results, tied)">
        <ProfileScreen
          kind="full"
          header={{ displayName: 'Ng', isOwn: true, champion: null, championEliminated: false, leaguesCount: 0 }}
          stats={{ totalPoints: 0, rank: null, exactScores: 0, correctResults: 0, scoredMatches: 0, accuracyPercent: null }}
          events={[]}
          locked={false}
          onEdit={() => {}}
        />
      </Section>

      <Section title="Profile — another player, pre-lock (reveal-gated hidden state)">
        <ProfileScreen
          kind="hidden"
          displayName="José Peña"
          leaguesCount={2}
          hasEntry
          lockDateLabel="9 June 2028"
        />
      </Section>

      <Section title="/welcome screen">
        <WelcomeScreen displayName="Alex" onStart={() => {}} onScoring={() => {}} />
        <Label>hostile long display name (no overflow at 360px)</Label>
        <WelcomeScreen
          displayName="Maximilian von Habsburg-Lothringen III"
          onStart={() => {}}
          onScoring={() => {}}
        />
      </Section>

      <Section title="Home — stat strip (during tournament)">
        <StatStrip
          totalPoints={148}
          pointsToday={12}
          rank={4}
          entryCount={2140}
          bestLeagueRank={1}
          hasLeague
          onPoints={() => {}}
          onToday={() => {}}
          onRank={() => {}}
          onLeague={() => {}}
        />
        <Label>pre-results / no league</Label>
        <StatStrip
          totalPoints={0}
          pointsToday={0}
          rank={null}
          entryCount={2140}
          bestLeagueRank={null}
          hasLeague={false}
          onPoints={() => {}}
          onToday={() => {}}
          onRank={() => {}}
          onLeague={() => {}}
        />
      </Section>

      <Section title="Home — Today card">
        <Label>live (cyan border) + upcoming + full-time rows</Label>
        <TodayCard section={TODAY_LIVE} onOpenMatch={() => {}} />
        <Label>no matches today → next matchday</Label>
        <TodayCard section={TODAY_NEXT} onOpenMatch={() => {}} />
        <Label>nothing scheduled</Label>
        <TodayCard section={{ kind: 'none' }} onOpenMatch={() => {}} />
      </Section>

      <Section title="Home — catch-up line + league snapshot">
        <CatchUpLine catchUp={{ pointsDelta: 18, rankDelta: null }} />
        <LeagueSnapshot
          league={{ id: 'x', name: 'The Undisputed Champions Of All Group Stages', memberCount: 22, rank: 1, gapToTop: 0, lastActivityMs: 0 }}
          onOpen={() => {}}
          onCreate={() => {}}
        />
        <LeagueSnapshot
          league={{ id: 'y', name: 'Fam', memberCount: 6, rank: 4, gapToTop: 23, lastActivityMs: 0 }}
          onOpen={() => {}}
          onCreate={() => {}}
        />
        <Label>no leagues → create prompt</Label>
        <LeagueSnapshot league={null} onOpen={() => {}} onCreate={() => {}} />
      </Section>

      {/* THE SEASON SURFACES. Everything above this point is tournament-era —
          the gallery grew alongside Euro 2028 and never followed the product
          onto a competition season, so the fixture list, the Match Centre and
          the administrator's provider queues had no picture anywhere. A visual
          contract is the only cheap way to hold "the provisional score is not
          in the result column", which is precisely the kind of thing a
          stylesheet edit can undo without failing a single assertion. */}

      <Section title="Season fixtures — day list, rescheduled matchweek, provisional score">
        {/* One Saturday carrying two matchweeks, because that is the case the
            by-date list exists for, plus a live fixture whose provider score
            must read as provisional rather than as a result. */}
        <SeasonMatchesPage gateway={seasonFixtureGateway} timeZone={SEASON_ZONE} />
      </Section>

      <Section title="Season Match Centre — an opened fixture with its prediction and points">
        <SeasonMatchCentre
          fixture={seasonScoredRow}
          read={seasonCardReader}
          football={seasonFootball}
        />
        <Label>settled: prediction, official result and this fixture&rsquo;s points</Label>
        <SeasonMatchCentre
          fixture={seasonLiveRow}
          read={seasonCardReader}
          football={seasonFootball}
        />
        <Label>
          in play: a provider&rsquo;s score, outside the result field, awarding nothing — and a
          club with nothing settled saying so rather than showing empty pills
        </Label>
      </Section>

      <Section title="Season Overview — next up">
        <SeasonFixturePreview
          gateway={seasonFixtureGateway}
          timeZone={SEASON_ZONE}
          onSeeAll={() => {}}
        />
      </Section>

      <Section title="Provider review queues — work waiting and nothing waiting">
        <ProviderReviewPanel
          load={async () => mapProviderReviewQueues(PROVIDER_QUEUES_BUSY)}
          acknowledge={async () => ({ marked: 1 })}
        />
        <Label>with work waiting</Label>
        <ProviderReviewPanel
          load={async () => mapProviderReviewQueues(PROVIDER_QUEUES_CLEAR)}
          acknowledge={async () => ({ marked: 0 })}
        />
        <Label>clear</Label>
      </Section>

      {/* The three states §9.1 and §9.2 name that this harness could not show.
          Loading, empty, partial, locked, error and hostile data were already
          here across ~70 sections; offline, unavailable and conflict were the
          gap, and they are the three hardest to reach from a healthy database
          — which is exactly why a gallery has to be able to render them on
          demand rather than waiting for the conditions to occur. */}

      <Section title="State — offline (banner, preserved state, only safe actions)">
        {/* §9.1: "Offline banner; preserve local/last-known state; queue only
            explicitly safe actions." All three parts are shown together,
            because the banner alone is the easy half — the point is that the
            content underneath SURVIVES and that writes stop. */}
        <Alert variant="warning" title="You're offline">
          Showing the last data we loaded. Your saved predictions are safe, and this page will
          update by itself when the connection returns.
        </Alert>
        <Label>last-known content stays on screen — it is not replaced by an empty state</Label>
        <LeagueSnapshot
          league={{ id: 'offline', name: 'Saturday Night League', memberCount: 12, rank: 4, gapToTop: 6, lastActivityMs: 0 }}
          onOpen={() => {}}
          onCreate={() => {}}
        />
        <Label>writes are disabled rather than queued — a prediction is a timed act</Label>
        <Button variant="primary" disabled>
          Save predictions
        </Button>
        <Label>a read-only action stays available, because it needs nothing from the network</Label>
        <Button variant="secondary">View scoring rules</Button>
      </Section>

      <Section title="State — unavailable (scope, reason, expected recovery)">
        {/* §9.1: "Explain scope, reason and expected recovery where known."
            Two rows, because the honest difference between them is whether we
            know when it comes back — and a page that invents a recovery time
            it does not have is worse than one that says it does not know. */}
        <Label>recovery known</Label>
        <EmptyState
          title="Standings are paused until the matchweek settles"
          description="Three results are still awaiting confirmation. The table returns as soon as they are confirmed — usually within an hour of the last final whistle."
        />
        <Label>recovery not known — say so rather than inventing a time</Label>
        <EmptyState
          title="Last Man Standing is not available for this season"
          description="This competition has not opened a Last Man Standing game. If one opens, it appears here and is joined separately from your predictions."
        />
        <Label>partial unavailability inside an otherwise usable page</Label>
        <Alert variant="info" title="Live scores are unavailable">
          Confirmed results are unaffected — only the in-play view is missing. Everything below is
          the official record.
        </Alert>
      </Section>

      <Section title="State — conflict (do not overwrite; refresh, compare, reapply)">
        {/* §9.2: "Server state changed after load. Do not overwrite; offer
            refresh/compare/reapply." The prohibition is the requirement: the
            player's own input is shown beside the server's value rather than
            being silently replaced by it, and no action here writes without
            them choosing one. */}
        <Alert variant="warning" title="This prediction changed somewhere else">
          You have this open in more than one place. We have not overwritten either version — choose
          which one you want to keep.
        </Alert>
        <Label>both values are shown; neither has been applied</Label>
        <div className={styles.row}>
          <StatCard label="Yours (unsaved)" value="2–1" />
          <StatCard label="Saved elsewhere" value="3–1" />
        </div>
        <Label>the three actions §9.2 requires — none of them writes on its own</Label>
        <div className={styles.row}>
          <Button variant="secondary">Refresh</Button>
          <Button variant="secondary">Compare</Button>
          <Button variant="primary">Reapply mine</Button>
        </div>
        <Label>conflict on an action that cannot be reapplied — refresh is the only honest offer</Label>
        <Alert variant="error" title="This matchweek locked while you were editing">
          Kickoff has passed, so this card can no longer be changed. What was saved before the lock
          has been kept.
        </Alert>
      </Section>

      <Section title="State — refreshing (content stays, progress is quiet)">
        {/* §9.1: "Keep content visible; subtle progress; disable only actions
            whose truth is uncertain." The third clause is the one that is easy
            to get wrong in both directions — disabling everything makes a
            background poll feel like an outage, and disabling nothing lets a
            player act on a number that is being replaced as they read it. */}
        <p className={styles.label} role="status">
          Updating scores…
        </p>
        <Label>content is not replaced by a skeleton — it was already usable</Label>
        <LeagueTable rows={PREMIER_LEAGUE_ROWS.slice(0, 4)} caption="Premier League" />
        <Label>uncertain: this rank is mid-update, so acting on it is blocked</Label>
        <Button variant="secondary" disabled>
          Share my position
        </Button>
        <Label>certain: entering predictions does not depend on the numbers being refreshed</Label>
        <Button variant="primary">Edit predictions</Button>
      </Section>

      <Section title="State — stale (freshness labelled, sensitive writes restricted)">
        {/* §9.1: "Label timestamp/freshness; restrict sensitive writes." Stale
            is NOT offline — the connection is fine and the data is simply older
            than its threshold — so the copy says how old rather than implying a
            failure the player might try to fix. */}
        <Alert variant="info" title="Showing results from 14 minutes ago">
          We have not been able to refresh since then. Nothing here is wrong, but a recent goal may
          not be counted yet.
        </Alert>
        <Label>the freshness line sits with the figures it describes, not only at the top of the page</Label>
        <div className={styles.row}>
          <StatCard label="Points" value="176" />
          <StatCard label="Rank" value="4th" />
        </div>
        <p className={styles.label}>Last updated 14:32 · usually every minute</p>
        <Label>the sensitive write is restricted, and says what would make it safe</Label>
        <Button variant="primary" disabled>
          Confirm matchweek
        </Button>
        <p className={styles.label}>
          Confirming is paused until we can check the latest state of your card.
        </p>
      </Section>

      <Section title="State — error blocking (full page, correlation reference)">
        {/* §9.1: "Contract/security/config failure prevents safe rendering.
            Full-page error, support/correlation information and telemetry."
            The distinction from a retryable error is the whole point: there is
            no retry button here, because repeating a request that failed a
            contract or permission check will fail identically and a button
            that cannot work is a worse answer than an honest dead end. */}
        <Alert variant="error" title="We can’t show this page safely">
          Something in this competition’s configuration does not match what the app expects, so we
          have stopped rather than show you numbers we cannot stand behind. Your predictions and
          your points are unaffected.
        </Alert>
        <Label>a reference the player can quote, because support cannot search for "it broke"</Label>
        <p className={styles.label}>Reference: 7F3C-2026-08-05-A19</p>
        <Label>no retry — the same request fails the same way; the exits are elsewhere</Label>
        <div className={styles.row}>
          <Button variant="secondary">Back to hub</Button>
          <Button variant="secondary">Contact support</Button>
        </div>
      </Section>
    </div>
  )
}

/**
 * Dev-only preview at /dev/components: the whole design system, every state,
 * side by side in both themes. Not part of the shipped app.
 */
/**
 * The widths a visual contract may pin the gallery to.
 *
 * Read from `?width=` rather than from the viewport, because the panels are
 * normally flexible (`flex: 1 1 340px`) and a flexible panel photographs
 * differently on every runner and every window size. A screenshot baseline
 * built on that compares nothing reliably.
 *
 * `auto` is the default and is what a human browsing `/dev/components` gets, so
 * adding the anchors does not change the harness for the people who use it.
 */
export type PreviewWidth = 'auto' | 'phone' | 'desktop'

function requestedWidth(search: string): PreviewWidth {
  const value = new URLSearchParams(search).get('width')
  return value === 'phone' || value === 'desktop' ? value : 'auto'
}

export function ComponentsPreview() {
  // `useLocation` rather than reading `window` directly, so the value tracks a
  // client-side navigation between widths instead of only the first paint.
  const width = requestedWidth(useLocation().search)

  return (
    <div className={styles.page} data-preview-width={width}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Design system — /dev/components</h1>
        <p className={styles.sub}>Every component and state, dark and light.</p>
      </header>
      <div className={styles.themes}>
        {/* `data-theme-panel` is the anchor a visual contract targets. Class
            names are hashed by CSS modules and change whenever the stylesheet
            does, so a baseline keyed on one would break for reasons that have
            nothing to do with what it renders. */}
        <section data-theme="dark" data-theme-panel="dark" className={styles.panel}>
          <div className={styles.panelTag}>Dark — Night broadcast</div>
          <Gallery />
        </section>
        <section data-theme="light" data-theme-panel="light" className={styles.panel}>
          <div className={styles.panelTag}>Light — Daylight clean</div>
          <Gallery />
        </section>
      </div>
    </div>
  )
}
