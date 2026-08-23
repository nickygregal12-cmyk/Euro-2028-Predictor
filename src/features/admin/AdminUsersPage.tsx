import { useState, type FormEvent } from 'react'
import {
  isAdminSupportNotConfigured,
  searchAdminUsers,
  type AdminSupportUser,
} from '../../services/supabase/adminSupport'
import { formatKickoffWithDay } from '../../shared/time/kickoff'
import { ControlRoomPage, Panel, ReadState, Stat, StatusPill } from './ControlRoomUi'
import styles from './controlRoom.module.css'

function formatInstant(value: string | null): string {
  return formatKickoffWithDay(value) ?? 'Unknown'
}

function latestActivity(user: AdminSupportUser): string | null {
  const values = [user.lastSeenAt, user.lastSignInAt]
    .map((value) => value ? new Date(value) : null)
    .filter((value): value is Date => value !== null && Number.isFinite(value.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())
  return values[0]?.toISOString() ?? null
}

export function AdminUsersPage() {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<AdminSupportUser[] | null>(null)
  const [selected, setSelected] = useState<AdminSupportUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setError('Enter at least two characters or an exact support reference.')
      return
    }
    setLoading(true)
    setError(null)
    setNotConfigured(false)
    setSelected(null)
    try {
      setUsers(await searchAdminUsers(trimmed))
    } catch (cause) {
      setUsers(null)
      if (isAdminSupportNotConfigured(cause)) setNotConfigured(true)
      else setError(cause instanceof Error ? cause.message : 'User search failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ControlRoomPage eyebrow="Support operations" title="Users" intro="A bounded server-side support lookup. The browser never downloads the user base, never receives raw Auth metadata, tokens or password data, and this surface deliberately contains no make-admin control.">
      <Panel title="Find a user" description="Search by display name or exact support reference. The Edge boundary re-resolves the caller and requires the trusted users capability before reading support data.">
        <form onSubmit={submit} className={styles.rowSpread}>
          <label className={styles.controlField} style={{ flex: 1 }}>
            <span>Display name or support reference</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" autoComplete="off" />
          </label>
          <button className={styles.primaryButton} type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        </form>
        {notConfigured ? <ReadState kind="not-configured" title="Admin support boundary is not deployed" detail="The repository contains the read-only function, but this environment has not provisioned it. No fallback service-role read is attempted from the browser." /> : null}
        {error ? <ReadState kind="failed" title="User search unavailable" detail={error} /> : null}
        {loading ? <ReadState kind="loading" title="Searching bounded support data" detail="At most 20 matching profiles are returned." /> : null}
        {!loading && !notConfigured && users?.length === 0 ? <ReadState kind="empty" title="No matching users" detail="The bounded search completed successfully and found no match." /> : null}
      </Panel>

      {users && users.length > 0 ? (
        <Panel title="Search results" description={`${users.length} bounded result${users.length === 1 ? '' : 's'}. Email is returned only inside this protected support boundary and is not used as a browser-side directory.`}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>User</th><th>Status</th><th>Created</th><th>Activity</th><th>Memberships</th><th /></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.supportRef}>
                    <td data-label="User"><strong>{user.displayName}</strong><br /><span className={styles.meta}>{user.email ?? 'No email returned'}</span></td>
                    <td data-label="Status"><StatusPill state={user.accountStatus === 'active' ? 'healthy' : user.accountStatus === 'banned' ? 'warning' : user.accountStatus === 'deleted' ? 'critical' : 'unknown'} label={user.accountStatus} /></td>
                    <td data-label="Created">{formatInstant(user.createdAt)}</td>
                    <td data-label="Activity">{formatInstant(latestActivity(user))}</td>
                    <td data-label="Memberships">{user.gameMemberships} games · {user.leagueMemberships} leagues</td>
                    <td data-label="Detail"><button className={styles.secondaryButton} type="button" onClick={() => setSelected(user)}>Inspect</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {selected ? (
        <Panel title={selected.displayName} description={`Support reference ${selected.supportRef}`} aside={<StatusPill state={selected.accountStatus === 'active' ? 'healthy' : selected.accountStatus === 'banned' ? 'warning' : 'unknown'} label={selected.accountStatus} />}>
          <div className={styles.grid4}>
            <Stat label="Followed competitions" value={selected.followedCompetitions} />
            <Stat label="Game memberships" value={selected.gameMemberships} />
            <Stat label="League memberships" value={selected.leagueMemberships} />
            <Stat label="Reminder email preference" value={selected.reminderEmails === null ? 'Unknown' : selected.reminderEmails ? 'Enabled' : 'Disabled'} />
          </div>
          <div className={styles.grid3}>
            <Stat label="Onboarding" value={selected.onboardingStep ?? 'Unknown'} detail={selected.onboardingCompletedAt ? `Completed ${formatInstant(selected.onboardingCompletedAt)}` : 'Completion not recorded'} />
            <Stat label="Email confirmed" value={selected.emailConfirmedAt ? 'Yes' : 'Unknown / no'} detail={formatInstant(selected.emailConfirmedAt)} />
            <Stat label="Last meaningful activity" value={formatInstant(latestActivity(selected))} detail="Latest profile activity or Auth sign-in, where available" />
          </div>
          <ReadState kind="not-configured" title="Sensitive account mutations are not exposed" detail="Suspend/unsuspend, session revocation and recovery require a reason-bearing audited server command. The Control Room does not invent those writes or expose an unsafe service-role proxy." />
        </Panel>
      ) : null}
    </ControlRoomPage>
  )
}
