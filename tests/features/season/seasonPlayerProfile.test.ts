import { describe, expect, it } from 'vitest'
import { mapSeasonPlayerProfile } from '../../../src/services/supabase/seasonPlayerProfileModel'
import { mapSeasonFixture } from '../../../src/services/supabase/seasonFixtureListModel'
import { presentFixture } from '../../../src/features/season/fixtureListModel'
import { presentMatchweekRecap } from '../../../src/features/hub/matchweekRecapModel'
import { mapSeasonLeagueMovement } from '../../../src/services/supabase/seasonLeagueMovementModel'

/**
 * Contracts 148 and 151 as the browser consumes them.
 *
 * CONTRACT 148 — one fixture, addressed by its own id. The property under test
 * is that a fixture reached from a LINK is described identically to the same
 * fixture reached from the CALENDAR: the addressed read returns contract 139's
 * entry field for field, and both decode through the same functions, so there
 * is no second vocabulary to drift.
 *
 * CONTRACT 151 — one player's season. The properties are that not-entered is an
 * answer rather than an error, that absent points stay absent rather than
 * becoming zero, and that the counts are counts. Whether a caller MAY read a
 * player at all is the server's decision and is proved in pgTAP, not here — a
 * browser-side re-check would be a second boundary that can disagree.
 */

describe('a fixture addressed by its own id', () => {
  const payload = {
    competition: {
      id: 'season-1',
      name: 'Premier League',
      slug: 'premier-league',
      season_key: '2026-27',
      time_zone: 'Europe/London',
    },
    server_now: '2026-08-15T13:00:00Z',
    fixture: {
      id: 'fixture-1',
      kickoff_at: '2026-08-15T14:00:00Z',
      status: 'scheduled',
      round: { id: 'round-5', ordinal: 5, label: 'Matchweek 5' },
      home: { name: 'Arsenal', short_code: 'ARS', club_colours: '#EF0107' },
      away: { name: 'Chelsea', short_code: 'CHE', club_colours: '#034694' },
      result: null,
      live: { kind: 'in_play', home: 1, away: 0, observed_at: '2026-08-15T14:35:00Z' },
    },
  }

  it('carries the round, both clubs and the competition’s own route slug', () => {
    const answer = mapSeasonFixture(payload)
    expect(answer.competition.slug).toBe('premier-league')
    expect(answer.fixture?.round).toEqual({ id: 'round-5', ordinal: 5, label: 'Matchweek 5' })
    expect(answer.fixture?.home.name).toBe('Arsenal')
  })

  it('never promotes a provider’s score to a result', () => {
    const answer = mapSeasonFixture(payload)
    // Two fields, and they stay two fields. `result` is the platform's
    // settlement and is null; `live` is what a provider currently reports.
    expect(answer.fixture?.result).toBeNull()
    expect(answer.fixture?.live).toEqual({
      kind: 'in_play',
      home: 1,
      away: 0,
      observedAt: '2026-08-15T14:35:00Z',
    })

    const presented = presentFixture(answer.fixture!, 'Europe/London')
    expect(presented.row.score).toBeNull()
    expect(presented.row.provisional).toBe('1 - 0')
    expect(presented.row.played).toBe(false)
  })

  it('always prints the matchweek, because a standalone page has no day heading', () => {
    const presented = presentFixture(mapSeasonFixture(payload).fixture!, 'Europe/London')
    expect(presented.row.roundLabel).toBe('Matchweek 5')
    expect(presented.row.round).toEqual({ ordinal: 5, name: 'Matchweek 5' })
    // The day wording follows the runner's locale; the DATE is what matters.
    expect(presented.dayLabel).toContain('15')
  })

  it('returns no fixture rather than half of one', () => {
    const answer = mapSeasonFixture({
      ...payload,
      fixture: { id: 'fixture-1', status: 'scheduled', home: { name: 'Arsenal' } },
    })
    expect(answer.fixture).toBeNull()
  })
})

describe('one player’s season', () => {
  const entered = {
    player: { user_id: 'player-2', display_name: 'Sam', is_self: false },
    entered: true,
    server_now: '2026-08-16T09:00:00Z',
    season: { points: 118, matchweeks_played: 5, rank: 3, field_size: 42 },
    accuracy: { fixtures_predicted: 50, exact_scores: 7, correct_outcomes: 26 },
    jokers: { played: 1, points_from_joker_matchweeks: 24 },
    history: [
      {
        matchweek_id: 'round-5',
        ordinal: 5,
        label: 'Matchweek 5',
        points: 24,
        joker_played: true,
        predictions: { 'fixture-1': { home: 2, away: 1 } },
      },
      {
        matchweek_id: 'round-4',
        ordinal: 4,
        label: 'Matchweek 4',
        points: null,
        joker_played: false,
        predictions: { 'fixture-9': { home: 0, away: 0 } },
      },
    ],
  }

  it('reads the season, the counts and the locked history', () => {
    const profile = mapSeasonPlayerProfile(entered)
    expect(profile.entered).toBe(true)
    expect(profile.season).toEqual({ points: 118, matchweeksPlayed: 5, rank: 3, fieldSize: 42 })
    expect(profile.accuracy).toEqual({
      fixturesPredicted: 50,
      exactScores: 7,
      correctOutcomes: 26,
    })
    expect(profile.history.map((matchweek) => matchweek.ordinal)).toEqual([5, 4])
    // Absent points and zero points are different answers.
    expect(profile.history[1]?.points).toBeNull()
  })

  it('treats a co-member who never entered as an answer, not a failure', () => {
    const profile = mapSeasonPlayerProfile({
      player: { user_id: 'player-3', display_name: 'Robin', is_self: false },
      entered: false,
      server_now: '2026-08-16T09:00:00Z',
      season: null,
      accuracy: null,
      jokers: null,
      history: [],
    })
    expect(profile.entered).toBe(false)
    expect(profile.season).toBeNull()
    expect(profile.history).toEqual([])
  })

  it('accepts a numeric sum sent as a string, and rejects anything else', () => {
    const profile = mapSeasonPlayerProfile({
      ...entered,
      jokers: { played: 2, points_from_joker_matchweeks: '31' },
      accuracy: { fixtures_predicted: 'not a number', exact_scores: 1, correct_outcomes: 1 },
    })
    expect(profile.jokers?.pointsFromJokerMatchweeks).toBe(31)
    // A malformed count produces no accuracy block rather than a wrong one.
    expect(profile.accuracy).toBeNull()
  })

  describe('the Hub’s matchweek recap', () => {
    const profile = mapSeasonPlayerProfile(entered)

    it('recaps the latest SETTLED matchweek, not the latest one played', () => {
      const recap = presentMatchweekRecap(
        'Premier League 2026/27',
        'Premier League',
        '/competitions/premier-league/2026-27',
        profile,
      )
      // Matchweek 4 is more recent in the list order sense but has no banked
      // points; a matchweek being scored is not one to report.
      expect(recap?.matchweekOrdinal).toBe(5)
      expect(recap?.points).toBe(24)
      expect(recap?.jokerPlayed).toBe(true)
      expect(recap?.seasonRank).toBe(3)
      expect(recap?.fieldSize).toBe(42)
      expect(recap?.exactScores).toBe(7)
      expect(recap?.leagues).toEqual([])
    })

    it('adds league movement only for the matchweek it is recapping', () => {
      const forThisWeek = mapSeasonLeagueMovement({
        league: { id: 'league-1' },
        matchweek: { id: 'round-5', ordinal: 5, label: 'Matchweek 5' },
        settled: true,
        server_now: '2026-08-16T09:00:00Z',
        members: [
          {
            user_id: 'player-2',
            display_name: 'Sam',
            is_self: true,
            points_before: 94,
            points_after: 118,
            points_this_matchweek: 24,
            rank_before: 6,
            rank_after: 2,
            movement: 4,
            gap_to_leader_before: 20,
            gap_to_leader_after: 3,
          },
        ],
      })
      const forAnotherWeek = mapSeasonLeagueMovement({
        league: { id: 'league-2' },
        matchweek: { id: 'round-3', ordinal: 3, label: 'Matchweek 3' },
        settled: true,
        server_now: '2026-08-16T09:00:00Z',
        members: [
          {
            user_id: 'player-2',
            display_name: 'Sam',
            is_self: true,
            points_before: 40,
            points_after: 55,
            points_this_matchweek: 15,
            rank_before: 2,
            rank_after: 1,
            movement: 1,
            gap_to_leader_before: 4,
            gap_to_leader_after: 0,
          },
        ],
      })

      const recap = presentMatchweekRecap(
        'Premier League 2026/27',
        'Premier League',
        '/competitions/premier-league/2026-27',
        profile,
        [
          { leagueId: 'league-1', leagueName: 'The Office', movement: forThisWeek },
          { leagueId: 'league-2', leagueName: 'Old Friends', movement: forAnotherWeek },
        ],
      )

      // A league whose most recent settled matchweek is a DIFFERENT one is
      // describing another week and is left out rather than mislabelled.
      expect(recap?.leagues.map((league) => league.leagueName)).toEqual(['The Office'])
      expect(recap?.leagues[0]?.movement).toBe(4)
    })

    it('recaps nothing for a player who has not entered', () => {
      const notEntered = mapSeasonPlayerProfile({
        player: { user_id: 'player-3', display_name: 'Robin', is_self: true },
        entered: false,
        server_now: '2026-08-16T09:00:00Z',
        season: null,
        accuracy: null,
        jokers: null,
        history: [],
      })
      expect(
        presentMatchweekRecap('X 2026/27', 'X', '/competitions/x/2026-27', notEntered),
      ).toBeNull()
    })
  })
})
