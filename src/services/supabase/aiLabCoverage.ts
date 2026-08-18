import { db } from './client'
import {
  mapAiCoverage,
  mapAiHealth,
  mapAiResultsReview,
  type AiCoverage,
  type AiHealth,
  type AiResultsReview,
} from './aiLabCoverageModel'

/**
 * Contract 201's three bounded reads. Each independently enforces the
 * competition-admin capability on the server; schema `ai` stays unreachable from
 * every browser role, which is why these are definer RPCs returning JSON rather
 * than table reads.
 *
 * The window is passed explicitly rather than defaulted server-side, because the
 * caller is the one who knows which weekend the operator is looking at.
 */

export async function fetchAiCoverage(options: {
  from: Date
  to: Date
  leagues?: readonly string[] | null
}): Promise<AiCoverage> {
  const { data, error } = await db.rpc('admin_ai_fixture_coverage', {
    p_from: options.from.toISOString(),
    p_to: options.to.toISOString(),
    ...(options.leagues && options.leagues.length
      ? { p_leagues: [...options.leagues] }
      : {}),
  })
  if (error) throw error
  return mapAiCoverage(data)
}

export async function fetchAiOperationalHealth(): Promise<AiHealth> {
  const { data, error } = await db.rpc('admin_ai_operational_health')
  if (error) throw error
  return mapAiHealth(data)
}

export async function fetchAiResultsReview(options: {
  from: Date
  to: Date
  leagues?: readonly string[] | null
}): Promise<AiResultsReview> {
  const { data, error } = await db.rpc('admin_ai_results_review', {
    p_from: options.from.toISOString(),
    p_to: options.to.toISOString(),
    ...(options.leagues && options.leagues.length
      ? { p_leagues: [...options.leagues] }
      : {}),
  })
  if (error) throw error
  return mapAiResultsReview(data)
}
