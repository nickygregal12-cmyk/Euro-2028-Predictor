import { userFacingError } from '../../shared/errors/userFacingError'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
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
import { createMatchCentrePageModel } from '../../domain/tournament/matchCentrePageModel'
import { adjacentMatchRefs } from '../../domain/tournament/matchNavigation'
import {
  authoritativeMatchScore,
  authoritativeWinnerSide,
  knockoutResultDetail,
} from '../../domain/tournament/authoritativeMatchResult'
import {
  groupStake,
  koStake,
  groupDistribution,
  koSplit,
  orderLeagueGroupPicks,
  orderLeagueKoPicks,
  koLeagueCasualties,
} from '../../domain/tournament/matchCentre'
import { MatchCentreScreen, type MatchScope, type MatchSaid } from './MatchCentreScreen'
import { useMatchCentreBackNavigation } from './useMatchCentreBackNavigation'
import { resolveMatchCentreCompetitionContext } from './matchCentreCompetitionContext'
import s from '../shared.module.css'

const ROUND_LABEL: Record<string, string> = {
  r16: 'Round of 16',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  final: 'Final',
}
const STAGE_UP: Record<string, KnockoutStage> = {
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  final: 'FINAL',
  champion: 'CHAMPION',
}

// Your predicted furthest stage for each participant of a knockout tie (null if
// your bracket didn't place that team), upper-cased for the domain. Both the
// overall-KO youBacked and your own stake derive from this one place so the
// "who did you back" answer always comes from koStake — never row-presence,
// which mis-picks 'home' when both teams have a progression row (QF onward).
function koStagesFor(
  match: { homeTeamId: string | null; awayTeamId: string | null },
  progression: Record<string, ProgressionStage>,
): { homeStage: KnockoutStage | null; awayStage: KnockoutStage | null } {
  const up = (id: string | null): KnockoutStage | null =>
    id && progression[id] ? STAGE_UP[progression[id]] : null
  return { homeStage: up(match.homeTeamId), awayStage: up(match.awayTeamId) }
}

type LeagueScopeRow = { id: string; name: string }
type LeagueScopesState =
  | { status: 'loading'; rows: LeagueScopeRow[] }
  | { status: 'ready'; rows: LeagueScopeRow[] }
  | { status: 'unavailable'; rows: LeagueScopeRow[]; message: string }

export function MatchCentrePage() {
  const { matchRef } = useParams<{ matchRef: string }>()
  const navigate = useNavigate()
  const onBack = useMatchCentreBackNavigation()
  const [searchParams] = useSearchParams()
  const data = useTournamentData()
  const preds = usePredictions()

  const [leagueScopes, setLeagueScopes] = useState<LeagueScopesState>({
    status: 'loading',
    rows: [],
  })
  const [leagueReloadKey, setLeagueReloadKey] = useState(0)
  const [scope, setScope] = useState<MatchScope>({ type: 'overall' })
  const [said, setSaid] = useState<MatchSaid>({
    revealed: false,
    predicted: 0,
    total: 0,
  })
  const [saidLoading, setSaidLoading] = useState(true)
  const [saidError, setSaidError] = useState<string | null>(null)
  const [saidReloadKey, setSaidReloadKey] = useState(0)
  const [consequence, setConsequence] = useState<{
    casualties: number
    example: string | null
  } | null>(null)

  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null

  // Load the user's leagues for the scope switcher; pre-select ?league=<id>.
  // A failed read remains explicitly unavailable and must never masquerade as a
  // successful no-leagues account or silently swallow a requested league scope.
  useEffect(() => {
    if (!tournamentId) return
    let active = true
    setLeagueScopes({ status: 'loading', rows: [] })

    fetchMyLeagues(tournamentId)
      .then((leagues) => {
        if (!active) return
        const mapped = leagues.map((league) => ({ id: league.id, name: league.name }))
        setLeagueScopes({ status: 'ready', rows: mapped })
        const requestedId = searchParams.get('league')
        const requested = requestedId
          ? mapped.find((league) => league.id === requestedId)
          : null
        setScope((current) => {
          if (requested) {
            return { type: 'league', id: requested.id, name: requested.name }
          }
          if (
            current.type === 'league' &&
            !mapped.some((league) => league.id === current.id)
          ) {
            return { type: 'overall' }
          }
          return current
        })
      })
      .catch((error) => {
        if (!active) return
        setLeagueScopes({
          status: 'unavailable',
          rows: [],
          message: userFacingError(
            error,
            'Could not load your league scopes. Please try again.',
          ),
        })
        setScope({ type: 'overall' })
      })

    return () => {
      active = false
    }
  }, [tournamentId, searchParams, leagueReloadKey])

  const match =
    data.status === 'ready'
      ? data.data.matches.find((candidate) => candidate.matchRef === matchRef)
      : undefined

  const adjacent = useMemo(
    () =>
      data.status === 'ready' && matchRef
        ? adjacentMatchRefs(data.data.matches, matchRef)
        : { previous: null, next: null },
    [data, matchRef],
  )

  const teamsById = useMemo(
    () =>
      data.status === 'ready'
        ? new Map(data.data.teams.map((team) => [team.id, team]))
        : new Map(),
    [data],
  )

  // The said-block fetch: overall distribution OR league picks, shaped via the
  // domain. Reveal-gating lives in the RPCs (counts pre-lock; picks post-lock).
  useEffect(() => {
    if (!match) return
    let active = true
    setSaidLoading(true)
    setSaidError(null)
    setConsequence(null)
    const result = authoritativeMatchScore(match)
    const actualWinner = authoritativeWinnerSide(match)
    const isGroup = match.round === 'group'
    const yourPick = isGroup ? preds.getPrediction(match.id) : null

    const run = async () => {
      try {
        if (scope.type === 'overall') {
          const distribution = await fetchMatchDistribution(match.id)
          if (!active) return
          if (!distribution.locked) {
            setSaid({
              revealed: false,
              predicted: distribution.predictedCount,
              total: distribution.totalEntries,
            })
          } else if (distribution.kind === 'group') {
            const picked =
              yourPick &&
              yourPick.homeScore !== null &&
              yourPick.awayScore !== null
                ? {
                    homeScore: yourPick.homeScore,
                    awayScore: yourPick.awayScore,
                  }
                : null
            const { bars, total } = groupDistribution(
              distribution.buckets,
              picked,
              result,
            )
            setSaid({ revealed: true, kind: 'overall-group', bars, total })
          } else {
            const { homeStage, awayStage } = koStagesFor(
              match,
              preds.bracketProgression,
            )
            const youBacked = koStake(
              homeStage,
              awayStage,
              match.round,
              actualWinner,
            ).backed
            const split = koSplit(
              {
                homeCount: distribution.homeCount,
                awayCount: distribution.awayCount,
                totalEntries: distribution.totalEntries,
              },
              youBacked,
              actualWinner,
            )
            setSaid({
              revealed: true,
              kind: 'overall-ko',
              homeName: teamsById.get(match.homeTeamId ?? '')?.name ?? 'TBC',
              awayName: teamsById.get(match.awayTeamId ?? '')?.name ?? 'TBC',
              split,
            })
          }
        } else {
          const picks = await fetchLeagueMatchPicks(scope.id, match.id)
          if (!active) return
          if (!picks.locked) {
            setSaid({
              revealed: false,
              predicted: picks.predictedCount,
              total: picks.totalMembers,
            })
          } else if (picks.kind === 'group') {
            setSaid({
              revealed: true,
              kind: 'league-group',
              rows: orderLeagueGroupPicks(picks.groupPicks, result),
            })
          } else {
            const rows = orderLeagueKoPicks(
              picks.koPicks,
              match.round,
              actualWinner,
            )
            setSaid({
              revealed: true,
              kind: 'league-ko',
              homeName: teamsById.get(match.homeTeamId ?? '')?.name ?? 'TBC',
              awayName: teamsById.get(match.awayTeamId ?? '')?.name ?? 'TBC',
              rows,
            })
            if (actualWinner) setConsequence(koLeagueCasualties(rows, true))
          }
        }
      } catch (error) {
        if (active) {
          setSaidError(
            userFacingError(error, 'Could not load predictions. Please try again.'),
          )
        }
      } finally {
        if (active) setSaidLoading(false)
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [match, scope, preds, teamsById, saidReloadKey])

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        <EmptyState
          icon={<CalendarIcon size={22} />}
          title="Couldn't load this match"
          description={data.message}
        />
        <Button variant="secondary" fullWidth onClick={data.reload}>
          Retry match data
        </Button>
        <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    )
  }
  if (data.status !== 'ready') {
    return (
      <div className={s.page} role="status" aria-live="polite">
        <p>Loading match…</p>
      </div>
    )
  }
  if (preds.loadStatus === 'error') {
    return (
      <div className={s.page}>
        <EmptyState
          icon={<CalendarIcon size={22} />}
          title="Couldn't load your prediction context"
          description={preds.loadMessage ?? 'Your saved predictions remain safe.'}
        />
        <Button variant="secondary" fullWidth onClick={preds.retryInitialLoad}>
          Retry predictions
        </Button>
      </div>
    )
  }
  if (!preds.ready) {
    return (
      <div className={s.page} role="status" aria-live="polite">
        <p>Loading your prediction context…</p>
      </div>
    )
  }
  if (!match) {
    return (
      <div className={s.page}>
        <EmptyState
          icon={<CalendarIcon size={22} />}
          title="Match not found"
          description={`No fixture matches "${matchRef}".`}
        />
        <Button variant="secondary" fullWidth onClick={data.reload}>
          Retry match data
        </Button>
        <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    )
  }

  const navigateToMatch = (nextMatchRef: string) => {
    const params = new URLSearchParams()
    const pendingLeagueId =
      leagueScopes.status === 'ready' ? null : searchParams.get('league')
    const leagueId = scope.type === 'league' ? scope.id : pendingLeagueId
    if (leagueId) params.set('league', leagueId)
    const query = params.toString()
    navigate(`/match/${nextMatchRef}${query ? `?${query}` : ''}`)
  }

  const td = data.data
  const nowServer = new Date()
  const now = nowServer.toISOString()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const resolved = resolveMatchCentreCompetitionContext({
    data: td,
    matchId: match.id,
    submitted: preds.submittedAt !== null,
    nowServer,
    timeZone,
    fetchedAt: now,
  })
  const pageModel = createMatchCentrePageModel({
    match,
    teams: td.teams,
    groups: td.groups,
    now,
    fetchedAt: now,
    resolvedState: resolved.state,
  })
  const { home, away, result, temporalState: temporal } = pageModel
  const actualWinner = authoritativeWinnerSide(match)

  // Your stake + this-match score events.
  let stakeProp: Parameters<typeof MatchCentreScreen>[0]['stake']
  const events: ScoreEvent[] = []
  if (match.round === 'group') {
    const prediction = preds.getPrediction(match.id)
    const pick =
      prediction.homeScore !== null && prediction.awayScore !== null
        ? {
            homeScore: prediction.homeScore,
            awayScore: prediction.awayScore,
            joker: prediction.joker,
          }
        : null
    const stake = groupStake(pick, result)
    stakeProp = { kind: 'group', stake }
    if (result && pick && stake.points !== null) {
      events.push({
        id: `mc-${match.id}`,
        category: 'group_matches',
        explanation: `${home.name} ${result.home}–${result.away} ${away.name} · ${stake.outcome === 'unknown' ? 'wrong' : stake.outcome === 'exact' ? 'exact score' : stake.outcome === 'correct' ? 'correct result' : 'wrong'}`,
        points: stake.points,
        joker: pick.joker || undefined,
      })
    }
  } else {
    const { homeStage, awayStage } = koStagesFor(
      match,
      preds.bracketProgression,
    )
    const stake = koStake(homeStage, awayStage, match.round, actualWinner)
    const teamName =
      stake.backed === 'home' ? home.name : stake.backed === 'away' ? away.name : null
    stakeProp = { kind: 'knockout', stake, teamName }
    if (result && stake.correct === true && stake.points) {
      events.push({
        id: `mc-${match.id}`,
        category: 'knockout',
        explanation: `${teamName} · through to the ${ROUND_LABEL[match.round === 'r16' ? 'qf' : match.round === 'qf' ? 'sf' : match.round === 'sf' ? 'final' : 'final'] ?? 'next round'}`,
        points: stake.points,
      })
    }
  }

  return (
    <MatchCentreScreen
      eyebrow={pageModel.eyebrow}
      venue={match.venue}
      venueCountryCode={venueCountryCode(pageModel.venueCountryCodeInput)}
      home={home}
      away={away}
      temporalState={temporal}
      lifecycleContent={pageModel.lifecycleContent}
      statusPresentation={pageModel.statusPresentation}
      matchSource={pageModel.matchSource}
      result={result}
      koDetail={knockoutResultDetail(match, home.name, away.name)}
      countdownLabel={pageModel.countdownLabel}
      liveMinute={pageModel.liveMinute}
      stake={stakeProp}
      scope={scope}
      leagues={leagueScopes.rows}
      leagueScopesStatus={leagueScopes.status}
      leagueScopesMessage={
        leagueScopes.status === 'unavailable' ? leagueScopes.message : null
      }
      onRetryLeagueScopes={() => setLeagueReloadKey((key) => key + 1)}
      onScopeChange={setScope}
      said={said}
      saidLoading={saidLoading}
      saidError={saidError}
      onRetrySaid={() => setSaidReloadKey((key) => key + 1)}
      onPreviousMatch={
        adjacent.previous ? () => navigateToMatch(adjacent.previous as string) : undefined
      }
      onNextMatch={adjacent.next ? () => navigateToMatch(adjacent.next as string) : undefined}
      consequence={consequence}
      scoreEvents={events}
      onBack={onBack}
    />
  )
}
