import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()
const coverage = readFileSync(
  resolve(repositoryRoot, 'docs/architecture/stage-c-schema-coverage.md'),
  'utf8',
)
const overlay = readFileSync(
  resolve(repositoryRoot, 'docs/architecture/stage-c1-schema-overlay.md'),
  'utf8',
)

function section(source: string, start: string, end: string): string {
  const selected = source.split(start)[1]?.split(end)[0]
  expect(selected, `${start} → ${end}`).toBeTruthy()
  return selected!
}

function tableTokens(source: string): string[] {
  return [
    ...source.matchAll(
      /^\|\s*`([a-z_][a-z0-9_]*)`(?:\s+view)?\s*\|/gm,
    ),
  ].map((match) => match[1])
}

function bulletTokens(source: string): string[] {
  return [...source.matchAll(/^-\s+`([a-z_][a-z0-9_]*)`\s*$/gm)].map(
    (match) => match[1],
  )
}

const currentRelations = tableTokens(
  section(coverage, '## 4. Public relations', '## 5. New relations'),
)
const newRelations = tableTokens(
  section(coverage, '## 5. New relations', '## 6. Public functions and RPCs'),
)
const reviewedFunctions = bulletTokens(
  section(coverage, '## 6. Public functions and RPCs', '## 7. Existing validators and authorities'),
)
const overlayRows = tableTokens(overlay)
const overlayFunctions = bulletTokens(
  section(overlay, '## 6. Function and RPC disposition', '## 7. RLS, grants, views and definer security'),
)

describe('Stage C1 schema overlay coverage', () => {
  it('keeps positive controls for the original coverage inventory', () => {
    expect(currentRelations).toHaveLength(35)
    expect(newRelations).toHaveLength(4)
    // 57 -> 58 at contract 116: `get_season_lms_round`, the season Last Man
    // Standing round read. 58 -> 59 at contract 121:
    // `get_season_play_context`, which tells the browser which matchweek a
    // season's card opens at. 59 -> 60 at contract 122:
    // `get_season_period_standings`, the monthly and form tables. 60 -> 62 at
    // contracts 129 and 130: `get_season_head_to_head` and
    // `get_season_prediction_consensus`, the two season comparison reads.
    // 62 -> 64 at contract 132: `admin_approve_initial_provider_fixtures` and
    // `admin_reject_initial_provider_fixtures`, the explicit initial-calendar
    // decision authorities. 64 -> 65 at contract 133:
    // `get_my_season_cup_instances`, the caller-owned private Championship
    // discovery read. 65 -> 67 at contracts 138 and 139:
    // `get_provider_review_queues`, the administrator's view of the seven
    // provider review queues, and `get_season_fixtures`, the season fixture
    // list ordered by kickoff and labelled by round. The pin is a positive
    // control on the inventory, so it moves only when a function is genuinely
    // added to the manifest. 70 -> 71 at contract 151:
    // `get_season_player_profile`, one player's season, gated on a shared
    // private league rather than on a shared competition.
    // 67 -> 70 at contracts 140 and 141:
    // `get_game_leave_eligibility`, and the two club-football derivations
    // `get_season_club_form` and `get_season_club_head_to_head`.
    expect(reviewedFunctions).toHaveLength(71)
  })

  it('gives every current and proposed relation an overlay disposition', () => {
    const missing = [...currentRelations, ...newRelations].filter(
      (token) => !overlayRows.includes(token),
    )
    expect(missing).toEqual([])
  })

  it('gives every reviewed function an overlay disposition', () => {
    const missing = reviewedFunctions.filter((token) => !overlayFunctions.includes(token))
    expect(missing).toEqual([])
  })

  it('keeps the C1 after-state free of C2 ownership and erasure work', () => {
    const c1 = section(overlay, '## 2. C1 after-state', '## 3. Shared before-state preserved through C1')
    expect(c1).not.toMatch(
      /auth_user_id|pseudonym|anonym|account erasure|references\s+profiles|repoint[^\n]*profiles/i,
    )
  })

  it('pins the complete shared auth-owned foreign-key boundary', () => {
    const shared = section(
      overlay,
      '## 3. Shared before-state preserved through C1',
      '## 4. C2 blocked after-state',
    )
    const expected = [
      'profiles.id',
      'entries.user_id',
      'league_members.user_id',
      'rank_history.user_id',
      'rate_limit_events.user_id',
      'bonus_competition_entrants.user_id',
      'bonus_knockout_predictions.user_id',
      'leagues.owner_id',
      'bonus_cup_fixtures.winner_user_id',
      'match_result_revisions.actor_id',
      'actual_third_place_resolutions.updated_by',
      'actual_third_place_resolution_revisions.actor_id',
      'bonus_competition_audit.actor_id',
    ]
    for (const reference of expected) expect(shared).toContain(`\`${reference}\``)
    expect(shared).toContain('explicit `RESTRICT` at contract 64')
  })

  it('keeps every C2 after-state behind issue 272', () => {
    const c2 = section(overlay, '## 4. C2 blocked after-state', '## 5. Relation-by-relation disposition')
    expect(c2).toContain('issue #272')
    expect(c2).toContain('`profiles.auth_user_id`')
    expect(c2).toContain('account erasure, anonymisation or pseudonymisation')
    expect(c2).toContain('ownership RLS')
  })

  it('does not turn the overlay into migration authority', () => {
    expect(overlay).toContain('no migration exists')
    expect(overlay).toContain('does not authorise SQL')
    expect(overlay).toContain('a hosted development mutation')
    expect(overlay).toContain('any production change')
  })
})
