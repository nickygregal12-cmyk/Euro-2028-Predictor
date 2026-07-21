import { useState } from 'react'
import { TeamFlag, Alert, initialsOf } from '../../design-system'
import { ChevronLeftIcon } from '../../design-system/icons'
import { PointsBreakdown } from '../scoring/PointsBreakdown'
import type { ScoreEvent } from '../../domain/tournament/scoreEvents'
import type {
  MatchTemporalState,
  GroupStake,
  KoStake,
  ScorelineBar,
  KoSplit,
  LeagueGroupPickRow,
  LeagueKoPickRow,
} from '../../domain/tournament/matchCentre'
import s from './MatchCentre.module.css'

export type MatchScope = { type: 'overall' } | { type: 'league'; id: string; name: string }

export type MatchSaid =
  | { revealed: false; predicted: number; total: number }
  | { revealed: true; kind: 'overall-group'; bars: ScorelineBar[]; total: number }
  | { revealed: true; kind: 'overall-ko'; homeName: string; awayName: string; split: KoSplit }
  | { revealed: true; kind: 'league-group'; rows: LeagueGroupPickRow[] }
  | { revealed: true; kind: 'league-ko'; homeName: string; awayName: string; rows: LeagueKoPickRow[] }

export type MatchCentreScreenProps = {
  eyebrow: string
  venue: string
  venueCountryCode: string
  home: { name: string; countryCode: string }
  away: { name: string; countryCode: string }
  temporalState: MatchTemporalState
  result: { home: number; away: number } | null
  koDetail?: string | null
  countdownLabel?: string | null
  liveMinute?: string | null
  stake:
    | { kind: 'group'; stake: GroupStake }
    | { kind: 'knockout'; stake: KoStake; teamName: string | null }
  scope: MatchScope
  leagues: { id: string; name: string }[]
  onScopeChange?: (scope: MatchScope) => void
  said: MatchSaid
  saidLoading?: boolean
  saidError?: string | null
  consequence?: { casualties: number; example: string | null } | null
  scoreEvents: ScoreEvent[]
  onBack?: () => void
}

function JokerPill({ paid }: { paid: boolean }) {
  return <span className={paid ? s.jokerPaid : s.jokerBurned}>{paid ? 'Joker 2×' : 'Joker +0'}</span>
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
    <li className={`${s.memberRow} ${isYou ? s.memberYou : ''} ${s[`o_${outcome}`] ?? ''}`}>
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

// Collapse a long member list to the notable rows + a "show all" toggle.
function CollapsibleList({ count, children }: { count: number; children: React.ReactNode[] }) {
  const [open, setOpen] = useState(false)
  const LIMIT = 6
  const shown = open ? children : children.slice(0, LIMIT)
  return (
    <>
      <ul className={s.memberList}>{shown}</ul>
      {count > LIMIT ? (
        <button type="button" className={s.showAll} onClick={() => setOpen((v) => !v)}>
          {open ? 'Show fewer' : `Show all ${count} members`}
        </button>
      ) : null}
    </>
  )
}

function ScorelineBars({ bars, total }: { bars: ScorelineBar[]; total: number }) {
  const max = Math.max(1, ...bars.map((b) => b.count))
  return (
    <div className={s.bars}>
      {bars.map((b) => (
        <div key={`${b.homeScore}-${b.awayScore}`} className={`${s.bar} ${s[`o_${b.outcome}`] ?? ''}`}>
          <span className={s.barLabel}>
            {b.homeScore}–{b.awayScore}
          </span>
          <span className={s.barTrack}>
            <span className={s.barFill} style={{ width: `${(b.count / max) * 100}%` }} />
          </span>
          <span className={s.barCount}>
            {b.count}
            {b.isYou ? <span className={s.youTag}> · you</span> : null}
          </span>
        </div>
      ))}
      <p className={s.barsTotal}>{total} entries</p>
    </div>
  )
}

function KoSplitBar({ split, homeName, awayName }: { split: KoSplit; homeName: string; awayName: string }) {
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
        <span className={`${s.splitHome} ${won('home') ? s.splitWon : ''}`} style={{ width: `${homePct}%` }} />
        <span className={`${s.splitAway} ${won('away') ? s.splitWon : ''}`} style={{ width: `${100 - homePct}%` }} />
      </div>
      <div className={s.splitCounts}>
        <span>{split.homeCount} had them through</span>
        <span>{split.awayCount} had them through</span>
      </div>
    </div>
  )
}

function outcomeTag(o: 'exact' | 'correct' | 'wrong' | 'unknown'): 'exact' | 'correct' | 'wrong' | 'neutral' {
  return o === 'unknown' ? 'neutral' : o
}

export function MatchCentreScreen(props: MatchCentreScreenProps) {
  const { home, away, result, temporalState } = props
  const live = temporalState === 'during'

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <button type="button" className={s.back} onClick={props.onBack}>
          <ChevronLeftIcon size={16} /> Back
        </button>
        {props.leagues.length > 0 ? (
          <select
            className={s.scope}
            aria-label="Prediction scope"
            value={props.scope.type === 'league' ? props.scope.id : 'overall'}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'overall') props.onScopeChange?.({ type: 'overall' })
              else {
                const l = props.leagues.find((x) => x.id === v)
                if (l) props.onScopeChange?.({ type: 'league', id: l.id, name: l.name })
              }
            }}
          >
            <option value="overall">Overall</option>
            {props.leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {/* Header + score hero */}
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
              <span className={s.dot} /> Live
            </span>
          ) : (
            <span className={s.vs}>vs</span>
          )}
          {live && props.liveMinute ? <span className={s.minute}>{props.liveMinute}</span> : null}
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
        <TeamFlag countryCode={props.venueCountryCode} label={props.venue} size="venue" /> {props.venue}
      </p>

      {/* Your stake */}
      <section className={s.card}>
        <h2 className={s.cardTitle}>Your pick{live ? ' · provisional' : ''}</h2>
        {props.stake.kind === 'group' ? (
          props.stake.stake.pick ? (
            <p className={s.stakeLine}>
              You predicted{' '}
              <strong>
                {props.stake.stake.pick.homeScore}–{props.stake.stake.pick.awayScore}
              </strong>
              {props.stake.stake.pick.joker ? <JokerPill paid={props.stake.stake.outcome !== 'wrong'} /> : null}
              {props.stake.stake.points !== null ? (
                <span className={`${s.pointsPill} ${s[`o_${outcomeTag(props.stake.stake.outcome)}`] ?? ''}`}>
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
            {props.stake.stake.correct === true ? <span className={`${s.pointsPill} ${s.o_correct}`}>✓ +{props.stake.stake.points}</span> : null}
            {props.stake.stake.correct === false ? <span className={`${s.pointsPill} ${s.o_wrong}`}>✗</span> : null}
          </p>
        ) : (
          <p className={s.stakeMuted}>You had neither of these teams reaching this stage.</p>
        )}
      </section>

      {/* What [scope] said */}
      <section className={s.card}>
        <h2 className={s.cardTitle}>
          What {props.scope.type === 'league' ? props.scope.name : 'everyone'} said
        </h2>
        {props.saidError ? (
          <Alert variant="error">{props.saidError}</Alert>
        ) : props.saidLoading ? (
          <p className={s.stakeMuted}>Loading…</p>
        ) : !props.said.revealed ? (
          <p className={s.stakeMuted}>
            {props.said.predicted} of {props.said.total} have predicted this match. Everyone&rsquo;s picks
            reveal once entries lock.
          </p>
        ) : props.said.kind === 'overall-group' ? (
          <ScorelineBars bars={props.said.bars} total={props.said.total} />
        ) : props.said.kind === 'overall-ko' ? (
          <KoSplitBar split={props.said.split} homeName={props.said.homeName} awayName={props.said.awayName} />
        ) : props.said.kind === 'league-group' ? (
          <CollapsibleList count={props.said.rows.length}>
            {props.said.rows.map((r) => (
              <MemberRow
                key={r.displayName + (r.isYou ? '-you' : '')}
                name={r.displayName}
                isYou={r.isYou}
                outcome={outcomeTag(r.outcome)}
                right={
                  <>
                    <span className={s.pick}>
                      {r.homeScore}–{r.awayScore}
                    </span>
                    {r.joker ? <JokerPill paid={r.outcome !== 'wrong'} /> : null}
                    {r.points !== null ? <span className={s.rowPts}>+{r.points}</span> : null}
                  </>
                }
              />
            ))}
          </CollapsibleList>
        ) : (
          <CollapsibleList count={props.said.rows.length}>
            {props.said.rows.map((r) => {
              const said = props.said as Extract<MatchSaid, { kind: 'league-ko' }>
              const team = r.backed === 'home' ? said.homeName : r.backed === 'away' ? said.awayName : null
              const oc = r.backed === null ? 'neutral' : r.correct ? 'good' : 'bad'
              return (
                <MemberRow
                  key={r.displayName + (r.isYou ? '-you' : '')}
                  name={r.displayName}
                  isYou={r.isYou}
                  outcome={oc}
                  right={
                    team ? (
                      <span className={s.pick}>
                        Had {team} {r.correct === true ? '✓' : r.correct === false ? '✗' : ''}
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

      {/* What it changed (after only) */}
      {temporalState === 'after' && props.consequence && props.consequence.casualties > 0 ? (
        <section className={s.card}>
          <h2 className={s.cardTitle}>What it changed</h2>
          <p className={s.stakeLine}>
            {props.consequence.casualties} in {props.scope.type === 'league' ? 'your league' : 'the field'} lose a
            pick here
            {props.consequence.example ? <> — incl. {props.consequence.example}</> : null}.
          </p>
        </section>
      ) : null}

      {/* Points detail — reuses the canonical breakdown, filtered to this match. */}
      <section className={s.card}>
        <h2 className={s.cardTitle}>Points from this match</h2>
        <PointsBreakdown events={props.scoreEvents} />
      </section>
    </div>
  )
}
