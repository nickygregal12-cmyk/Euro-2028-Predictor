import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, Button } from '../../design-system'
import { CalendarIcon } from '../../design-system/icons'
import { useLocationState } from '../../app/navRestore'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import type { Match } from '../../services/supabase/tournamentData'
import type { KnockoutStage } from '../../domain/tournament/scoringConfig'
import { matchTemporalState, groupStake, koStake } from '../../domain/tournament/matchCentre'
import { groupByMatchday, groupByGroupLetter, currentGroupIndex } from '../../domain/tournament/matchesTab'
import { MatchesScreen, type FilterKey, type FixtureRowVM, type MatchesGroupVM } from './MatchesScreen'
import s from '../shared.module.css'

const STAGE_UP: Record<string, KnockoutStage> = { r16: 'R16', qf: 'QF', sf: 'SF', final: 'FINAL', champion: 'CHAMPION' }

function whenLabel(m: Match): string {
  const d = new Date(m.kickoffAt ?? m.matchDate)
  const opts: Intl.DateTimeFormatOptions = m.kickoffAt
    ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { weekday: 'short', day: 'numeric', month: 'short' }
  return d.toLocaleString(undefined, opts)
}
function dateLabel(m: Match): string {
  return new Date(m.kickoffAt ?? m.matchDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function MatchesPage() {
  const navigate = useNavigate()
  const data = useTournamentData()
  const preds = usePredictions()
  // Persist the active filter across back-navigation (reset on a fresh visit).
  const [filter, setFilter] = useLocationState<FilterKey>('matches-filter', 'all')

  const teamName = useMemo(
    () => (data.status === 'ready' ? new Map(data.data.teams.map((t) => [t.id, t.name])) : new Map<string, string>()),
    [data],
  )

  const built = useMemo(() => {
    if (data.status !== 'ready' || !preds.ready) return null
    const td = data.data
    const letterOf = (groupId: string | null) => td.groups.find((g) => g.id === groupId)?.letter ?? null

    // Build a row VM for one match from own picks + result.
    const rowOf = (m: Match): FixtureRowVM => {
      const home = { name: teamName.get(m.homeTeamId ?? '') ?? 'TBC', countryCode: '' }
      const away = { name: teamName.get(m.awayTeamId ?? '') ?? 'TBC', countryCode: '' }
      const state = matchTemporalState(m)
      const result = m.homeScore !== null && m.awayScore !== null ? { home: m.homeScore, away: m.awayScore } : null

      if (m.round === 'group') {
        const p = preds.getPrediction(m.id)
        const pick = p.homeScore !== null && p.awayScore !== null ? { homeScore: p.homeScore, awayScore: p.awayScore, joker: p.joker } : null
        const gs = groupStake(pick, result)
        const outcome = gs.outcome === 'unknown' ? 'neutral' : gs.outcome
        return {
          matchRef: m.matchRef,
          home,
          away,
          state,
          timeLabel: whenLabel(m),
          result,
          yourPick: pick ? `You said ${pick.homeScore}–${pick.awayScore}` : null,
          points: gs.points,
          joker: !!pick?.joker,
          jokerPaid: !!pick?.joker && gs.outcome !== 'wrong',
          outcome,
        }
      }

      const winner: 'home' | 'away' | null = result ? (result.home > result.away ? 'home' : result.away > result.home ? 'away' : null) : null
      const hs = (m.homeTeamId && preds.bracketProgression[m.homeTeamId] ? STAGE_UP[preds.bracketProgression[m.homeTeamId]] : null) as KnockoutStage | null
      const as = (m.awayTeamId && preds.bracketProgression[m.awayTeamId] ? STAGE_UP[preds.bracketProgression[m.awayTeamId]] : null) as KnockoutStage | null
      const ks = koStake(hs, as, m.round, winner)
      const backedName = ks.backed === 'home' ? home.name : ks.backed === 'away' ? away.name : null
      return {
        matchRef: m.matchRef,
        home,
        away,
        state,
        timeLabel: whenLabel(m),
        result,
        yourPick: backedName ? `You had ${backedName} through` : null,
        points: ks.points,
        joker: false,
        outcome: ks.correct === true ? 'good' : ks.correct === false ? 'bad' : 'neutral',
      }
    }

    // Apply the filter, then choose the grouping.
    let source = td.matches
    if (filter === 'jokers') source = td.matches.filter((m) => m.round === 'group' && preds.getPrediction(m.id).joker)

    const groups =
      filter === 'group'
        ? groupByGroupLetter(source, letterOf)
        : groupByMatchday(source)

    const vm: MatchesGroupVM[] = groups.map((g) => ({
      key: g.key,
      label: g.label,
      dateLabel: g.matches.length ? dateLabel(g.matches[0]) : '',
      rows: g.matches.map(rowOf),
    }))
    const scrollToKey = filter === 'all' && vm.length ? vm[currentGroupIndex(groups)].key : null
    return { vm, scrollToKey }
  }, [data, preds, teamName, filter])

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        <EmptyState icon={<CalendarIcon size={22} />} title="Couldn't load fixtures" description={data.message} />
        <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    )
  }
  if (!built) return <div className={s.page} />

  return (
    <MatchesScreen
      filter={filter}
      onFilter={setFilter}
      groups={built.vm}
      scrollToKey={built.scrollToKey}
      onOpen={(ref) => navigate(`/match/${ref}`)}
      emptyMessage={filter === 'jokers' ? 'No jokers placed yet — place them on your group predictions.' : 'No fixtures yet.'}
    />
  )
}
