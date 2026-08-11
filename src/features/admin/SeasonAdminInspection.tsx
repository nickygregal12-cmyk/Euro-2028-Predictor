import { useEffect, useState } from 'react'
import { Alert, Button, ConfirmModal, Skeleton, TextInput } from '../../design-system'
import type {
  AdminEntrant,
  AdminEntrantsPage,
  ProviderProposal,
  ProviderProposalPage,
} from '../../services/supabase/seasonAdminInspectionModel'
import { blockerLabel } from '../../services/supabase/seasonAdminInspectionModel'
import { userFacingError } from '../../shared/errors/userFacingError'
import styles from './adminPanels.module.css'
import own from './SeasonAdminInspection.module.css'

/**
 * The evidence an administrator was previously asked to decide without
 * (contract 168, `DFA-009`).
 *
 * WHAT THIS PAGE USED TO SAY, VERBATIM: that disqualifying an entrant was
 * "absent from this page on purpose: no browser read enumerates a competition's
 * entrants, so the control could not name who it was about to remove. It needs
 * a read before it needs a button." And that approving a staged provider
 * calendar was the same shape, because the review panel reported a COUNT rather
 * than the list an approval would act on. Contract 168 is those two reads, so
 * both controls can now exist without misrepresenting what they act on.
 *
 * APPROVAL IS WHOLE-CALENDAR AND THE INTERFACE SAYS SO. There is no per-row
 * accept, because `admin_approve_initial_provider_fixtures` takes a season and a
 * PROVIDER and decides everything staged for it. The per-proposal list is what
 * makes that decision informed; a button on each row would say the server can do
 * something it cannot.
 *
 * A BLOCKER IS NAMED. "12 problems" tells an administrator to refuse and tells
 * them nothing to fix, so every blocker is listed by name on the proposal it
 * belongs to.
 *
 * DISQUALIFICATION NAMES THE PERSON AND ASKS TWICE. It is irreversible from the
 * player's side — a disqualified entry can never be rejoined — and the control
 * appears only where the server itself says it would accept one
 * (`disqualifiable`), which is contract 140's lesson: offer what will work, and
 * explain what will not.
 *
 * A REASON IS REQUIRED BY THE SERVER AND IS NOT DEFAULTED HERE. A decision
 * nobody can review afterwards is not a decision that should be easy to make.
 */

export type SeasonAdminInspectionProps = {
  tournamentId: string
  seasonName: string
  loadProposals: () => Promise<ProviderProposalPage>
  approve: (provider: string, reason: string) => Promise<void>
  reject: (provider: string, reason: string) => Promise<void>
  /** The private/season competitions whose entrants may be inspected. */
  competitions: readonly { id: string; name: string }[]
  loadEntrants: (competitionId: string) => Promise<AdminEntrantsPage | null>
  disqualify: (competitionId: string, userId: string, reason: string) => Promise<void>
}

export function SeasonAdminInspection(props: SeasonAdminInspectionProps) {
  return (
    <>
      <ProposalsPanel {...props} />
      <EntrantsPanel {...props} />
    </>
  )
}

function ProposalsPanel({
  tournamentId,
  seasonName,
  loadProposals,
  approve,
  reject,
}: SeasonAdminInspectionProps) {
  const [page, setPage] = useState<ProviderProposalPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null)

  useEffect(() => {
    let active = true
    setPage(null)
    setFailed(false)
    loadProposals()
      .then((next) => {
        if (active) setPage(next)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [loadProposals, tournamentId, nonce])

  const provider = page?.proposals[0]?.provider ?? null

  async function decide(kind: 'approve' | 'reject') {
    if (!provider) return
    setBusy(true)
    setError(null)
    try {
      await (kind === 'approve' ? approve : reject)(provider, reason.trim())
      setConfirming(null)
      setReason('')
      setNonce((value) => value + 1)
    } catch (thrown) {
      setError(userFacingError(thrown, 'That decision was not recorded.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="staged-proposals-heading">
      <h2 className={styles.heading} id="staged-proposals-heading">
        Staged provider fixtures
      </h2>
      <p className={styles.caption}>
        Every fixture a provider has staged for {seasonName}, with the reason any of them cannot be
        created. Approval decides the whole calendar for one provider — there is no per-fixture
        accept, because the server has none.
      </p>

      {failed ? (
        <Alert variant="warning" title="We could not load the staged fixtures">
          <Button variant="secondary" onClick={() => setNonce((value) => value + 1)}>
            Try again
          </Button>
        </Alert>
      ) : !page ? (
        <Skeleton lines={4} />
      ) : page.proposals.length === 0 ? (
        <p className={styles.caption}>Nothing is staged for this season.</p>
      ) : (
        <>
          <p className={own.summary}>
            {page.total} staged
            {page.blockedTotal > 0 ? ` · ${page.blockedTotal} blocked` : ' · none blocked'}
            {Object.entries(page.states).map(([state, count]) => (
              <span key={state} className={own.stateChip}>
                {state}: {count}
              </span>
            ))}
          </p>

          <ul className={own.proposals}>
            {page.proposals.map((proposal) => (
              <Proposal key={proposal.proposalId} proposal={proposal} />
            ))}
          </ul>

          {page.hasMore ? (
            // The bound, stated. A page nobody knows is a page reads as the
            // whole calendar.
            <p className={styles.caption}>
              Showing {page.proposals.length} of {page.total}. The rest are on the next page.
            </p>
          ) : null}

          {error ? (
            <Alert variant="error" title="That decision was not recorded">
              {error}
            </Alert>
          ) : null}

          {provider ? (
            <div className={own.decide}>
              <TextInput
                label="Reason (recorded with the decision)"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <div className={own.actions}>
                <Button
                  variant="primary"
                  disabled={busy || reason.trim().length === 0}
                  onClick={() => setConfirming('approve')}
                >
                  Approve {provider}’s calendar
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy || reason.trim().length === 0}
                  onClick={() => setConfirming('reject')}
                >
                  Reject it
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <ConfirmModal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => void decide(confirming ?? 'approve')}
        title={confirming === 'reject' ? 'Reject this calendar?' : 'Approve this calendar?'}
        confirmLabel={confirming === 'reject' ? 'Reject' : 'Approve'}
        destructive={confirming === 'reject'}
        loading={busy}
      >
        <p>
          This decides every fixture {provider} has staged for {seasonName}
          {page ? ` — ${page.total} in total` : ''}. It is recorded against your account with the
          reason you gave.
        </p>
      </ConfirmModal>
    </section>
  )
}

function Proposal({ proposal }: { proposal: ProviderProposal }) {
  const home = proposal.home.mappedTeamName ?? proposal.home.providerName ?? 'Unknown club'
  const away = proposal.away.mappedTeamName ?? proposal.away.providerName ?? 'Unknown club'

  return (
    <li className={proposal.blockers.length > 0 ? own.blocked : own.proposal}>
      <div className={own.fixture}>
        <span className={own.clubs}>
          {home} v {away}
        </span>
        <span className={own.meta}>
          {proposal.proposedKickoffAt ?? 'No kick-off supplied'}
          {proposal.state ? ` · ${proposal.state}` : ''}
          {proposal.providerStatus ? ` · ${proposal.providerStatus}` : ''}
        </span>
        {/* The provider's own names, kept beside ours. An administrator
            checking a mapping needs to see what the provider called it. */}
        {proposal.home.mappedTeamName || proposal.away.mappedTeamName ? (
          <span className={own.meta}>
            Provider: {proposal.home.providerName ?? '—'} v {proposal.away.providerName ?? '—'}
          </span>
        ) : null}
      </div>

      {proposal.blockers.length > 0 ? (
        <ul className={own.blockers}>
          {proposal.blockers.map((blocker) => (
            <li key={blocker}>{blockerLabel(blocker)}</li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function EntrantsPanel({
  competitions,
  loadEntrants,
  disqualify,
}: SeasonAdminInspectionProps) {
  const [competitionId, setCompetitionId] = useState<string | null>(
    competitions[0]?.id ?? null,
  )
  const [page, setPage] = useState<AdminEntrantsPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [target, setTarget] = useState<AdminEntrant | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!competitionId) return
    let active = true
    setPage(null)
    setFailed(false)
    loadEntrants(competitionId)
      .then((next) => {
        if (active) setPage(next)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [competitionId, loadEntrants, nonce])

  async function remove() {
    if (!competitionId || !target) return
    setBusy(true)
    setError(null)
    try {
      await disqualify(competitionId, target.userId, reason.trim())
      setTarget(null)
      setReason('')
      setNonce((value) => value + 1)
    } catch (thrown) {
      setError(userFacingError(thrown, 'That entrant was not disqualified.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="entrants-heading">
      <h2 className={styles.heading} id="entrants-heading">
        Entrants
      </h2>
      <p className={styles.caption}>
        Who is in a competition, and whether the server would accept a disqualification for them.
        Disqualifying is irreversible from the player’s side: a disqualified entry can never be
        rejoined.
      </p>

      {competitions.length === 0 ? (
        <p className={styles.caption}>This season runs no competition to inspect.</p>
      ) : (
        <div className={own.chips} role="group" aria-label="Competition">
          {competitions.map((competition) => (
            <button
              key={competition.id}
              type="button"
              className={`${own.chip} ${competitionId === competition.id ? own.chipOn : ''}`}
              aria-pressed={competitionId === competition.id}
              onClick={() => setCompetitionId(competition.id)}
            >
              {competition.name}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <Alert variant="error" title="That entrant was not disqualified">
          {error}
        </Alert>
      ) : null}

      {failed ? (
        <Alert variant="warning" title="We could not load the entrants">
          <Button variant="secondary" onClick={() => setNonce((value) => value + 1)}>
            Try again
          </Button>
        </Alert>
      ) : !competitionId ? null : !page ? (
        <Skeleton lines={4} />
      ) : page.entrants.length === 0 ? (
        <p className={styles.caption}>Nobody has entered this competition.</p>
      ) : (
        <ul className={own.entrants}>
          {page.entrants.map((entrant) => (
            <li key={entrant.userId} className={own.entrant}>
              <div className={own.who}>
                <span className={own.name}>{entrant.displayName}</span>
                <span className={own.meta}>
                  {entrant.outcome ?? 'active'}
                  {entrant.membershipStatus ? ` · ${entrant.membershipStatus}` : ''}
                  {entrant.disqualifiedAt ? ' · disqualified' : ''}
                  {entrant.rejoinCount > 0 ? ` · rejoined ${entrant.rejoinCount}×` : ''}
                </span>
              </div>
              {entrant.disqualifiable ? (
                <Button variant="destructive" onClick={() => setTarget(entrant)}>
                  Disqualify
                </Button>
              ) : (
                // Explained, never a disabled control to hover over.
                <span className={own.meta}>
                  {entrant.disqualifiedAt
                    ? 'Already disqualified'
                    : entrant.leftAt
                      ? 'Has left'
                      : 'Not eligible'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={() => void remove()}
        title={`Disqualify ${target?.displayName ?? ''}?`}
        confirmLabel="Disqualify"
        destructive
        loading={busy}
      >
        <p>
          {target?.displayName} will be removed from this competition and can never rejoin it. This
          cannot be undone.
        </p>
        <TextInput
          label="Reason (required, recorded with the decision)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </ConfirmModal>
    </section>
  )
}
