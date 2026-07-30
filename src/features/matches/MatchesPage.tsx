import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyState, Button, Skeleton } from '../../design-system'
import { CalendarIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import type { Match } from '../../services/supabase/tournamentData'
import type { KnockoutStage } from '../../domain/tournament/scoringConfig'
import { groupStake, koStake } from '../../domain/tournament/matchCentre'
import {
  authoritativeMatchScore,
  authoritativeWinnerSide,
} from '../../domain/tournament/authoritativeMatchResult'
import {
  groupByMatchday,
  groupByGroupLetter,
  currentGroupIndexFromContext,
} from '../../domain/tournament/matchesTab'
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
import { resolveTournamentCompetitionContext } from '../shared/tournamentCompetitionContext'
import s from '../shared.module.css'
import m from './MatchesTab.module.css'

const STAGE_UP: Record<string, KnockoutStage> = { r16: 'R16', qf: 'QF', sf: 'SF', final: 'FINAL', champion: 'CHAMPION' }

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
    const nowServer = new Date()
    const competition = resolveTournamentCompetitionContext({
      data: td,
      submitted: preds.submittedAt !== null,
      entryComplete: false,
      nowServer,
      viewerTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    })
    const resolvedMatchState = new Map(
      competition.context.matches.map((candidate) => [candidate.id, candidate.state]),
    )
    const letterOf = (groupId: string | null) => td.groups.find((g) => g.id === groupId)?.letter ?? null

    const rowOf = (match: Match): FixtureRowVM => {
      const home = { name: teamName.get(match.homeTeamId ?? '') ?? 'TBC', countryCode: '' }
      const away = { name: teamName.get(match.awayTeamId ?? '') ?? 'TBC', countryCode: '' }
      const sharedState = resolvedMatchState.get(match.id)
      const state: FixtureRowVM['state'] =
        sharedState === 'confirmed' || sharedState === 'scored'
          ? 'after'
          : sharedState === 'in_play_feed'
            ? 'during'
            : 'before'
      const result = authoritativeMatchScore(match)

      if (match.round === 'group') {
        const prediction = preds.getPrediction(match.id)
        const pick = prediction.homeScore !== null && prediction.awayScore !== null
          ? { homeScore: prediction.homeScore, awayScore: prediction.awayScore, joker: prediction.joker }
          : null
        const stake = groupStake(pick, result)
        return {
          matchRef: match.matchRef,
          home,
          away,
          state,
          timeLabel: whenLabel(match),
          result,
          yourPick: pick ? `You said ${pick.homeScore}–${pick.awayScore}` : null,
          points: stake.points,
          joker: !!pick?.joker,
          jokerPaid: !!pick?.joker && stake.outcome !== 'wrong',
          outcome: stake.outcome === 'unknown' ? 'neutral' : stake.outcome,
        }
      }

      const winner = authoritativeWinnerSide(match)
      const homeStage = (match.homeTeamId && preds.bracketProgression[match.homeTeamId]
        ? STAGE_UP[preds.bracketProgression[match.homeTeamId]]
        : null) as KnockoutStage | null
      const awayStage = (match.awayTeamId && preds.bracketProgression[match.awayTeamId]
        ? STAGE_UP[preds.bracketProgression[match.awayTeamId]]
        : null) as KnockoutStage | null
      const stake = koStake(homeStage, awayStage, match.round, winner)
      const backedName = stake.backed === 'home' ? home.name : stake.backed === 'away' ? away.name : null
      return {
        matchRef: match.matchRef,
        home,
        away,
        state,
        timeLabel: whenLabel(match),
        result,
        yourPick: backedName ? `You had ${backedName} through` : null,
        points: stake.points,
        joker: false,
        outcome: stake.correct === true ? 'good' : stake.correct === false ? 'bad' : 'neutral',
      }
    }

    let source = td.matches
    if (filter === 'jokers') {
      source = td.matches.filter((match) => match.round === 'group' && preds.getPrediction(match.id).joker)
    }
    const groups = filter === 'group' ? groupByGroupLetter(source, letterOf) : groupByMatchday(source)
    const viewModels: MatchesGroupVM[] = groups.map((group) => ({
      key: group.key,
      label: group.label,
      dateLabel: group.matches.length ? dateLabel(group.matches[0]) : '',
      rows: group.matches.map(rowOf),
    }))

    const scrollToKey = filter === 'all' && viewModels.length
      ? viewModels[currentGroupIndexFromContext(groups, competition.context)].key
      : null
    return { vm: viewModels, scrollToKey }
  }, [data, preds, teamName, filter])

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
    if (data.status !== 'ready' || !preds.ready) return { total: 0, predictedCount: 0, matchCount: 0 }
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
        <Button variant="secondary" fullWidth onClick={data.reload}>Retry fixtures</Button>
        <Button variant="secondary" fullWidth onClick={() => navigate('/')}>Back to Home</Button>
      </div>
    )
  }
  if (!built || !info) {
    return (
      <div className={s.page} role="status" aria-live="polite" aria-label="Loading fixtures">
        <div className={s.card}><Skeleton lines={3} /></div>
        <div className={s.card}><Skeleton lines={3} /></div>
      </div>
    )
  }

  return (
    <div className={m.page}>
      <h1 className={m.title}>Matches</h1>
      <div className={m.filters} role="group" aria-label="Matches view">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`${m.chip} ${view === item.key ? m.chipOn : ''}`}
            aria-pressed={view === item.key}
            onClick={() => setView(item.key)}
          >
            {item.label}
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
