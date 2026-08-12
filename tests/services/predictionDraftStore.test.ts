import { describe, expect, it } from 'vitest'
import {
  createPredictionDraftStore,
  draftKey,
  parseDraftRecord,
  type DraftStorage,
  type PredictionDraftScope,
} from '../../src/services/offline/predictionDraftStore'

/**
 * `INNOV-020`'s local persistence.
 *
 * Every rejection asserted below is a case a real device produces, and the two
 * that matter most are the ones a shared phone creates: a record whose payload
 * names a different account, and a record written by an older build whose
 * fields might mean something else. Both are discarded rather than read, and
 * discarding is safe because a draft is by definition work the server does not
 * have.
 */

const SCOPE: PredictionDraftScope = {
  userId: 'user-a',
  tournamentId: 'season-1',
  matchweek: 5,
}

function memoryStorage(seed: Record<string, string> = {}): DraftStorage & {
  map: Map<string, string>
} {
  const map = new Map(Object.entries(seed))
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

const record = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    schema: 1,
    userId: 'user-a',
    tournamentId: 'season-1',
    matchweek: 5,
    savedAt: '2026-08-12T14:32:00.000Z',
    drafts: [{ fixtureId: 'fx-1', prediction: { home: 2, away: 1 } }],
    ...over,
  })

const clock = () => new Date('2026-08-12T14:32:00.000Z')

describe('the prediction draft key', () => {
  it('names the schema, the account, the season and the matchweek', () => {
    expect(draftKey(SCOPE)).toBe('fph.predictionDrafts.v1.user-a.season-1.5')
  })

  it('gives two matchweeks of one season different keys', () => {
    expect(draftKey(SCOPE)).not.toBe(draftKey({ ...SCOPE, matchweek: 6 }))
  })
})

describe('parseDraftRecord', () => {
  it('reads a well-formed record', () => {
    expect(parseDraftRecord(record(), SCOPE)?.drafts).toEqual([
      { fixtureId: 'fx-1', prediction: { home: 2, away: 1 }, refusal: null },
    ])
  })

  it('discards a record written by a different account, even under a matching key', () => {
    expect(parseDraftRecord(record({ userId: 'user-b' }), SCOPE)).toBeNull()
  })

  it('discards a record from another schema version rather than migrating it', () => {
    expect(parseDraftRecord(record({ schema: 99 }), SCOPE)).toBeNull()
  })

  it('discards a record naming another season or matchweek', () => {
    expect(parseDraftRecord(record({ tournamentId: 'season-2' }), SCOPE)).toBeNull()
    expect(parseDraftRecord(record({ matchweek: 6 }), SCOPE)).toBeNull()
  })

  it('discards malformed local data rather than repairing it', () => {
    expect(parseDraftRecord('{"schema"', SCOPE)).toBeNull()
    expect(parseDraftRecord('null', SCOPE)).toBeNull()
    expect(parseDraftRecord(null, SCOPE)).toBeNull()
  })

  it('drops an unreadable draft but keeps the readable ones beside it', () => {
    const parsed = parseDraftRecord(
      record({
        drafts: [
          { fixtureId: 'fx-1', prediction: { home: 'two', away: 1 } },
          { prediction: { home: 1, away: 1 } },
          { fixtureId: 'fx-3', prediction: null },
        ],
      }),
      SCOPE,
    )
    expect(parsed?.drafts.map((draft) => draft.fixtureId)).toEqual(['fx-3'])
  })

  it('keeps a draft whose refusal it cannot read, and drops only the refusal', () => {
    const parsed = parseDraftRecord(
      record({
        drafts: [
          { fixtureId: 'fx-1', prediction: { home: 2, away: 1 }, refusal: { outcome: 'exploded' } },
        ],
      }),
      SCOPE,
    )
    expect(parsed?.drafts).toEqual([
      { fixtureId: 'fx-1', prediction: { home: 2, away: 1 }, refusal: null },
    ])
  })

  it('treats a record with no readable drafts as no record', () => {
    expect(parseDraftRecord(record({ drafts: [] }), SCOPE)).toBeNull()
  })
})

describe('createPredictionDraftStore', () => {
  it('round-trips drafts through storage', () => {
    const storage = memoryStorage()
    const store = createPredictionDraftStore(storage, SCOPE, clock)
    store.write([{ fixtureId: 'fx-1', prediction: { home: 3, away: 0 } }])
    expect(store.read()?.drafts).toEqual([
      { fixtureId: 'fx-1', prediction: { home: 3, away: 0 }, refusal: null },
    ])
    expect(store.read()?.savedAt).toBe('2026-08-12T14:32:00.000Z')
  })

  it('removes the record entirely when nothing is left', () => {
    const storage = memoryStorage()
    const store = createPredictionDraftStore(storage, SCOPE, clock)
    store.write([{ fixtureId: 'fx-1', prediction: { home: 3, away: 0 } }])
    store.write([])
    expect(storage.map.size).toBe(0)
    expect(store.read()).toBeNull()
  })

  it('cannot read another account’s record', () => {
    const storage = memoryStorage()
    createPredictionDraftStore(storage, SCOPE, clock).write([
      { fixtureId: 'fx-1', prediction: { home: 3, away: 0 } },
    ])
    const other = createPredictionDraftStore(
      storage,
      { ...SCOPE, userId: 'user-b' },
      clock,
    )
    expect(other.read()).toBeNull()
  })

  it('fails to a no-op when storage refuses a write, rather than throwing at the screen', () => {
    const storage: DraftStorage = {
      getItem: () => {
        throw new Error('storage disabled')
      },
      setItem: () => {
        throw new Error('quota exceeded')
      },
      removeItem: () => {
        throw new Error('storage disabled')
      },
    }
    const store = createPredictionDraftStore(storage, SCOPE, clock)
    expect(() => store.write([{ fixtureId: 'fx-1', prediction: { home: 1, away: 1 } }])).not.toThrow()
    expect(() => store.clear()).not.toThrow()
    expect(store.read()).toBeNull()
  })
})
