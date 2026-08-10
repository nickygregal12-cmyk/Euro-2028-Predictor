import {
  SEASON_JOKERS_PER_HALF,
  SEASON_JOKERS_PER_SEASON,
  SEASON_PREDICTOR_POINTS,
} from '../../domain/season/scoring'
import { publicLmsSetup } from '../../domain/season/lmsPresets'
import { LMS_PUBLIC_JOINT_WINNER_CAP } from '../../domain/season/lmsRoundResolution'
import { CUP_TIE_MATCH_POINTS } from '../../domain/season/cupTieSettlement'

/**
 * How each season game works, in the player's words and the authority's
 * numbers.
 *
 * EVERY NUMBER IS IMPORTED, NEVER TYPED OUT. A rules screen is the most
 * tempting place in a codebase to write "5 points for an exact score" as prose,
 * and the moment it is written the product has two scoring authorities — one
 * that pays out and one that explains. Each figure below comes from the module
 * that decides it, so a rule change moves the explanation with it or fails to
 * compile.
 *
 * IT DESCRIBES THE SEASON GAMES, NOT EURO 2028. `docs/scoring-rules.md` is the
 * preserved Euro Original Predictor configuration — a different game with a
 * different scale, group and knockout scoring and its own bonuses. Linking a
 * domestic player there would be worse than saying nothing, so nothing here
 * links to it and nothing here is derived from it.
 *
 * IT ADDS NO RULES. Every line restates something an authority already decides:
 * the two point values and the Joker allowance from `domain/season/scoring`,
 * the public Last Man Standing setup from `lmsPresets` and its joint-winner cap
 * from `lmsRoundResolution`, the Championship's per-tie points from
 * `cupTieSettlement`. Where a game's behaviour is configurable per competition
 * — private Last Man Standing lives and saves — the text says the public
 * competition's setup and says that it is the public one, rather than implying
 * every competition plays that way.
 *
 * PURE. Constants in, sentences out.
 */

type GameRuleSection = {
  heading: string
  lines: readonly string[]
}

export type GameRules = {
  /** The game, named the way the rest of the product names it. */
  name: string
  /** One sentence: what the player is trying to do. */
  summary: string
  sections: readonly GameRuleSection[]
}

const PUBLIC_LMS = publicLmsSetup()

export const MATCH_PREDICTOR_RULES: GameRules = {
  name: 'Match Predictor',
  summary: 'Predict the score of every fixture in the matchweek. Points build up all season.',
  sections: [
    {
      heading: 'Points',
      lines: [
        `Exact score: ${SEASON_PREDICTOR_POINTS.exactScore} points.`,
        `Correct result, wrong score: ${SEASON_PREDICTOR_POINTS.correctResult} points.`,
        // The single most misread rule in the game: the two do not stack.
        `An exact score is worth ${SEASON_PREDICTOR_POINTS.exactScore} in total — it replaces the ${SEASON_PREDICTOR_POINTS.correctResult}, it does not add to it.`,
        'Anything else scores nothing, and a fixture you did not predict scores nothing.',
      ],
    },
    {
      heading: 'The Joker',
      lines: [
        'A Joker doubles your points for the whole matchweek, not one fixture.',
        `You get ${SEASON_JOKERS_PER_SEASON} a season — ${SEASON_JOKERS_PER_HALF} in each half, with no carrying an unused one forward.`,
        'One Joker per matchweek at most.',
      ],
    },
  ],
}

export const LAST_MAN_STANDING_RULES: GameRules = {
  name: 'Last Man Standing',
  summary: 'Pick one club to win each round. Survive longer than everyone else.',
  sections: [
    {
      heading: 'Surviving a round',
      lines: [
        'Pick one club from the fixtures in that round. Your club has to win.',
        PUBLIC_LMS.drawsRule === 'eliminate'
          ? 'A draw eliminates you, the same as a defeat.'
          : 'A draw keeps you in.',
        PUBLIC_LMS.lives === 0
          ? 'In the public competition there are no extra lives and no saves — one wrong pick is the end of your run.'
          : `In the public competition you have ${PUBLIC_LMS.lives} extra ${PUBLIC_LMS.lives === 1 ? 'life' : 'lives'} and ${PUBLIC_LMS.saves} ${PUBLIC_LMS.saves === 1 ? 'save' : 'saves'}.`,
      ],
    },
    {
      heading: 'Choosing a club',
      lines: [
        'You cannot pick a club you have already used, until your used list resets.',
        'The reset happens automatically once every club playing that round is already on your list — you are never eliminated for running out of clubs.',
        'Miss the deadline and a club is assigned for you: the first eligible unused club in alphabetical order. It is deterministic, and it is no better or worse than picking late.',
      ],
    },
    {
      heading: 'Winning',
      lines: [
        'The last player standing wins.',
        `If a round takes out everyone left, the public competition names joint winners — up to ${LMS_PUBLIC_JOINT_WINNER_CAP} of them.`,
        'A private competition can be set up differently; its own page says how.',
      ],
    },
  ],
}

export const PREDICTOR_CHAMPIONSHIP_RULES: GameRules = {
  name: 'Predictor Championship',
  summary:
    'A head-to-head tie every matchweek, decided by the Match Predictor points you were scoring anyway.',
  sections: [
    {
      heading: 'How a tie is decided',
      lines: [
        'You are drawn against one other entrant each matchweek.',
        'Whoever scores more from that matchweek’s fixtures wins the tie.',
        `A win is worth ${CUP_TIE_MATCH_POINTS.win} points in the table, a draw ${CUP_TIE_MATCH_POINTS.draw}, a defeat ${CUP_TIE_MATCH_POINTS.loss}.`,
      ],
    },
    {
      heading: 'Playing it',
      lines: [
        'There is nothing extra to enter. Your Match Predictor card is your tie.',
        'The table runs through the season, and the field splits into two halves partway through — you carry your record with you.',
      ],
    },
  ],
}

export const SEASON_GAME_RULES = {
  main_predictor: MATCH_PREDICTOR_RULES,
  last_man_standing: LAST_MAN_STANDING_RULES,
  predictor_cup: PREDICTOR_CHAMPIONSHIP_RULES,
} as const

export type SeasonRulesGameKey = keyof typeof SEASON_GAME_RULES

export function seasonGameRules(key: SeasonRulesGameKey): GameRules {
  return SEASON_GAME_RULES[key]
}
