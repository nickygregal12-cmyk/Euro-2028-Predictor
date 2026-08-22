import { db } from './client'
import { rpcArgs } from './rpcArguments'
import { submitSeasonPredictionBatch } from './seasonPredictionBatch'
import { resolveLockState } from '../../domain/competition/lockState'
import { mainPredictorLockPolicy } from '../../domain/competition/game'
import { resolveClubIdentity } from '../../domain/clubIdentity/clubIdentityTokens'
import { clubDisplayName } from '../../domain/clubIdentity/clubName'
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
  // Contract 214. Optional during the repository/hosted rollout gap; absence is
  // not permission to invent a browser timestamp or receipt id.
  confirmed_at?: string | null
  confirmation_reference?: string | null
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
    // Contract 212. The per-fixture lock the trigger enforces, published at
    // last. Optional in this type because a database still at contract 211
    // answers without them, and the page falls back to the matchweek lock.
    lock_at?: string | null
    locked?: boolean
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
      const { data, error } = await db.rpc('get_season_matchweek_card', {
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
            // `name` is what a card prints, so the provider's legal suffix
            // goes; `shortName` used to be a copy of it, which made the field
            // a lie rather than a short name. Both now come from the one
            // display authority, and the resolver below still receives the
            // stored spelling because that is what the reference join matches.
            name: clubDisplayName(fixture.home_name),
            shortName: clubDisplayName(fixture.home_name),
            tokens: resolveClubIdentity({
              externalId: fixture.id,
              name: fixture.home_name,
              tla: fixture.home_short_code ?? undefined,
              clubColors: fixture.home_club_colours ?? undefined,
            }),
          },
          away: {
            name: clubDisplayName(fixture.away_name),
            shortName: clubDisplayName(fixture.away_name),
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
          // Contract 212, closing ING-005. The instant is the DATABASE'S, not a
          // second derivation: `resolveLockState` below still decides the
          // matchweek-wide lock from kickoffs, and these two fields decide only
          // this fixture. Where a fixture has not moved the two agree exactly;
          // where it has, this is the one the trigger would enforce.
          lockAt: fixture.lock_at ?? null,
          locked: fixture.locked,
        })),
        cardStatus: card.card_status,
        // Contract 214. These are CURRENT-confirmation evidence supplied by the
        // server. A pre-214 hosted database returns neither, which maps to null
        // and keeps the UI from fabricating a time or reference during rollout.
        confirmedAt: card.confirmed_at ?? null,
        confirmationReference: card.confirmation_reference ?? null,
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
          const { data, error } = await db.rpc(
            'save_season_prediction',
            // Null is how a prediction is CLEARED, not an absent value:
            // `20260805100000_season_card_rpcs.sql:377` branches on `p_home is
            // null` to delete, and line 351 refuses one score without the
            // other. A null version is coalesced to zero at line 385.
            rpcArgs('save_season_prediction', ['p_home', 'p_away', 'p_version'], {
              p_tournament_id: options.tournamentId,
              p_season_fixture_id: command.fixtureId,
              p_home: command.prediction?.home ?? null,
              p_away: command.prediction?.away ?? null,
              p_version: command.prediction ? (versions.get(command.fixtureId) ?? 0) : null,
            }),
          )
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
          const { error } = await db.rpc('set_season_matchweek_joker', {
            p_tournament_id: options.tournamentId,
            p_matchweek: matchweek,
            p_played: command.played,
          })
          if (error) throw error
          return
        }
        case 'confirmCard': {
          const { error } = await db.rpc('confirm_season_matchweek_card', {
            p_tournament_id: options.tournamentId,
            p_matchweek: matchweek,
          })
          if (error) throw error
          return
        }
      }
    },

    /**
     * `INNOV-020` over contract 177 — the drafts a device wrote while it had no
     * signal, in one call.
     *
     * THE VERSIONS ARE STILL PRIVATE. Each draft is stamped with the version
     * this gateway last read or saved for that fixture, exactly as `apply`
     * does; the caller supplies a fixture and a scoreline and never a number it
     * could get wrong. Where the map has lost a version — a reload while
     * offline, so `load` never ran — the draft goes with zero, which the server
     * treats as "expected no existing row". Against a row that DOES exist that
     * is a `PT409`, reported per item as a conflict with both scorelines, which
     * is the correct and honest outcome rather than a silent overwrite.
     *
     * IT UPDATES THE MAP FROM WHAT THE SERVER ACCEPTED, so a device that
     * reconciles and keeps drafting continues from the stored version rather
     * than from the one it had before the batch.
     */
    async reconcile(_matchweek, drafts) {
      const result = await submitSeasonPredictionBatch(
        options.tournamentId,
        drafts.map((draft) => ({
          fixture_id: draft.fixtureId,
          home: draft.prediction?.home ?? null,
          away: draft.prediction?.away ?? null,
          version: draft.prediction ? (versions.get(draft.fixtureId) ?? 0) : 0,
        })),
      )

      for (const row of result.results) {
        if (row.outcome !== 'accepted') continue
        if (row.cleared) versions.delete(row.fixtureId)
        else if (row.version !== null) versions.set(row.fixtureId, row.version)
      }

      return result
    },
  }
}
