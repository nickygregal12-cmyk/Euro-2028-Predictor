import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('../../src/services/supabase/client', () => ({
  db: { from: mocks.from },
}))

import { getOrCreateEntry } from '../../src/services/supabase/predictions'

type EntryRow = {
  id: string
  submitted_at: string | null
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function insertBuilder(
  result: Promise<{ data: EntryRow | null; error: unknown | null }>,
) {
  const maybeSingle = vi.fn(() => result)
  const select = vi.fn(() => ({ maybeSingle }))
  const upsert = vi.fn(() => ({ select }))
  return { builder: { upsert }, upsert }
}

function existingBuilder(result: { data: EntryRow; error: unknown | null }) {
  const single = vi.fn(async () => result)
  const tournamentEq = vi.fn(() => ({ single }))
  const userEq = vi.fn(() => ({ eq: tournamentEq }))
  const select = vi.fn(() => ({ eq: userEq }))
  return { builder: { select }, userEq, tournamentEq }
}

describe('getOrCreateEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns one shared entry when two first-use callers race', async () => {
    const winner = deferred<{ data: EntryRow | null; error: null }>()
    const loser = deferred<{ data: EntryRow | null; error: null }>()
    const firstInsert = insertBuilder(winner.promise)
    const secondInsert = insertBuilder(loser.promise)
    const sharedRow = { id: 'entry-1', submitted_at: null }
    const existing = existingBuilder({ data: sharedRow, error: null })

    mocks.from
      .mockReturnValueOnce(firstInsert.builder)
      .mockReturnValueOnce(secondInsert.builder)
      .mockReturnValueOnce(existing.builder)

    const first = getOrCreateEntry('user-1', 'tournament-1')
    const second = getOrCreateEntry('user-1', 'tournament-1')

    winner.resolve({ data: sharedRow, error: null })
    loser.resolve({ data: null, error: null })

    await expect(Promise.all([first, second])).resolves.toEqual([
      { id: 'entry-1', submittedAt: null },
      { id: 'entry-1', submittedAt: null },
    ])

    expect(firstInsert.upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', tournament_id: 'tournament-1' },
      {
        onConflict: 'user_id,tournament_id',
        ignoreDuplicates: true,
      },
    )
    expect(secondInsert.upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', tournament_id: 'tournament-1' },
      {
        onConflict: 'user_id,tournament_id',
        ignoreDuplicates: true,
      },
    )
    expect(existing.userEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(existing.tournamentEq).toHaveBeenCalledWith(
      'tournament_id',
      'tournament-1',
    )
  })

  it('returns the inserted row without a fallback read', async () => {
    const inserted = insertBuilder(
      Promise.resolve({
        data: {
          id: 'entry-2',
          submitted_at: '2026-07-24T21:00:00.000Z',
        },
        error: null,
      }),
    )
    mocks.from.mockReturnValueOnce(inserted.builder)

    await expect(getOrCreateEntry('user-2', 'tournament-1')).resolves.toEqual({
      id: 'entry-2',
      submittedAt: '2026-07-24T21:00:00.000Z',
    })
    expect(mocks.from).toHaveBeenCalledOnce()
  })

  it('surfaces an insert boundary error without attempting a fallback read', async () => {
    const error = new Error('insert denied')
    const failed = insertBuilder(Promise.resolve({ data: null, error }))
    mocks.from.mockReturnValueOnce(failed.builder)

    await expect(getOrCreateEntry('user-3', 'tournament-1')).rejects.toBe(error)
    expect(mocks.from).toHaveBeenCalledOnce()
  })
})
