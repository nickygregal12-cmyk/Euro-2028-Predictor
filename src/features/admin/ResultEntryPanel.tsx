import { useState } from 'react'
import { Button } from '../../design-system'
import type { Match } from '../../services/supabase/tournamentData'
import { validateResultEntry, type ResultEntryDraft } from '../../domain/admin/resultEntry'
import a from './admin.module.css'

const EMPTY_DRAFT: ResultEntryDraft = {
  home90: '',
  away90: '',
  wentToExtraTime: false,
  homeExtraTime: '',
  awayExtraTime: '',
  wentToPenalties: false,
  homePenalties: '',
  awayPenalties: '',
}

type Props = {
  match: Match
  homeName: string
  awayName: string
  onClose: () => void
}

export function ResultEntryPanel({ match, homeName, awayName, onClose }: Props) {
  const [draft, setDraft] = useState<ResultEntryDraft>(EMPTY_DRAFT)
  const [errors, setErrors] = useState<string[]>([])
  const [preview, setPreview] = useState<string | null>(null)

  function set<K extends keyof ResultEntryDraft>(key: K, value: ResultEntryDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }) as ResultEntryDraft)
    setErrors([])
    setPreview(null)
  }

  function review() {
    const validation = validateResultEntry(match.round, draft)
    if (!validation.ok) {
      setErrors(validation.errors)
      return
    }

    const value = validation.value
    const suffix = value.homePenalties !== null
      ? `, ${value.homePenalties}–${value.awayPenalties} on penalties`
      : value.homeAfterExtraTime !== null
        ? `, ${value.homeAfterExtraTime}–${value.awayAfterExtraTime} after extra time`
        : ''
    setPreview(`${homeName} ${value.home90}–${value.away90} ${awayName}${suffix}`)
  }

  return (
    <section className={a.entryPanel} aria-labelledby="result-entry-title">
      <div className={a.sectionHeading}>
        <div>
          <span className={a.fixtureMeta}>{match.matchRef}</span>
          <h2 id="result-entry-title" className={a.sectionTitle}>Review result entry</h2>
        </div>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>

      <div className={a.scoreGrid}>
        <label>
          <span>{homeName} after 90 minutes</span>
          <input inputMode="numeric" value={draft.home90} onChange={(event) => set('home90', event.target.value)} />
        </label>
        <label>
          <span>{awayName} after 90 minutes</span>
          <input inputMode="numeric" value={draft.away90} onChange={(event) => set('away90', event.target.value)} />
        </label>
      </div>

      {match.round !== 'group' ? (
        <>
          <label className={a.checkRow}>
            <input type="checkbox" checked={draft.wentToExtraTime} onChange={(event) => set('wentToExtraTime', event.target.checked)} />
            Match went to extra time
          </label>

          {draft.wentToExtraTime ? (
            <div className={a.scoreGrid}>
              <label>
                <span>{homeName} after extra time</span>
                <input inputMode="numeric" value={draft.homeExtraTime} onChange={(event) => set('homeExtraTime', event.target.value)} />
              </label>
              <label>
                <span>{awayName} after extra time</span>
                <input inputMode="numeric" value={draft.awayExtraTime} onChange={(event) => set('awayExtraTime', event.target.value)} />
              </label>
            </div>
          ) : null}

          {draft.wentToExtraTime ? (
            <label className={a.checkRow}>
              <input type="checkbox" checked={draft.wentToPenalties} onChange={(event) => set('wentToPenalties', event.target.checked)} />
              Match went to penalties
            </label>
          ) : null}

          {draft.wentToPenalties ? (
            <div className={a.scoreGrid}>
              <label>
                <span>{homeName} penalties</span>
                <input inputMode="numeric" value={draft.homePenalties} onChange={(event) => set('homePenalties', event.target.value)} />
              </label>
              <label>
                <span>{awayName} penalties</span>
                <input inputMode="numeric" value={draft.awayPenalties} onChange={(event) => set('awayPenalties', event.target.value)} />
              </label>
            </div>
          ) : null}
        </>
      ) : null}

      {errors.length ? (
        <div className={a.validation} role="alert">
          <strong>Check this result</strong>
          <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      ) : null}

      {preview ? (
        <div className={a.preview} role="status">
          <strong>Validated preview</strong>
          <span>{preview}</span>
          <small>Database confirmation remains disabled in this build.</small>
        </div>
      ) : null}

      <Button onClick={review}>Validate result</Button>
    </section>
  )
}
