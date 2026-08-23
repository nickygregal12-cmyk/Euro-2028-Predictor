import { weekActionCallToAction, weekActionForGame } from '../../../features/hub/competitionWeekModel'
import type {
  GameEntry,
  GameWeekAction,
  GameStanding,
  GamesPageModel,
  GamesPanel,
  RejoinOutlook,
} from '../../models/games'
import { registrationOutlookOf } from './registrationOutlook'
import type { CompetitionGame } from '../../../services/supabase/competitionGamesModel'
import type { GamesSource } from './gamesSource'

/**
 * `GamesSource` → `GamesPageModel`. PURE.
 *
 * ============================ IT DOES NOT RESTATE THE ENTRY RULE ========
 *
 * `lmsRegistrationModel.ts` already resolves where registration stands from the
 * stored instants against the server's clock, and it is GAME-NEUTRAL BY
 * DESIGN — its own words: "`join_competition_game` governs entry for every game
 * key, so a second copy of this logic per game would be three chances to
 * disagree about one rule." This calls it rather than re-deriving it, and takes
 * only its `state`; the WORDS are vNext's, because that module's copy belongs
 * to the production surfaces it was written for.
 *
 * The copy constant passed in is irrelevant to the state and is passed only
 * because the signature requires one. Nothing here reads the headline or the
 * explanation it produces.
 *
 * ============================ WHAT IT REFUSES TO DECIDE =================
 *
 * WHETHER A PLAYER WHO LEFT MAY REJOIN. See `models/games.ts`: the rule turns
 * on whether the competition is RUNNING, and `competition_is_running` is
 * revoked from `authenticated`. The mapper reports the rule and not a verdict.
 */


/**
 * WHETHER A REJOIN IS DETERMINATE.
 *
 * `allow_rejoin` true means the game permits it whatever has happened, so the
 * answer is knowable. False means it is refused ONCE RUNNING — and running-ness
 * is not readable — so the honest answer is the rule, not a verdict.
 */
function rejoinOf(game: CompetitionGame): RejoinOutlook {
  return game.allowRejoin ? 'allowed' : 'only-before-it-starts'
}

function standingOf(game: CompetitionGame, serverNow: string): GameStanding {
  const membership = game.membership
  if (membership === null) {
    return { kind: 'never-joined', registration: registrationOutlookOf(game, serverNow) }
  }

  // THE STATUS IS THE SERVER'S WORD. The catalogue's own check constraint fixes
  // it at `active | left | disqualified`, and each is paired with its own
  // timestamps there — so nothing here reads `disqualifiedAt` to decide what
  // `status` already states.
  switch (membership.status) {
    case 'active':
      return { kind: 'playing' }
    case 'disqualified':
      return { kind: 'disqualified' }
    case 'left':
      return { kind: 'left', rejoin: rejoinOf(game) }
    default:
      // A STATUS THIS LANE DOES NOT KNOW is not silently read as playing. The
      // membership row exists, so `never-joined` would be false too; the safe
      // answer is the one that offers nothing and claims nothing.
      return { kind: 'left', rejoin: rejoinOf(game) }
  }
}

/**
 * WHAT ONE GAME IS ASKING, FROM THAT GAME'S OWN READ.
 *
 * `weekActionForGame` is `competitionWeekModel`'s own catalogue-key lookup —
 * the one place the week model's kinds and the catalogue's keys are allowed to
 * meet. Matching here on a key this lane invented would be a second mapping,
 * and the first one to drift would be the one a player pressed.
 *
 * THE VERB COMES FROM `weekActionCallToAction`, NOT FROM THIS FILE. It returns
 * null for anything not outstanding — and always for the Championship, which is
 * won by Match Predictor points and asks for nothing. A null `call` is what
 * makes a row a destination, so the "is this a task?" decision is taken once,
 * in the model, for every surface.
 */
function weekActionOf(source: GamesSource, gameKey: string): GameWeekAction | null {
  const action = weekActionForGame(source.week, gameKey)
  if (action === null) return null

  return {
    title: action.title,
    outstanding: action.outstanding,
    deadline: action.locksAt,
    call: weekActionCallToAction(action),
  }
}

function gamesPanelOf(source: GamesSource): GamesPanel {
  if (source.games.kind !== 'ok') return { kind: 'unavailable' }

  const read = source.games.games
  // `competitionMember` IS DELIBERATELY NOT READ HERE. It is a summary of the
  // per-game memberships below, and gating the catalogue on it would hide every
  // joinable game from the player with nothing joined. See `models/games.ts`.
  if (read.games.length === 0) return { kind: 'empty' }

  // The server's own instant where it supplied one. The host's is the fallback,
  // and it is only ever reached for a read that answered without a clock.
  const serverNow = read.serverNow ?? source.generatedAt

  const entries: GameEntry[] = read.games.map((game) => ({
    id: game.id,
    gameKey: game.gameKey,
    displayName: game.displayName,
    active: game.active,
    standing: standingOf(game, serverNow),
    weekAction: weekActionOf(source, game.gameKey),
  }))

  return { kind: 'games', entries }
}

export function buildGamesModel(source: GamesSource): GamesPageModel {
  const serverNow =
    source.games.kind === 'ok' ? source.games.games.serverNow ?? source.generatedAt : source.generatedAt

  return {
    generatedAt: serverNow,
    context: {
      competitionName: source.context.competitionName,
      seasonLabel: source.context.seasonLabel,
    },
    games: gamesPanelOf(source),
  }
}
