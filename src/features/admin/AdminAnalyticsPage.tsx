import { useEffect, useState } from 'react'
import { fetchPublicCapacity } from '../../services/supabase/publicCapacity'
import type { PublicCapacity } from '../../services/supabase/publicCapacityModel'
import { ControlRoomPage, Panel, ReadState, Stat, StatusPill } from './ControlRoomUi'
import styles from './controlRoom.module.css'

type Read = { status: 'loading' } | { status: 'failed'; message: string } | { status: 'ready'; value: PublicCapacity }

export function AdminAnalyticsPage() {
  const [capacity, setCapacity] = useState<Read>({ status: 'loading' })
  const posthogConfigured = Boolean(import.meta.env.VITE_POSTHOG_KEY?.trim())

  useEffect(() => {
    let active = true
    fetchPublicCapacity()
      .then((value) => { if (active) setCapacity({ status: 'ready', value }) })
      .catch((error) => { if (active) setCapacity({ status: 'failed', message: error instanceof Error ? error.message : 'Analytics capacity read failed.' }) })
    return () => { active = false }
  }, [])

  return (
    <ControlRoomPage eyebrow="Product intelligence" title="Analytics" intro="Privacy-conscious product reporting. The in-app surface shows only aggregates the application already has a bounded authority for; deeper analysis remains in PostHog or the repository's read-only reporting layer rather than exposing raw player rows.">
      <div className={styles.grid3}>
        <Stat label="Product analytics" value={posthogConfigured ? 'Configured' : 'Disabled'} detail={posthogConfigured ? 'Intentional events only' : 'No PostHog key in this build'} state={posthogConfigured ? 'healthy' : 'disabled'} />
        <Stat label="Session replay" value="Off" detail="Not part of the current privacy-safe analytics integration" state="disabled" />
        <Stat label="Hosted BI" value="Not provisioned" detail="Aggregate reporting definitions exist in repository only" state="not-configured" />
      </div>

      <Panel title="Current platform scale" description="These are capacity aggregates, not engagement metrics and not a substitute for DAU/WAU.">
        {capacity.status === 'loading' ? <ReadState kind="loading" title="Loading aggregate scale" detail="No player-level rows are being requested." /> : null}
        {capacity.status === 'failed' ? <ReadState kind="failed" title="Aggregate scale unavailable" detail={capacity.message} /> : null}
        {capacity.status === 'ready' ? (
          <div className={styles.grid4}>
            <Stat label="Public accounts" value={capacity.value.publicUsersUsed} detail={`Operating limit ${capacity.value.publicUserLimit}`} />
            <Stat label="Leagues" value={capacity.value.leaguesUsed} detail={`Operating limit ${capacity.value.totalLeagueLimit}`} />
            <Stat label="Signup capacity" value={capacity.value.signupAvailable ? 'Available' : 'Full'} state={capacity.value.signupAvailable ? 'healthy' : 'critical'} />
            <Stat label="League capacity" value={capacity.value.leagueCreationAvailable ? 'Available' : 'Full'} state={capacity.value.leagueCreationAvailable ? 'healthy' : 'critical'} />
          </div>
        ) : null}
      </Panel>

      <Panel title="Reporting catalogue" description="The repository already defines aggregate reporting views for these questions; this Control Room does not reproduce them with ad-hoc service-role queries.">
        <ul className={styles.recordList}>
          <li className={styles.recordRow}><div className={styles.rowSpread}><strong>Acquisition & signup trend</strong><StatusPill state="not-configured" label="Read-only reporting view available externally" /></div><span className={styles.meta}>Daily signup aggregates are defined without exposing account identities.</span></li>
          <li className={styles.recordRow}><div className={styles.rowSpread}><strong>Prediction activity & completion</strong><StatusPill state="not-configured" label="Read-only reporting view available externally" /></div><span className={styles.meta}>Prediction writers are an activity proxy, not true DAU/WAU. The Control Room does not rename them as active users.</span></li>
          <li className={styles.recordRow}><div className={styles.rowSpread}><strong>Competition, league & LMS participation</strong><StatusPill state="not-configured" label="Read-only reporting view available externally" /></div><span className={styles.meta}>Aggregate participation views exist; per-player selections and predictions remain outside the reporting role.</span></li>
          <li className={styles.recordRow}><div className={styles.rowSpread}><strong>Provider & AI Lab evidence</strong><StatusPill state="healthy" label="Operational workspaces available" /></div><span className={styles.meta}>Provider polling and AI performance already have dedicated protected admin reads; AI Lab remains the richer analytical product.</span></li>
        </ul>
      </Panel>

      <Panel title="Privacy boundary" description="The reporting architecture intentionally has fewer answers than the product database.">
        <ReadState kind="not-configured" title="True DAU/WAU is not derived from prediction writes" detail="The database has no canonical session/page-view ledger. PostHog is the product-behaviour system when configured; external BI tooling consumes aggregate views only and is not given base-table access." />
      </Panel>
    </ControlRoomPage>
  )
}
