import { describe, expect, it } from 'vitest'
import { buildActionsModel } from '../../src/vnext/integration/actions/buildActionsModel'
import type { ActionsSource } from '../../src/vnext/integration/actions/actionsSource'
import {
  actionsNeedingYou,
  actionsNews,
  unseenActionKeys,
} from '../../src/vnext/models/actions'
import type { PersistentPlayerAction } from '../../src/services/supabase/playerActions'
import { at, first } from '../support/indexed'

/**
 * THE ACTION CENTRE MAPPING, TESTED AS TRUTH RATHER THAN AS SHAPE.
 *
 * A pure mapper, a hand-built source, no Supabase, no network, no React and no
 * clock. Almost none of the assertions check that a field was copied — a rename
 * is the compiler's job. They check the things that would be WRONG:
 *
 *   1. NO SENTENCE IS INVENTED. A context missing a field produces silence, not
 *      a zero and not a plausible default. This is the whole risk of a file
 *      whose job is composing copy from a payload.
 *   2. THE ORDER IS THE SERVER'S. The source below arrives deliberately NOT in
 *      priority order, so a mapper that sorted would produce a tidy and wrong
 *      answer here rather than an identical one.
 *   3. WORK AND NEWS ARE SPLIT BY `action_type` and never by a judgement.
 *   4. THE UNSEEN COUNT IS THE SERVER'S, never a count of the rows.
 *   5. A COMPETITION THE PLAYER'S LIST DOES NOT COVER IS NAMED AS UNKNOWN, not
 *      labelled with its id and not dropped.
 */

function action(over: Partial<PersistentPlayerAction> = {}): PersistentPlayerAction {
  return {
    actionKey: 'lms_pick_due:comp-1:window-9',
    actionType: 'lms_pick_due',
    priority: 1,
    tournamentId: 'tournament-1',
    competitionId: 'comp-1',
    deadlineAt: '2026-08-29T14:00:00.000Z',
    expiresAt: '2026-08-29T14:00:00.000Z',
    context: { window_id: 'window-9', round_label: 'Round 9' },
    seen: false,
    seenAt: null,
    dismissed: false,
    generatedAt: '2026-08-23T09:00:00.000Z',
    ...over,
  }
}

function source(over: Partial<ActionsSource> = {}): ActionsSource {
  return {
    feed: { unseen: 1, actions: [action()] },
    competitions: [{ tournamentId: 'tournament-1', name: 'Caledonian Premiership' }],
    ...over,
  }
}

describe('the vNext action feed', () => {
  it('returns null for a feed that has not landed, which is not an empty feed', () => {
    // The distinction the surface depends on: nothing may claim "you are up to
    // date" while the read is still out.
    expect(buildActionsModel(source({ feed: null }))).toBeNull()
  })

  it('returns an empty model once the server has actually said so', () => {
    const model = buildActionsModel(source({ feed: { unseen: 0, actions: [] } }))
    expect(model).not.toBeNull()
    expect(model?.items).toEqual([])
    expect(model?.unseen).toBe(0)
  })

  it('keeps the server order and does not sort', () => {
    // Priority 3 first, then 1. An LMS pick outranking a matchweek is a rule
    // about ELIMINATION and it lives in the database; a mapper that reordered
    // here would be a second opinion about it.
    const model = buildActionsModel(
      source({
        feed: {
          unseen: 2,
          actions: [
            action({ actionKey: 'b', actionType: 'matchweek_settled', priority: 3, context: {} }),
            action({ actionKey: 'a', actionType: 'lms_pick_due', priority: 1 }),
          ],
        },
      }),
    )

    expect(model?.items.map((item) => item.key)).toEqual(['b', 'a'])
  })

  it('takes the unseen count from the server rather than counting rows', () => {
    // The read caps at fifty and computes `unseen` over the whole table, so a
    // count of the rows would silently under-report a busy player.
    const model = buildActionsModel(
      source({
        feed: { unseen: 74, actions: [action({ seen: true })] },
      }),
    )

    expect(model?.unseen).toBe(74)
  })

  it('splits work from news by the server type', () => {
    const model = buildActionsModel(
      source({
        feed: {
          unseen: 0,
          actions: [
            action({ actionKey: 'w1', actionType: 'matchweek_predictions_due' }),
            action({ actionKey: 'w2', actionType: 'lms_pick_due' }),
            action({ actionKey: 'w3', actionType: 'cup_penalty_number_due' }),
            action({ actionKey: 'n1', actionType: 'matchweek_settled', context: {} }),
            action({ actionKey: 'n2', actionType: 'game_consequence', context: {} }),
          ],
        },
      }),
    )!

    expect(actionsNeedingYou(model).map((item) => item.key)).toEqual(['w1', 'w2', 'w3'])
    expect(actionsNews(model).map((item) => item.key)).toEqual(['n1', 'n2'])
  })

  it('files a kind it does not recognise as news rather than as work', () => {
    // Telling a player they owe something and being unable to say what is worse
    // than reporting it quietly, and an unknown kind carries no deadline this
    // build can interpret.
    const model = buildActionsModel(
      source({
        feed: { unseen: 1, actions: [action({ actionType: 'something_new', context: {} })] },
      }),
    )!

    expect(first(model.items).kind).toBe('unknown')
    expect(actionsNeedingYou(model)).toEqual([])
    expect(first(model.items).headline).toBeTruthy()
  })

  it('names the competition from the player list and never from the id', () => {
    const model = buildActionsModel(source())!
    expect(first(model.items).competitionName).toBe('Caledonian Premiership')
  })

  it('leaves a competition it cannot name as null, and still shows the row', () => {
    const model = buildActionsModel(
      source({ competitions: [{ tournamentId: 'other', name: 'Somewhere else' }] }),
    )!

    expect(first(model.items).competitionName).toBeNull()
    // AND IT IS STILL THERE. A deadline the player cannot be told the name of
    // is still a deadline.
    expect(model.items).toHaveLength(1)
  })

  describe('the copy it composes', () => {
    function copyFor(
      actionType: string,
      context: Record<string, unknown>,
    ): { headline: string; detail: string | null } {
      const model = buildActionsModel(
        source({ feed: { unseen: 0, actions: [action({ actionType, context })] } }),
      )!
      const item = first(model.items)
      return { headline: item.headline, detail: item.detail }
    }

    it('states real progress on a card, which the deadline alone cannot', () => {
      expect(
        copyFor('matchweek_predictions_due', {
          round_label: 'Matchweek 4',
          fixtures: 10,
          predicted: 4,
        }),
      ).toEqual({ headline: 'Matchweek 4 predictions needed', detail: '4 of 10 predicted' })
    })

    it('says how many there are rather than "0 of 10" on an untouched card', () => {
      expect(
        copyFor('matchweek_predictions_due', {
          round_label: 'Matchweek 4',
          fixtures: 10,
          predicted: 0,
        }),
      ).toEqual({ headline: 'Matchweek 4 predictions needed', detail: '10 fixtures to predict' })
    })

    it('says nothing about counts the context did not carry', () => {
      expect(copyFor('matchweek_predictions_due', { round_label: 'Matchweek 4' })).toEqual({
        headline: 'Matchweek 4 predictions needed',
        detail: null,
      })
    })

    it('falls back to the kind, never to an invented round', () => {
      expect(copyFor('matchweek_predictions_due', {})).toEqual({
        headline: 'Predictions needed',
        detail: null,
      })
    })

    it('reports the points a settled matchweek banked', () => {
      expect(
        copyFor('matchweek_settled', {
          round_label: 'Matchweek 3',
          points: 47,
          fixtures_scored: 10,
        }),
      ).toEqual({ headline: 'Matchweek 3 is settled', detail: '47 points banked' })
    })

    it('names the Joker where the server applied one', () => {
      expect(
        copyFor('matchweek_settled', {
          round_label: 'Matchweek 3',
          points: 62,
          joker_applied: true,
        }),
      ).toEqual({ headline: 'Matchweek 3 is settled', detail: '62 points banked, Joker applied' })
    })

    it('never renders a missing points value as zero', () => {
      // THE BINDING CASE FOR THIS FILE. "0 points banked" and "we were not told"
      // are different sentences and only one of them is true.
      const copy = copyFor('matchweek_settled', { round_label: 'Matchweek 3', fixtures_scored: 8 })
      expect(copy.detail).toBe('8 fixtures scored')
      expect(copy.detail).not.toContain('0 points')
    })

    it('distinguishes a genuine zero from a missing one', () => {
      // A player who banked nothing DID bank nothing, and the server said so.
      expect(copyFor('matchweek_settled', { round_label: 'Matchweek 3', points: 0 })).toEqual({
        headline: 'Matchweek 3 is settled',
        detail: '0 points banked',
      })
    })

    it('uses the server outcome vocabulary for a consequence', () => {
      expect(copyFor('game_consequence', { outcome: 'eliminated' }).headline).toBe(
        'You were eliminated',
      )
      expect(copyFor('game_consequence', { outcome: 'champion' }).headline).toBe('You won it')
      expect(copyFor('game_consequence', { outcome: 'survived' }).headline).toBe(
        'You survived the round',
      )
    })

    it('separates a disqualification from an elimination, as the server does', () => {
      expect(copyFor('game_consequence', { outcome: 'eliminated', disqualified: true })).toEqual({
        headline: 'You were eliminated',
        detail: 'Disqualified',
      })
    })

    it('claims nothing for an outcome word it does not know', () => {
      const copy = copyFor('game_consequence', { outcome: 'promoted' })
      expect(copy.headline).toBe('Your game moved on')
      expect(copy.detail).toBeNull()
    })

    it('singularises a count of one', () => {
      expect(copyFor('matchweek_settled', { round_label: 'MW1', points: 1 }).detail).toBe(
        '1 point banked',
      )
    })

    it('ignores a context value of the wrong type rather than printing it', () => {
      // A malformed payload must not put "NaN" or "[object Object]" in front of
      // a player.
      const copy = copyFor('matchweek_settled', {
        round_label: 'Matchweek 3',
        points: 'lots',
      })
      expect(copy.detail).toBeNull()
    })
  })

  describe('which game an item is about', () => {
    function gameFor(actionType: string, context: Record<string, unknown> = {}) {
      const model = buildActionsModel(
        source({ feed: { unseen: 0, actions: [action({ actionType, context })] } }),
      )!
      return first(model.items).game
    }

    it('takes the game from the kind where only one game generates it', () => {
      expect(gameFor('matchweek_predictions_due')).toBe('match-predictor')
      expect(gameFor('lms_pick_due')).toBe('last-man-standing')
      expect(gameFor('cup_penalty_number_due')).toBe('championship')
      // Contract 173 reads `season_matchweek_scores`, which is the Match
      // Predictor's — so a settled matchweek is that game's news.
      expect(gameFor('matchweek_settled')).toBe('match-predictor')
    })

    it('reads the game a consequence names rather than guessing it', () => {
      // THE ONE KIND THAT SPANS GAMES. It is generated from
      // `bonus_competitions.game_key`, so it says which and is not inferred
      // from the competition id or from the outcome word.
      expect(gameFor('game_consequence', { game_key: 'last_man_standing' })).toBe(
        'last-man-standing',
      )
      expect(gameFor('game_consequence', { game_key: 'predictor_cup' })).toBe('championship')
    })

    it('answers null for a game_key this build has no surface for', () => {
      // `ko_predictor` is a real value in the database vocabulary with no vNext
      // route. Sending a player to the nearest game that DOES have one would be
      // worse than offering no link, so the row becomes information.
      expect(gameFor('game_consequence', { game_key: 'ko_predictor' })).toBeNull()
      expect(gameFor('game_consequence', {})).toBeNull()
    })

    it('answers null for a kind it cannot interpret', () => {
      expect(gameFor('something_new')).toBeNull()
    })
  })

  it('lists exactly the keys whose seen state the server has not recorded', () => {
    const model = buildActionsModel(
      source({
        feed: {
          unseen: 2,
          actions: [
            action({ actionKey: 'a', seen: false }),
            action({ actionKey: 'b', seen: true }),
            action({ actionKey: 'c', seen: false }),
          ],
        },
      }),
    )!

    expect(unseenActionKeys(model)).toEqual(['a', 'c'])
  })

  it('carries the deadline as the server sent it, unformatted and uncompared', () => {
    const model = buildActionsModel(source())!
    expect(at(model.items, 0).deadlineAt).toBe('2026-08-29T14:00:00.000Z')
  })
})
