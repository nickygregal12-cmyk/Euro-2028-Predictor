import { db } from './client'
import {
  reportOperationFailure,
  serverCodeOf,
} from '../observability/operationFailure'
import { clubDisplayName } from '../../domain/clubIdentity/clubName'
import type { LmsRoundPage, SeasonLmsGateway } from '../../features/season/lmsRoundModel'

/**
 * RE-EXPORTED SO CALLERS OF THIS READ CAN NAME ITS ANSWER.
 *
 * The shapes live in `lmsRoundModel.ts` beside the presentation that first
 * needed them, and moving them would churn a working surface for no gain. But
 * a consumer of THIS gateway should be able to depend on the gateway rather
 * than reach past it into a feature directory — which is the import direction
 * the vNext lane is built on, and the reason this line exists.
 */
export type { LmsClub, LmsRoundPage } from '../../features/season/lmsRoundModel'

/**
 * AND THE REFUSAL AUTHORITY FOR THIS WRITE, for the same reason.
 *
 * `lmsRefusal` is the repository's map from `save_lms_selection`'s error codes
 * to the sentence each one deserves. It exists because these refusals "are the
 * opposite of" a generic failure — each is a rule the player just met, with a
 * different thing to do about it — and a caller that classified them itself
 * would be a second authority over the same RPC.
 */
export { isLmsRefusal, lmsRefusal } from '../../features/season/lmsRefusal'

/**
 * The real season Last Man Standing gateway, over contract 116's bounded read
 * and the shared `save_lms_selection` write.
 *
 * TWO FUNCTIONS FROM DIFFERENT CONTRACTS, AND THAT IS THE POINT. The read is
 * new because the tournament read cannot see season fixtures; the write is the
 * one that already existed, because it never joined fixtures itself — it
 * resolves the competition from the window id and delegates shape validation to
 * the trigger contract 86 widened. So this module reads through the season path
 * and writes through the shared one, which is exactly the asymmetry contract
 * 116 was written to close.
 *
 * THE VERSION IS THIS MODULE'S PRIVATE CONCERN, as it is for the season card.
 * `save_lms_selection` takes the version the caller last read so a racing save
 * refuses as PT409; a pick is a player's intention and carries no version, so
 * the command vocabulary has none. Losing the number on a reload is safe — the
 * next load brings the server's own.
 */

type RoundPayload = {
  available: boolean
  entered: boolean
  entry_outcome: LmsRoundPage['entryOutcome']
  used_cycle: number
  used_team_ids: readonly string[]
  window: {
    id: string
    sequence: number
    label: string
    opens_at: string | null
    locks_at: string | null
    settles_at: string | null
    selection: { team_id: string; version: number } | null
    pick_outcome: LmsRoundPage['pickOutcome']
    fixtures: readonly {
      season_fixture_id: string
      kickoff_at: string | null
      status: string
      home_score: number | null
      away_score: number | null
      home: { team_id: string; name: string }
      away: { team_id: string; name: string }
    }[]
  } | null
}

function requireShape(payload: unknown): RoundPayload {
  const round = payload as RoundPayload
  if (
    round === null ||
    typeof round !== 'object' ||
    typeof round.available !== 'boolean' ||
    typeof round.entered !== 'boolean' ||
    !Array.isArray(round.used_team_ids)
  ) {
    // Malformed data fails loudly rather than rendering a guessed round — this
    // surface can consume a club, so a guess is not a cosmetic risk.
    throw new Error('The season Last Man Standing response was not in the expected shape.')
  }
  return round
}

export function createSeasonLmsRpcGateway(options: {
  tournamentId: string
}): SeasonLmsGateway {
  // The window and version the last load reported, echoed on the next write.
  let windowId: string | null = null
  let version = 0

  return {
    async load(): Promise<LmsRoundPage> {
      const { data, error } = await db.rpc('get_season_lms_round', {
        p_tournament_id: options.tournamentId,
      })
      if (error) throw error
      const round = requireShape(data)

      windowId = round.window?.id ?? null
      version = round.window?.selection?.version ?? 0

      const used = new Set(round.used_team_ids)
      const club = (team: { team_id: string; name: string }) => ({
        teamId: team.team_id,
        // A pick list is a column of club names on a phone; the provider's
        // legal suffix is the part that pushes the name into an ellipsis.
        name: clubDisplayName(team.name),
        used: used.has(team.team_id),
      })

      return {
        available: round.available,
        entered: round.entered,
        entryOutcome: round.entry_outcome,
        round: round.window
          ? {
              windowId: round.window.id,
              sequence: round.window.sequence,
              label: round.window.label,
              opensAt: round.window.opens_at,
              locksAt: round.window.locks_at,
            }
          : null,
        fixtures: (round.window?.fixtures ?? []).map((fixture) => ({
          fixtureId: fixture.season_fixture_id,
          kickoffAt: fixture.kickoff_at,
          status: fixture.status,
          home: club(fixture.home),
          away: club(fixture.away),
          score:
            fixture.home_score !== null && fixture.away_score !== null
              ? { home: fixture.home_score, away: fixture.away_score }
              : null,
        })),
        pick: round.window?.selection ? { teamId: round.window.selection.team_id } : null,
        pickOutcome: round.window?.pick_outcome ?? null,
      }
    },

    async pick(teamId: string): Promise<void> {
      if (!windowId) {
        // Not a server refusal, so it does not go through userFacingError: there
        // is simply no round loaded to pick in.
        throw new Error('There is no open round to pick in.')
      }
      const { error } = await db.rpc('save_lms_selection', {
        p_window_id: windowId,
        p_team_id: teamId,
        p_expected_version: version,
      })
      if (error) {
        // `C1`. A spent club is a competitive act, and a pick that did not
        // reach the server is the kind of failure a player reports rather than
        // one anybody sees. `lmsRefusal` still owns what the PLAYER is told;
        // this only makes the failure visible to whoever is watching.
        reportOperationFailure('lms.pick', {
          outcome: serverCodeOf(error) === 'PT409' ? 'conflict' : 'failed',
          serverCode: serverCodeOf(error),
        })
        throw error
      }
    },
  }
}
