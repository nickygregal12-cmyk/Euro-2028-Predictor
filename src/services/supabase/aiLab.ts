import { db } from './client'
import { parseAiLabRawSnapshot } from './aiLabBoundary'
import { mapAiLabSnapshot, type AiLabSnapshot } from './aiLabModel'

function leagueArgs(league: string | null): { p_league?: string } {
  return league ? { p_league: league } : {}
}

function predictionArgs(league: string | null): { p_league?: string; p_limit: number } {
  return { ...leagueArgs(league), p_limit: 50 }
}

/**
 * One coherent read of the private AI Lab. Every table remains unavailable to
 * browser roles; these eight bounded RPCs independently enforce the competition
 * admin capability on the server.
 */
export async function fetchAiLabSnapshot(league: string | null): Promise<AiLabSnapshot> {
  const args = leagueArgs(league)
  const prediction = predictionArgs(league)
  const [dashboard, upcoming, recent, breakdown, betting, bettingGate, markets, odds] =
    await Promise.all([
      db.rpc('admin_ai_dashboard', args),
      db.rpc('admin_ai_upcoming_predictions', prediction),
      db.rpc('admin_ai_recent_results', prediction),
      db.rpc('admin_ai_performance_breakdown', args),
      db.rpc('admin_ai_betting_dashboard', args),
      db.rpc('admin_ai_betting_gate_status'),
      db.rpc('admin_ai_evidence_by_market'),
      db.rpc('admin_ai_odds_api_status'),
    ])

  const responses = [dashboard, upcoming, recent, breakdown, betting, bettingGate, markets, odds]
  const failed = responses.find((response) => response.error)
  if (failed?.error) throw failed.error

  const raw = parseAiLabRawSnapshot({
    dashboard: dashboard.data,
    upcoming: upcoming.data,
    recent: recent.data,
    breakdown: breakdown.data,
    betting: betting.data,
    bettingGate: bettingGate.data,
    markets: markets.data,
    odds: odds.data,
  })

  return mapAiLabSnapshot(raw)
}

