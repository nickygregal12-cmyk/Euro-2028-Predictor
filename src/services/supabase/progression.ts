// Query wrappers for predicted_progression (the winner-only knockout picks:
// per team, the furthest stage the user predicts it reaches). Keyed per entry
// by team. The domain reconstructs the full bracket from these rows.
//
// The provider still describes changes as per-team upserts/deletes, but every
// synchronous bracket edit is coalesced here into ONE complete replacement RPC.
// That preserves the existing provider API while making the server write atomic.

import { supabase } from './client'
import type { ProgressionStage } from '../../domain/tournament/bracketPicks'
import { VersionConflictError, isVersionConflict } from './writeConflict'

export type StoredProgression = {
  teamId: string
  stage: ProgressionStage
  version: number
}

type ProgressionSnapshot = {
  stages: Record<string, ProgressionStage>
  versions: Record<string, number>
}

type UpsertWaiter = {
  kind: 'upsert'
  teamId: string
  resolve: (version: number) => void
  reject: (error: unknown) => void
}

type DeleteWaiter = {
  kind: 'delete'
  teamId: string
  resolve: () => void
  reject: (error: unknown) => void
}

type PendingWaiter = UpsertWaiter | DeleteWaiter

type PendingBatch = {
  desired: Record<string, ProgressionStage>
  expectedVersions: Record<string, number>
  waiters: PendingWaiter[]
}

// Complete last-read snapshots, keyed by entry. fetchProgression() refreshes this
// cache; a successful replacement advances it to the authoritative RPC response.
const snapshots = new Map<string, ProgressionSnapshot>()

// One microtask batch per entry. PredictionsProvider creates all changed upsert /
// delete promises synchronously before awaiting Promise.all(), so they join the
// same batch and produce one complete desired snapshot.
const pendingBatches = new Map<string, PendingBatch>()

function snapshotFromRows(rows: StoredProgression[]): ProgressionSnapshot {
  const stages: Record<string, ProgressionStage> = {}
  const versions: Record<string, number> = {}
  for (const row of rows) {
    stages[row.teamId] = row.stage
    versions[row.teamId] = row.version
  }
  return { stages, versions }
}

function getOrCreateBatch(entryId: string): PendingBatch {
  const existing = pendingBatches.get(entryId)
  if (existing) return existing

  const current = snapshots.get(entryId) ?? { stages: {}, versions: {} }
  const batch: PendingBatch = {
    desired: { ...current.stages },
    expectedVersions: { ...current.versions },
    waiters: [],
  }
  pendingBatches.set(entryId, batch)
  queueMicrotask(() => {
    void flushBatch(entryId, batch)
  })
  return batch
}

async function replaceProgressionSnapshot(
  entryId: string,
  desired: Record<string, ProgressionStage>,
  expectedVersions: Record<string, number>,
): Promise<StoredProgression[]> {
  const { data, error } = await supabase.rpc('replace_predicted_progression', {
    p_entry_id: entryId,
    p_desired: desired,
    p_expected_versions: expectedVersions,
  })

  if (error) {
    if (isVersionConflict(error)) throw new VersionConflictError()
    throw error
  }

  return (data ?? []).map((row) => ({
    teamId: row.team_id,
    stage: row.stage as ProgressionStage,
    version: row.version,
  }))
}

async function flushBatch(entryId: string, batch: PendingBatch): Promise<void> {
  // Do not let a completed batch delete a newer queued batch for the same entry.
  if (pendingBatches.get(entryId) === batch) pendingBatches.delete(entryId)

  try {
    const rows = await replaceProgressionSnapshot(
      entryId,
      batch.desired,
      batch.expectedVersions,
    )
    const next = snapshotFromRows(rows)
    snapshots.set(entryId, next)

    for (const waiter of batch.waiters) {
      if (waiter.kind === 'delete') {
        waiter.resolve()
        continue
      }
      const version = next.versions[waiter.teamId]
      if (version === undefined) {
        waiter.reject(new Error('Atomic bracket replacement omitted an upserted team.'))
      } else {
        waiter.resolve(version)
      }
    }
  } catch (error) {
    for (const waiter of batch.waiters) waiter.reject(error)
  }
}

export async function fetchProgression(entryId: string): Promise<StoredProgression[]> {
  const { data, error } = await supabase
    .from('predicted_progression')
    .select('team_id, stage, version')
    .eq('entry_id', entryId)
  if (error) throw error

  const rows = (data ?? []).map((row) => ({
    teamId: row.team_id,
    stage: row.stage as ProgressionStage,
    version: row.version,
  }))
  snapshots.set(entryId, snapshotFromRows(rows))
  return rows
}

/**
 * Queue one changed team's furthest stage. All progression changes created by the
 * same provider save are replaced together through replace_predicted_progression.
 * The returned version preserves the provider's existing optimistic-concurrency
 * bookkeeping.
 */
export function upsertProgression(
  entryId: string,
  teamId: string,
  stage: ProgressionStage,
  expectedVersion: number,
): Promise<number> {
  const batch = getOrCreateBatch(entryId)
  const cachedVersion = batch.expectedVersions[teamId]
  if (cachedVersion !== undefined && cachedVersion !== expectedVersion) {
    return Promise.reject(new VersionConflictError())
  }

  batch.desired[teamId] = stage
  return new Promise<number>((resolve, reject) => {
    batch.waiters.push({ kind: 'upsert', teamId, resolve, reject })
  })
}

/** Queue removal of a team that no longer wins any knockout match. */
export function deleteProgression(entryId: string, teamId: string): Promise<void> {
  const batch = getOrCreateBatch(entryId)
  delete batch.desired[teamId]
  return new Promise<void>((resolve, reject) => {
    batch.waiters.push({ kind: 'delete', teamId, resolve, reject })
  })
}
