import { describe, expect, it } from 'vitest'

import {
  MAIN_PREDICTOR_ID,
  NICKY_USER_ID,
  PRIVATE_CHAMPIONSHIP_ID,
  SCOTTISH_TOURNAMENT_ID,
  WEEKEND_ENTRANTS,
  seedSql,
} from '../../scripts/seed-dev/seed-scottish-private-championship-weekend'

describe('Scottish private Championship weekend Development seed', () => {
  const sql = seedSql()

  it('pins Nicky Gregal into the deterministic eight-player field', () => {
    expect(WEEKEND_ENTRANTS).toHaveLength(8)
    expect(WEEKEND_ENTRANTS[0]).toEqual({
      userId: NICKY_USER_ID,
      displayName: 'Nicky Gregal',
    })
    expect(new Set(WEEKEND_ENTRANTS.map((entrant) => entrant.userId)).size).toBe(8)
  })

  it('is pinned to the Scottish Development rehearsal rows', () => {
    expect(sql).toContain(SCOTTISH_TOURNAMENT_ID)
    expect(sql).toContain(MAIN_PREDICTOR_ID)
    expect(sql).toContain(PRIVATE_CHAMPIONSHIP_ID)
    expect(sql).toContain("name = 'Scottish Premiership 2026/27'")
    expect(sql).toContain('Required Development rehearsal identity')
  })

  it('protects Nicky own confirmed MW2 card rather than replacing it', () => {
    expect(sql).toContain('Nicky Gregal MW2 card changed from the protected six-pick confirmed baseline')
    expect(sql).toContain('v_prediction_count <> 6')
    expect(sql).toContain("v_card_status is distinct from 'confirmed'")
    expect(sql.indexOf(`v_user.user_id = '${NICKY_USER_ID}'::uuid`)).toBeLessThan(
      sql.indexOf('public.save_season_prediction'),
    )
  })

  it('creates support cards through the player authorities, not raw prediction tables', () => {
    expect(sql).toContain('public.join_competition_game(v_main_predictor)')
    expect(sql).toContain('public.save_season_prediction(')
    expect(sql).toContain('public.confirm_season_matchweek_card(v_tournament, 2)')
    expect(sql).not.toMatch(/insert\s+into\s+public\.(entries|game_memberships|season_predictions|season_matchweek_cards)/i)
  })

  it('refuses to seed after the real MW2 lock', () => {
    expect(sql).toContain('predictor_internal.season_matchweek_lock_at')
    expect(sql).toContain('Scottish Matchweek 2 is already locked')
    expect(sql.indexOf('season_matchweek_lock_at')).toBeLessThan(
      sql.indexOf('public.save_season_prediction'),
    )
  })

  it('launches only a private Championship and leaves public launch rules alone', () => {
    expect(sql).toContain("'predictor_cup', false, 'active'")
    expect(sql).toContain("true, 'private'")
    expect(sql).toContain('public.admin_open_season_competition(v_private_cup)')
    expect(sql).not.toContain('admin_draw_predictor_cup')
    expect(sql).not.toContain("visibility_kind = 'public'")
  })

  it('treats a launched competition as verification-only and never redraws it', () => {
    expect(sql).toContain('Scottish private Championship rehearsal is already launched; left untouched')
    expect(sql).toContain('launched with a different field')
    expect(sql.indexOf('already launched; left untouched')).toBeLessThan(
      sql.indexOf('select id into strict v_mw2'),
    )
  })

  it('is additive and contains no destructive reset', () => {
    expect(sql).not.toMatch(/\bdelete\s+from\b/i)
    expect(sql).not.toMatch(/\btruncate\b/i)
    expect(sql).not.toMatch(/\bdrop\s+(table|schema)\b/i)
  })
})
