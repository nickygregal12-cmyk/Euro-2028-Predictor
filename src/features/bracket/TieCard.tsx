import { TeamFlag } from '../../design-system'
import { CheckIcon, LockIcon } from '../../design-system/icons'
import type { TieSide } from './bracketPipeline'
import s from './TieCard.module.css'

export type TieCardProps = {
  // Eyebrow provenance, e.g. "R16 · Winner A v Runner-up C".
  provenance: string
  date: string
  venue: string
  venueCountryCode: string
  home: TieSide
  away: TieSide
  pickedTeamId: string | null
  // Called with the picked team's id. Omitted (or a non-pickable tie) makes the
  // rows non-interactive — a forward tie can't be decided until both feeders are.
  onPick?: (teamId: string) => void
}

/**
 * One knockout tie, rendered as a fixture (design-system §5 "Knockout bracket").
 * Two team rows separated by a "v" divider; each resolved row is the tappable
 * button that picks the winner. Presentational only — the parent owns the picked
 * state and persistence.
 */
export function TieCard({
  provenance,
  date,
  venue,
  venueCountryCode,
  home,
  away,
  pickedTeamId,
  onPick,
}: TieCardProps) {
  const pickable =
    home.kind === 'team' && away.kind === 'team' && typeof onPick === 'function'

  return (
    <section className={s.card} aria-label={provenance}>
      <div className={s.eyebrow}>
        <span className={s.provenance}>{provenance}</span>
        <span className={s.eyebrowRight}>
          {date && <span>{date}</span>}
          {venue && (
            <>
              <TeamFlag countryCode={venueCountryCode} label={`${venue} (host venue)`} size="venue" />
              <span>{venue}</span>
            </>
          )}
        </span>
      </div>

      <TieRow side={home} picked={pickedTeamId} pickable={pickable} onPick={onPick} />
      <div className={s.divider} aria-hidden="true">
        <span className={s.dividerRule} />
        <span className={s.v}>v</span>
        <span className={s.dividerRule} />
      </div>
      <TieRow side={away} picked={pickedTeamId} pickable={pickable} onPick={onPick} />
    </section>
  )
}

function TieRow({
  side,
  picked,
  pickable,
  onPick,
}: {
  side: TieSide
  picked: string | null
  pickable: boolean
  onPick?: (teamId: string) => void
}) {
  if (side.kind === 'placeholder') {
    return (
      <div className={`${s.row} ${s.placeholderRow}`}>
        <span className={s.placeholderFlag} aria-hidden="true" />
        <span className={s.placeholderLabel}>{side.label}</span>
        <LockIcon size={15} className={s.placeholderIcon} title="Not decided yet" />
      </div>
    )
  }

  const isWinner = picked === side.teamId
  const isLoser = picked !== null && !isWinner

  const inner = (
    <>
      <span className={s.flag}>
        <TeamFlag countryCode={side.countryCode} label={side.name} size="table" />
      </span>
      <span className={s.name}>{side.name}</span>
      {isWinner ? (
        <span className={s.through}>
          <CheckIcon size={15} /> Through
        </span>
      ) : (
        <span className={s.circle} aria-hidden="true" />
      )}
    </>
  )

  const rowClass = [
    s.row,
    isWinner ? s.winnerRow : '',
    isLoser ? s.loserRow : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (!pickable) {
    // Both feeders not yet decided: show the known side but it isn't selectable.
    return <div className={rowClass}>{inner}</div>
  }

  return (
    <button
      type="button"
      className={rowClass}
      aria-pressed={isWinner}
      aria-label={isWinner ? `${side.name} — through` : `Pick ${side.name} to go through`}
      onClick={() => onPick?.(side.teamId)}
    >
      {inner}
    </button>
  )
}
