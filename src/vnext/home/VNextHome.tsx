import { motion } from 'framer-motion'
import type { HomeModel } from '../models/home'
import { VNextShell } from '../app/VNextShell'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { ActionBanner } from './ActionBanner'
import { AroundTheGrounds } from './AroundTheGrounds'
import { SinceYouWereHere } from './SinceYouWereHere'
import { CompetitionFocus } from './CompetitionFocus'
import { DecisionHero } from './DecisionHero'
import { FeaturedMatch } from './FeaturedMatch'
import { FixtureTicker } from './FixtureTicker'
import { HomeMasthead } from './HomeMasthead'
import { SocialContext } from './SocialContext'
import {
  pickDecisionMatch,
  pickFeaturedLiveMatch,
  selectHomeEmphasis,
} from './selectHomeEmphasis'
import styles from './home.module.css'

export type VNextHomeProps = {
  model: HomeModel
}

/** What the secondary football zone is called, per emphasis. */
const GROUNDS_TITLE = {
  live: 'Around the grounds',
  decision: 'The rest of the matchweek',
  competition: 'The football',
} as const

/**
 * vNEXT HOME — one surface, three emphases.
 *
 * SAME STADIUM, DIFFERENT MATCH STATE. This is a single Home, not three. The
 * masthead, the score bar, the navigation, the typography, the surfaces, the
 * team-colour language and the motion are identical whatever is happening; what
 * changes is which zone gets the largest treatment and what order the zones
 * come in. Building `LiveHome`, `DecisionHome` and `CompetitionHome` would have
 * been three products sharing a colour palette, and a user who opened the app
 * on a Tuesday would not recognise the page they used on Saturday.
 *
 * WHERE THE THREE CONCEPTS ENDED UP.
 *
 *   MATCHDAY ARENA is the design authority and the structure is its: masthead,
 *   score bar, one match on a stage, dense rows for everything else, football
 *   before furniture, team colour loud on the featured fixture and restrained
 *   everywhere else.
 *
 *   GAME COMMAND CENTRE contributed INFORMATION, not layout. Rank movement, the
 *   gap to the leader, who the user can catch and who can catch them, and the
 *   recent-performance figures — the things Arena knew about the user but never
 *   said. They arrive as a compact module on a matchday and as the dominant
 *   zone on a quiet one, and B's metric board did not come with them.
 *
 *   CINEMATIC FOOTBALL contributed EMPHASIS. An atmospheric competition wash
 *   under the whole page, display-scale typography where a moment deserves it,
 *   and one genuinely cinematic treatment reserved for the next decision. Its
 *   empty half-screen heroes and its poster-per-fixture did not come with it.
 *
 * WHAT HOME STOPPED OWNING IN STAGE 5. The canvas, the atmospheric wash, the
 * page bounds, the sticky band the masthead sits in, both navigations, the
 * `<main>` landmark and the mobile bottom spacing are the APPLICATION's, and
 * they are `app/VNextShell` now. Home kept what was never general: the score
 * bar, the outstanding-action banner, the emphasis system and the three-zone
 * grid it drives. The extraction moved no pixel — `e2e/vnext-home.spec.ts`
 * measures the composition at every width and emphasis either way.
 *
 * THE EMPHASIS IS PRESENTATION ONLY. `selectHomeEmphasis` reads state the model
 * already decided — which matches are live, how urgent the outstanding action
 * is — and answers one question: what should be biggest. It is not consulted
 * about locks, scoring, settlement, reveal or whether a match is officially
 * under way, and it must never become so.
 */
export function VNextHome({ model }: VNextHomeProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const stagger = useVNextMotion(vnextMotion.stagger)

  const now = model.generatedAt
  const emphasis = selectHomeEmphasis(model)
  const featured = pickFeaturedLiveMatch(model)
  const decision = pickDecisionMatch(model)

  const allMatches = [
    ...model.liveMatches,
    ...model.upcomingMatches,
    ...model.recentResults,
  ]

  // The match on the stage is not repeated in the list below it. Competition
  // emphasis puts no match on the stage, so nothing is withheld from the list.
  const staged =
    emphasis === 'live' ? featured : emphasis === 'decision' ? decision : null
  const supporting = allMatches.filter((match) => match.id !== staged?.id)

  return (
    <VNextShell
      destination="home"
      header={<HomeMasthead model={model} />}
      // THE PALETTE IS A FALLBACK NOW AND NOT AN INSTRUCTION. Under the
      // Competition Deck the football context — including its colours — belongs
      // to the shell, which takes them from its own active competition wherever
      // an application supplied one. This keeps `VNextHome({ model })`
      // renderable on its own, which is what the deterministic visual matrix
      // and every render test depend on.
      competitionColours={model.competition.colours}
    >
      <FixtureTicker matches={allMatches} now={now} />

      {/* WHAT HAPPENED, BEFORE WHAT NOW. A player returning on a Monday wants
          the weekend before they want the deadline, and every other zone on
          this page answers "what now". It renders nothing on a first visit and
          nothing when nothing has finished since — which is most days. */}
      <SinceYouWereHere since={model.sinceLastVisit} />

      {/* In decision emphasis the hero IS the outstanding action, so the
          banner would say the same thing twice in a row. Everywhere else it
          sits above the football, because a deadline you can still act on
          outranks a match you cannot. */}
      {emphasis === 'decision' ? null : (
        <ActionBanner action={model.primaryAction} now={now} />
      )}

      {/* Keyed on the emphasis so a change of state re-runs the entrance
          rather than swapping content in place. Under reduced motion the
          resolved variants make that a fade with no travel. */}
      <motion.div
        key={emphasis}
        className={styles.body}
        data-vnext-emphasis={emphasis}
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <motion.div className={styles.stage} data-vnext-zone="stage" variants={rise}>
          {emphasis === 'live' && featured ? <FeaturedMatch match={featured} /> : null}
          {emphasis === 'decision' && decision ? (
            <DecisionHero match={decision} now={now} />
          ) : null}
          {emphasis === 'competition' ? <CompetitionFocus model={model} /> : null}
        </motion.div>

        <motion.div
          className={styles.groundsZone}
          data-vnext-zone="grounds"
          variants={rise}
        >
          <AroundTheGrounds
            matches={supporting}
            now={now}
            title={GROUNDS_TITLE[emphasis]}
          />
        </motion.div>

        {/* Competition emphasis has the league race in the dominant zone
            already; a second copy underneath would be the same table twice. */}
        {emphasis === 'competition' ? null : (
          <motion.div
            className={styles.socialZone}
            data-vnext-zone="social"
            variants={rise}
          >
            <SocialContext model={model} />
          </motion.div>
        )}
      </motion.div>
    </VNextShell>
  )
}
