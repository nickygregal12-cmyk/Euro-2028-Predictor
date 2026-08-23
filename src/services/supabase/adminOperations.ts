import { db } from './client'

type OddsApiRecentCall = {
  endpoint: string | null
  sportKey: string | null
  estimatedCost: number | null
  reportedCost: number | null
  reportedRemaining: number | null
  calledAt: string | null
}

export type OddsApiAdminStatus = {
  monthToDateCredits: number | null
  monthlyCredits: number | null
  softCap: number | null
  remainingToSoftCap: number | null
  costModelDrift: number | null
  recentCalls: readonly OddsApiRecentCall[]
}

type AiJobHealth = {
  job: string
  lastRunAt: string | null
  lastSuccessAt: string | null
  failures7d: number | null
}

export type AdminAiOperationalHealth = {
  generatedAt: string | null
  oddsApi: {
    collectionEnabled: boolean | null
    monthlyCredits: number | null
    softCap: number | null
    creditsUsedThisMonth: number | null
    lastDispatchAt: string | null
    lastSuccessfulCallAt: string | null
    lastCallStatus: number | null
  }
  jobs: readonly AiJobHealth[]
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

export function decodeOddsApiAdminStatus(payload: unknown): OddsApiAdminStatus {
  const root = record(payload)
  if (!root) throw new Error('The Odds API admin status response was not in the expected shape.')

  const recent = Array.isArray(root.recent_calls) ? root.recent_calls : []
  return {
    monthToDateCredits: numberOrNull(root.month_to_date_credits),
    monthlyCredits: numberOrNull(root.monthly_credits),
    softCap: numberOrNull(root.soft_cap),
    remainingToSoftCap: numberOrNull(root.remaining_to_soft_cap),
    costModelDrift: numberOrNull(root.cost_model_drift),
    recentCalls: recent.flatMap((item) => {
      const row = record(item)
      if (!row) return []
      return [{
        endpoint: stringOrNull(row.endpoint),
        sportKey: stringOrNull(row.sport_key),
        estimatedCost: numberOrNull(row.estimated_cost),
        reportedCost: numberOrNull(row.reported_cost),
        reportedRemaining: numberOrNull(row.reported_remaining),
        calledAt: stringOrNull(row.called_at),
      }]
    }),
  }
}

export function decodeAiOperationalHealth(payload: unknown): AdminAiOperationalHealth {
  const root = record(payload)
  if (!root) throw new Error('The AI operational health response was not in the expected shape.')
  const odds = record(root.odds_api) ?? {}
  const jobs = Array.isArray(root.jobs) ? root.jobs : []

  return {
    generatedAt: stringOrNull(root.generated_at),
    oddsApi: {
      collectionEnabled: booleanOrNull(odds.collection_enabled),
      monthlyCredits: numberOrNull(odds.monthly_credits),
      softCap: numberOrNull(odds.soft_cap),
      creditsUsedThisMonth: numberOrNull(odds.credits_used_this_month),
      lastDispatchAt: stringOrNull(odds.last_dispatch_at),
      lastSuccessfulCallAt: stringOrNull(odds.last_successful_call_at),
      lastCallStatus: numberOrNull(odds.last_call_status),
    },
    jobs: jobs.flatMap((item) => {
      const row = record(item)
      const job = row ? stringOrNull(row.job) : null
      if (!row || job === null) return []
      return [{
        job,
        lastRunAt: stringOrNull(row.last_run_at),
        lastSuccessAt: stringOrNull(row.last_success_at),
        failures7d: numberOrNull(row.failures_7d),
      }]
    }),
  }
}

/**
 * Read retained quota evidence. This RPC performs no provider network request;
 * it reads `ai.api_budget` and `ai.api_usage`, and enforces competition-admin
 * authority on the server.
 */
export async function fetchOddsApiAdminStatus(): Promise<OddsApiAdminStatus> {
  const { data, error } = await db.rpc('admin_ai_odds_api_status')
  if (error) throw error
  return decodeOddsApiAdminStatus(data)
}

/** A bounded server-owned snapshot of the private AI jobs and Odds API loop. */
export async function fetchAdminAiOperationalHealth(): Promise<AdminAiOperationalHealth> {
  const { data, error } = await db.rpc('admin_ai_operational_health')
  if (error) throw error
  return decodeAiOperationalHealth(data)
}
