import { describe, expect, it } from 'vitest'
import { buildDiscoveryModel } from '../../src/vnext/integration/discovery/buildDiscoveryModel'
import type { DiscoverySource } from '../../src/vnext/integration/discovery/discoverySource'
import { offersFollow, offersUnfollow } from '../../src/vnext/models/discovery'

/**
 * `DiscoverySource` → `DiscoveryPageModel`.
 *
 * THE ONE THAT MATTERS: a failed preferences read must not read as "follows
 * nothing". `set_competition_follow` upserts with a favourite argument that
 * defaults to null, so a Follow sent for a competition the player already
 * follows CLEARS their favourite club. Every other rule here is ordinary.
 */

const NOW = '2027-08-01T12:00:00.000Z'

function season(over: Record<string, unknown> = {}) {
  return {
    competitionSlug: 'caledonian',
    seasonKey: '2027-28',
    competitionId: 'c-1',
    competitionName: 'Caledonian Premiership',
    seasonId: 't-1',
    seasonName: 'Caledonian Premiership 2027/28',
    status: 'active' as const,
    timeZone: 'Europe/London',
    ...over,
  }
}

function source(over: Partial<DiscoverySource> = {}): DiscoverySource {
  return {
    generatedAt: NOW,
    catalogue: { kind: 'ok', seasons: [season()] },
    preferences: {
      kind: 'ok',
      preferences: {
        onboarding: { step: null, completedAt: null },
        follows: [],
        pinnedRivals: [],
      },
    },
    ...over,
  } as DiscoverySource
}

function rows(model: ReturnType<typeof buildDiscoveryModel>) {
  if (model.catalogue.kind !== 'seasons') throw new Error('expected seasons')
  return model.catalogue.seasons
}

describe('an unknown follow state is never offered as an action', () => {
  it('marks the knowledge unknown when preferences failed', () => {
    const model = buildDiscoveryModel(source({ preferences: { kind: 'failed' } }))
    expect(model.followKnowledge).toBe('unknown')
  })

  it('still shows the catalogue, because published seasons are not private', () => {
    const model = buildDiscoveryModel(source({ preferences: { kind: 'failed' } }))
    expect(rows(model)).toHaveLength(1)
  })

  it('offers NEITHER follow nor unfollow while the state is unknown', () => {
    const model = buildDiscoveryModel(source({ preferences: { kind: 'failed' } }))
    const row = rows(model)[0]!
    // A Follow here can land on a competition the player already follows, and
    // that upsert discards their favourite club.
    expect(offersFollow(row, model.followKnowledge)).toBe(false)
    expect(offersUnfollow(row, model.followKnowledge)).toBe(false)
  })

  it('offers follow only for a season the player does not follow', () => {
    const model = buildDiscoveryModel(source())
    const row = rows(model)[0]!
    expect(offersFollow(row, model.followKnowledge)).toBe(true)
    expect(offersUnfollow(row, model.followKnowledge)).toBe(false)
  })

  it('offers unfollow only for a season the player does follow', () => {
    const model = buildDiscoveryModel(
      source({
        preferences: {
          kind: 'ok',
          preferences: {
            onboarding: { step: null, completedAt: null },
            follows: [{ tournamentId: 't-1', favouriteTeamId: 'team-3', followedAt: null }],
            pinnedRivals: [],
          },
        },
      }),
    )
    const row = rows(model)[0]!
    expect(row.follow).toBe('following')
    expect(offersFollow(row, model.followKnowledge)).toBe(false)
    expect(offersUnfollow(row, model.followKnowledge)).toBe(true)
  })
})

describe('the catalogue is carried as read', () => {
  it('says `empty` for a platform that publishes nothing', () => {
    expect(buildDiscoveryModel(source({ catalogue: { kind: 'ok', seasons: [] } })).catalogue).toEqual({
      kind: 'empty',
    })
  })

  it('says `unavailable` when the catalogue read failed', () => {
    expect(buildDiscoveryModel(source({ catalogue: { kind: 'failed' } })).catalogue).toEqual({
      kind: 'unavailable',
    })
  })

  it('keeps the read’s order', () => {
    const model = buildDiscoveryModel(
      source({
        catalogue: {
          kind: 'ok',
          seasons: [
            season({ seasonId: 'b', seasonName: 'B' }),
            season({ seasonId: 'a', seasonName: 'A' }),
          ],
        },
      }),
    )
    expect(rows(model).map((r) => r.seasonName)).toEqual(['B', 'A'])
  })

  it('carries the stored slug rather than deriving one from a name', () => {
    const model = buildDiscoveryModel(
      source({
        catalogue: {
          kind: 'ok',
          seasons: [season({ competitionName: 'Highland League', competitionSlug: 'hl-north' })],
        },
      }),
    )
    expect(rows(model)[0]?.route).toEqual({ competitionSlug: 'hl-north', seasonKey: '2027-28' })
  })

  it('carries a null status without turning it into a word', () => {
    const model = buildDiscoveryModel(
      source({ catalogue: { kind: 'ok', seasons: [season({ status: null })] } }),
    )
    expect(rows(model)[0]?.status).toBeNull()
  })
})
