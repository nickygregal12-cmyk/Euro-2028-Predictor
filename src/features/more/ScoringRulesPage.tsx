import { useNavigate } from 'react-router-dom'
import { Button } from '../../design-system'
import {
  GROUP_MATCH_POINTS,
  JOKER_MULTIPLIER,
  GROUP_POSITION_POINTS,
  KNOCKOUT_STAGE_ORDER,
  KNOCKOUT_STAGE_POINTS,
  GOLDEN_BOOT_POINTS,
  TOTAL_GOALS_BANDS,
  TOTAL_GOALS_OUTSIDE_POINTS,
} from '../../domain/tournament/scoringConfig'
import s from '../shared.module.css'
import m from './more.module.css'

// "How scoring works", rendered from the scoring CONFIG so the numbers can never
// drift from docs/scoring-rules.md (the single source of truth for point values,
// per CLAUDE.md). No point value is hard-coded in this screen.

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className={m.row}>
      <span className={m.rowLabel}>{label}</span>
      <span className={m.rowValue}>{value}</span>
    </div>
  )
}

const STAGE_LABEL: Record<string, string> = {
  R16: 'Round of 16',
  QF: 'Quarter-final',
  SF: 'Semi-final',
  FINAL: 'Final',
  CHAMPION: 'Champion',
}

export function ScoringRulesPage() {
  const navigate = useNavigate()

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>More</span>
        <h1 className={s.title}>How scoring works</h1>
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Group matches</span>
        <Rule label="Exact score" value={`+${GROUP_MATCH_POINTS.exactScore}`} />
        <Rule label="Correct result (wrong score)" value={`+${GROUP_MATCH_POINTS.correctResult}`} />
        <Rule label="Wrong result" value={`+${GROUP_MATCH_POINTS.wrong}`} />
        <p className={s.sub}>
          A joker doubles one group match&apos;s points ({JOKER_MULTIPLIER}×) — up to five per entry,
          group stage only.
        </p>
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Group positions</span>
        <Rule label="Each team in the right position" value={`+${GROUP_POSITION_POINTS.perCorrectTeam}`} />
        <Rule label="All four in the right order (bonus)" value={`+${GROUP_POSITION_POINTS.fullOrderBonus}`} />
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Knockout progression (per team)</span>
        {KNOCKOUT_STAGE_ORDER.map((stage) => (
          <Rule key={stage} label={STAGE_LABEL[stage]} value={`+${KNOCKOUT_STAGE_POINTS[stage]}`} />
        ))}
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Bonus predictions</span>
        <Rule label="Golden Boot (top scorer)" value={`+${GOLDEN_BOOT_POINTS}`} />
        {TOTAL_GOALS_BANDS.map((b) => (
          <Rule
            key={b.band}
            label={
              b.maxDiff === 0
                ? 'Total goals — exact'
                : `Total goals — within ${b.maxDiff}`
            }
            value={`+${b.points}`}
          />
        ))}
        <Rule label="Total goals — outside" value={`+${TOTAL_GOALS_OUTSIDE_POINTS}`} />
      </div>

      <Button variant="secondary" fullWidth onClick={() => navigate('/more')}>
        Back
      </Button>
    </div>
  )
}
