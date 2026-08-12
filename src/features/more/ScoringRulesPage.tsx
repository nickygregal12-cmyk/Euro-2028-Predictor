import { useNavigate } from 'react-router'
import { Button, Workspace } from '../../design-system'
import {
  SEASON_JOKERS_PER_HALF,
  SEASON_JOKERS_PER_SEASON,
  SEASON_PREDICTOR_POINTS,
} from '../../domain/season/scoring'
import s from '../shared.module.css'
import m from './more.module.css'

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className={m.row}>
      <span className={m.rowLabel}>{label}</span>
      <span className={m.rowValue}>{value}</span>
    </div>
  )
}

/**
 * Domestic weekly game explainer. Tournament group/bracket/Golden Boot rules
 * deliberately do not appear here: this route sits inside the weekly Hub and
 * must describe the games the Premier League and Scottish Premiership expose.
 */
export function ScoringRulesPage() {
  const navigate = useNavigate()

  // Prose and rule rows. Without a reading measure the explanatory lines run
  // the full 1440px shell, which is roughly two hundred characters and is not
  // readable at any level of polish.
  return (
    <Workspace width="reading">
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>More</span>
        <h1 className={s.title}>How the games work</h1>
        <p className={s.sub}>
          Each game has its own competition and standings. Playing more games never boosts your
          score in another one.
        </p>
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Match Predictor</span>
        <Rule label="Exact score" value={`+${SEASON_PREDICTOR_POINTS.exactScore}`} />
        <Rule label="Correct result, wrong score" value={`+${SEASON_PREDICTOR_POINTS.correctResult}`} />
        <Rule label="Wrong result or no prediction" value="0" />
        <p className={s.sub}>
          Predict every fixture in the matchweek. The round locks at its first kickoff. A Joker
          doubles your whole matchweek total — {SEASON_JOKERS_PER_SEASON} per season, split{' '}
          {SEASON_JOKERS_PER_HALF} in each half, with at most one on a matchweek.
        </p>
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Last Man Standing</span>
        <Rule label="Your pick wins" value="Survive" />
        <Rule label="Your pick loses" value="Out / lose a life" />
        <Rule label="Round deadline" value="30 min before kickoff" />
        <p className={s.sub}>
          Pick one eligible team each matchweek. Once you use a team you cannot use it again until
          your used-team list resets. The competition preset controls lives, Saves and whether a
          draw eliminates you; if you miss a pick, the game deterministically assigns an eligible
          unused team.
        </p>
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Predictor Championship</span>
        <Rule label="Head-to-head win" value="3 table pts" />
        <Rule label="Head-to-head draw" value="1 table pt" />
        <Rule label="Head-to-head loss" value="0 table pts" />
        <p className={s.sub}>
          Your raw Match Predictor points become your score against a named opponent. Jokers never
          count here. The field size determines the competition format, and the published fixture
          list lets you see who you face before each round.
        </p>
      </div>

      <Button variant="secondary" fullWidth onClick={() => navigate('/more')}>
        Back to More
      </Button>
    </div>
    </Workspace>
  )
}
