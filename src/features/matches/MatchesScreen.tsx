import { useEffect, useRef } from 'react'
import { TeamFlag, EmptyState } from '../../design-system'
import { CalendarIcon, ChevronRightIcon } from '../../design-system/icons'
import s from './MatchesTab.module.css'

export type FilterKey = 'all' | 'group' | 'jokers'

export type RowOutcome = 'exact' | 'correct' | 'wrong' | 'good' | 'bad' | 'neutral'

export type FixtureRowVM = {
  matchRef: string
  home: { name: string; countryCode: string }
  away: { name: string; countryCode: string }
  state: 'before' | 'during' | 'after'
  timeLabel: string
  result: { home: number; away: number } | null
  liveMinute?: string | null
  yourPick: string | null
  points: number | null
  joker: boolean
  jokerPaid?: boolean
  outcome: RowOutcome
}

export type MatchesGroupVM = { key: string; label: string; dateLabel: string; rows: FixtureRowVM[] }

export type MatchesScreenProps = {
  filter: FilterKey
  onFilter: (f: FilterKey) => void
  groups: MatchesGroupVM[]
  scrollToKey?: string | null
  onOpen: (matchRef: string) => void
  emptyMessage?: string | null
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'group', label: 'By group' },
  { key: 'jokers', label: 'My jokers' },
]

function FixtureRow({ row, onOpen }: { row: FixtureRowVM; onOpen: (ref: string) => void }) {
  const live = row.state === 'during'
  return (
    <button type="button" className={`${s.row} ${live ? s.rowLive : ''}`} onClick={() => onOpen(row.matchRef)}>
      <div className={s.rowTop}>
        <span className={s.side}>
          <TeamFlag countryCode={row.home.countryCode} label={row.home.name} size="venue" />
          <span className={s.team}>{row.home.name}</span>
        </span>
        <span className={s.center}>
          {row.result ? (
            <span className={s.result}>
              {row.result.home}–{row.result.away}
            </span>
          ) : live ? (
            <span className={s.live}>
              <span className={s.dot} /> {row.liveMinute ?? 'Live'}
            </span>
          ) : (
            <span className={s.time}>{row.timeLabel}</span>
          )}
        </span>
        <span className={`${s.side} ${s.sideRight}`}>
          <span className={s.team}>{row.away.name}</span>
          <TeamFlag countryCode={row.away.countryCode} label={row.away.name} size="venue" />
        </span>
      </div>
      <div className={s.rowBottom}>
        <span className={s.pick}>{row.yourPick ?? 'No prediction'}</span>
        <span className={s.rowMeta}>
          {row.joker ? (
            <span className={row.jokerPaid ? s.jokerPaid : s.jokerBurned}>{row.jokerPaid ? 'J 2×' : 'J'}</span>
          ) : null}
          {row.points !== null ? (
            <span className={`${s.pts} ${s[`o_${row.outcome}`] ?? ''}`}>+{row.points}</span>
          ) : null}
          <ChevronRightIcon size={16} />
        </span>
      </div>
    </button>
  )
}

export function MatchesScreen(props: MatchesScreenProps) {
  const targetRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (props.scrollToKey && targetRef.current) {
      targetRef.current.scrollIntoView({ block: 'start', behavior: 'auto' })
    }
    // Only on first mount / when the scroll target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.scrollToKey])

  return (
    <div className={s.page}>
      <h1 className={s.title}>Matches</h1>

      <div className={s.filters} role="tablist" aria-label="Fixture filter">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`${s.chip} ${props.filter === f.key ? s.chipOn : ''}`}
            aria-pressed={props.filter === f.key}
            onClick={() => props.onFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {props.groups.length === 0 ? (
        <EmptyState icon={<CalendarIcon size={22} />} title={props.emptyMessage ?? 'Nothing to show'} />
      ) : (
        props.groups.map((g) => (
          <div key={g.key} className={s.group} ref={g.key === props.scrollToKey ? targetRef : undefined}>
            <div className={s.groupHeader}>
              <span className={s.groupLabel}>{g.label}</span>
              <span className={s.groupDate}>{g.dateLabel}</span>
            </div>
            <div className={s.rows}>
              {g.rows.map((r) => (
                <FixtureRow key={r.matchRef} row={r} onOpen={props.onOpen} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
