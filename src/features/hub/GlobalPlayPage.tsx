import { Link } from 'react-router'
import { Alert, Button, EmptyState, Skeleton, Workspace } from '../../design-system'
import { formatDeadline } from '../../shared/time/kickoff'
import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
import { weeklyRoutes } from '../../app/weeklyRoutes'
import { useGlobalPlayInbox } from './useGlobalPlayInbox'
import { BriefingPanel } from './BriefingPanel'
import type { InboxAction } from './playInboxModel'
import styles from './GlobalPlayPage.module.css'
import s from '../shared.module.css'

/**
 * `/play` — the cross-competition action inbox.
 *
 * WHAT IT REPLACES. This route used to be a competition chooser: it asked which
 * competition, then sent the player to that competition's Play section. The
 * 10 August 2026 navigation authority retires that shape — "a player should
 * never have to choose a competition merely to discover what needs done" — and
 * the chooser got worse with every competition the platform adds, which is the
 * scalability requirement stated as a defect.
 *
 * ONLY JOINED GAMES ARE ACTIONS. An available game the player has not joined
 * never appears here; that is discovery, and it lives on the competition and
 * the catalogue. It is what keeps this page the same size on a
 * twenty-competition platform as on a two-competition one.
 *
 * EVERY CARD NAMES COMPETITION, GAME, WHAT IS NEEDED, WHEN IT LOCKS AND WHERE
 * TO GO. An action that does not say which competition it belongs to is
 * unreadable the moment a player has two.
 *
 * A COMPETITION THAT COULD NOT BE READ IS NAMED. It is not dropped: an inbox
 * that quietly omits a competition tells a player they are up to date while a
 * lock passes.
 */

function ActionCard({ action, tone }: { action: InboxAction; tone: 'urgent' | 'normal' | 'done' }) {
  const when = formatDeadline(action.locksAt)
  const body = (
    <>
      <span className={styles.where}>
        {action.competitionName} · {action.gameName}
      </span>
      <span className={styles.title}>{action.title}</span>
      {when ? (
        <span className={styles.when}>
          {action.outstanding ? 'Locks' : 'Locked'} {when}
        </span>
      ) : null}
    </>
  )

  const className = [styles.action, tone === 'urgent' ? styles.actionUrgent : '', tone === 'done' ? styles.actionDone : '']
    .filter(Boolean)
    .join(' ')

  // A joined game whose surface does not exist yet is listed without a link,
  // exactly as Play and Overview list it: hiding it would misreport membership
  // and linking it would be a dead link.
  return action.href ? (
    <li>
      <Link className={className} to={action.href}>
        {body}
      </Link>
    </li>
  ) : (
    <li>
      <div className={`${className} ${styles.actionInert}`}>{body}</div>
    </li>
  )
}

function Group({
  title,
  actions,
  tone,
}: {
  title: string
  actions: readonly InboxAction[]
  tone: 'urgent' | 'normal' | 'done'
}) {
  if (actions.length === 0) return null
  return (
    <section className={styles.group} aria-labelledby={`play-group-${tone}`}>
      <h2 className={styles.groupTitle} id={`play-group-${tone}`}>
        {title}
      </h2>
      <ul className={styles.list}>
        {actions.map((action) => (
          <ActionCard key={action.key} action={action} tone={tone} />
        ))}
      </ul>
    </section>
  )
}

export function GlobalPlayPage() {
  const { status: membership, player, reload } = usePlayerCompetitions()
  const { status, inbox } = useGlobalPlayInbox(player)

  if (membership === 'failed') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Play</h1>
        <Alert variant="error" title="We could not load your competitions">
          Nothing is claimed either way — your entries are unaffected.
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    )
  }

  if (membership === 'loading' || status !== 'ready' || !inbox) {
    return (
      <div className={s.page} aria-busy="true">
        <h1 className={s.title}>Play</h1>
        <span className={styles.srOnly}>Working out what needs doing</span>
        <Skeleton width="100%" height={84} />
        <Skeleton width="100%" height={84} />
        <Skeleton width="100%" height={84} />
      </div>
    )
  }

  if (inbox.empty) {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Play</h1>
        <EmptyState
          title="You have not joined a game yet"
          description="Games are joined inside a competition. Once you have joined one, everything it asks of you appears here."
          action={
            <Link className={styles.exploreLink} to={weeklyRoutes.competitions}>
              Find a competition
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className={s.page}>
      {/* A reading column, not the full 1440px. An action inbox is a list of
          short cards; spread across a wide monitor each one becomes a line of
          text with two metres of empty space after it. There is no second
          independent thing to put beside it — the football belongs to Matches
          and the Hub already pairs the two — so this takes no contextual
          panel. */}
      <Workspace>
      <h1 className={s.title}>Play</h1>

      {/* INNOV-016, the same module the Hub carries and the same inbox behind
          it. `/play` has no football list of its own, so the briefing here
          speaks only about what is due and when — which is what this page is
          for. It renders nothing when nothing is outstanding. */}
      <BriefingPanel
        input={{
          now: new Date(),
          fixturesToday: 0,
          competitionsWithFixturesToday: 0,
          outstanding: [...inbox.urgent, ...inbox.thisWeek].map((action) => ({
            competitionName: action.competitionName,
            gameName: action.gameName,
            title: action.title,
            locksAt: action.locksAt,
          })),
          standing: null,
        }}
      />
      <p className={styles.intro}>
        Everything your joined games are asking for, across every competition you play in.
      </p>

      {inbox.unreadable.length > 0 ? (
        <Alert variant="warning" title="Some competitions could not be read">
          {inbox.unreadable.map((entry) => entry.competitionName).join(', ')} could not be checked just now, so anything they need is
          missing from this list. Nothing has changed in them.
        </Alert>
      ) : null}

      {inbox.allClear ? (
        <p className={styles.allClear}>
          Nothing outstanding. Everything your games have asked for is done.
        </p>
      ) : null}

      <Group title="Urgent" actions={inbox.urgent} tone="urgent" />
      <Group title="This week" actions={inbox.thisWeek} tone="normal" />
      <Group title="Complete and waiting" actions={inbox.settled} tone="done" />
      </Workspace>
    </div>
  )
}
