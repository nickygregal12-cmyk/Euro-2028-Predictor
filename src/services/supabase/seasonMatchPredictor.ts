import { supabase } from './client'
import { resolveLockState } from '../../domain/competition/lockState'
import { mainPredictorLockPolicy } from '../../domain/competition/game'
import { resolveClubIdentity } from '../../domain/clubIdentity/clubIdentityTokens'
import type {
  MatchPredictorCommand,
  MatchPredictorGateway,
  MatchPredictorPage,
} from '../../features/season/matchPredictorModel'

/**
 * The real season Match Predictor gateway, over the contract 113 bounded RPCs.
 *
 * This is the implementation the UI-04 seam was cut for: the page and hook are
 * unchanged, and this replaces the fixture-backed DEV gateway when a real
 * season serves it. Everything a component may do arrives here as a
 * `MatchPredictorCommand`; everything it renders leaves here as a
 * `MatchPredictorPage`. No component imports this module directly — it is
 * injected where the route mounts the page.
 *
 * VERSIONS ARE THIS MODULE'S PRIVATE CONCERN. The command vocabulary carries no
 * version numbers, because a version is a storage fact rather than a player
 * intention. The gateway remembers the version each fixture was last read or
 * saved at and echoes it on the next write; a mismatch comes back as
 * PostgREST's PT409, which `isVersionConflict` classifies and the hook treats
 * as terminal. Losing this map (a reload) is safe: `load` rebuilds it from the
 * server's own numbers.
 *
 * THE LOCK IS PRESENTED FROM SERVER FACTS AND ENFORCED BY THE SERVER. The RPC
 * returns kickoffs; `resolveLockState` derives the presented state exactly as
 * every other surface does. If the presentation and the database ever disagree,
 * the database wins — a write against a locked matchweek refuses with 55000
 * regardless of what this client believed.
 */

type CardPayload = {
  matchweek: { number: number; of: number }
  card_status: 'no_submission' | 'provisional' | 'confirmed'
  joker: {
    played: boolean
    used_first_half: number
    used_second_half: number
    matchweek_count: number
  }
  settled_points: number | null
  fixtures: readonly {
    id: string
    kickoff_at: string | null
    status: string
    home_name: string
    away_name: string
    // Contract 136. Null for a club the identity reference does not name, which
    // resolves to the neutral fallback exactly as an absent field did before.
    home_short_code?: string | null
    away_short_code?: string | null
    home_club_colours?: string | null
    away_club_colours?: string | null
    result_home: number | null
    result_away: number | null
    prediction: { home: number; away: number; version: number } | null
  }[]
}

function requireShape(payload: unknown): CardPayload {
  const card = payload as CardPayload
  if (
    card === null ||
    typeof card !== 'object' ||
    typeof card.matchweek?.number !== 'number' ||
    !Array.isArray(card.fixtures) ||
    typeof card.joker?.matchweek_count !== 'number'
  ) {
    // Malformed data fails loudly rather than rendering a guessed card.
    throw new Error('The season card response was not in the expected shape.')
  }
  return card
}

const PER_HALF = 5

export function createSeasonMatchPredictorRpcGateway(options: {
  tournamentId: string
  competitionName: string
  seasonLabel: string
  timeZone: string
  /** Server time supplier. A test injects a fixed clock; production passes Date.now-based. */
  now: () => Date
}): MatchPredictorGateway {
  const versions = new Map<string, number>()

  return {
    async load(matchweek: number): Promise<MatchPredictorPage> {
      const { data, error } = await supabase.rpc('get_season_matchweek_card', {
        p_tournament_id: options.tournamentId,
        p_matchweek: matchweek,
      })
      if (error) throw error
      const card = requireShape(data)

      versions.clear()
      for (const fixture of card.fixtures) {
        if (fixture.prediction) versions.set(fixture.id, fixture.prediction.version)
      }

      const policy = mainPredictorLockPolicy(card.joker.matchweek_count)
      const now = options.now()
      const lock = resolveLockState(
        {
          id: `matchweek-${matchweek}`,
          type: policy.scope,
          bufferMinutes: policy.bufferMinutes,
          previouslyLocked: false,
          fixtureData:
            card.fixtures.length === 0
              ? null
              : {
                  observedAt: now.toISOString(),
                  validUntil: new Date(now.getTime() + 60_000).toISOString(),
                  fixtures: card.fixtures.map((fixture) => ({
                    id: fixture.id,
                    kickoffAt: fixture.kickoff_at,
                  })),
                },
        },
        now,
      )

      const inFirstHalf = matchweek <= Math.floor(card.joker.matchweek_count / 2)
      const usedThisHalf = inFirstHalf
        ? card.joker.used_first_half
        : card.joker.used_second_half
      const remainingThisHalf = Math.max(0, PER_HALF - usedThisHalf)

      return {
        competition: {
          name: options.competitionName,
          seasonLabel: options.seasonLabel,
          timeZone: options.timeZone,
        },
        matchweek: { number: card.matchweek.number, of: card.matchweek.of },
        fixtures: card.fixtures.map((fixture) => ({
          fixtureId: fixture.id,
          kickoffAt: fixture.kickoff_at ?? '',
          // Contract 136 supplies the code and the colours the resolver has
          // always taken and never been given, so a club renders as itself
          // rather than as the neutral fallback. `tla` is also what keys the
          // curated pattern overlay, which is why Newcastle can be striped at
          // all. Both are optional: an unnamed club resolves exactly as before.
          home: {
            name: fixture.home_name,
            shortName: fixture.home_name,
            tokens: resolveClubIdentity({
              externalId: fixture.id,
              name: fixture.home_name,
              tla: fixture.home_short_code ?? undefined,
              clubColors: fixture.home_club_colours ?? undefined,
            }),
          },
          away: {
            name: fixture.away_name,
            shortName: fixture.away_name,
            tokens: resolveClubIdentity({
              externalId: fixture.id,
              name: fixture.away_name,
              tla: fixture.away_short_code ?? undefined,
              clubColors: fixture.away_club_colours ?? undefined,
            }),
          },
          prediction: fixture.prediction
            ? { home: fixture.prediction.home, away: fixture.prediction.away }
            : null,
          result:
            fixture.result_home !== null && fixture.result_away !== null
              ? { home: fixture.result_home, away: fixture.result_away }
              : null,
          points: null,
        })),
        cardStatus: card.card_status,
        lock,
        joker: {
          playedHere: card.joker.played,
          remainingThisHalf,
          playable: remainingThisHalf > 0,
        },
        settledPoints: card.settled_points,
      }
    },

    async apply(matchweek: number, command: MatchPredictorCommand): Promise<void> {
      switch (command.kind) {
        case 'setPrediction': {
          const { data, error } = await supabase.rpc('save_season_prediction', {
            p_tournament_id: options.tournamentId,
            p_season_fixture_id: command.fixtureId,
            p_home: command.prediction?.home ?? null,
            p_away: command.prediction?.away ?? null,
            p_version: command.prediction ? (versions.get(command.fixtureId) ?? 0) : null,
          })
          if (error) throw error
          const stored = (data as { version?: number } | null)?.version
          if (command.prediction === null) {
            versions.delete(command.fixtureId)
          } else if (typeof stored === 'number') {
            versions.set(command.fixtureId, stored)
          }
          return
        }
        case 'setJoker': {
          const { error } = await supabase.rpc('set_season_matchweek_joker', {
            p_tournament_id: options.tournamentId,
            p_matchweek: matchweek,
            p_played: command.played,
          })
          if (error) throw error
          return
        }
        case 'confirmCard': {
          const { error } = await supabase.rpc('confirm_season_matchweek_card', {
            p_tournament_id: options.tournamentId,
            p_matchweek: matchweek,
          })
          if (error) throw error
          return
        }
      }
    },
  }
}
