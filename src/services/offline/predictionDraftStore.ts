/**
 * `INNOV-020` — where a prediction lives while the phone has no signal.
 *
 * A DRAFT IS NEVER A SUBMISSION, AND THE STORE EXISTS TO KEEP THAT TRUE. Every
 * row here is work the server has not accepted. It is written on the device, it
 * is read back on the device, and the only thing that removes it is the server
 * saying `accepted` — or the player discarding it. Nothing in this module can
 * make a prediction count.
 *
 * IT IS VERSIONED AND SCOPED, AND BOTH ARE SAFETY PROPERTIES.
 *
 *   * The **schema version** is in the payload. A record written by an older
 *     build is discarded rather than migrated: a half-understood draft is worse
 *     than none, because the fields this build would read from it might mean
 *     something else.
 *   * The **user id** is in the key AND in the payload, and a record whose
 *     payload names a different user is discarded even when the key matched.
 *     A shared device where one player's drafts appeared under another's name
 *     would submit somebody else's predictions under this account.
 *   * The **season and matchweek** are in the key, so two matchweeks cannot
 *     overwrite one another and a draft cannot leak across seasons.
 *
 * IT STORES NO INSTANT THAT ANYTHING DEPENDS ON. `savedAt` is the device clock
 * and is for the sentence "saved on this device at 14:32" and nothing else. It
 * is never sent to the server, never compared with a lock, and contract 177
 * accepts no instant at all — a source assertion in the migration refuses any
 * redefinition that grows one.
 *
 * IT NEVER THROWS AT ITS CALLER. Storage can be full, disabled, or private-mode
 * restricted, and a prediction screen that breaks because a quota was reached
 * is worse than one with no offline support. Every operation fails to a no-op
 * and `read` answers with no drafts.
 */

import type { ScorelinePrediction } from '../../domain/season/scoring'

/** Bumped whenever the stored shape changes. Older records are discarded. */
export const DRAFT_SCHEMA = 1

const KEY_PREFIX = 'fph.predictionDrafts'

/**
 * The server's refusal of this draft, once it has given one.
 *
 * It is persisted with the draft on purpose: a player who reconnects, is told
 * their prediction was locked, and then closes the app must not be shown a
 * pending draft again on the next open. The refusal is a fact the device
 * learned and there is nowhere else to keep it.
 */
export type PredictionDraftRefusal = {
  outcome: 'locked' | 'conflict' | 'invalid' | 'refused'
  reason: string | null
  /** Present on a conflict: the scoreline the server holds. */
  stored: ScorelinePrediction | null
}

export type PredictionDraft = {
  fixtureId: string
  /** The drafted scoreline, or null where the draft CLEARS a prediction. */
  prediction: ScorelinePrediction | null
  /** Set once the server refused it. A refused draft is never re-sent on its own. */
  refusal?: PredictionDraftRefusal | null
}

export type PredictionDraftRecord = {
  /** Device clock, for display only. Never a lock authority. */
  savedAt: string
  drafts: readonly PredictionDraft[]
}

export type PredictionDraftScope = {
  userId: string
  tournamentId: string
  matchweek: number
}

/** The slice of `Storage` this needs. Injected, so a test needs no jsdom global. */
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type PredictionDraftStore = {
  read(): PredictionDraftRecord | null
  /** Replaces the whole matchweek's drafts. An empty list removes the record. */
  write(drafts: readonly PredictionDraft[]): void
  clear(): void
}

export function draftKey(scope: PredictionDraftScope): string {
  return `${KEY_PREFIX}.v${DRAFT_SCHEMA}.${scope.userId}.${scope.tournamentId}.${scope.matchweek}`
}

function isWholeScore(value: unknown): value is ScorelinePrediction {
  if (!value || typeof value !== 'object') return false
  const row = value as { home?: unknown; away?: unknown }
  return (
    Number.isInteger(row.home) &&
    Number.isInteger(row.away) &&
    (row.home as number) >= 0 &&
    (row.away as number) >= 0
  )
}

const REFUSALS = ['locked', 'conflict', 'invalid', 'refused'] as const

function parseRefusal(value: unknown): PredictionDraftRefusal | null {
  if (!value || typeof value !== 'object') return null
  const row = value as { outcome?: unknown; reason?: unknown; stored?: unknown }
  if (!REFUSALS.includes(row.outcome as (typeof REFUSALS)[number])) return null
  return {
    outcome: row.outcome as PredictionDraftRefusal['outcome'],
    reason: typeof row.reason === 'string' ? row.reason : null,
    stored: isWholeScore(row.stored)
      ? { home: row.stored.home, away: row.stored.away }
      : null,
  }
}

function parseDraft(value: unknown): PredictionDraft | null {
  if (!value || typeof value !== 'object') return null
  const row = value as { fixtureId?: unknown; prediction?: unknown; refusal?: unknown }
  if (typeof row.fixtureId !== 'string' || row.fixtureId.length === 0) return null

  // An unreadable refusal drops the refusal and NOT the draft: losing the
  // reason leaves the draft pending, which costs one more round trip. Dropping
  // the draft would lose the prediction, which is the thing being protected.
  const refusal = parseRefusal(row.refusal)

  if (row.prediction === null) return { fixtureId: row.fixtureId, prediction: null, refusal }
  if (!isWholeScore(row.prediction)) return null
  return {
    fixtureId: row.fixtureId,
    prediction: { home: row.prediction.home, away: row.prediction.away },
    refusal,
  }
}

/**
 * Read a stored record, or null.
 *
 * EXPORTED SEPARATELY SO IT CAN BE TESTED WITHOUT A STORE. Every rejection
 * below is a case a real device produces: a truncated write, a build that
 * changed the shape, a second account on the same phone.
 */
export function parseDraftRecord(
  raw: string | null,
  scope: PredictionDraftScope,
): PredictionDraftRecord | null {
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Malformed local data is discarded, not repaired. Half a draft is a
    // prediction the player did not make.
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null
  const record = parsed as {
    schema?: unknown
    userId?: unknown
    tournamentId?: unknown
    matchweek?: unknown
    savedAt?: unknown
    drafts?: unknown
  }

  if (record.schema !== DRAFT_SCHEMA) return null
  // Checked against the payload as well as the key: a key can be copied.
  if (record.userId !== scope.userId) return null
  if (record.tournamentId !== scope.tournamentId) return null
  if (record.matchweek !== scope.matchweek) return null
  if (!Array.isArray(record.drafts)) return null

  const drafts = record.drafts
    .map(parseDraft)
    .filter((draft): draft is PredictionDraft => draft !== null)

  if (drafts.length === 0) return null

  return {
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : '',
    drafts,
  }
}

export function createPredictionDraftStore(
  storage: DraftStorage,
  scope: PredictionDraftScope,
  now: () => Date,
): PredictionDraftStore {
  const key = draftKey(scope)

  return {
    read() {
      try {
        return parseDraftRecord(storage.getItem(key), scope)
      } catch {
        return null
      }
    },
    write(drafts) {
      try {
        if (drafts.length === 0) {
          storage.removeItem(key)
          return
        }
        storage.setItem(
          key,
          JSON.stringify({
            schema: DRAFT_SCHEMA,
            userId: scope.userId,
            tournamentId: scope.tournamentId,
            matchweek: scope.matchweek,
            savedAt: now().toISOString(),
            drafts,
          }),
        )
      } catch {
        // Quota, private mode, or storage disabled. The edit still applies on
        // screen and still reconciles in this session; what is lost is
        // surviving a reload, which is a smaller failure than a broken screen.
      }
    },
    clear() {
      try {
        storage.removeItem(key)
      } catch {
        // As above.
      }
    },
  }
}
