import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyState, Button, Skeleton } from '../../design-system'
import { CalendarIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import type { Match } from '../../services/supabase/tournamentData'
import type { KnockoutStage } from '../../domain/tournament/scoringConfig'
import { matchTemporalState, groupStake, koStake } from '../../domain/tournament/matchCentre'
import {
  authoritativeMatchScore,
  authoritativeWinnerSide,
} from '../../domain/tournament/authoritativeMatchResult'
import { groupByMatchday, groupByGroupLetter, currentGroupIndex } from '../../domain/tournament/matchesTab'
import { sumGroupGoals } from '../../domain/tournament/groupGoals'
import { MatchesScreen, type FilterKey, type FixtureRowVM, type MatchesGroupVM } from './MatchesScreen'
import {
  buildLiveTablesView,
  buildBracketView,
  buildStatsView,
} from './tournamentInfoPipeline'
import { MatchesTablesView, MatchesBracketView, MatchesStatsView } from './TournamentInfoViews'
import { useOpenMatchCentre } from './useOpenMatchCentre'
import { formatShortDate } from '../../app/time'
import s from '../shared.module.css'
import m from './MatchesTab.module.css'

const STAGE_UP: Record<string, KnockoutStage> = { r16: 'R16', qf: 'QF', sf: 'SF', final: 'FINAL', champion: 'CHAMPION' }

// The tournament-info sub-views (design-system §Matches). Fixtures keeps its
// own filter chips; the other three are the "what's happening" views.
type ViewKey = 'fixtures' | 'tables' | 'bracket' | 'stats'

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'fixtures', label: 'Fixtures' },
  { key: 'tables', label: 'Tables' },
  { key: 'bracket', label: 'Bracket' },
  { key: 'stats', label: 'Stats' },
]

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
  const openMatchCentre = useOpenMatchCentre()
  const data = useTournamentData()
  const preds = usePredictions()
  const [view, setView] = useState<ViewKey>('fixtures')
  const [filter, setFilter] = useState<FilterKey>('all')

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
      const result = authoritativeMatchScore(m)

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

      const winner = authoritativeWinnerSide(m)
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

  // The tournament-info view models read confirmed results only — they don't
  // depend on the filter or (except the goals race) on the user's entry.
  const info = useMemo(() => {
    if (data.status !== 'ready') return null
    const td = data.data
    return {
      tables: buildLiveTablesView(td),
      bracket: buildBracketView(td),
      stats: buildStatsView(td),
      tournamentDates:
        td.tournament.startsOn && td.tournament.endsOn
          ? `${formatShortDate(td.tournament.startsOn)} – ${formatShortDate(td.tournament.endsOn)}`
          : 'Summer 2028',
      hostCities: [...new Set(td.matches.map((match) => match.venue))].sort(),
    }
  }, [data])

  const predictedGroupGoals = useMemo(() => {
    if (data.status !== 'ready' || !preds.ready) {
      return { total: 0, predictedCount: 0, matchCount: 0 }
    }
    return sumGroupGoals(
      data.data.matches
        .filter((match) => match.round === 'group')
        .map((match) => preds.getPrediction(match.id)),
    )
  }, [data, preds])

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        <EmptyState icon={<CalendarIcon size={22} />} title="Couldn't load fixtures" description={data.message} />
        <Button variant="secondary" fullWidth onClick={data.reload}>
          Retry fixtures
        </Button>
        <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    )
  }
  if (!built || !info) {
    return (
      <div className={s.page} role="status" aria-live="polite" aria-label="Loading fixtures">
        <div className={s.card}>
          <Skeleton lines={3} />
        </div>
        <div className={s.card}>
          <Skeleton lines={3} />
        </div>
      </div>
    )
  }

  return (
    <div className={m.page}>
      <h1 className={m.title}>Matches</h1>

      {/* Toggle chips, not tabs — same reasoning as the fixture filter (axe
          wcag131: a tablist requires tab-role children). */}
      <div className={m.filters} role="group" aria-label="Matches view">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            className={`${m.chip} ${view === v.key ? m.chipOn : ''}`}
            aria-pressed={view === v.key}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'fixtures' ? (
        <MatchesScreen
          filter={filter}
          onFilter={setFilter}
          groups={built.vm}
          scrollToKey={built.scrollToKey}
          onOpen={openMatchCentre}
          emptyMessage={filter === 'jokers' ? 'No jokers placed yet — place them on your group predictions.' : 'No fixtures yet.'}
        />
      ) : view === 'tables' ? (
        <MatchesTablesView view={info.tables} />
      ) : view === 'bracket' ? (
        <MatchesBracketView rounds={info.bracket} onOpen={openMatchCentre} />
      ) : (
        <MatchesStatsView
          view={info.stats}
          predictedGroupGoals={predictedGroupGoals}
          tournamentDates={info.tournamentDates}
          hostCities={info.hostCities}
        />
      )}
    </div>
  )
}
