import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { releaseIdentity } from '../../services/observability/releaseIdentity'
import { snapshotAllowsCapability } from '../../services/supabase/adminAccess'
import {
  fetchAdministeredSeasons,
  type AdministeredSeason,
} from '../../services/supabase/administeredSeasons'
import { fetchAdminAiOperationalHealth, type AdminAiOperationalHealth } from '../../services/supabase/adminOperations'
import { fetchSeasonGames } from '../../services/supabase/competitionGames'
import type { SeasonGames } from '../../services/supabase/competitionGamesModel'
import { fetchProviderReviewQueues } from '../../services/supabase/providerReviewQueues'
import type { ProviderReviewQueues } from '../../services/supabase/providerReviewQueuesModel'
import { fetchPublicCapacity } from '../../services/supabase/publicCapacity'
import type { PublicCapacity } from '../../services/supabase/publicCapacityModel'
import { fetchReminderDeliveryHealth, type ReminderDeliveryHealth } from '../../services/supabase/reminderDeliveryHealth'
import { fetchSeasonMatchweekFixtures } from '../../services/supabase/seasonFixtures'
import { useAdminAccess } from './AdminAccessContext'
import { summariseMatchweekReadiness } from './adminOverviewReadiness'
import { presentSeasonReadiness, type SeasonReadiness } from './seasonAdminModel'
import { ControlRoomPage, Panel, ReadState, Stat, StatusPill, type OperationalState } from './ControlRoomUi'
import styles from './controlRoom.module.css'

type Read<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'failed'; message: string }

type InboxItem = {
  key: string
  title: string
  detail: string
  state: OperationalState
  href: string
}

function contractState(): OperationalState {
  if (releaseIdentity.hostedContract === null) return 'unknown'
  if (releaseIdentity.hostedContract === releaseIdentity.applicationContract) return 'healthy'
  return releaseIdentity.hostedContract < releaseIdentity.applicationContract ? 'critical' : 'warning'
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function settled<T>(read: Read<T> | null): boolean {
  return read === null || read.status !== 'loading'
}

export function AdminOverviewPage() {
  const access = useAdminAccess()
  const canOperateCompetitions = snapshotAllowsCapability(access, 'competitions')
  const canOperateResults = snapshotAllowsCapability(access, 'results')
  const [capacity, setCapacity] = useState<Read<PublicCapacity>>({ status: 'loading' })
  const [operations, setOperations] = useState<Read<AdminAiOperationalHealth> | null>(canOperateCompetitions ? { status: 'loading' } : null)
  const [reminders, setReminders] = useState<Read<ReminderDeliveryHealth> | null>(canOperateCompetitions ? { status: 'loading' } : null)
  const [seasons, setSeasons] = useState<Read<AdministeredSeason[]> | null>(canOperateCompetitions ? { status: 'loading' } : null)
  const [readinessSeasonId, setReadinessSeasonId] = useState('')
  const [readinessMatchweek, setReadinessMatchweek] = useState(1)
  const [fixtureReadiness, setFixtureReadiness] = useState<Read<SeasonReadiness> | null>(null)
  const [providerReadiness, setProviderReadiness] = useState<Read<ProviderReviewQueues> | null>(null)
  const [gameReadiness, setGameReadiness] = useState<Read<SeasonGames> | null>(null)

  useEffect(() => {
    let active = true
    fetchPublicCapacity()
      .then((value) => { if (active) setCapacity({ status: 'ready', value }) })
      .catch((error) => { if (active) setCapacity({ status: 'failed', message: messageOf(error, 'Capacity read failed.') }) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!canOperateCompetitions) return
    let active = true
    Promise.allSettled([
      fetchAdminAiOperationalHealth(),
      fetchReminderDeliveryHealth(),
      fetchAdministeredSeasons(),
    ]).then(([ops, notification, seasonList]) => {
      if (!active) return
      setOperations(ops.status === 'fulfilled' ? { status: 'ready', value: ops.value } : { status: 'failed', message: messageOf(ops.reason, 'Football operations read failed.') })
      setReminders(notification.status === 'fulfilled' ? { status: 'ready', value: notification.value } : { status: 'failed', message: messageOf(notification.reason, 'Notification operations read failed.') })
      if (seasonList.status === 'fulfilled') {
        setSeasons({ status: 'ready', value: seasonList.value })
        // This chooses what the selector opens on; it does NOT claim which
        // matchweek is current. The selected season remains visible and editable.
        const preferred =
          seasonList.value.find((season) => season.status === 'active') ??
          seasonList.value.find((season) => season.status === 'scheduled') ??
          seasonList.value[0]
        setReadinessSeasonId((current) => current || preferred?.id || '')
      } else {
        setSeasons({ status: 'failed', message: messageOf(seasonList.reason, 'Administered seasons could not be read.') })
      }
    })
    return () => { active = false }
  }, [canOperateCompetitions])

  useEffect(() => {
    if (!canOperateCompetitions || !readinessSeasonId) {
      setProviderReadiness(null)
      setGameReadiness(null)
      return
    }
    let active = true
    setProviderReadiness({ status: 'loading' })
    setGameReadiness({ status: 'loading' })
    Promise.allSettled([
      fetchProviderReviewQueues(readinessSeasonId),
      fetchSeasonGames(readinessSeasonId),
    ]).then(([provider, games]) => {
      if (!active) return
      setProviderReadiness(provider.status === 'fulfilled' ? { status: 'ready', value: provider.value } : { status: 'failed', message: messageOf(provider.reason, 'Provider review queues could not be read.') })
      setGameReadiness(games.status === 'fulfilled' ? { status: 'ready', value: games.value } : { status: 'failed', message: messageOf(games.reason, 'Game availability could not be read.') })
    })
    return () => { active = false }
  }, [canOperateCompetitions, readinessSeasonId])

  useEffect(() => {
    if (!canOperateCompetitions || !readinessSeasonId) {
      setFixtureReadiness(null)
      return
    }
    let active = true
    setFixtureReadiness({ status: 'loading' })
    fetchSeasonMatchweekFixtures(readinessSeasonId, readinessMatchweek)
      .then((page) => {
        if (active) setFixtureReadiness({ status: 'ready', value: presentSeasonReadiness(page) })
      })
      .catch((error) => {
        if (active) setFixtureReadiness({ status: 'failed', message: messageOf(error, 'Matchweek fixtures could not be read.') })
      })
    return () => { active = false }
  }, [canOperateCompetitions, readinessSeasonId, readinessMatchweek])

  const selectedSeason = seasons?.status === 'ready'
    ? seasons.value.find((season) => season.id === readinessSeasonId) ?? null
    : null

  const readiness =
    fixtureReadiness?.status === 'ready' &&
    providerReadiness?.status === 'ready' &&
    gameReadiness?.status === 'ready'
      ? summariseMatchweekReadiness(
          fixtureReadiness.value,
          providerReadiness.value,
          gameReadiness.value,
        )
      : null

  const inbox = useMemo<InboxItem[]>(() => {
    const items: InboxItem[] = []
    if (capacity.status === 'failed') items.push({ key: 'capacity-read', title: 'Capacity summary could not be read', detail: capacity.message, state: 'warning', href: '/admin?workspace=system' })
    if (capacity.status === 'ready') {
      if (!capacity.value.signupAvailable) items.push({ key: 'signup-cap', title: 'Public signup is at its operating limit', detail: `${capacity.value.publicUsersUsed} of ${capacity.value.publicUserLimit} public-user slots are used.`, state: 'critical', href: '/admin?workspace=system' })
      if (!capacity.value.leagueCreationAvailable) items.push({ key: 'league-cap', title: 'League creation is at its operating limit', detail: `${capacity.value.leaguesUsed} of ${capacity.value.totalLeagueLimit} league slots are used.`, state: 'critical', href: '/admin?workspace=system' })
    }
    if (operations?.status === 'failed') items.push({ key: 'ops-read', title: 'Football operations health could not be read', detail: operations.message, state: 'warning', href: '/admin/season?workspace=football-data' })
    if (operations?.status === 'ready') {
      const failures = operations.value.jobs.filter((job) => (job.failures7d ?? 0) > 0)
      if (failures.length > 0) items.push({ key: 'job-failures', title: `${failures.length} pipeline job${failures.length === 1 ? '' : 's'} reported failures`, detail: failures.map((job) => `${job.job}: ${job.failures7d}`).join(' · '), state: 'warning', href: '/admin/season?workspace=football-data' })
      if (operations.value.oddsApi.collectionEnabled === false) items.push({ key: 'odds-off', title: 'Paid odds collection is disabled', detail: 'This is a retained server state, not a failed provider request.', state: 'disabled', href: '/admin/season?workspace=football-data' })
    }
    if (reminders?.status === 'failed') items.push({ key: 'reminder-read', title: 'Reminder health could not be read', detail: reminders.message, state: 'warning', href: '/admin?workspace=notifications' })
    if (reminders?.status === 'ready') {
      if (reminders.value.deliveries.terminalFailures > 0 || reminders.value.deliveries.stalledOverAnHour > 0) items.push({ key: 'delivery-failure', title: 'Reminder ledger needs attention', detail: `${reminders.value.deliveries.terminalFailures} terminal failures · ${reminders.value.deliveries.stalledOverAnHour} stalled.`, state: 'critical', href: '/admin?workspace=notifications' })
      if (reminders.value.actions.openPastDeadline > 0) items.push({ key: 'action-expiry', title: 'Action Centre has overdue open items', detail: `${reminders.value.actions.openPastDeadline} item(s) are open past their own deadline.`, state: 'warning', href: '/admin?workspace=notifications' })
    }
    if (seasons?.status === 'failed') items.push({ key: 'season-read', title: 'Competition readiness list could not be read', detail: seasons.message, state: 'warning', href: '/admin/season' })
    if (seasons?.status === 'ready' && seasons.value.length === 0) items.push({ key: 'season-empty', title: 'No weekly seasons are available to administer', detail: 'The bounded administration list returned no league seasons.', state: 'warning', href: '/admin/season' })
    if (fixtureReadiness?.status === 'failed') items.push({ key: 'fixture-readiness-read', title: 'Selected matchweek fixture readiness could not be read', detail: fixtureReadiness.message, state: 'warning', href: '/admin/season' })
    if (fixtureReadiness?.status === 'ready' && fixtureReadiness.value.withoutKickoff > 0) items.push({ key: 'fixture-kickoffs', title: `${selectedSeason?.name ?? 'Selected season'} · Matchweek ${readinessMatchweek} is missing kickoff data`, detail: `${fixtureReadiness.value.withoutKickoff} of ${fixtureReadiness.value.fixtures} fixtures have no kickoff instant.`, state: 'critical', href: '/admin/season' })
    if (providerReadiness?.status === 'failed') items.push({ key: 'provider-readiness-read', title: 'Selected competition provider queues could not be read', detail: providerReadiness.message, state: 'warning', href: '/admin/season?workspace=football-data' })
    if (providerReadiness?.status === 'ready' && !providerReadiness.value.clear) {
      const unreviewed = providerReadiness.value.queues.reduce((total, queue) => total + queue.unreviewed, 0)
      items.push({ key: 'provider-readiness-work', title: `${selectedSeason?.name ?? 'Selected season'} has provider work waiting`, detail: `${unreviewed} unreviewed ingestion item(s) · ${providerReadiness.value.pendingCalendarProposals} staged calendar proposal(s).`, state: 'warning', href: '/admin/season?workspace=football-data' })
    }
    if (gameReadiness?.status === 'failed') items.push({ key: 'game-readiness-read', title: 'Selected competition game availability could not be read', detail: gameReadiness.message, state: 'warning', href: '/admin/season?workspace=games' })
    if (gameReadiness?.status === 'ready' && gameReadiness.value.games.filter((game) => game.active && game.completedAt === null).length === 0) items.push({ key: 'game-readiness-none-active', title: `${selectedSeason?.name ?? 'Selected season'} has no active unfinished game`, detail: `${gameReadiness.value.games.length} game configuration row(s) were returned.`, state: 'warning', href: '/admin/season?workspace=games' })
    if (contractState() !== 'healthy') items.push({ key: 'contract', title: 'Release/database contract needs review', detail: `Application ${releaseIdentity.applicationContract}; hosted ${releaseIdentity.hostedContract ?? 'unknown'}.`, state: contractState(), href: '/admin?workspace=system' })
    return items
  }, [capacity, operations, reminders, seasons, fixtureReadiness, providerReadiness, gameReadiness, selectedSeason, readinessMatchweek])

  const readinessReadsSettled =
    !canOperateCompetitions ||
    (settled(seasons) &&
      (seasons?.status !== 'ready' || seasons.value.length === 0 || (
        settled(fixtureReadiness) && settled(providerReadiness) && settled(gameReadiness)
      )))
  const readsSettled =
    capacity.status !== 'loading' &&
    (!canOperateCompetitions || (settled(operations) && settled(reminders))) &&
    readinessReadsSettled

  const readinessPanelState: OperationalState = readiness
    ? readiness.state
    : [fixtureReadiness, providerReadiness, gameReadiness].some((read) => read?.status === 'failed')
      ? 'warning'
      : 'unknown'

  return (
    <ControlRoomPage eyebrow="Operations overview" title="Control Room" intro="A capability-safe operational front door. Every status comes from a bounded authority or is labelled unknown; absence of an alert never substitutes for a read that did not run.">
      <div className={styles.heroStatus}>
        <section className={styles.statusHero} aria-labelledby="platform-status-title">
          <StatusPill state="healthy" label="Admin access verified" />
          <h2 id="platform-status-title">Predictor Hub</h2>
          <p>Trusted Auth app metadata admitted this account to at least one admin capability. Workspace RPCs and write commands continue to authorize independently on the server.</p>
        </section>
        <div className={styles.grid2}>
          <Stat label="Environment" value={releaseIdentity.environment.toUpperCase()} detail="Release identity, not a guessed hostname" />
          <Stat label="Access scope" value={access.isSuperAdmin ? 'All current' : access.capabilities.length} detail={access.isSuperAdmin ? 'Super administrator' : 'Explicit trusted capabilities'} />
        </div>
      </div>

      <Panel title="Action required" description="A consolidated operator inbox from the bounded summaries this account is allowed to read." aside={<StatusPill state={!readsSettled ? 'unknown' : inbox.some((item) => item.state === 'critical') ? 'critical' : inbox.length > 0 ? 'warning' : 'healthy'} label={!readsSettled ? 'Loading operational reads' : inbox.length > 0 ? `${inbox.length} item${inbox.length === 1 ? '' : 's'}` : 'No issue in loaded summaries'} />}>
        {!readsSettled ? <ReadState kind="loading" title="Loading operational summaries" detail="Capabilities are loaded independently; unsupported areas are not queried." /> : null}
        {readsSettled && inbox.length === 0 ? <ReadState kind="empty" title="No action in the loaded summaries" detail="This is not a claim that every external service is healthy; detailed provider, result and competition queues remain in their own workspaces." /> : null}
        {inbox.length > 0 ? (
          <ul className={styles.actionList}>
            {inbox.map((item) => (
              <li className={styles.actionItem} key={item.key}>
                <div className={styles.rowSpread}><strong>{item.title}</strong><StatusPill state={item.state} /></div>
                <span className={styles.meta}>{item.detail}</span>
                <Link className={styles.linkButton} to={item.href}>Inspect</Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <div className={styles.grid3}>
        <Stat label="Database contract" value={releaseIdentity.hostedContract === null ? 'Unknown' : `${releaseIdentity.hostedContract} / ${releaseIdentity.applicationContract}`} state={contractState()} detail="Hosted / application" />
        <Stat label="Football data" value={!canOperateCompetitions ? 'Not in capability' : operations?.status === 'ready' ? 'Summary loaded' : operations?.status === 'failed' ? 'Read failed' : 'Loading'} state={!canOperateCompetitions ? 'unknown' : operations?.status === 'ready' ? 'healthy' : operations?.status === 'failed' ? 'warning' : 'unknown'} detail="Provider detail remains in Football Data" />
        <Stat label="Notifications" value={!canOperateCompetitions ? 'Not in capability' : reminders?.status === 'ready' ? (reminders.value.senderConfigured ? 'Configured' : 'Delivery disabled') : reminders?.status === 'failed' ? 'Read failed' : 'Loading'} state={reminders?.status === 'ready' ? (reminders.value.senderConfigured ? 'healthy' : 'disabled') : reminders?.status === 'failed' ? 'warning' : 'unknown'} />
        <Stat label="Users" value={capacity.status === 'ready' ? `${capacity.value.publicUsersUsed} / ${capacity.value.publicUserLimit}` : capacity.status === 'failed' ? 'Unknown' : 'Loading'} state={capacity.status === 'ready' && !capacity.value.signupAvailable ? 'critical' : capacity.status === 'ready' ? 'healthy' : 'unknown'} />
        <Stat label="Results Centre" value={canOperateResults ? 'Available' : 'Not in capability'} state={canOperateResults ? 'healthy' : 'unknown'} detail="Fixture writes retain result-admin authority" />
        <Stat label="Sentry" value={import.meta.env.VITE_SENTRY_ENABLED === 'true' && import.meta.env.VITE_SENTRY_DSN?.trim() ? 'Configured · health external' : 'Disabled / incomplete'} state={import.meta.env.VITE_SENTRY_ENABLED === 'true' && import.meta.env.VITE_SENTRY_DSN?.trim() ? 'unknown' : 'disabled'} />
      </div>

      <Panel
        title="Matchweek readiness"
        description="An operator-selected season and matchweek, aggregated from the existing fixture card, provider-review and game-catalogue reads. This is a presentation summary, not a second server readiness rule."
        aside={<StatusPill state={readinessPanelState} label={readiness?.label ?? (canOperateCompetitions ? 'Awaiting selected reads' : 'Outside capability')} />}
      >
        {!canOperateCompetitions ? (
          <ReadState kind="no-permission" title="Competition readiness is outside this capability" detail="The Overview does not widen competition administration just to fill a readiness card." />
        ) : seasons?.status === 'loading' ? (
          <ReadState kind="loading" title="Loading administered competitions" detail="Drafts are included because administration must be able to inspect a season before players can." />
        ) : seasons?.status === 'failed' ? (
          <ReadState kind="failed" title="Competition readiness list unavailable" detail={seasons.message} />
        ) : seasons?.status === 'ready' && seasons.value.length === 0 ? (
          <ReadState kind="empty" title="No weekly seasons to inspect" detail="The bounded administration list returned no league seasons." />
        ) : seasons?.status === 'ready' ? (
          <>
            <div className={styles.readinessControls}>
              <label className={styles.controlField}>
                <span>Competition</span>
                <select value={readinessSeasonId} onChange={(event) => setReadinessSeasonId(event.target.value)}>
                  {seasons.value.map((season) => <option key={season.id} value={season.id}>{season.name} · {season.status ?? 'unknown'}</option>)}
                </select>
              </label>
              <label className={styles.controlField}>
                <span>Matchweek</span>
                <input
                  type="number"
                  min={1}
                  max={fixtureReadiness?.status === 'ready' ? fixtureReadiness.value.matchweekCount : undefined}
                  value={readinessMatchweek}
                  onChange={(event) => setReadinessMatchweek(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                />
              </label>
            </div>

            {fixtureReadiness?.status === 'loading' || providerReadiness?.status === 'loading' || gameReadiness?.status === 'loading' ? <ReadState kind="loading" title="Loading selected readiness sources" detail="Fixture, provider and game reads settle independently." /> : null}
            {fixtureReadiness?.status === 'failed' ? <ReadState kind="failed" title="Fixture readiness unavailable" detail={fixtureReadiness.message} /> : null}
            {providerReadiness?.status === 'failed' ? <ReadState kind="failed" title="Provider review readiness unavailable" detail={providerReadiness.message} /> : null}
            {gameReadiness?.status === 'failed' ? <ReadState kind="failed" title="Game availability readiness unavailable" detail={gameReadiness.message} /> : null}

            {readiness && fixtureReadiness?.status === 'ready' ? (
              <div className={styles.grid4}>
                <Stat label="Fixtures" value={readiness.fixtures} detail={`Matchweek ${fixtureReadiness.value.matchweek} of ${fixtureReadiness.value.matchweekCount}`} state={readiness.fixtures > 0 ? 'healthy' : 'critical'} />
                <Stat label="Kickoffs confirmed" value={`${Math.max(0, readiness.fixtures - readiness.fixturesWithoutKickoff)} / ${readiness.fixtures}`} detail={readiness.fixturesWithoutKickoff > 0 ? `${readiness.fixturesWithoutKickoff} missing` : 'Every fixture has a kickoff instant'} state={readiness.fixturesWithoutKickoff > 0 ? 'critical' : 'healthy'} />
                <Stat label="Provider work" value={readiness.providerWork} detail="Unreviewed ingestion items + staged calendar proposals" state={readiness.providerWork > 0 ? 'warning' : 'healthy'} />
                <Stat label="Active games" value={`${readiness.activeGames} / ${readiness.configuredGames}`} detail="Active and unfinished / configured" state={readiness.activeGames > 0 ? 'healthy' : 'warning'} />
              </div>
            ) : null}

            <div className={styles.grid3}>
              <Link className={styles.linkButton} to="/admin/season">Competition setup & fixture controls</Link>
              <Link className={styles.linkButton} to="/admin/season?workspace=football-data">Provider, quota & polling evidence</Link>
              <Link className={styles.linkButton} to="/admin/season?workspace=games">Game availability & participation</Link>
            </div>
          </>
        ) : null}
      </Panel>
    </ControlRoomPage>
  )
}
