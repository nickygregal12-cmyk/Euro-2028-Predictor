import { TextInput } from '../../design-system'
import { CloseIcon } from '../../design-system/icons'
import s from './awards.module.css'

export type GoldenBootPlayer = { id: string; name: string; teamName?: string }

export type GoldenBootPickerProps = {
  points: number
  query: string
  onQueryChange: (q: string) => void
  results: GoldenBootPlayer[]
  selected: GoldenBootPlayer | null
  onSelect: (p: GoldenBootPlayer) => void
  onClear: () => void
  // Shown when there are no results to offer (squads not confirmed yet). The
  // search UI is final; only its data is pending (scoring-rules §4).
  emptyNote: string
  loading?: boolean
}

/**
 * Golden-boot picker (design-system §5 Awards card / scoring §4). Presentational:
 * the parent owns the query, results and selection. Points value is labelled in
 * gold beside the award. When squads aren't confirmed the search returns nothing
 * and an honest empty note shows in place of results.
 */
export function GoldenBootPicker({
  points,
  query,
  onQueryChange,
  results,
  selected,
  onSelect,
  onClear,
  emptyNote,
  loading,
}: GoldenBootPickerProps) {
  return (
    <div className={s.award}>
      <div className={s.awardHead}>
        <span className={s.awardTitle}>Golden boot</span>
        <span className={s.points}>{points} pts</span>
      </div>

      {selected ? (
        <span className={s.chip}>
          <span className={s.chipName}>
            {selected.name}
            {selected.teamName ? <span className={s.chipTeam}> · {selected.teamName}</span> : null}
          </span>
          <button
            type="button"
            className={s.chipRemove}
            aria-label={`Remove ${selected.name} as your golden boot pick`}
            onClick={onClear}
          >
            <CloseIcon size={14} />
          </button>
        </span>
      ) : (
        <>
          <TextInput
            label="Top scorer"
            placeholder="Search by player or team…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          {loading ? (
            <p className={s.note}>Searching…</p>
          ) : results.length > 0 ? (
            <ul className={s.results}>
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" className={s.result} onClick={() => onSelect(p)}>
                    <span>{p.name}</span>
                    {p.teamName ? <span className={s.resultTeam}>{p.teamName}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.note}>{emptyNote}</p>
          )}
        </>
      )}
    </div>
  )
}
