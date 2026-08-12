/**
 * Contract 178's shadow scoring report, decoded. Pure: no Supabase import, no
 * network, no clock — the configured wrapper is `shadowScoringReport.ts`.
 *
 * THE VERIFIER CORRECTS NOTHING AND NEITHER DOES THIS. Contract 178
 * independently recomputes settled matchweek points from ADR 0012 without
 * naming either canonical scoring function, and records disagreements as
 * evidence. There is no repair path anywhere in it, and a surface built on it
 * must not offer one.
 *
 * "NO RUN" IS NOT "VERIFIED". `run` is null until the verifier has been called,
 * and contract 178 has no scheduled caller — so on any environment where
 * nothing has run it, the honest answer is that there is no evidence, not that
 * the scoring is right. This decoder keeps the two apart by type: a null run is
 * a different shape from a run with zero mismatches.
 *
 * AN ENTRY IS AN ENTRY ID AND NOTHING ELSE. Contract 178 deliberately names no
 * display name and no address: the question is whether the scoring is right,
 * and who the player is adds nothing to it. This decoder cannot invent one.
 */

export type ShadowFindingSeverity = 'critical' | 'advisory'

export type ShadowFinding = {
  /** `points`, `joker_applied` or `fixtures_scored`. The server's own token. */
  finding: string
  severity: ShadowFindingSeverity
  matchweekId: string | null
  matchweek: number | null
  entryId: string | null
  /** What the platform banked. */
  banked: number | null
  /** What the independent recomputation expected. */
  expected: number | null
  detectedAt: string | null
}

export type ShadowRun = {
  runId: string
  startedAt: string | null
  /** Null while a run is still in progress, or if one died mid-way. */
  completedAt: string | null
  roundsChecked: number
  scoresChecked: number
  criticalMismatches: number
  advisoryMismatches: number
}

export type ShadowScoringReport = {
  tournamentId: string
  serverNow: string | null
  /** Null when the verifier has never been run against this season. */
  run: ShadowRun | null
  findings: readonly ShadowFinding[]
  findingsReturned: number
  findingsTruncated: boolean
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function integerOr(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function mapFinding(value: unknown): ShadowFinding | null {
  const row = objectOf(value)
  const finding = stringOrNull(row.finding)
  if (finding === null) return null
  return {
    finding,
    // Anything that is not explicitly advisory is treated as critical. A
    // finding whose severity this build does not recognise must not be sorted
    // below the ones that mean the league table is wrong.
    severity: row.severity === 'advisory' ? 'advisory' : 'critical',
    matchweekId: stringOrNull(row.matchweek_id),
    matchweek: integerOr(row.matchweek, null),
    entryId: stringOrNull(row.entry_id),
    banked: integerOr(row.banked, null),
    expected: integerOr(row.expected, null),
    detectedAt: stringOrNull(row.detected_at),
  }
}

function mapRun(value: unknown): ShadowRun | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const runId = stringOrNull(row.run_id)
  if (runId === null) return null
  return {
    runId,
    startedAt: stringOrNull(row.started_at),
    completedAt: stringOrNull(row.completed_at),
    roundsChecked: integerOr(row.rounds_checked, 0) ?? 0,
    scoresChecked: integerOr(row.scores_checked, 0) ?? 0,
    criticalMismatches: integerOr(row.critical_mismatches, 0) ?? 0,
    advisoryMismatches: integerOr(row.advisory_mismatches, 0) ?? 0,
  }
}

export function mapShadowScoringReport(value: unknown): ShadowScoringReport {
  const payload = objectOf(value)
  const tournamentId = stringOrNull(payload.tournament_id)
  if (tournamentId === null) {
    throw new Error('The shadow scoring report was not in the expected shape.')
  }

  const raw = Array.isArray(payload.findings) ? payload.findings : []
  const findings = raw.map(mapFinding).filter((row): row is ShadowFinding => row !== null)

  return {
    tournamentId,
    serverNow: stringOrNull(payload.server_now),
    run: mapRun(payload.run),
    findings,
    findingsReturned: findings.length,
    findingsTruncated: payload.findings_truncated === true || findings.length < raw.length,
  }
}
