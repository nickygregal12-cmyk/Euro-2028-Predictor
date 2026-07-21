import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { EmptyState, Button } from '../../design-system'
import { CalendarIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { fetchMyLeagues } from '../../services/supabase/leagues'
import { fetchLeagueMatchPicks, fetchMatchDistribution } from '../../services/supabase/matchCentre'
import { venueCountryCode } from '../predict/venues'
import type { KnockoutStage } from '../../domain/tournament/scoringConfig'
import type { ProgressionStage } from '../../domain/tournament/bracketPicks'
import type { ScoreEvent } from '../../domain/tournament/scoreEvents'
import {
  matchTemporalState,
  groupStake,
  koStake,
  groupDistribution,
  koSplit,
  orderLeagueGroupPicks,
  orderLeagueKoPicks,
  koLeagueCasualties,
} from '../../domain/tournament/matchCentre'
import { MatchCentreScreen, type MatchScope, type MatchSaid } from './MatchCentreScreen'
import s from '../shared.module.css'

const ROUND_LABEL: Record<string, string> = {
  r16: 'Round of 16',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  final: 'Final',
}
const STAGE_UP: Record<string, KnockoutStage> = { r16: 'R16', qf: 'QF', sf: 'SF', final: 'FINAL', champion: 'CHAMPION' }

// Your predicted furthest stage for each participant of a knockout tie (null if
// your bracket didn't place that team), upper-cased for the domain. Both the
// overall-KO youBacked and your own stake derive from this one place so the
// "who did you back" answer always comes from koStake — never row-presence,
// which mis-picks 'home' when both teams have a progression row (QF onward).
function koStagesFor(
  match: { homeTeamId: string | null; awayTeamId: string | null },
  progression: Record<string, ProgressionStage>,
): { homeStage: KnockoutStage | null; awayStage: KnockoutStage | null } {
  const up = (id: string | null): KnockoutStage | null => (id && progression[id] ? STAGE_UP[progression[id]] : null)
  return { homeStage: up(match.homeTeamId), awayStage: up(match.awayTeamId) }
}

export function MatchCentrePage() {
  const { matchRef } = useParams<{ matchRef: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const data = useTournamentData()
  const preds = usePredictions()

  const [leagues, setLeagues] = useState<{ id: string; name: string }[]>([])
  const [scope, setScope] = useState<MatchScope>({ type: 'overall' })
  const [said, setSaid] = useState<MatchSaid>({ revealed: false, predicted: 0, total: 0 })
  const [saidLoading, setSaidLoading] = useState(true)
  const [saidError, setSaidError] = useState<string | null>(null)
  const [consequence, setConsequence] = useState<{ casualties: number; example: string | null } | null>(null)

  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null

  // Load the user's leagues for the scope switcher; pre-select ?league=<id>.
  useEffect(() => {
    if (!tournamentId) return
    let active = true
    fetchMyLeagues(tournamentId)
      .then((ls) => {
        if (!active) return
        const mapped = ls.map((l) => ({ id: l.id, name: l.name }))
        setLeagues(mapped)
        const pre = searchParams.get('league')
        const match = pre ? mapped.find((l) => l.id === pre) : null
        if (match) setScope({ type: 'league', id: match.id, name: match.name })
      })
      .catch(() => {
        if (active) setLeagues([])
      })
    return () => {
      active = false
    }
  }, [tournamentId, searchParams])

  const match = data.status === 'ready' ? data.data.matches.find((m) => m.matchRef === matchRef) : undefined

  const teamsById = useMemo(
    () => (data.status === 'ready' ? new Map(data.data.teams.map((t) => [t.id, t])) : new Map()),
    [data],
  );

  // The said-block fetch: overall distribution OR league picks, shaped via the
  // domain. Reveal-gating lives in the RPCs (counts pre-lock; picks post-lock).
  useEffect(() => {
    if (!match) return
    let active = true
    setSaidLoading(true)
    setSaidError(null)
    setConsequence(null)
    const result = match.homeScore !== null && match.awayScore !== null ? { home: match.homeScore, away: match.awayScore } : null
    const actualWinner: 'home' | 'away' | null = result ? (result.home > result.away ? 'home' : result.away > result.home ? 'away' : null) : null
    const isGroup = match.round === 'group'
    const yourPick = isGroup ? preds.getPrediction(match.id) : null

    const run = async () => {
      try {
        if (scope.type === 'overall') {
          const d = await fetchMatchDistribution(match.id)
          if (!active) return
          if (!d.locked) {
            setSaid({ revealed: false, predicted: d.predictedCount, total: d.totalEntries })
          } else if (d.kind === 'group') {
            const yp = yourPick && yourPick.homeScore !== null && yourPick.awayScore !== null ? { homeScore: yourPick.homeScore, awayScore: yourPick.awayScore } : null
            const { bars, total } = groupDistribution(d.buckets, yp, result)
            setSaid({ revealed: true, kind: 'overall-group', bars, total })
          } else {
            const { homeStage, awayStage } = koStagesFor(match, preds.bracketProgression)
            const youBacked = koStake(homeStage, awayStage, match.round, actualWinner).backed
            const split = koSplit({ homeCount: d.homeCount, awayCount: d.awayCount, totalEntries: d.totalEntries }, youBacked, actualWinner)
            setSaid({
              revealed: true,
              kind: 'overall-ko',
              homeName: teamsById.get(match.homeTeamId ?? '')?.name ?? 'TBC',
              awayName: teamsById.get(match.awayTeamId ?? '')?.name ?? 'TBC',
              split,
            })
          }
        } else {
          const p = await fetchLeagueMatchPicks(scope.id, match.id)
          if (!active) return
          if (!p.locked) {
            setSaid({ revealed: false, predicted: p.predictedCount, total: p.totalMembers })
          } else if (p.kind === 'group') {
            setSaid({ revealed: true, kind: 'league-group', rows: orderLeagueGroupPicks(p.groupPicks, result) })
          } else {
            const rows = orderLeagueKoPicks(p.koPicks, match.round, actualWinner)
            setSaid({
              revealed: true,
              kind: 'league-ko',
              homeName: teamsById.get(match.homeTeamId ?? '')?.name ?? 'TBC',
              awayName: teamsById.get(match.awayTeamId ?? '')?.name ?? 'TBC',
              rows,
            })
            if (result) setConsequence(koLeagueCasualties(rows, true))
          }
        }
      } catch (err) {
        if (active) setSaidError((err as { message?: string })?.message ?? 'Could not load predictions.')
      } finally {
        if (active) setSaidLoading(false)
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [match, scope, preds, teamsById])

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        <EmptyState icon={<CalendarIcon size={22} />} title="Couldn't load this match" description={data.message} />
        <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    )
  }
  if (data.status !== 'ready' || !preds.ready) {
    return <div className={s.page} />
  }
  if (!match) {
    return (
      <div className={s.page}>
        <EmptyState icon={<CalendarIcon size={22} />} title="Match not found" description={`No fixture matches "${matchRef}".`} />
        <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    )
  }

  const td = data.data
  const home = { name: teamsById.get(match.homeTeamId ?? '')?.name ?? 'TBC', countryCode: '' }
  const away = { name: teamsById.get(match.awayTeamId ?? '')?.name ?? 'TBC', countryCode: '' }
  const result = match.homeScore !== null && match.awayScore !== null ? { home: match.homeScore, away: match.awayScore } : null
  const actualWinner: 'home' | 'away' | null = result ? (result.home > result.away ? 'home' : result.away > result.home ? 'away' : null) : null
  const temporal = matchTemporalState(match)

  const stageLabel = match.round === 'group' ? `Group ${td.groups.find((g) => g.id === match.groupId)?.letter ?? ''}`.trim() : (ROUND_LABEL[match.round] ?? 'Knockout')
  const stateLabel = temporal === 'after' ? 'Full time' : temporal === 'during' ? 'Live' : 'Upcoming'
  const eyebrow = `${stageLabel} · ${stateLabel}`

  // Your stake + this-match score events.
  let stakeProp: Parameters<typeof MatchCentreScreen>[0]['stake']
  const events: ScoreEvent[] = []
  if (match.round === 'group') {
    const p = preds.getPrediction(match.id)
    const pick = p.homeScore !== null && p.awayScore !== null ? { homeScore: p.homeScore, awayScore: p.awayScore, joker: p.joker } : null
    const gs = groupStake(pick, result)
    stakeProp = { kind: 'group', stake: gs }
    if (result && pick && gs.points !== null) {
      events.push({
        id: `mc-${match.id}`,
        category: 'group_matches',
        explanation: `${home.name} ${result.home}–${result.away} ${away.name} · ${gs.outcome === 'unknown' ? 'wrong' : gs.outcome === 'exact' ? 'exact score' : gs.outcome === 'correct' ? 'correct result' : 'wrong'}`,
        points: gs.points,
        joker: pick.joker || undefined,
      })
    }
  } else {
    const { homeStage, awayStage } = koStagesFor(match, preds.bracketProgression)
    const ks = koStake(homeStage, awayStage, match.round, actualWinner)
    const teamName = ks.backed === 'home' ? home.name : ks.backed === 'away' ? away.name : null
    stakeProp = { kind: 'knockout', stake: ks, teamName }
    if (result && ks.correct === true && ks.points) {
      events.push({
        id: `mc-${match.id}`,
        category: 'knockout',
        explanation: `${teamName} · through to the ${ROUND_LABEL[match.round === 'r16' ? 'qf' : match.round === 'qf' ? 'sf' : match.round === 'sf' ? 'final' : 'final'] ?? 'next round'}`,
        points: ks.points,
      })
    }
  }

  return (
    <MatchCentreScreen
      eyebrow={eyebrow}
      venue={match.venue}
      venueCountryCode={venueCountryCode(match.venue)}
      home={home}
      away={away}
      temporalState={temporal}
      result={result}
      koDetail={null}
      countdownLabel={temporal === 'before' ? `Kick-off ${new Date(match.kickoffAt ?? match.matchDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : null}
      liveMinute={null}
      stake={stakeProp}
      scope={scope}
      leagues={leagues}
      onScopeChange={setScope}
      said={said}
      saidLoading={saidLoading}
      saidError={saidError}
      consequence={consequence}
      scoreEvents={events}
      onBack={() => navigate(-1)}
    />
  )
}
