import type {
  GameEntry,
  GameStanding,
  GamesPageModel,
  GamesPanel,
  RegistrationOutlook,
  RejoinOutlook,
} from '../../models/games'
import {
  presentLmsRegistration,
  MAIN_PREDICTOR_REGISTRATION_COPY,
} from '../../../features/season/lmsRegistrationModel'
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
 * WHERE REGISTRATION STANDS, from the shared authority.
 *
 * `entered` is passed as false unconditionally: this branch is only reached for
 * a player with no membership row, and passing their real membership would ask
 * the authority a question this mapper has already answered.
 */
function registrationOf(game: CompetitionGame, serverNow: string): RegistrationOutlook {
  const presented = presentLmsRegistration(
    {
      competitionId: game.id,
      entered: false,
      joinedAt: null,
      registrationOpensAt: game.registrationOpensAt,
      registrationClosesAt: game.registrationClosesAt,
      completedAt: game.completedAt,
      serverNow,
    },
    MAIN_PREDICTOR_REGISTRATION_COPY,
  )

  switch (presented.state) {
    case 'finished':
      return 'finished'
    case 'not_open':
      return 'not-open'
    case 'closed':
      return 'closed'
    default:
      // `entered` is false above, so `entered` is unreachable and `open` is the
      // only state left. Named rather than defaulted silently.
      return 'open'
  }
}

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
    return { kind: 'never-joined', registration: registrationOf(game, serverNow) }
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

function gamesPanelOf(source: GamesSource): GamesPanel {
  if (source.games.kind !== 'ok') return { kind: 'unavailable' }

  const read = source.games.games
  // THE COMPETITION'S ANSWER ABOUT THE CALLER, not about the games. A
  // non-member is told so rather than shown an empty catalogue.
  if (!read.competitionMember) return { kind: 'not-a-member' }
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
