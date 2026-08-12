// Contract 178's `admin_shadow_scoring_report` — the independent scoring
// verifier's evidence, for a competition administrator.
//
// IT IS A READ AND THERE IS NOTHING ELSE TO CALL. `run_shadow_scoring_
// verification` is granted to `service_role` only and is deliberately NOT
// wrapped here: running the verifier is a rollout decision, not a frontend one,
// and a browser wrapper for it would be the first step toward one being taken
// by accident. Contract 178 also corrects nothing, so there is no repair
// function to wrap either.
//
// NO RUN IS NOT A CLEAN BILL. Contract 178 has no scheduled caller on any
// hosted environment, so on most of them this read answers with a null run.
// That is an absence of evidence and the surface says so; it is never rendered
// as verification having passed.

import { db } from './client'
import { mapShadowScoringReport, type ShadowScoringReport } from './shadowScoringReportModel'

export type {
  ShadowScoringReport,
  ShadowRun,
  ShadowFinding,
  ShadowFindingSeverity,
} from './shadowScoringReportModel'

export async function fetchShadowScoringReport(
  tournamentId: string,
  limit?: number,
): Promise<ShadowScoringReport> {
  const { data, error } = await db.rpc('admin_shadow_scoring_report', {
    p_tournament_id: tournamentId,
    ...(limit === undefined ? {} : { p_limit: limit }),
  })
  if (error) throw error
  return mapShadowScoringReport(data)
}
