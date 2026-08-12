import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShadowScoringPanel } from '../../../src/features/admin/ShadowScoringPanel'
import { mapShadowScoringReport } from '../../../src/services/supabase/shadowScoringReportModel'

/**
 * Contract 178 on screen.
 *
 * TWO PROPERTIES ARE THE WHOLE POINT AND BOTH ARE ASSERTED NEGATIVELY:
 *
 *   * a season nothing has ever verified must NOT read as verified. An empty
 *     report and a clean season are the same shape if a surface is careless,
 *     and one of them is a green tick over no evidence at all;
 *   * there is no control that could act on a finding. The verifier corrects
 *     nothing, and a "fix scores" button would claim an authority that does not
 *     exist anywhere in the repository.
 */

const report = (over: Record<string, unknown> = {}) =>
  mapShadowScoringReport({
    tournament_id: 't-1',
    server_now: '2026-08-12T14:20:00Z',
    run: null,
    findings: [],
    findings_returned: 0,
    findings_truncated: false,
    ...over,
  })

const cleanRun = {
  run_id: 'run-1',
  started_at: '2026-08-12T03:00:00Z',
  completed_at: '2026-08-12T03:02:00Z',
  rounds_checked: 6,
  scores_checked: 240,
  critical_mismatches: 0,
  advisory_mismatches: 0,
}

describe('ShadowScoringPanel', () => {
  it('says a season has never been checked, and never that it passed', async () => {
    render(<ShadowScoringPanel load={async () => report()} />)
    await waitFor(() =>
      expect(screen.getByText(/This season has never been checked/)).toBeInTheDocument(),
    )
    expect(
      screen.getByText(/This is not a report that the scoring is correct/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/no disagreement/)).not.toBeInTheDocument()
  })

  it('reports a clean run with the bound it was measured over', async () => {
    render(<ShadowScoringPanel load={async () => report({ run: cleanRun })} />)
    await waitFor(() => expect(screen.getByText('Disagreements')).toBeInTheDocument())
    expect(screen.getByText(/no disagreement over 240 banked totals across 6 matchweeks/))
      .toBeInTheDocument()
    // The bound it explicitly does not cover, stated rather than implied.
    expect(screen.getByText(/does not check the settlement lifecycle/)).toBeInTheDocument()
  })

  it('lists findings with both numbers and offers nothing that could change them', async () => {
    render(
      <ShadowScoringPanel
        load={async () =>
          report({
            run: { ...cleanRun, critical_mismatches: 1, advisory_mismatches: 1 },
            findings: [
              {
                finding: 'points',
                severity: 'critical',
                matchweek_id: 'r-5',
                matchweek: 5,
                entry_id: 'entry-9',
                banked: 31,
                expected: 26,
                detected_at: '2026-08-12T03:01:00Z',
              },
              {
                finding: 'fixtures_scored',
                severity: 'advisory',
                matchweek_id: 'r-5',
                matchweek: 5,
                entry_id: 'entry-9',
                banked: 9,
                expected: 10,
                detected_at: '2026-08-12T03:01:00Z',
              },
            ],
          })
        }
      />,
    )
    await waitFor(() => expect(screen.getByText('Banked points disagree')).toBeInTheDocument())
    expect(screen.getByText('Banked 31 · independently recomputed 26')).toBeInTheDocument()
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('Advisory')).toBeInTheDocument()
    // No repair path anywhere.
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('says how much of a long list it carried', async () => {
    render(
      <ShadowScoringPanel
        load={async () =>
          report({
            run: { ...cleanRun, critical_mismatches: 60, advisory_mismatches: 0 },
            findings: [
              {
                finding: 'points',
                severity: 'critical',
                matchweek: 5,
                entry_id: 'entry-9',
                banked: 31,
                expected: 26,
              },
            ],
            findings_truncated: true,
          })
        }
      />,
    )
    await waitFor(() => expect(screen.getByText(/Showing 1 of 60/)).toBeInTheDocument())
  })

  it('renders a refusal as a refusal rather than as a season with no findings', async () => {
    render(
      <ShadowScoringPanel
        load={async () => {
          throw { code: '42501', message: 'not an admin' }
        }}
      />,
    )
    await waitFor(() =>
      expect(
        screen.getByText(/does not hold the administrator capability/),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText(/never been checked/)).not.toBeInTheDocument()
  })

  it('says a run that never finished is not a complete pass', async () => {
    render(
      <ShadowScoringPanel load={async () => report({ run: { ...cleanRun, completed_at: null } })} />,
    )
    await waitFor(() =>
      expect(screen.getByText(/has not recorded a finish/)).toBeInTheDocument(),
    )
  })
})

describe('mapShadowScoringReport', () => {
  it('refuses a payload it cannot read', () => {
    expect(() => mapShadowScoringReport({})).toThrow(/not in the expected shape/)
  })

  it('treats an unrecognised severity as critical, never as advisory', () => {
    const decoded = mapShadowScoringReport({
      tournament_id: 't-1',
      run: cleanRun,
      findings: [{ finding: 'points', severity: 'mild', entry_id: 'e-1' }],
    })
    expect(decoded.findings[0]?.severity).toBe('critical')
  })
})
