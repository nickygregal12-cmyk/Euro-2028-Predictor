import { useState, type FormEvent } from 'react'
import {
  isAdminSupportNotConfigured,
  searchAdminContainers,
  type AdminContainerSummary,
} from '../../services/supabase/adminSupport'
import { formatKickoffWithDay } from '../../shared/time/kickoff'
import { ControlRoomPage, Panel, ReadState, StatusPill } from './ControlRoomUi'
import styles from './controlRoom.module.css'

function formatInstant(value: string | null): string {
  return formatKickoffWithDay(value) ?? 'Unknown'
}

function lifecycleState(value: string | null) {
  if (!value) return 'unknown' as const
  if (['active', 'available', 'open', 'scheduled'].includes(value)) return 'healthy' as const
  if (['complete', 'archived', 'closed'].includes(value)) return 'disabled' as const
  return 'unknown' as const
}

export function AdminLeaguesPage() {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<AdminContainerSummary[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setError('Enter at least two characters.')
      return
    }
    setLoading(true)
    setError(null)
    setNotConfigured(false)
    try {
      setRows(await searchAdminContainers(trimmed))
    } catch (cause) {
      setRows(null)
      if (isAdminSupportNotConfigured(cause)) setNotConfigured(true)
      else setError(cause instanceof Error ? cause.message : 'Private-play search failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ControlRoomPage eyebrow="Private play" title="Leagues & containers" intro="A server-bounded administration search across ordinary leagues and private game containers. Invite codes are credentials and are deliberately absent from every response and table.">
      <Panel title="Find private play" description="Search by container name. At most 30 rows leave the server boundary, and the service-role credential stays inside the Edge runtime.">
        <form onSubmit={submit} className={styles.rowSpread}>
          <label className={styles.controlField} style={{ flex: 1 }}>
            <span>League or container name</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search private play" autoComplete="off" />
          </label>
          <button className={styles.primaryButton} type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        </form>
        {notConfigured ? <ReadState kind="not-configured" title="Admin support boundary is not deployed" detail="The repository contains the read-only function, but this environment has not provisioned it. Invite data is not fetched through an unsafe fallback." /> : null}
        {loading ? <ReadState kind="loading" title="Searching bounded private-play data" detail="No invite code is read or returned." /> : null}
        {error ? <ReadState kind="failed" title="Private-play search unavailable" detail={error} /> : null}
        {!loading && !notConfigured && rows?.length === 0 ? <ReadState kind="empty" title="No matching containers" detail="The bounded search completed successfully and found no match." /> : null}
      </Panel>

      {rows && rows.length > 0 ? (
        <Panel title="Search results" description="Ordinary Match Predictor leagues and independent private LMS/Championship containers retain their own identities rather than being flattened into one game model.">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Name</th><th>Type</th><th>Competition</th><th>Owner</th><th>Members</th><th>Lifecycle</th><th>Created</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`}>
                    <td data-label="Name"><strong>{row.name}</strong><br /><span className={styles.meta}>{row.kind === 'league' ? 'League' : 'Private game container'}</span></td>
                    <td data-label="Type">{row.gameType ?? 'Unknown'}</td>
                    <td data-label="Competition">{row.seasonName ?? 'Unknown'}</td>
                    <td data-label="Owner">{row.ownerName}</td>
                    <td data-label="Members">{row.memberCount}</td>
                    <td data-label="Lifecycle"><StatusPill state={lifecycleState(row.lifecycle)} label={row.lifecycle ?? 'Unknown'} /></td>
                    <td data-label="Created">{formatInstant(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel title="Administrative actions" description="Search is intentionally read-only until each moderation write has a reason-bearing audited server authority.">
        <ReadState kind="not-configured" title="No arbitrary league mutation tools" detail="The Control Room does not expose invite codes, edit points, change predictions, archive/disable or remove-participant buttons unless a reviewed server command owns that exact action." />
      </Panel>
    </ControlRoomPage>
  )
}
