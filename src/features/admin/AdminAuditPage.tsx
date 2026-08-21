import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useSite } from '../../app/site/SiteProvider'
import { snapshotAllowsCapability } from '../../services/supabase/adminAccess'
import { fetchAdministeredSeasons, type AdministeredSeason } from '../../services/supabase/administeredSeasons'
import { fetchProviderReviewQueues, type ProviderReviewQueues } from '../../services/supabase/providerReviewQueues'
import { formatKickoffWithDay } from '../../shared/time/kickoff'
import { useAdminAccess } from './AdminAccessContext'
import { ControlRoomPage, Panel, ReadState, StatusPill } from './ControlRoomUi'
import styles from './controlRoom.module.css'

type Read<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'failed'; message: string }

function formatInstant(value: string | null): string {
  return formatKickoffWithDay(value) ?? 'Unknown'
}

export function AdminAuditPage() {
  const access = useAdminAccess()
  const site = useSite()
  const canReadCompetitionAudit = snapshotAllowsCapability(access, 'competitions')
  const canReadResults = snapshotAllowsCapability(access, 'results')
  const [seasons, setSeasons] = useState<Read<AdministeredSeason[]> | null>(canReadCompetitionAudit ? { status: 'loading' } : null)
  const [seasonId, setSeasonId] = useState('')
  const [audit, setAudit] = useState<Read<ProviderReviewQueues> | null>(null)

  useEffect(() => {
    if (!canReadCompetitionAudit) return
    let active = true
    fetchAdministeredSeasons()
      .then((rows) => {
        if (!active) return
        setSeasons({ status: 'ready', value: rows })
        setSeasonId((value) => value || rows[0]?.id || '')
      })
      .catch((error) => {
        if (active) setSeasons({ status: 'failed', message: error instanceof Error ? error.message : 'Audit season read failed.' })
      })
    return () => { active = false }
  }, [canReadCompetitionAudit])

  useEffect(() => {
    if (!canReadCompetitionAudit || !seasonId) return
    let active = true
    setAudit({ status: 'loading' })
    fetchProviderReviewQueues(seasonId, 30)
      .then((value) => { if (active) setAudit({ status: 'ready', value }) })
      .catch((error) => { if (active) setAudit({ status: 'failed', message: error instanceof Error ? error.message : 'Audit read failed.' }) })
    return () => { active = false }
  }, [canReadCompetitionAudit, seasonId])

  return (
    <ControlRoomPage
      eyebrow="Traceability"
      title="Audit"
      intro="A unified presentation over existing append-only domain evidence. It does not replace result revisions, provider decisions, publication transitions or AI model history with a generic editable log."
    >
      {canReadCompetitionAudit ? (
        <Panel title="Competition & provider history" description="Recent official result changes come from the existing provider-review authority; review queues remain work, not history.">
          {seasons?.status === 'loading' ? <ReadState kind="loading" title="Loading competition history" detail="Waiting for the administered-season read." /> : null}
          {seasons?.status === 'failed' ? <ReadState kind="failed" title="Competition history unavailable" detail={seasons.message} /> : null}
          {seasons?.status === 'ready' && seasons.value.length === 0 ? <ReadState kind="empty" title="No administered competition seasons" detail="No history is invented when the admin season catalogue is empty." /> : null}
          {seasons?.status === 'ready' && seasons.value.length > 0 ? (
            <label>
              <span className={styles.meta}>Competition season</span>
              <select value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
                {seasons.value.map((season) => <option value={season.id} key={season.id}>{season.name}</option>)}
              </select>
            </label>
          ) : null}
          {audit?.status === 'loading' ? <ReadState kind="loading" title="Loading append-only history" detail="The selected competition's bounded audit evidence is being read." /> : null}
          {audit?.status === 'failed' ? <ReadState kind="failed" title="Audit evidence unavailable" detail={audit.message} /> : null}
          {audit?.status === 'ready' && audit.value.recentResultChanges.length === 0 ? <ReadState kind="empty" title="No recent result changes" detail="This means the bounded history read succeeded and returned none." /> : null}
          {audit?.status === 'ready' && audit.value.recentResultChanges.length > 0 ? (
            <ul className={styles.auditList}>
              {audit.value.recentResultChanges.map((entry) => (
                <li className={styles.auditRow} key={entry.id}>
                  <div className={styles.rowSpread}>
                    <strong>{entry.summary}</strong>
                    <span className={styles.meta}>{formatInstant(entry.at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : (
        <Panel title="Competition & provider history"><ReadState kind="no-permission" title="Competition audit not in this capability" detail="This account is not given competition-admin reads merely because the Audit destination exists." /></Panel>
      )}

      <div className={styles.grid2}>
        <Panel title="Official result revisions" description="Corrections and clears retain their fixture-scoped revision authority.">
          {canReadResults ? (
            <><StatusPill state="healthy" label="Results capability" /><Link className={styles.linkButton} to="/admin/results">Open Results Centre</Link></>
          ) : <ReadState kind="no-permission" title="No Results capability" detail="Result history is not widened through Audit." />}
        </Panel>
        <Panel title="AI model & evidence history" description="AI Lab remains a separate analytical product and keeps its own promotion/evidence authorities.">
          {canReadCompetitionAudit && site.servesDomesticCompetitions ? (
            <><StatusPill state="healthy" label="Competition-admin authority" /><Link className={styles.linkButton} to="/admin/ai">Open AI Lab</Link></>
          ) : <ReadState kind="no-permission" title="AI Lab unavailable here" detail="Audit does not bypass capability or deployment-variant boundaries." />}
        </Panel>
      </div>

      <Panel title="New admin mutations" description="This branch adds bounded read-only support endpoints, not new user/league mutation categories.">
        <StatusPill state="healthy" label="No editable audit surface" />
        <p className={styles.meta}>Future suspend/archive/notification-switch commands must add their own reason-bearing append-only audit seam before a button is enabled.</p>
      </Panel>
    </ControlRoomPage>
  )
}
