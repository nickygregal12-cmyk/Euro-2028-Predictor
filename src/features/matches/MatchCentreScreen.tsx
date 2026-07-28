import { useState } from 'react'
import { TeamFlag, Alert, Button, initialsOf } from '../../design-system'
import { ChevronLeftIcon } from '../../design-system/icons'
import { PointsBreakdown } from '../scoring/PointsBreakdown'
import type { ScoreEvent } from '../../domain/tournament/scoreEvents'
import type { MatchSourceMetadata } from '../../domain/tournament/matchCentreContract'
import type { MatchCentreLifecycleContent } from '../../domain/tournament/matchCentreLifecycleContent'
import type { MatchCentreStatusPresentation } from '../../domain/tournament/matchCentrePresentation'
import type {
  MatchTemporalState,
  GroupStake,
  KoStake,
  ScorelineBar,
  KoSplit,
  LeagueGroupPickRow,
  LeagueKoPickRow,
} from '../../domain/tournament/matchCentre'
import { MatchCentreDataNotice } from './MatchCentreDataNotice'
import { MatchCentreLifecyclePanel } from './MatchCentreLifecyclePanel'
import { MatchCentreScopeChoice } from './MatchCentreScopeChoice'
import s from './MatchCentre.module.css'

export type MatchScope =
  | { type: 'overall' }
  | { type: 'league'; id: string; name: string }

export type MatchSaid =
  | { revealed: false; predicted: number; total: number }
  | { revealed: true; kind: 'overall-group'; bars: ScorelineBar[]; total: number }
  | {
      revealed: true
      kind: 'overall-ko'
      homeName: string
      awayName: string
      split: KoSplit
    }
  | { revealed: true; kind: 'league-group'; rows: LeagueGroupPickRow[] }
  | {
      revealed: true
      kind: 'league-ko'
      homeName: string
      awayName: string
      rows: LeagueKoPickRow[]
    }

export type MatchCentreScreenProps = {
  eyebrow: string
  venue: string
  venueCountryCode: string
  home: { name: string; countryCode: string }
  away: { name: string; countryCode: string }
  temporalState: MatchTemporalState
  lifecycleContent?: MatchCentreLifecycleContent
  statusPresentation?: MatchCentreStatusPresentation
  matchSource?: MatchSourceMetadata
  result: { home: number; away: number } | null
  koDetail?: string | null
  countdownLabel?: string | null
  liveMinute?: string | null
  stake:
    | { kind: 'group'; stake: GroupStake }
    | { kind: 'knockout'; stake: KoStake; teamName: string | null }
  scope: MatchScope
  leagues: { id: string; name: string }[]
  leagueScopesStatus?: 'loading' | 'ready' | 'unavailable'
  leagueScopesMessage?: string | null
  onRetryLeagueScopes?: () => void
  onScopeChange?: (scope: MatchScope) => void
  said: MatchSaid
  saidLoading?: boolean
  saidError?: string | null
  onRetrySaid?: () => void
  onPreviousMatch?: () => void
  onNextMatch?: () => void
  consequence?: { casualties: number; example: string | null } | null
  scoreEvents: ScoreEvent[]
  onBack?: () => void
}

function JokerPill({ paid }: { paid: boolean }) {
  return (
    <span className={paid ? s.jokerPaid : s.jokerBurned}>
      {paid ? 'Joker 2×' : 'Joker +0'}
    </span>
  )
}

function MemberRow({
  name,
  isYou,
  right,
  outcome,
}: {
  name: string
  isYou: boolean
  right: React.ReactNode
  outcome: 'exact' | 'correct' | 'wrong' | 'neutral' | 'good' | 'bad'
}) {
  return (
    <li
      className={`${s.memberRow} ${isYou ? s.memberYou : ''} ${s[`o_${outcome}`] ?? ''}`}
    >
      <span className={s.avatar} aria-hidden="true">
        {initialsOf(name)}
      </span>
      <span className={s.memberName}>
        {name}
        {isYou ? <span className={s.youTag}>you</span> : null}
      </span>
      <span className={s.memberRight}>{right}</span>
    </li>
  )
}

function CollapsibleList({
  count,
  children,
}: {
  count: number
  children: React.ReactNode[]
}) {
  const [open, setOpen] = useState(false)
  const LIMIT = 6
  const shown = open ? children : children.slice(0, LIMIT)
  return (
    <>
      <ul className={s.memberList}>{shown}</ul>
      {count > LIMIT ? (
        <button type="button" className={s.showAll} onClick={() => setOpen((value) => !value)}>
          {open ? 'Show fewer' : `Show all ${count} members`}
        </button>
      ) : null}
    </>
  )
}

function ScorelineBars({ bars, total }: { bars: ScorelineBar[]; total: number }) {
  const max = Math.max(1, ...bars.map((bar) => bar.count))
  return (
    <div className={s.bars}>
      {bars.map((bar) => (
        <div
          key={`${bar.homeScore}-${bar.awayScore}`}
          className={`${s.bar} ${s[`o_${bar.outcome}`] ?? ''}`}
        >
          <span className={s.barLabel}>
            {bar.homeScore}–{bar.awayScore}
          </span>
          <span className={s.barTrack}>
            <span
              className={s.barFill}
              style={{ width: `${(bar.count / max) * 100}%` }}
            />
          </span>
          <span className={s.barCount}>
            {bar.count}
            {bar.isYou ? <span className={s.youTag}> · you</span> : null}
          </span>
        </div>
      ))}
      <p className={s.barsTotal}>{total} entries</p>
    </div>
  )
}

function KoSplitBar({
  split,
  homeName,
  awayName,
}: {
  split: KoSplit
  homeName: string
  awayName: string
}) {
  const total = Math.max(1, split.homeCount + split.awayCount)
  const homePct = (split.homeCount / total) * 100
  const won = (side: 'home' | 'away') => split.actualWinner === side
  return (
    <div className={s.split}>
      <div className={s.splitLabels}>
        <span className={`${s.splitTeam} ${won('home') ? s.splitWon : ''}`}>
          {homeName}
          {split.youBacked === 'home' ? <span className={s.youTag}> · you</span> : null}
        </span>
        <span className={`${s.splitTeam} ${won('away') ? s.splitWon : ''}`}>
          {split.youBacked === 'away' ? <span className={s.youTag}>you · </span> : null}
          {awayName}
        </span>
      </div>
      <div className={s.splitTrack}>
        <span
          className={`${s.splitHome} ${won('home') ? s.splitWon : ''}`}
          style={{ width: `${homePct}%` }}
        />
        <span
          className={`${s.splitAway} ${won('away') ? s.splitWon : ''}`}
          style={{ width: `${100 - homePct}%` }}
        />
      </div>
      <div className={s.splitCounts}>
        <span>{split.homeCount} had them through</span>
        <span>{split.awayCount} had them through</span>
      </div>
    </div>
  )
}

function outcomeTag(
  outcome: 'exact' | 'correct' | 'wrong' | 'unknown',
): 'exact' | 'correct' | 'wrong' | 'neutral' {
  return outcome === 'unknown' ? 'neutral' : outcome
}

export function MatchCentreScreen(props: MatchCentreScreenProps) {
  const { home, away, result, temporalState } = props
  const live = props.statusPresentation?.isLive ?? temporalState === 'during'
  const leagueScopesStatus = props.leagueScopesStatus ?? 'ready'
  const showPredictionContext = props.lifecycleContent?.showPredictionContext ?? true
  const showMatchImpact = props.lifecycleContent?.showMatchImpact ?? temporalState !== 'before'

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <button type="button" className={s.back} onClick={props.onBack}>
          <ChevronLeftIcon size={16} /> Back
        </button>
        <nav className={s.matchNav} aria-label="Adjacent matches">
          <button
            type="button"
            className={s.matchNavButton}
            disabled={!props.onPreviousMatch}
            onClick={props.onPreviousMatch}
          >
            Previous
          </button>
          <button
            type="button"
            className={s.matchNavButton}
            disabled={!props.onNextMatch}
            onClick={props.onNextMatch}
          >
            Next
          </button>
        </nav>
        {leagueScopesStatus === 'ready' && props.leagues.length > 0 ? (
          <MatchCentreScopeChoice
            scope={props.scope}
            leagues={props.leagues}
            onScopeChange={props.onScopeChange}
          />
        ) : null}
      </div>

      {leagueScopesStatus === 'unavailable' ? (
        <Alert variant="warning" title="League scopes unavailable">
          {props.leagueScopesMessage ??
            'Overall predictions are still available. Your leagues remain saved.'}
          {props.onRetryLeagueScopes ? (
            <div style={{ marginTop: 10 }}>
              <Button variant="secondary" onClick={props.onRetryLeagueScopes}>
                Retry league scopes
              </Button>
            </div>
          ) : null}
        </Alert>
      ) : null}

      {props.statusPresentation && props.matchSource ? (
        <MatchCentreDataNotice status={props.statusPresentation} source={props.matchSource} />
      ) : null}

      <p className={s.eyebrow}>{props.eyebrow}</p>
      <div className={`${s.hero} ${live ? s.heroLive : ''}`}>
        <div className={s.heroSide}>
          <TeamFlag countryCode={home.countryCode} label={home.name} size="champion" />
          <span className={s.heroTeam}>{home.name}</span>
        </div>
        <div className={s.heroScore}>
          {result ? (
            <span className={s.score}>
              {result.home}–{result.away}
            </span>
          ) : live ? (
            <span className={s.liveTag}>
              <span className={s.dot} /> {props.statusPresentation?.label ?? 'Live'}
            </span>
          ) : (
            <span className={s.vs}>vs</span>
          )}
          {live && props.liveMinute ? (
            <span className={s.minute}>{props.liveMinute}</span>
          ) : null}
        </div>
        <div className={s.heroSide}>
          <TeamFlag countryCode={away.countryCode} label={away.name} size="champion" />
          <span className={s.heroTeam}>{away.name}</span>
        </div>
      </div>
      {props.koDetail ? <p className={s.koDetail}>{props.koDetail}</p> : null}
      {temporalState === 'before' && props.countdownLabel ? (
        <p className={s.countdown}>{props.countdownLabel}</p>
      ) : null}
      <p className={s.venue}>
        <TeamFlag
          countryCode={props.venueCountryCode}
          label={props.venue}
          size="venue"
        />{' '}
        {props.venue}
      </p>

      {props.lifecycleContent ? (
        <MatchCentreLifecyclePanel content={props.lifecycleContent} />
      ) : null}

      {showPredictionContext ? (
        <>
          <section className={s.card}>
            <h2 className={s.cardTitle}>Your pick{live ? ' · provisional' : ''}</h2>
            {props.stake.kind === 'group' ? (
              props.stake.stake.pick ? (
                <p className={s.stakeLine}>
                  You predicted{' '}
                  <strong>
                    {props.stake.stake.pick.homeScore}–{props.stake.stake.pick.awayScore}
                  </strong>
                  {props.stake.stake.pick.joker ? (
                    <JokerPill paid={props.stake.stake.outcome !== 'wrong'} />
                  ) : null}
                  {props.stake.stake.points !== null ? (
                    <span
                      className={`${s.pointsPill} ${s[`o_${outcomeTag(props.stake.stake.outcome)}`] ?? ''}`}
                    >
                      +{props.stake.stake.points}
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className={s.stakeMuted}>You didn&rsquo;t predict this match.</p>
              )
            ) : props.stake.teamName ? (
              <p className={s.stakeLine}>
                You had <strong>{props.stake.teamName}</strong> through
                {props.stake.stake.correct === true ? (
                  <span className={`${s.pointsPill} ${s.o_correct}`}>
                    ✓ +{props.stake.stake.points}
                  </span>
                ) : null}
                {props.stake.stake.correct === false ? (
                  <span className={`${s.pointsPill} ${s.o_wrong}`}>✗</span>
                ) : null}
              </p>
            ) : (
              <p className={s.stakeMuted}>
                You had neither of these teams reaching this stage.
              </p>
            )}
          </section>

          <section className={s.card}>
            <h2 className={s.cardTitle}>
              What {props.scope.type === 'league' ? props.scope.name : 'everyone'} said
            </h2>
            {props.saidError ? (
              <Alert variant="error">
                {props.saidError}
                {props.onRetrySaid ? (
                  <div style={{ marginTop: 10 }}>
                    <Button variant="secondary" onClick={props.onRetrySaid}>
                      Retry predictions
                    </Button>
                  </div>
                ) : null}
              </Alert>
            ) : props.saidLoading ? (
              <p className={s.stakeMuted} role="status" aria-live="polite">
                Loading prediction context…
              </p>
            ) : !props.said.revealed ? (
              <p className={s.stakeMuted}>
                {props.said.predicted} of {props.said.total} have predicted this match.
                Everyone&rsquo;s picks reveal once entries lock.
              </p>
            ) : props.said.kind === 'overall-group' ? (
              <ScorelineBars bars={props.said.bars} total={props.said.total} />
            ) : props.said.kind === 'overall-ko' ? (
              <KoSplitBar
                split={props.said.split}
                homeName={props.said.homeName}
                awayName={props.said.awayName}
              />
            ) : props.said.kind === 'league-group' ? (
              <CollapsibleList count={props.said.rows.length}>
                {props.said.rows.map((row) => (
                  <MemberRow
                    key={row.displayName + (row.isYou ? '-you' : '')}
                    name={row.displayName}
                    isYou={row.isYou}
                    outcome={outcomeTag(row.outcome)}
                    right={
                      <>
                        <span className={s.pick}>
                          {row.homeScore}–{row.awayScore}
                        </span>
                        {row.joker ? <JokerPill paid={row.outcome !== 'wrong'} /> : null}
                        {row.points !== null ? (
                          <span className={s.rowPts}>+{row.points}</span>
                        ) : null}
                      </>
                    }
                  />
                ))}
              </CollapsibleList>
            ) : (
              <CollapsibleList count={props.said.rows.length}>
                {props.said.rows.map((row) => {
                  const said = props.said as Extract<MatchSaid, { kind: 'league-ko' }>
                  const team =
                    row.backed === 'home'
                      ? said.homeName
                      : row.backed === 'away'
                        ? said.awayName
                        : null
                  const outcome =
                    row.backed === null ? 'neutral' : row.correct ? 'good' : 'bad'
                  return (
                    <MemberRow
                      key={row.displayName + (row.isYou ? '-you' : '')}
                      name={row.displayName}
                      isYou={row.isYou}
                      outcome={outcome}
                      right={
                        team ? (
                          <span className={s.pick}>
                            Had {team}{' '}
                            {row.correct === true ? '✓' : row.correct === false ? '✗' : ''}
                          </span>
                        ) : (
                          <span className={s.stakeMuted}>neither</span>
                        )
                      }
                    />
                  )
                })}
              </CollapsibleList>
            )}
          </section>
        </>
      ) : null}

      {showMatchImpact && temporalState === 'after' && props.consequence && props.consequence.casualties > 0 ? (
        <section className={s.card}>
          <h2 className={s.cardTitle}>What it changed</h2>
          <p className={s.stakeLine}>
            {props.consequence.casualties} in{' '}
            {props.scope.type === 'league' ? 'your league' : 'the field'} lose a pick here
            {props.consequence.example ? <> — incl. {props.consequence.example}</> : null}.
          </p>
        </section>
      ) : null}

      {showMatchImpact ? (
        <section className={s.card}>
          <h2 className={s.cardTitle}>Points from this match</h2>
          <PointsBreakdown events={props.scoreEvents} />
        </section>
      ) : null}
    </div>
  )
}
