/**
 * THE FIVE-PHASE MARKETING WORLD — the product, told as a week.
 *
 * ============================ WHY IT IS A FIXTURE AND NOT A MOCK =========
 *
 * The anonymous landing page has to show somebody what the product IS before
 * they have an account to look at. Until now it did that by drawing a second,
 * hand-built picture of the Hub: its own rows, its own navigation, its own
 * copy. That picture went stale the moment the product's information
 * architecture changed, and the way anybody found out was by reading a
 * marketing page that advertised a UI the product no longer had.
 *
 * So the page does not draw the product any more. It MOUNTS it. Every phase
 * below is a real vNext surface — `VNextHome`, `VNextMatches`, `VNextLeagues`,
 * `VNextGames` — rendered from a real model inside the real shell. If the
 * Competition Deck changes, the landing page changes with it, because it is the
 * same component. A marketing page that cannot go stale is the whole point of
 * this file.
 *
 * ============================ IT IS THE WORKSHOP'S OWN WORLDS ============
 *
 * Nothing here invents football. Each phase selects a world the review lane
 * already curates and already holds to a premise — `homeScenarios.decision`,
 * `matchesScenarios.singleCompetition`, `homeScenarios.live`,
 * `leaguesScenarios.leagueSettled`, `gamesScenarios.allOpen` — so the five
 * pictures a visitor sees are five pictures a reviewer has already accepted.
 * A separate set of "marketing data" would be a second world to keep truthful,
 * and the second one to drift is always the one on the public page.
 *
 * ============================ DETERMINISTIC, OFFLINE, NO CLOCK ===========
 *
 * Every model beneath this file is literals: no `Date.now()`, no random source,
 * no service, no account, no Supabase, no football provider. The sequence a
 * visitor sees on a Tuesday is the sequence they see on a Friday and the one a
 * screenshot comparison sees on the runner. That is a requirement rather than a
 * nicety — a preview that differs per render cannot have a visual baseline, and
 * a public page that read the real product would be reading it for a visitor
 * with no account.
 *
 * ============================ REAL CLUBS, ILLUSTRATIVE FOOTBALL ==========
 *
 * The competition is the Scottish Premiership and the clubs are its own,
 * because the one question an acquisition page has to answer is "is this for MY
 * football?" — and a device showing the invented Caledonian Premiership
 * answered no, on a page whose own copy names the real competitions the product
 * covers. A visitor met an advertisement for one thing and a demonstration of
 * another.
 *
 * The old caution behind that invention was right about a different failure:
 * the page before it printed "Arsenal 2 – 1 Chelsea" with a made-up scoreline,
 * which a visitor could read as a real result. The answer is not to invent the
 * clubs — it is to stop inventing the FOOTBALL. `realFootball.ts` draws that
 * line and enforces it: real identity resolved through the application's own
 * club authority, and no score, no clock, no form, no league position and no
 * head-to-head anywhere in the sequence. What the device shows a visitor doing
 * is predicting, which is the product, and a prediction is self-evidently a
 * guess.
 *
 * ============================ AND THE VIEWER IS NOT A REAL PERSON ========
 *
 * The workshop's signed-in player carries the repository owner's own name,
 * which is unremarkable in a private review surface and wrong on a public
 * acquisition page: a named individual would appear to a stranger as a real
 * person's real standing. `MARKETING_PLAYER` replaces it everywhere the viewer
 * is visible — the shell avatar, Home's masthead and the league table's own
 * row.
 */

import type { HomeModel } from '../../models/home'
import type { MatchesModel } from '../../models/matches'
import type { GamesPageModel } from '../../models/games'
import type { LeaguePlayer, LeaguesModel, LeaguesPrivateRow } from '../../models/leagues'
import type {
  ShellContext,
  ShellDestinationId,
  ShellGame,
  VNextShellModel,
} from '../../models/shell'
import { SHELL_DESTINATIONS } from '../../models/shell'
import { illustrativeHome, illustrativeMatches, realFootballNames } from './realFootball'
import { homeScenarios } from '../home/scenarios'
import { matchesScenarios } from '../matches/scenarios'
import { leaguesScenarios } from '../leagues/scenarios'
import { gamesScenarios } from '../games/scenarios'

/**
 * THE VIEWER OF THE PREVIEW.
 *
 * Invented, and deliberately not the workshop's. See the header.
 */
const MARKETING_PLAYER = { name: 'Rowan Adeyemi', initials: 'RA' } as const

/**
 * The competition every phase is inside.
 *
 * Its name, monogram and colours match the workshop's Caledonian Premiership so
 * the chrome and the page beneath it never name two different competitions — a
 * defect a preview makes especially easy, because a reader has no way to tell
 * which of the two is the product's real answer.
 */
const MARKETING_COMPETITION = {
  id: 'scottish-premiership',
  name: 'Scottish Premiership',
  shortName: 'Premiership',
  monogram: 'SP',
  seasonLabel: '2027/28',
  colours: { primary: '#123B72', accent: '#37E0A0' },
} as const satisfies ShellContext['competition']

/**
 * ONE COMPETITION, AND THAT IS THE PRODUCT CLAIM BEING MADE.
 *
 * The shell's binding product test is that a player in one competition gets a
 * one-competition product rather than a platform dashboard with one thing
 * selected — no switcher, no shortcut rail, no Jump. A visitor deciding whether
 * to sign up should see the small product, because that is what they will get.
 * Twenty competitions exist behind it; the preview does not advertise them,
 * `contexts` has one entry, and the discovery entry is how the product says the
 * rest is there.
 */
function marketingShell(tempoLabel: string, games: readonly ShellGame[]): VNextShellModel {
  return {
    player: MARKETING_PLAYER,
    contexts: [
      {
        competition: MARKETING_COMPETITION,
        relationship: 'playing',
        tempoLabel,
        games,
        leagues: [
          { id: 'sunday-club', name: 'The Sunday Club', game: 'match-predictor' },
        ],
      },
    ],
    activeContextId: MARKETING_COMPETITION.id,
    destinations: SHELL_DESTINATIONS,
    // NOTHING IS WAITING ELSEWHERE, in every phase. The attention layer is the
    // shell's answer to a competition the player is NOT looking at, and a
    // one-competition preview has no elsewhere — drawing the band anyway would
    // advertise a state this world cannot be in.
    attention: [],
    discovery: { reachable: true, catalogueSize: 20 },
  }
}

const predictorGame = (made: number, of: number, deadlineLabel: string | null): ShellGame => ({
  key: 'match-predictor',
  name: 'Match Predictor',
  summary: { kind: 'match-predictor', made, of, deadlineLabel },
})

const lmsGame = (
  life: 'alive' | 'eliminated' | 'not-entered',
  selection: string | null,
  deadlineLabel: string | null,
): ShellGame => ({
  key: 'last-man-standing',
  name: 'Last Man Standing',
  summary: {
    kind: 'last-man-standing',
    life,
    // The club a player has spent is a CHOICE they made, not a result — so it
    // is illustrative game data and belongs on the page, under the name of a
    // club that exists like every other name in this preview.
    selection: selection === null ? null : realFootballNames(selection),
    deadlineLabel,
  },
})

/* ==========================================================================
   THE VIEWER'S NAME, WHEREVER IT IS DRAWN
   ========================================================================== */

function marketingPlayerName(player: LeaguePlayer): LeaguePlayer {
  // KEYED ON THE DESTINATION AND NOT ON THE NAME. `destination.kind === 'you'`
  // is the model's own statement about which row is the reader's; matching on a
  // display string would rename any rival who happened to share it.
  return player.destination.kind === 'you'
    ? { ...player, displayName: MARKETING_PLAYER.name }
    : player
}

function marketingRow(row: LeaguesPrivateRow): LeaguesPrivateRow {
  return { ...row, player: marketingPlayerName(row.player) }
}

function marketingLeagues(model: LeaguesModel): LeaguesModel {
  const named: LeaguesModel = {
    ...model,
    context: {
      ...model.context,
      competitionName: realFootballNames(model.context.competitionName),
    },
  }
  const table = named.private
  if (table === null) return named
  return {
    ...named,
    private: {
      ...table,
      rows: table.rows.map(marketingRow),
      you: table.you === null ? null : marketingRow(table.you),
    },
  }
}

/** Games, with the competition it is inside named as the chrome names it. */
function marketingGames(model: GamesPageModel): GamesPageModel {
  return {
    ...model,
    context: {
      ...model.context,
      competitionName: realFootballNames(model.context.competitionName),
    },
  }
}

function marketingHome(model: HomeModel): HomeModel {
  const illustrative = illustrativeHome(model)
  return {
    ...illustrative,
    user: {
      ...illustrative.user,
      name: MARKETING_PLAYER.name,
      initials: MARKETING_PLAYER.initials,
    },
  }
}

/**
 * SATURDAY'S HOME: the same week, with nothing left to do.
 *
 * Built from Thursday's world rather than from a scenario of its own, because
 * it IS Thursday's world a day later — the same matchweek, the same fixtures,
 * the same private league. Only two things change, and they are the two things
 * that change in the product: the card is complete, and the primary action
 * stops asking for something.
 *
 * `review` rather than `watchLive`, deliberately. The player has finished; the
 * football has not started. `watchLive` is the state whose whole content is a
 * score, which is the one thing this preview may not print.
 */
const lockedHome: HomeModel = (() => {
  const base = marketingHome(homeScenarios.decision)
  // EVERY FIXTURE HAS A CALL ON IT, because that is what "locked" means. The
  // banner cannot say five of five are in while a card below it still offers
  // to take one — a preview that contradicts itself on the same screen is
  // worse than a preview that shows less.
  const played = base.upcomingMatches.map((match, index) => ({
    ...match,
    lockAt: null,
    prediction: {
      score: match.prediction?.score ?? { home: index === 0 ? 2 : 1, away: 1 },
      status: 'locked' as const,
      isJoker: match.prediction?.isJoker ?? false,
      outcome: null,
      points: null,
      pointsAreProvisional: false,
    },
  }))

  return {
    ...base,
    upcomingMatches: played,
    primaryAction: {
      ...base.primaryAction,
      type: 'review',
      title: 'Your matchweek is in',
      // FIVE, MATCHING THE SHELL'S OWN COUNT rather than the number of
      // fixtures Home has room to draw. The card is the matchweek; Home shows
      // the football nearest the reader, which is a subset of it in every
      // phase of this story.
      description: 'All five predictions are locked. Nothing to do but watch.',
      deadline: null,
      progress: { completed: 5, total: 5 },
      urgency: 'calm',
    },
  }
})()

/* ==========================================================================
   THE PHASES
   ========================================================================== */

export type MarketingSurface =
  | { readonly kind: 'home'; readonly model: HomeModel }
  | { readonly kind: 'matches'; readonly model: MatchesModel }
  | { readonly kind: 'leagues'; readonly model: LeaguesModel }
  | { readonly kind: 'games'; readonly model: GamesPageModel }

export type MarketingPhase = {
  readonly id: string
  /**
   * Which of the four destinations this phase is at.
   *
   * IT IS DECLARED RATHER THAN INFERRED, and it is what a test can hold: the
   * preview's promise is that it moves around the Competition Deck, and a
   * five-phase story that never left Home would still render perfectly.
   */
  readonly destination: ShellDestinationId
  readonly shell: VNextShellModel
  readonly surface: MarketingSurface
}

/**
 * FIVE PHASES, IN THE ORDER THE WEEK HAPPENS.
 *
 * Thursday's outstanding action, Friday's fixture list, Saturday's football,
 * Monday's table, and the one thing a weekly loop cannot show — that there is
 * more than one game in the season. Four destinations across five phases, with
 * Home visited twice because that is what a player actually does.
 *
 * FIVE RATHER THAN MORE. Each phase has to be readable in the seconds it is on
 * screen, and a visitor who scrolls past after ten seconds should have seen at
 * least two. A longer script is a longer wait for the payoff, which on an
 * acquisition page is the whole cost.
 */
export const MARKETING_PHASES: readonly MarketingPhase[] = [
  {
    id: 'deadline',
    destination: 'home',
    shell: marketingShell('Matchweek 4 · locks Saturday', [
      predictorGame(3, 5, 'Locks Saturday 17:30'),
      lmsGame('alive', 'Glenmore Athletic', 'Pick by Saturday'),
    ]),
    surface: { kind: 'home', model: marketingHome(homeScenarios.decision) },
  },
  {
    id: 'matchweek',
    destination: 'matches',
    shell: marketingShell('Matchweek 4 · locks Saturday', [
      predictorGame(5, 5, 'Locks Saturday 17:30'),
      lmsGame('alive', 'Glenmore Athletic', 'Pick by Saturday'),
    ]),
    surface: {
      kind: 'matches',
      model: illustrativeMatches(matchesScenarios.singleCompetition),
    },
  },
  {
    /*
     * SATURDAY, AND IT USED TO BE THE LIVE SCORES.
     *
     * The phase showed `homeScenarios.live` — matches in play, their minute,
     * and a provisional total moving. Every one of those is a claim about
     * football happening right now, and against clubs that exist it is a
     * fabricated live score on a public page. There is no version of that frame
     * this preview may draw.
     *
     * What survives is the BEAT, which was always the point: the deadline has
     * gone, the card is complete, and there is nothing left to do but watch.
     * That is a real Saturday feeling and it needs no invented result to show
     * it — the shell says `Locked`, the predictions are in, and the caption in
     * `landingPreviewScript.ts` says what happens next.
     */
    id: 'locked',
    destination: 'home',
    shell: marketingShell('Matchweek 4 · locked', [
      predictorGame(5, 5, 'Locked'),
      lmsGame('alive', 'Glenmore Athletic', null),
    ]),
    surface: { kind: 'home', model: lockedHome },
  },
  {
    id: 'table',
    destination: 'leagues',
    shell: marketingShell('Matchweek 4 · settled', [
      predictorGame(5, 5, 'Settled'),
      lmsGame('alive', 'Glenmore Athletic', null),
    ]),
    surface: { kind: 'leagues', model: marketingLeagues(leaguesScenarios.leagueSettled) },
  },
  {
    id: 'games',
    destination: 'games',
    shell: marketingShell('Matchweek 5 opens Wednesday', [
      predictorGame(0, 5, 'Opens Wednesday'),
      lmsGame('alive', 'Glenmore Athletic', null),
    ]),
    surface: { kind: 'games', model: marketingGames(gamesScenarios.allOpen) },
  },
]

/**
 * The phase a given step shows.
 *
 * TOTAL BY CONSTRUCTION. An index outside the script wraps rather than
 * returning undefined, so no caller can render an empty device — and the
 * wrapping is what makes the sequence a loop rather than something that ends on
 * a still. `((n % c) + c) % c` rather than `n % c`, because a negative step from
 * a "previous" control is a real input and `-1 % 5` is `-1` in JavaScript.
 */
export function marketingPhaseAt(index: number): MarketingPhase {
  const count = MARKETING_PHASES.length
  const wrapped = ((index % count) + count) % count
  return MARKETING_PHASES[wrapped] as MarketingPhase
}
