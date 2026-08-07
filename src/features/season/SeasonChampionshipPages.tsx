import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, EmptyState, Skeleton, StatusBadge } from '../../design-system'
import type {
  ChampionshipDiscovery,
  ChampionshipGroupFixture,
  ChampionshipInstance,
  ChampionshipPlayerView,
  SeasonCupDiscoveryGateway,
  SeasonCupPlayerViewGateway,
} from '../../services/supabase/seasonCupPlayer'
import {
  CHAMPIONSHIP_REGISTRATION_COPY,
  type SeasonLmsRegistrationGateway,
} from './lmsRegistrationModel'
import { SeasonLmsRegistration } from './SeasonLmsRegistration'
import styles from './SeasonChampionshipPages.module.css'

type LoadState<T> =
  | { status: 'loading'; value: null; error: null }
  | { status: 'ready'; value: T; error: null }
  | { status: 'failed'; value: null; error: string }

function useGateway<T>(gateway: { load(): Promise<T> }) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState<T>>({
    status: 'loading',
    value: null,
    error: null,
  })

  useEffect(() => {
    let active = true
    setState({ status: 'loading', value: null, error: null })
    gateway
      .load()
      .then((value) => {
        if (active) setState({ status: 'ready', value, error: null })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          status: 'failed',
          value: null,
          error: error instanceof Error ? error.message : 'Something went wrong.',
        })
      })
    return () => {
      active = false
    }
  }, [attempt, gateway])

  return { state, reload: () => setAttempt((value) => value + 1) }
}

function visibilityLabel(instance: Pick<ChampionshipInstance, 'visibility'>): string {
  return instance.visibility === 'private' ? 'Private Championship' : 'Public Championship'
}

function resultLabel(result: ChampionshipGroupFixture['result']): string | null {
  switch (result) {
    case 'win':
      return 'Win'
    case 'loss':
      return 'Loss'
    case 'draw':
      return 'Draw'
    case 'walkover_win':
      return 'Walkover win'
    case 'walkover_loss':
      return 'Walkover loss'
    case 'void':
      return 'Void'
    default:
      return null
  }
}

function phaseLabel(phase: ChampionshipInstance['phaseKind']): string | null {
  if (phase === 'split') return 'Split'
  if (phase === 'initial') return 'League phase'
  return null
}

export function SeasonChampionshipIndexPage({
  gateway,
  hrefFor,
}: {
  gateway: SeasonCupDiscoveryGateway
  hrefFor: (competitionId: string) => string
}) {
  const { state, reload } = useGateway<ChampionshipDiscovery>(gateway)

  if (state.status === 'loading') {
    return (
      <section className={styles.page} aria-busy="true">
        <h2 className={styles.heading}>Predictor Championship</h2>
        <Skeleton width="100%" height={120} />
        <Skeleton width="100%" height={120} />
      </section>
    )
  }

  if (state.status === 'failed') {
    return (
      <section className={styles.page}>
        <h2 className={styles.heading}>Predictor Championship</h2>
        <Alert variant="error" title="We could not load your Championships">
          {state.error}
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </section>
    )
  }

  const entered = state.value.instances.filter((instance) => instance.entered)
  const available = state.value.instances.filter((instance) => !instance.entered)

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Your competition instances</p>
        <h2 className={styles.heading}>Predictor Championship</h2>
        <p className={styles.caption}>
          Each Championship is its own competition. Open the one you are playing to see your
          fixture, table and schedule.
        </p>
      </header>

      {entered.length === 0 ? (
        <EmptyState
          title="You have no Championship yet"
          description="A Championship you join will appear here as soon as the server creates your player state."
        />
      ) : (
        <div className={styles.instanceSection}>
          <h3 className={styles.sectionHeading}>Your Championships</h3>
          <div className={styles.instanceList}>
            {entered.map((instance) => (
              <ChampionshipInstanceCard
                key={instance.competitionId}
                instance={instance}
                href={hrefFor(instance.competitionId)}
              />
            ))}
          </div>
        </div>
      )}

      {available.length > 0 ? (
        <div className={styles.instanceSection}>
          <h3 className={styles.sectionHeading}>Available</h3>
          <div className={styles.instanceList}>
            {available.map((instance) => (
              <ChampionshipInstanceCard
                key={instance.competitionId}
                instance={instance}
                href={hrefFor(instance.competitionId)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ChampionshipInstanceCard({
  instance,
  href,
}: {
  instance: ChampionshipInstance
  href: string
}) {
  const phase = phaseLabel(instance.phaseKind)
  const fixture = instance.currentFixture

  return (
    <Link className={styles.instanceCard} to={href}>
      <div className={styles.instanceTopline}>
        <div>
          <p className={styles.eyebrow}>{visibilityLabel(instance)}</p>
          <h3 className={styles.cardTitle}>
            {instance.entered ? 'Your Championship' : 'Public Championship'}
          </h3>
        </div>
        <StatusBadge
          variant={instance.completedAt ? 'locked' : instance.entered ? 'submitted' : 'live'}
          label={instance.completedAt ? 'Completed' : instance.entered ? 'Entered' : 'Available'}
        />
      </div>

      {fixture ? (
        <div className={styles.fixtureSummary}>
          <span className={styles.fixtureMeta}>{fixture.windowLabel}</span>
          <strong className={styles.fixtureOpponent}>
            {fixture.isHome ? 'You' : fixture.opponent.displayName}
            <span aria-hidden="true"> vs </span>
            {fixture.isHome ? fixture.opponent.displayName : 'You'}
          </strong>
          {fixture.status === 'settled' && fixture.myPoints !== null && fixture.opponentPoints !== null ? (
            <span className={styles.fixtureMeta}>
              {fixture.myPoints}–{fixture.opponentPoints}
            </span>
          ) : (
            <span className={styles.fixtureMeta}>Next fixture</span>
          )}
        </div>
      ) : (
        <p className={styles.cardCopy}>
          {phase ? `${phase}. ` : ''}
          {instance.entered
            ? 'No player fixture is available yet.'
            : `${instance.entrantCount} entrant${instance.entrantCount === 1 ? '' : 's'} so far.`}
        </p>
      )}

      <span className={styles.openLabel}>Open Championship</span>
    </Link>
  )
}

export type ChampionshipPageMode = 'fixture' | 'table' | 'fixtures'

export function SeasonChampionshipPlayerPage({
  gateway,
  mode,
  registration,
}: {
  gateway: SeasonCupPlayerViewGateway
  mode: ChampionshipPageMode
  registration?: SeasonLmsRegistrationGateway
}) {
  const { state, reload } = useGateway<ChampionshipPlayerView>(gateway)

  if (state.status === 'loading') {
    return (
      <section className={styles.page} aria-busy="true">
        <Skeleton width="55%" height={28} />
        <Skeleton width="100%" height={180} />
      </section>
    )
  }

  if (state.status === 'failed') {
    return (
      <section className={styles.page}>
        <Alert variant="error" title="We could not load this Championship">
          {state.error}
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </section>
    )
  }

  const view = state.value
  if (!view.entered) {
    return (
      <section className={styles.page}>
        {registration ? (
          <SeasonLmsRegistration
            gateway={registration}
            copy={CHAMPIONSHIP_REGISTRATION_COPY}
            onJoined={reload}
          />
        ) : null}
        <EmptyState
          title="You are not entered"
          description="Join this Championship before opening its player fixture and group."
        />
      </section>
    )
  }

  if (!view.phaseReady || !view.group) {
    return (
      <section className={styles.page}>
        <Alert variant="info" title="You are entered">
          Your place is confirmed. Your fixture and table will appear when the Championship draw is completed.
        </Alert>
      </section>
    )
  }

  if (mode === 'table') return <ChampionshipTable view={view} />
  if (mode === 'fixtures') return <ChampionshipFixtures view={view} />
  return <ChampionshipMyFixture view={view} />
}

function ChampionshipMyFixture({ view }: { view: ChampionshipPlayerView }) {
  const myFixtures = view.fixtures.filter((fixture) => fixture.isMyFixture)
  const fixture = myFixtures.find((entry) => entry.status === 'pending') ?? myFixtures.at(-1) ?? null
  const me = view.members.find((member) => member.isYou)

  if (!fixture) {
    return (
      <section className={styles.page}>
        <EmptyState
          title="No fixture yet"
          description="Your Championship place is active, but no fixture has been scheduled for your group yet."
        />
      </section>
    )
  }

  const homeName = fixture.home.userId === me?.userId ? me.displayName : fixture.home.displayName
  const awayName = fixture.away.userId === me?.userId ? me.displayName : fixture.away.displayName
  const settled = fixture.status === 'settled'
  const result = resultLabel(fixture.result)

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{view.phaseKind === 'split' ? 'The split' : 'League phase'}</p>
        <h2 className={styles.heading}>My Fixture</h2>
        <p className={styles.caption}>{fixture.windowLabel}</p>
      </header>

      <article className={[styles.matchCard, fixture.isMyFixture ? styles.myMatch : ''].filter(Boolean).join(' ')}>
        <div className={styles.matchStatus}>
          <StatusBadge
            variant={settled ? 'locked' : 'live'}
            label={settled ? 'Settled' : 'Upcoming'}
          />
          {result ? <strong className={styles.result}>{result}</strong> : null}
        </div>
        <div className={styles.versus}>
          <div className={styles.playerSide}>
            <span className={styles.playerName}>{homeName}</span>
            {fixture.home.userId === me?.userId ? <span className={styles.youTag}>You</span> : null}
          </div>
          <div className={styles.score}>
            {settled && fixture.homePoints !== null && fixture.awayPoints !== null
              ? `${fixture.homePoints}–${fixture.awayPoints}`
              : 'vs'}
          </div>
          <div className={[styles.playerSide, styles.playerSideAway].join(' ')}>
            <span className={styles.playerName}>{awayName}</span>
            {fixture.away.userId === me?.userId ? <span className={styles.youTag}>You</span> : null}
          </div>
        </div>
        <p className={styles.matchFootnote}>
          Your Match Predictor card for {fixture.windowLabel} supplies the Championship score. Confirmed football results settle the tie.
        </p>
      </article>
    </section>
  )
}

function ChampionshipTable({ view }: { view: ChampionshipPlayerView }) {
  const names = useMemo(
    () => new Map(view.members.map((member) => [member.userId, member.displayName])),
    [view.members],
  )
  const rankCounts = new Map<number, number>()
  for (const row of view.table) rankCounts.set(row.groupRank, (rankCounts.get(row.groupRank) ?? 0) + 1)

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{view.phaseKind === 'split' ? 'The split' : 'League phase'}</p>
        <h2 className={styles.heading}>Table</h2>
        <p className={styles.caption}>Group of {view.group?.size ?? view.members.length}, ranked from settled rounds.</p>
      </header>

      {view.table.length === 0 ? (
        <EmptyState
          title="No table yet"
          description="The table updates when the first Championship round settles."
        />
      ) : (
        <>
          <div className={styles.tableHead} aria-hidden="true">
            <span>#</span>
            <span>Player</span>
            <span>PF</span>
            <span>PA</span>
            <span>Pts</span>
          </div>
          <ul className={styles.tableList}>
            {view.table.map((row) => {
              const tied = (rankCounts.get(row.groupRank) ?? 0) > 1
              const displayName = names.get(row.userId) ?? (row.isYou ? 'You' : 'Player')
              return (
                <li
                  key={row.userId}
                  className={[styles.tableRow, row.isYou ? styles.tableRowYou : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span>{tied ? `=${row.groupRank}` : row.groupRank}</span>
                  <span className={styles.tableName}>
                    {displayName}
                    {row.isYou ? <span className={styles.youTag}>You</span> : null}
                  </span>
                  <span>{row.pointsFor}</span>
                  <span>{row.pointsAgainst}</span>
                  <strong>{row.tablePoints}</strong>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function ChampionshipFixtures({ view }: { view: ChampionshipPlayerView }) {
  const groups = useMemo(() => {
    const grouped = new Map<number, ChampionshipGroupFixture[]>()
    for (const fixture of view.fixtures) {
      const rows = grouped.get(fixture.windowSequence) ?? []
      rows.push(fixture)
      grouped.set(fixture.windowSequence, rows)
    }
    return [...grouped.entries()].sort(([a], [b]) => a - b)
  }, [view.fixtures])

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{view.phaseKind === 'split' ? 'The split' : 'League phase'}</p>
        <h2 className={styles.heading}>Fixtures</h2>
        <p className={styles.caption}>Your group schedule. Your own fixture is marked in every round.</p>
      </header>

      {groups.length === 0 ? (
        <EmptyState
          title="No fixtures yet"
          description="The group schedule will appear when the Championship draw is completed."
        />
      ) : (
        <div className={styles.roundList}>
          {groups.map(([sequence, fixtures]) => (
            <section key={sequence} className={styles.round}>
              <h3 className={styles.roundHeading}>{fixtures[0]?.windowLabel ?? `Round ${sequence}`}</h3>
              <ul className={styles.fixtureList}>
                {fixtures.map((fixture) => (
                  <li
                    key={fixture.fixtureId}
                    className={[styles.fixtureRow, fixture.isMyFixture ? styles.fixtureRowMine : '']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className={styles.fixtureTeams}>
                      <span>{fixture.home.displayName}</span>
                      <span className={styles.fixtureScore}>
                        {fixture.status === 'settled' && fixture.homePoints !== null && fixture.awayPoints !== null
                          ? `${fixture.homePoints}–${fixture.awayPoints}`
                          : 'vs'}
                      </span>
                      <span>{fixture.away.displayName}</span>
                    </div>
                    <div className={styles.fixtureTags}>
                      {fixture.isMyFixture ? <span className={styles.youTag}>Your fixture</span> : null}
                      {fixture.status === 'settled' ? (
                        <StatusBadge variant="locked" label={resultLabel(fixture.result) ?? 'Settled'} />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
