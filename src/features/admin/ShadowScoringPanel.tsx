import { useEffect, useState } from 'react'
import { Alert, Skeleton } from '../../design-system'
import type { ShadowFinding, ShadowScoringReport } from '../../services/supabase/shadowScoringReportModel'
import { seasonAdminRefusal } from './seasonAdminModel'
import styles from './ShadowScoringPanel.module.css'

/**
 * Contract 178's shadow scoring evidence, for a competition administrator.
 *
 * THE VERIFIER CORRECTS NOTHING AND THIS PANEL OFFERS NO CONTROL THAT SUGGESTS
 * IT DOES. There is no "fix scores" button, no "re-bank" and no "resolve".
 * Contract 178 recomputes settled matchweek points independently — without
 * naming either canonical scoring function, refused at install time by a source
 * assertion, because a verifier that calls what it verifies reports a green
 * tick for ever — and writes its disagreements down. Acting on one is a
 * decision taken elsewhere, with the authority that owns the banked total.
 *
 * "NEVER RUN" IS SAID IN THOSE WORDS AND IS NEVER A PASS. Contract 178 has no
 * scheduled caller: giving it one is a rollout decision and not a frontend one,
 * so on most environments this read answers with no run at all. An empty report
 * and a clean season look identical if a surface is careless, so they are two
 * different states here with two different sentences, and only the second says
 * anything about the scoring being right.
 *
 * A CLEAN RUN IS REPORTED WITH ITS BOUND. The verifier checks the most recent
 * matchweeks and states, on every run, that it does NOT check the settlement
 * lifecycle — whether a matchweek should have settled, and whether every
 * eligible entry holds a row. So "no mismatches" is printed beside how much was
 * looked at, never on its own.
 *
 * AN ENTRY IS AN ENTRY ID. Contract 178 returns no display name and no address
 * on purpose: the question is whether the arithmetic is right. An administrator
 * who needs the person has the entrants read for it.
 */

export type ShadowScoringPanelProps = {
  /** Injected by the page; the panel calls no service itself. */
  load: () => Promise<ShadowScoringReport>
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; report: ShadowScoringReport }

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

const FINDING_LABEL: Record<string, string> = {
  points: 'Banked points disagree',
  joker_applied: 'Joker flag disagrees',
  fixtures_scored: 'Fixture count disagrees',
}

export function ShadowScoringPanel({ load }: ShadowScoringPanelProps) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    setState({ kind: 'loading' })
    load()
      .then((report) => {
        if (active) setState({ kind: 'ready', report })
      })
      .catch((error: unknown) => {
        if (active) setState({ kind: 'failed', message: seasonAdminRefusal(error) })
      })
    return () => {
      active = false
    }
  }, [load])

  return (
    <section className={styles.panel} aria-labelledby="shadow-scoring-heading">
      <h2 className={styles.heading} id="shadow-scoring-heading">
        Independent scoring check
      </h2>
      <p className={styles.caption}>
        A second, independent recomputation of settled matchweek points, compared with what the
        platform banked. It records disagreements and corrects nothing.
      </p>

      {state.kind === 'loading' ? <Skeleton height={120} radius="card" /> : null}
      {state.kind === 'failed' ? <Alert variant="warning">{state.message}</Alert> : null}
      {state.kind === 'ready' ? <Report report={state.report} /> : null}
    </section>
  )
}

function Report({ report }: { report: ShadowScoringReport }) {
  const run = report.run

  if (run === null) {
    return (
      <Alert variant="info" title="This season has never been checked">
        No verification has been run against this season, so there is no evidence either way. This
        is not a report that the scoring is correct. The check has no scheduled caller, and
        scheduling one is a rollout decision rather than something this page can take.
      </Alert>
    )
  }

  const mismatches = run.criticalMismatches + run.advisoryMismatches

  return (
    <>
      <dl className={styles.summary}>
        <Figure label="Last checked" value={when(run.completedAt) || 'Still running'} />
        <Figure label="Matchweeks checked" value={String(run.roundsChecked)} />
        <Figure label="Banked totals checked" value={String(run.scoresChecked)} />
        <Figure label="Disagreements" value={String(mismatches)} tone={mismatches > 0 ? 'alert' : 'quiet'} />
      </dl>

      {run.completedAt === null ? (
        <Alert variant="info">
          This run started at {when(run.startedAt) || 'an unrecorded time'} and has not recorded a
          finish. Its figures are what it had reached, not a complete pass.
        </Alert>
      ) : null}

      {mismatches === 0 ? (
        <p className={styles.caption}>
          {/* Stated with the bound, never as a bare tick. */}
          This run found no disagreement over {run.scoresChecked}{' '}
          {run.scoresChecked === 1 ? 'banked total' : 'banked totals'} across {run.roundsChecked}{' '}
          {run.roundsChecked === 1 ? 'matchweek' : 'matchweeks'}. It does not check the settlement
          lifecycle: whether a matchweek should have settled, and whether every eligible entry
          holds a row, are outside what it looked at.
        </p>
      ) : (
        <>
          <ul className={styles.findings}>
            {report.findings.map((finding, index) => (
              <Finding key={`${finding.entryId ?? 'entry'}-${finding.finding}-${index}`} finding={finding} />
            ))}
          </ul>
          {report.findingsTruncated ? (
            <p className={styles.caption}>
              Showing {report.findingsReturned} of {mismatches}. A truncated list beside the real
              total would otherwise read as the whole of it.
            </p>
          ) : null}
        </>
      )}
    </>
  )
}

function Figure({
  label,
  value,
  tone = 'quiet',
}: {
  label: string
  value: string
  tone?: 'quiet' | 'alert'
}) {
  return (
    <div className={styles.figure} data-tone={tone}>
      <dt className={styles.figureLabel}>{label}</dt>
      <dd className={styles.figureValue}>{value}</dd>
    </div>
  )
}

function Finding({ finding }: { finding: ShadowFinding }) {
  return (
    <li className={styles.finding} data-severity={finding.severity}>
      <span className={styles.findingTitle}>
        {FINDING_LABEL[finding.finding] ?? finding.finding}
        {/* A word, not only a border colour. */}
        <span className={styles.severity}>
          {finding.severity === 'critical' ? 'Critical' : 'Advisory'}
        </span>
      </span>
      <span className={styles.findingDetail}>
        Matchweek {finding.matchweek ?? '—'} · entry {finding.entryId ?? 'unknown'}
      </span>
      <span className={styles.findingDetail}>
        Banked {finding.banked ?? '—'} · independently recomputed {finding.expected ?? '—'}
      </span>
      {finding.detectedAt ? (
        <span className={styles.findingDetail}>Found {when(finding.detectedAt)}</span>
      ) : null}
    </li>
  )
}
