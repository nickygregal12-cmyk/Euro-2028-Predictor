import { describe, expect, it } from 'vitest'
import { mapOrganisedCompetitions } from '../../src/services/supabase/organisedCompetitionsModel'

describe('Contract 165 organiser list wire identity', () => {
  it('decodes competition_id from the bounded list response', () => {
    const rows = mapOrganisedCompetitions({
      total: 1,
      limit: 25,
      offset: 0,
      has_more: false,
      competitions: [
        {
          competition_id: 'cup-1',
          name: 'Office Championship',
          game_key: 'predictor_cup',
          game_name: 'Predictor Championship',
          tournament_id: 'season-1',
          season_name: 'Premier League 2026/27',
          season_key: '2026-27',
          created_at: '2026-08-14T12:00:00Z',
          completed_at: null,
          registration_closes_at: null,
          entrants: 4,
        },
      ],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'cup-1',
      name: 'Office Championship',
      gameKey: 'predictor_cup',
      seasonName: 'Premier League 2026/27',
    })
  })

  it('still accepts id from the addressed detail shape but invents no third fallback', () => {
    expect(
      mapOrganisedCompetitions([
        { id: 'detail-id', name: 'Detail-shaped row', game_key: 'last_man_standing' },
      ])[0]?.id,
    ).toBe('detail-id')

    expect(
      mapOrganisedCompetitions([
        { tournament_id: 'not-the-container-id', name: 'Missing identity' },
      ]),
    ).toEqual([])
  })
})
