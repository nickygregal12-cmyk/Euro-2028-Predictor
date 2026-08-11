import { describe, expect, it } from 'vitest'
import {
  privatePlayHref,
  PRIVATE_PLAY_GAME_NAME,
  type PrivatePlayGameKind,
} from '../../../src/features/hub/privatePlayModel'

/**
 * Where a private container on `/leagues` opens, per game.
 *
 * THE DEFECT THIS PINS. `GlobalLeaguesPage` gave every container the same
 * destination — `competitionSectionRoute(competition, 'leagues')` — for all
 * three games. That address is the MATCH PREDICTOR league workspace, which is
 * the only one `UI-F12` delivers. So a Last Man Standing or Predictor
 * Championship card offered "Open in <competition>" and landed the player on a
 * list their container was not in. To the player that is indistinguishable from
 * the container having been deleted, which is the worst reading available for a
 * thing whose whole purpose is that their friends are in it.
 *
 * A wrong destination is worse than a stated absence, so the link is withheld
 * and the card says so. The missing read and the missing page are registered
 * together as `MIG-UI-20`; this test is what fails if someone closes the gap by
 * pointing the card somewhere convenient instead.
 */

const COMPETITION_LEAGUES = '/competitions/premier-league/2026-27/leagues'

describe('where a private container opens', () => {
  it('opens a Match Predictor league in its competition workspace', () => {
    expect(privatePlayHref('main_predictor', COMPETITION_LEAGUES)).toBe(COMPETITION_LEAGUES)
  })

  it('withholds a destination from the two games that have no workspace', () => {
    // Named individually rather than swept, so adding a fourth game to
    // `PrivatePlayGameKind` is a decision someone takes here rather than a
    // default it inherits.
    expect(privatePlayHref('last_man_standing', COMPETITION_LEAGUES)).toBeNull()
    expect(privatePlayHref('predictor_cup', COMPETITION_LEAGUES)).toBeNull()
  })

  it('never invents a destination when the competition has none', () => {
    // A competition with no routable Leagues section cannot lend one to the
    // game that does have a workspace.
    for (const game of Object.keys(PRIVATE_PLAY_GAME_NAME) as PrivatePlayGameKind[]) {
      expect(privatePlayHref(game, null)).toBeNull()
    }
  })

  it('covers every game the list can show', () => {
    // Guards against the sweep above going vacuous if the union is narrowed.
    expect(Object.keys(PRIVATE_PLAY_GAME_NAME).sort()).toEqual([
      'last_man_standing',
      'main_predictor',
      'predictor_cup',
    ])
  })
})
