import { useEffect, useState } from 'react'
import { Alert, Skeleton } from '../../design-system'
import { InvitePanel } from './InvitePanel'
import type {
  OrganisedCompetition,
  OrganisedCompetitionSummary,
} from '../../services/supabase/organisedCompetitionsModel'
import styles from './OrganiserPanel.module.css'

/**
 * What an organiser can see about a competition they made (contract 165).
 *
 * OWNING A COMPETITION IS NOT A REVEAL EXEMPTION, and this surface is where
 * that is easiest to get wrong. It shows THAT an entrant has picked and never
 * WHAT — the read carries no club at all, so there is nothing here to leak —
 * and an organiser who wants to know what somebody picked waits for the round
 * to lock like every other entrant.
 *
 * THERE IS NO ORGANISER COMMAND, AND ITS ABSENCE IS DESIGNED. No accepted
 * authority grants an organiser power over another entrant, and the power in
 * question is the power to eliminate somebody. The server returns
 * `organiserCommandsAvailable` empty; this renders a control for each command
 * the server names and therefore renders none, so a command arriving later
 * appears without a component being edited — and one that has NOT been accepted
 * cannot be added by adding a button.
 *
 * THE INVITE CODE IS THE USEFUL PART TODAY. An organiser's live question is
 * "who is in, and how do I get more people in", and the answer to the second is
 * the code.
 *
 * IT IS NOT AN ADMINISTRATION SURFACE. These reads answer about competitions
 * the CALLER owns; contract 168's are the administration ones, and they are
 * deliberately separate.
 */

export type OrganiserPanelProps = {
  list: () => Promise<readonly OrganisedCompetitionSummary[]>
  open: (competitionId: string) => Promise<OrganisedCompetition | null>
}

type ListState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; competitions: readonly OrganisedCompetitionSummary[] }

export function OrganiserPanel({ list, open }: OrganiserPanelProps) {
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    list()
      .then((competitions) => {
        if (active) setState({ status: 'ready', competitions })
      })
      .catch(() => {
        if (active) setState({ status: 'failed' })
      })
    return () => {
      active = false
    }
  }, [list])

  if (state.status === 'loading') return <Skeleton lines={3} />

  if (state.status === 'failed') {
    return (
      <Alert variant="warning" title="We could not check what you organise">
        This is a failed read, not an empty list.
      </Alert>
    )
  }

  // Organising nothing is the common case and deserves no furniture.
  if (state.competitions.length === 0) return null

  return (
    <section className={styles.section} aria-labelledby="organiser-heading">
      <h2 className={styles.heading} id="organiser-heading">
        Competitions you organise
      </h2>
      <ul className={styles.list}>
        {state.competitions.map((competition) => (
          <li key={competition.id} className={styles.item}>
            <button
              type="button"
              className={styles.summary}
              aria-expanded={openId === competition.id}
              onClick={() => setOpenId(openId === competition.id ? null : competition.id)}
            >
              <span className={styles.name}>{competition.name}</span>
              <span className={styles.meta}>
                {competition.seasonName ?? ''}
                {competition.completedAt ? ' · finished' : ''}
                {competition.registrationClosesAt ? ' · closed to new entrants' : ''}
              </span>
            </button>
            {openId === competition.id ? (
              <Detail competitionId={competition.id} open={open} />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Detail({
  competitionId,
  open,
}: {
  competitionId: string
  open: (competitionId: string) => Promise<OrganisedCompetition | null>
}) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'failed' } | { status: 'ready'; view: OrganisedCompetition | null }
  >({ status: 'loading' })

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    open(competitionId)
      .then((view) => {
        if (active) setState({ status: 'ready', view })
      })
      .catch(() => {
        if (active) setState({ status: 'failed' })
      })
    return () => {
      active = false
    }
  }, [competitionId, open])

  if (state.status === 'loading') return <Skeleton lines={3} />
  if (state.status === 'failed') {
    return (
      <Alert variant="warning" title="We could not open this competition">
        Try again in a moment.
      </Alert>
    )
  }
  if (!state.view) {
    // Null means the server named no competition — which is what a caller who
    // does not own it gets. Rendered as a refusal, never as an empty screen.
    return (
      <Alert variant="warning" title="You do not organise this competition">
        Only its organiser can see its entrants.
      </Alert>
    )
  }

  const { view } = state

  return (
    <div className={styles.detail}>
      {view.competition.inviteCode ? (
        <InvitePanel
          leagueName={view.competition.name}
          code={view.competition.inviteCode}
          mode="full"
        />
      ) : null}

      <p className={styles.counts}>
        {view.counts.entrants} {view.counts.entrants === 1 ? 'entrant' : 'entrants'} ·{' '}
        {view.counts.remaining} still in · {view.counts.eliminated} out
        {view.counts.left > 0 ? ` · ${view.counts.left} left` : ''}
        {view.currentRound && view.counts.awaitingPick !== null
          ? ` · ${view.counts.awaitingPick} yet to pick`
          : ''}
      </p>

      <ul className={styles.entrants}>
        {view.entrants.map((entrant) => (
          <li key={entrant.userId} className={styles.entrant}>
            <span className={styles.entrantName}>{entrant.displayName}</span>
            <span className={styles.entrantState}>
              {/* THAT they have picked, never what. There is no club on this
                  read and there must be none on this row. */}
              {entrant.stillIn ? 'Still in' : 'Eliminated'}
              {entrant.hasPickedCurrentRound === true ? ' · picked' : ''}
              {entrant.hasPickedCurrentRound === false ? ' · not picked yet' : ''}
              {entrant.membershipStatus && entrant.membershipStatus !== 'active'
                ? ` · ${entrant.membershipStatus}`
                : ''}
            </span>
          </li>
        ))}
      </ul>

      {view.organiserCommandsAvailable.length === 0 ? (
        <p className={styles.note}>
          You can see who is in and who has picked. You cannot see what anyone picked before the
          round locks, and you cannot remove an entrant — organising a competition is not authority
          over the people in it.
        </p>
      ) : (
        // A command the SERVER names. None exists today; this renders whatever
        // it ever names rather than a button somebody added.
        <ul className={styles.commands}>
          {view.organiserCommandsAvailable.map((command) => (
            <li key={command}>{command}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
