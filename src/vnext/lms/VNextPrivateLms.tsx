import type { PrivateLmsPageModel } from '../models/privateLms'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { formatNumber } from '../foundations/format'
import text from '../foundations/typography.module.css'
import styles from './privateLms.module.css'

export type PrivateLmsNotice =
  | { readonly kind: 'conflict' }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'failed' }

export type VNextPrivateLmsProps = {
  readonly model: PrivateLmsPageModel
  readonly onPick?: ((teamId: string) => void) | undefined
  readonly busy?: boolean | undefined
  readonly notice?: PrivateLmsNotice | undefined
}

const STATE_COPY: Readonly<Record<PrivateLmsPageModel['round']['state'], string>> = {
  'no-round': 'There is no private round to play yet.',
  'not-entered': 'You are not currently entered in this private competition.',
  'not-open': 'This round has not opened yet.',
  open: 'Choose one club to survive this round.',
  picked: 'Your pick is saved for this round.',
  locked: 'Picks are closed for this round.',
  eliminated: 'You have been eliminated from this competition.',
}

function noticeCopy(notice: PrivateLmsNotice): string {
  if (notice.kind === 'conflict') {
    return 'Your pick changed somewhere else. This private round has been reloaded.'
  }
  if (notice.kind === 'refused') return `${notice.reason} This private round has been reloaded.`
  return 'We could not save that pick. Nothing has been confirmed, so you can try again.'
}

function fixtureGroups(model: PrivateLmsPageModel) {
  const byFixture = new Map<
    string,
    { kickoffAt: string | null; choices: PrivateLmsPageModel['choices'][number][] }
  >()
  for (const choice of model.choices) {
    const current = byFixture.get(choice.fixtureId)
    if (current) current.choices.push(choice)
    else byFixture.set(choice.fixtureId, { kickoffAt: choice.kickoffAt, choices: [choice] })
  }
  return [...byFixture.entries()]
}

export function VNextPrivateLms({
  model,
  onPick,
  busy = false,
  notice,
}: VNextPrivateLmsProps) {
  const groups = fixtureGroups(model)
  const open = model.round.state === 'open'

  return (
    <VNextShell
      destination="games"
      header={
        <VNextPageHeader
          title={model.context.privateCompetitionName}
          competition={`${model.context.competitionName} · ${model.context.seasonLabel}`}
          context="Private Last Man Standing"
        />
      }
    >
      <div className={styles.page}>
        <section className={styles.hero} data-vnext-zone="private-lms-status">
          <p className={`${text.micro} ${styles.eyebrow}`}>Private Last Man Standing</p>
          <p className={`${text.title} ${styles.status}`} data-round-state={model.round.state}>
            {STATE_COPY[model.round.state]}
          </p>
          <p className={`${text.micro} ${styles.meta}`}>
            <span>{formatNumber(model.memberCount)} entered</span>
            {model.round.label === null ? null : <span>{model.round.label}</span>}
          </p>
          {model.round.locksAt === null ? null : (
            <p className={`${text.micro} ${styles.deadline}`}>
              The server will refuse any pick after this round closes.
            </p>
          )}
        </section>

        {notice === undefined ? null : (
          <p className={`${text.body} ${styles.notice}`} role="status" data-notice={notice.kind}>
            {noticeCopy(notice)}
          </p>
        )}

        {open ? (
          <section className={styles.panel} data-vnext-zone="private-lms-picks">
            <h2 className={`${text.title} ${styles.panelHeading}`}>Pick a club</h2>
            {groups.length === 0 ? (
              <p className={text.body}>
                We could not match this private round to a complete season fixture card. Try again before choosing.
              </p>
            ) : (
              <div className={styles.fixtures}>
                {groups.map(([fixtureId, fixture]) => (
                  <div className={styles.fixture} key={fixtureId}>
                    <p className={`${text.micro} ${styles.fixtureTime}`}>One pick from this fixture</p>
                    <div className={styles.choiceRow}>
                      {fixture.choices.map((choice) => (
                        <button
                          key={choice.key}
                          type="button"
                          className={styles.choice}
                          disabled={busy || onPick === undefined}
                          onClick={() => onPick?.(choice.teamId)}
                          data-vnext-control="private-lms-pick"
                        >
                          {choice.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {model.inviteCode === null ? null : (
          <section className={styles.panel} data-vnext-zone="private-lms-invite">
            <h2 className={`${text.title} ${styles.panelHeading}`}>Invite players</h2>
            <p className={`${text.body} ${styles.inviteHint}`}>
              Share this code with the people you want in this competition.
            </p>
            <code className={styles.inviteCode}>{model.inviteCode}</code>
          </section>
        )}
      </div>
    </VNextShell>
  )
}
