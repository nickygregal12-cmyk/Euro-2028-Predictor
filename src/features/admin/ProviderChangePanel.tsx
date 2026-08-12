import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Skeleton, TextInput } from '../../design-system'
import type {
  ProviderChangeDecision,
  ProviderChangeProposal,
  ProviderChangeProposalPage,
  ProviderChangeState,
} from '../../services/supabase/providerChangeProposalsModel'
import { seasonAdminRefusal } from './seasonAdminModel'
import styles from './ProviderChangePanel.module.css'

/**
 * Contract 174's own refusals, said as the server said them.
 *
 * WHY NOT `seasonAdminRefusal` FOR EVERYTHING. That mapper serves the results
 * surface, and its `22023` sentence is about recording a result — accurate
 * there, and simply wrong beside a proposal, where the same code means the
 * rejection carried no reason. Worse, `55000` is where contract 174 puts the
 * three sentences an administrator most needs: this proposal was already
 * decided, these blockers stand, and — the one that matters — that fixture now
 * has a result and approving would rescore a settled matchweek. Those are the
 * server's words and they are passed through rather than replaced.
 */
function providerChangeRefusal(error: unknown): string {
  const row = (error ?? {}) as { code?: unknown; message?: unknown }
  const code = typeof row.code === 'string' ? row.code : ''
  const message = typeof row.message === 'string' ? row.message : ''

  if ((code === '55000' || code === 'raise_exception') && message) return message
  if (code === '22023' || code === 'invalid_parameter_value') {
    return message || 'A rejection needs a reason of at least three characters.'
  }
  if (code === 'no_data_found' || code === 'P0002') {
    return 'That proposal no longer exists. Reload the list.'
  }
  return seasonAdminRefusal(error)
}

/**
 * Contract 174's staged provider calendar changes, and the decision.
 *
 * WHY THIS SURFACE EXISTS. Contract 117 counted a fixture the provider named
 * that we do not hold, and a fixture reported no longer scheduled, into a jsonb
 * report nothing read — so a discovered or cancelled match produced a number in
 * a log and no administrator ever saw it. Contract 174 stages each one as
 * append-only evidence with its warnings and blockers NAMED, and writes no
 * fixture at all. This is the only place that evidence is visible.
 *
 * AN ADMINISTRATOR NEVER SEES A RAW PROVIDER PAYLOAD. What is shown is the
 * decoded proposal beside what this platform holds, field by field. The
 * retained response body stays on the server, which is contract 168's boundary
 * and is not widened here.
 *
 * ONLY THE COMMANDS THE SERVER GRANTS ARE OFFERED. `decidable` is the server's
 * own answer to "may this be approved" — pending, with no blockers — and it is
 * rendered rather than recomputed. A proposal carrying blockers shows them by
 * name and offers rejection only, because approving it is a call the server
 * will refuse.
 *
 * APPROVAL IS DELIBERATE AND SAYS WHAT IT WILL DO. It is the one path in the
 * repository that can add a fixture to a published season or take one out, so
 * the control names the consequence — create this fixture, void this fixture —
 * rather than saying "approve". Rejection requires a reason because the server
 * requires one, and the field states that rather than the button failing.
 *
 * A REFUSAL IS SHOWN AS THE SERVER WROTE IT. "That fixture now has a result;
 * approving would rescore a settled matchweek" is the sentence an administrator
 * needs; "something went wrong" is not, and would send them looking for a fault
 * that does not exist.
 */

export type ProviderChangePanelProps = {
  /** Injected by the page; the panel calls no service itself. */
  load: (state: ProviderChangeState) => Promise<ProviderChangeProposalPage>
  decide: (
    proposalId: string,
    decision: 'approve' | 'reject',
    reason?: string,
  ) => Promise<ProviderChangeDecision>
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; page: ProviderChangeProposalPage }

const KIND_LABEL: Record<string, string> = {
  discovered: 'A fixture we do not hold',
  postponed: 'Reported postponed',
  abandoned: 'Reported abandoned',
  cancelled: 'Reported cancelled',
  withdrawn: 'No longer sent by the provider',
}

/** What approving would actually do, named rather than called "approve". */
const APPROVE_LABEL: Record<string, string> = {
  discovered: 'Add this fixture',
  postponed: 'Mark postponed',
  abandoned: 'Mark abandoned',
  cancelled: 'Void this fixture',
  withdrawn: 'Void this fixture',
}

const FILTERS: readonly { key: ProviderChangeState; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

function when(value: string | null): string {
  if (!value) return ''
  const at = new Date(value)
  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
}

/** One field of a decoded proposal, printed as a readable value. */
function readable(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

export function ProviderChangePanel({ load, decide }: ProviderChangePanelProps) {
  const [filter, setFilter] = useState<ProviderChangeState>('pending')
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    setState({ kind: 'loading' })
    load(filter)
      .then((page) => {
        if (active) setState({ kind: 'ready', page })
      })
      .catch((error: unknown) => {
        if (active) setState({ kind: 'failed', message: providerChangeRefusal(error) })
      })
    return () => {
      active = false
    }
  }, [load, filter, nonce])

  const run = useCallback(
    async (proposal: ProviderChangeProposal, decision: 'approve' | 'reject') => {
      setBusy(proposal.id)
      setNotice(null)
      try {
        const answer = await decide(proposal.id, decision, reasons[proposal.id]?.trim() || undefined)
        setNotice({
          tone: 'success',
          text: answer.repeated
            ? `Already ${answer.state}. Nothing changed.`
            : `Recorded as ${answer.state}.`,
        })
        // Re-read rather than removing the row locally: the server's record of
        // what the decision DID is the thing worth showing, and a list that
        // quietly disagreed with it would be a second copy of the truth.
        setNonce((value) => value + 1)
      } catch (error: unknown) {
        // The server's own sentence. A generic message here would hide the one
        // refusal that matters most — a fixture that has since been settled.
        setNotice({ tone: 'warning', text: providerChangeRefusal(error) })
      } finally {
        setBusy(null)
      }
    },
    [decide, reasons],
  )

  return (
    <section className={styles.panel} aria-labelledby="provider-changes-heading">
      <h2 className={styles.heading} id="provider-changes-heading">
        Provider calendar changes
      </h2>
      <p className={styles.caption}>
        Fixtures a provider announced, moved or stopped sending, staged as evidence. Nothing here
        has changed the calendar: approving one is the only thing that does, and it is a decision
        taken here by hand.
      </p>

      <div className={styles.filters} role="group" aria-label="Proposal state">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            aria-pressed={entry.key === filter}
            className={entry.key === filter ? styles.filterActive : styles.filter}
            onClick={() => setFilter(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {notice ? (
        <Alert variant={notice.tone === 'success' ? 'success' : 'warning'}>{notice.text}</Alert>
      ) : null}

      {state.kind === 'loading' ? <Skeleton height={120} radius="card" /> : null}
      {state.kind === 'failed' ? <Alert variant="warning">{state.message}</Alert> : null}

      {state.kind === 'ready' ? (
        state.page.proposals.length === 0 ? (
          <p className={styles.caption}>
            {filter === 'pending'
              ? 'No provider calendar change is waiting for a decision.'
              : `No proposal has been ${filter}.`}
          </p>
        ) : (
          <>
            <ul className={styles.list}>
              {state.page.proposals.map((proposal) => (
                <Proposal
                  key={proposal.id}
                  proposal={proposal}
                  busy={busy === proposal.id}
                  reason={reasons[proposal.id] ?? ''}
                  onReason={(value) =>
                    setReasons((current) => ({ ...current, [proposal.id]: value }))
                  }
                  onDecide={(decision) => void run(proposal, decision)}
                />
              ))}
            </ul>
            {state.page.truncated ? (
              <p className={styles.caption}>
                Showing {state.page.returned} of {state.page.total}.
              </p>
            ) : null}
          </>
        )
      ) : null}
    </section>
  )
}

function Proposal({
  proposal,
  busy,
  reason,
  onReason,
  onDecide,
}: {
  proposal: ProviderChangeProposal
  busy: boolean
  reason: string
  onReason: (value: string) => void
  onDecide: (decision: 'approve' | 'reject') => void
}) {
  const fixture =
    proposal.homeTeam && proposal.awayTeam
      ? `${proposal.homeTeam} v ${proposal.awayTeam}`
      : 'Fixture not identified'

  // Every field either side names, so a difference is read rather than hunted
  // for. Union of both objects: a field present on one and absent on the other
  // is exactly the change being proposed.
  const fields = [...new Set([...Object.keys(proposal.proposed), ...Object.keys(proposal.observed)])]

  return (
    <li className={styles.proposal} data-state={proposal.state}>
      <span className={styles.proposalTitle}>
        {KIND_LABEL[proposal.kind] ?? proposal.kind}
        <span className={styles.badge}>{proposal.state}</span>
      </span>

      <span className={styles.detail}>{fixture}</span>
      <span className={styles.detail}>
        {proposal.round ?? 'Round not identified'}
        {proposal.roundOrdinal !== null ? ` · matchweek ${proposal.roundOrdinal}` : ''}
      </span>
      <span className={styles.detail}>
        {proposal.provider ?? 'Provider not recorded'}
        {proposal.providerFixtureId ? ` · their id ${proposal.providerFixtureId}` : ''}
        {proposal.detectedAt ? ` · first seen ${when(proposal.detectedAt)}` : ''}
        {/* Repeats matter: a provider that has said this fifty times is
            reporting something different from one that said it once. */}
        {proposal.seenCount > 1 ? ` · seen ${proposal.seenCount} times` : ''}
      </span>

      {fields.length > 0 ? (
        <table className={styles.compare}>
          <caption className={styles.srOnly}>What the provider proposes, beside what we hold</caption>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Provider says</th>
              <th scope="col">We hold</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field}>
                <th scope="row">{field}</th>
                <td>{readable(proposal.proposed[field])}</td>
                <td>{readable(proposal.observed[field])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {proposal.warnings.length > 0 ? (
        <ul className={styles.notes} data-tone="warning">
          {proposal.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {proposal.blockers.length > 0 ? (
        <ul className={styles.notes} data-tone="blocker">
          {proposal.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}

      {proposal.state === 'pending' ? (
        <div className={styles.actions}>
          <TextInput
            label="Reason (required to reject)"
            value={reason}
            onChange={(event) => onReason(event.target.value)}
            placeholder="Why this is being rejected"
          />
          <div className={styles.buttons}>
            {/* Offered only where the SERVER says it may be. A blocked proposal
                is not shown a control that will be refused. */}
            {proposal.decidable ? (
              <Button variant="primary" disabled={busy} onClick={() => onDecide('approve')}>
                {APPROVE_LABEL[proposal.kind] ?? 'Approve'}
              </Button>
            ) : null}
            <Button variant="destructive" disabled={busy} onClick={() => onDecide('reject')}>
              Reject
            </Button>
          </div>
          {!proposal.decidable ? (
            <span className={styles.detail}>
              This cannot be approved while the blockers above stand. It can be rejected.
            </span>
          ) : null}
        </div>
      ) : (
        <span className={styles.detail}>
          {proposal.state === 'approved' ? 'Approved' : 'Rejected'}
          {proposal.decidedAt ? ` ${when(proposal.decidedAt)}` : ''}
          {proposal.decisionReason ? ` · ${proposal.decisionReason}` : ''}
          {/* What it actually did, from the server's own record. */}
          {proposal.resultingAction ? ` · ${JSON.stringify(proposal.resultingAction)}` : ''}
        </span>
      )}
    </li>
  )
}
