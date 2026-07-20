import { TeamFlag } from '../../design-system'
import { ChevronRightIcon } from '../../design-system/icons'
import { formatWeekdayDate } from '../../app/time'
import type { TodayFixture, TodaySection } from './useHomeData'
import h from './home.module.css'

export type TodayCardProps = {
  section: TodaySection
  onOpenMatch: (matchRef: string) => void
}

function kickoffLabel(f: TodayFixture): string {
  if (f.live) return 'LIVE'
  if (f.result) return 'Full time'
  if (f.kickoffAt) {
    return new Date(f.kickoffAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  return 'Kickoff TBC'
}

function FixtureRow({ f, onOpen }: { f: TodayFixture; onOpen: () => void }) {
  return (
    <button type="button" className={h.fixtureRow} onClick={onOpen}>
      <span className={h.fixtureTop}>
        <span className={h.fixtureTeams}>
          <TeamFlag countryCode={f.home.countryCode} label={f.home.name} size="venue" />
          <span className={h.fixtureName}>{f.home.name}</span>
          {f.result || f.live ? (
            <span className={h.fixtureScore}>
              {(f.result ?? { home: 0, away: 0 }).home}–{(f.result ?? { home: 0, away: 0 }).away}
            </span>
          ) : (
            <span className={h.fixtureV}>v</span>
          )}
          <span className={h.fixtureName}>{f.away.name}</span>
          <TeamFlag countryCode={f.away.countryCode} label={f.away.name} size="venue" />
        </span>
        <ChevronRightIcon size={16} className={h.fixtureChev} />
      </span>
      <span className={h.fixtureMeta}>
        <span className={f.live ? h.fixtureLive : h.fixtureKick}>
          {f.live && <span className={h.liveDot} aria-hidden="true" />}
          {kickoffLabel(f)}
        </span>
        <span className={h.fixtureStake}>
          {f.prediction ? `You said ${f.prediction.home}–${f.prediction.away}` : 'No prediction'}
        </span>
      </span>
    </button>
  )
}

/**
 * The Today card (design-system §6): today's fixtures with the user's prediction
 * and a tap into the match centre; cyan border while any match is live. With no
 * matches today it shows the next matchday instead. Presentational — live state
 * comes from the caller (no live-score source yet, so rows read as upcoming).
 */
export function TodayCard({ section, onOpenMatch }: TodayCardProps) {
  if (section.kind === 'none') {
    return (
      <div className={h.todayCard}>
        <span className={h.cardEyebrow}>Today</span>
        <p className={h.todayEmpty}>No fixtures scheduled.</p>
      </div>
    )
  }

  const anyLive = section.kind === 'today' && section.anyLive
  const heading =
    section.kind === 'today' ? 'Today' : `Next matches · ${formatWeekdayDate(section.dateISO)}`

  return (
    <div className={`${h.todayCard} ${anyLive ? h.todayLive : ''}`}>
      <span className={h.cardEyebrow}>{heading}</span>
      <div className={h.fixtureList}>
        {section.fixtures.map((f) => (
          <FixtureRow key={f.matchId} f={f} onOpen={() => onOpenMatch(f.matchRef)} />
        ))}
      </div>
    </div>
  )
}
