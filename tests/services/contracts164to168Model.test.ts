import { describe, expect, it } from 'vitest'
import {
  isConcealed,
  mapSeasonLmsField,
  myEntrant,
} from '../../src/services/supabase/seasonLmsFieldModel'
import { mapOrganisedCompetition } from '../../src/services/supabase/organisedCompetitionsModel'
import {
  mapSeasonCupGroupStage,
  myGroup,
} from '../../src/services/supabase/seasonCupGroupStageModel'
import {
  blockerLabel,
  mapAdminEntrantsPage,
  mapProviderProposalPage,
} from '../../src/services/supabase/seasonAdminInspectionModel'

/**
 * Contracts 164 to 168, decoded.
 *
 * THESE ASSERTIONS ARE MOSTLY ABOUT NULLS, and that is the point. Every one of
 * these reads conceals something from somebody — a rival's pick before the
 * round locks, what an entrant chose from the organiser who owns the
 * competition, whether the server would accept a disqualification — and in each
 * case the concealment is expressed as a null. A decoder that defaulted one of
 * those to zero, false or an empty string would not fail loudly; it would
 * quietly publish a confident answer the server refused to give.
 */

describe('the Last Man Standing field (contract 164)', () => {
  const payload = {
    available: true,
    entered: true,
    my_outcome: 'active',
    round: {
      window_id: 'w1',
      sequence: 4,
      label: 'Round 4',
      opens_at: '2026-09-01T00:00:00Z',
      locks_at: '2026-09-05T11:30:00Z',
      settles_at: null,
      revealed: false,
      settled: false,
    },
    rules: { lives: 1, saves: 1, draws_rule: 'eliminate', endgame_scope: 'private' },
    field: { entrants: 12, remaining: 9, eliminated: 3, picked: null },
    entrants: [
      {
        user_id: 'me',
        display_name: 'You',
        is_me: true,
        outcome: 'active',
        still_in: true,
        lives_remaining: 1,
        saves_remaining: 1,
        has_picked: true,
        pick: { team_id: 't1', team_name: 'Arsenal', outcome: null },
      },
      {
        user_id: 'sam',
        display_name: 'Sam',
        is_me: false,
        outcome: 'active',
        still_in: true,
        lives_remaining: null,
        saves_remaining: null,
        has_picked: null,
        pick: null,
      },
    ],
  }

  it('keeps a rival’s pick, lives, saves and even has-picked null before the lock', () => {
    const field = mapSeasonLmsField(payload)
    if (!field.available || !field.entered) throw new Error('expected an entered field')

    const sam = field.entrants.find((entrant) => entrant.userId === 'sam')!
    expect(sam.pick).toBeNull()
    expect(sam.hasPicked).toBeNull()
    expect(sam.livesRemaining).toBeNull()
    expect(sam.savesRemaining).toBeNull()
    // Not zero. A zero would be a claim about how boldly Sam can play.
    expect(sam.livesRemaining).not.toBe(0)
    expect(isConcealed(sam)).toBe(true)
  })

  it('never conceals the caller’s own row from themselves', () => {
    const field = mapSeasonLmsField(payload)
    const me = myEntrant(field)!

    expect(me.pick?.teamName).toBe('Arsenal')
    expect(me.hasPicked).toBe(true)
    expect(isConcealed(me)).toBe(false)
  })

  it('leaves how many have picked null before the reveal', () => {
    const field = mapSeasonLmsField(payload)
    if (!field.available || !field.entered) throw new Error('expected an entered field')

    expect(field.field.picked).toBeNull()
    expect(field.field.remaining).toBe(9)
  })

  it('reveals everything once the server says the round is revealed', () => {
    const field = mapSeasonLmsField({
      ...payload,
      round: { ...payload.round, revealed: true },
      field: { ...payload.field, picked: 8 },
      entrants: [
        payload.entrants[0],
        {
          ...payload.entrants[1],
          lives_remaining: 0,
          saves_remaining: 1,
          has_picked: true,
          pick: { team_id: 't2', team_name: 'Chelsea', outcome: 'survived' },
        },
      ],
    })
    if (!field.available || !field.entered) throw new Error('expected an entered field')

    const sam = field.entrants.find((entrant) => entrant.userId === 'sam')!
    expect(sam.pick?.teamName).toBe('Chelsea')
    expect(sam.pick?.outcome).toBe('survived')
    // Zero lives is now a real answer rather than a concealed one.
    expect(sam.livesRemaining).toBe(0)
    expect(isConcealed(sam)).toBe(false)
    expect(field.field.picked).toBe(8)
  })

  it('tells a season with no Last Man Standing apart from one the player is not in', () => {
    expect(mapSeasonLmsField({ available: false })).toEqual({ available: false })
    expect(mapSeasonLmsField({ available: true, entered: false })).toEqual({
      available: true,
      entered: false,
    })
  })
})

describe('the organiser’s view (contract 165)', () => {
  const payload = {
    competition: {
      id: 'c1',
      name: 'Sunday Survivors',
      game_key: 'last_man_standing',
      season_name: 'Premier League 2026/27',
      invite_code: 'LMS234DEF567',
      published: false,
      availability_status: 'active',
    },
    setup: {
      lives: 1,
      saves: 0,
      draws_rule: 'eliminate',
      endgame_scope: 'private',
      endgame_on_wipeout: 'play_on',
    },
    current_round: {
      window_id: 'w1',
      sequence: 4,
      label: 'Round 4',
      locks_at: '2026-09-05T11:30:00Z',
      locked: false,
    },
    counts: { entrants: 12, remaining: 9, eliminated: 3, left: 1, awaiting_pick: 4 },
    entrants: [
      {
        user_id: 'sam',
        display_name: 'Sam',
        is_me: false,
        outcome: 'active',
        still_in: true,
        has_picked_current_round: true,
      },
    ],
    organiser_commands_available: [],
  }

  it('tells the organiser THAT an entrant has picked and never what', () => {
    const organised = mapOrganisedCompetition(payload)!
    const sam = organised.entrants[0]!

    expect(sam.hasPickedCurrentRound).toBe(true)
    // Owning a competition is not a reveal exemption: there is no field here
    // that could carry the club, even if a server sent one.
    expect(sam).not.toHaveProperty('pick')
    expect(JSON.stringify(sam)).not.toContain('team')
  })

  it('carries the empty command list rather than assuming it away', () => {
    // No accepted authority gives an organiser power over another entrant, and
    // that power is the power to eliminate somebody. When a command is ever
    // accepted it arrives in this field, not in a component.
    expect(mapOrganisedCompetition(payload)!.organiserCommandsAvailable).toEqual([])
  })

  it('refuses a payload with no competition rather than rendering an empty management screen', () => {
    expect(mapOrganisedCompetition({ entrants: [] })).toBeNull()
    expect(mapOrganisedCompetition(null)).toBeNull()
  })
})

describe('the Championship group stage (contract 167)', () => {
  const payload = {
    available: true,
    entered: true,
    competition: { id: 'c1', name: 'Office Cup', season_name: 'Premier League 2026/27' },
    group_count: 2,
    my_group_ordinal: 2,
    matchdays: 6,
    groups: [
      {
        group_id: 'g1',
        ordinal: 1,
        size: 4,
        is_my_group: false,
        rows: [{ rank: 1, user_id: 'a', display_name: 'A', table_points: 9 }],
      },
      {
        group_id: 'g2',
        ordinal: 2,
        size: 4,
        is_my_group: true,
        rows: [
          { rank: 2, user_id: 'me', display_name: 'You', is_me: true, table_points: 4 },
          { rank: 1, user_id: 'sam', display_name: 'Sam', table_points: 7 },
        ],
      },
    ],
  }

  it('carries every group, and says which one is the caller’s', () => {
    const stage = mapSeasonCupGroupStage(payload)
    if (!stage.available || !stage.entered) throw new Error('expected an entered stage')

    expect(stage.groupCount).toBe(2)
    expect(stage.myGroupOrdinal).toBe(2)
    expect(myGroup(stage)?.ordinal).toBe(2)
  })

  it('prints the server’s rank rather than the array order', () => {
    const stage = mapSeasonCupGroupStage(payload)
    const group = myGroup(stage)!

    // Deliberately out of order in the payload: the standings authority decided,
    // and re-sorting here would be a second opinion about the table.
    expect(group.rows.map((row) => row.rank)).toEqual([2, 1])
  })

  it('drops a row with no rank rather than placing it wherever the array put it', () => {
    const stage = mapSeasonCupGroupStage({
      ...payload,
      groups: [
        { group_id: 'g1', ordinal: 1, size: 2, is_my_group: true, rows: [{ user_id: 'a' }] },
      ],
    })
    if (!stage.available || !stage.entered) throw new Error('expected an entered stage')

    expect(stage.groups[0]?.rows).toEqual([])
  })

  it('names the competition even when the caller is not in it', () => {
    const stage = mapSeasonCupGroupStage({
      available: true,
      entered: false,
      competition: { id: 'c1', name: 'Office Cup', season_name: 'Premier League 2026/27' },
    })
    if (!stage.available || stage.entered) throw new Error('expected a not-entered stage')

    // "You are not in this one" is actionable; an unnamed empty bracket is not.
    expect(stage.competition.name).toBe('Office Cup')
  })
})

describe('the administration inspection reads (contract 168)', () => {
  it('names every blocker on a proposal rather than counting them', () => {
    const page = mapProviderProposalPage({
      tournament_id: 's1',
      total: 1,
      limit: 50,
      offset: 0,
      has_more: false,
      states: { pending: 1 },
      blocked_total: 1,
      proposals: [
        {
          proposal_id: 'p1',
          provider: 'sportmonks',
          proposed_kickoff_at: '2026-09-01T14:00:00Z',
          home: { provider_id: '1', provider_name: 'Arsenal', mapped_team_id: null },
          away: { provider_id: '2', provider_name: 'Chelsea', mapped_team_id: 't2' },
          blockers: ['unmapped_home_team', 'kickoff_in_the_past'],
        },
      ],
    })

    expect(page.proposals[0]?.blockers).toEqual([
      'unmapped_home_team',
      'kickoff_in_the_past',
    ])
    expect(blockerLabel('unmapped_home_team')).toBe('Home club is not mapped to one of ours')
    // A blocker this build has no phrase for is still shown: it is still a
    // reason to refuse.
    expect(blockerLabel('something_new')).toBe('something_new')
  })

  it('keeps an unmapped club null rather than inventing a name for it', () => {
    const page = mapProviderProposalPage({
      proposals: [
        {
          proposal_id: 'p1',
          home: { provider_name: 'Arsenal', mapped_team_id: null, mapped_team_name: null },
          away: { provider_name: 'Chelsea', mapped_team_id: 't2', mapped_team_name: 'Chelsea' },
        },
      ],
    })

    expect(page.proposals[0]?.home.mappedTeamName).toBeNull()
    expect(page.proposals[0]?.away.mappedTeamName).toBe('Chelsea')
  })

  it('defaults disqualifiable to FALSE, so a missing field never offers a control', () => {
    const page = mapAdminEntrantsPage({
      competition: { id: 'c1', name: 'Sunday Survivors' },
      total: 2,
      entrants: [
        { user_id: 'a', display_name: 'A', disqualifiable: true },
        { user_id: 'b', display_name: 'B' },
      ],
    })!

    expect(page.entrants[0]?.disqualifiable).toBe(true)
    expect(page.entrants[1]?.disqualifiable).toBe(false)
  })

  it('refuses an entrants payload with no competition', () => {
    expect(mapAdminEntrantsPage({ entrants: [] })).toBeNull()
  })
})
