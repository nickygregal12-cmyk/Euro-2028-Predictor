import { motion } from 'framer-motion'
import type { HomeModel } from '../models/home'
import { VNextShell } from '../app/VNextShell'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { ActionBanner } from './ActionBanner'
import { AroundTheGrounds } from './AroundTheGrounds'
import { SinceYouWereHere } from './SinceYouWereHere'
import { MatchweekRecap } from './MatchweekRecap'
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

/**
 * Home says WHAT the player asked to open; the application says WHERE it lives.
 * No route string crosses the vNext presentation boundary.
 */
export type HomeIntent =
  | { readonly kind: 'open-predictor' }
  | { readonly kind: 'open-leagues' }
  | { readonly kind: 'open-match'; readonly matchId: string }

export type VNextHomeProps = {
  model: HomeModel
  onIntent?: ((intent: HomeIntent) => void) | undefined
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
export function VNextHome({ model, onIntent }: VNextHomeProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const stagger = useVNextMotion(vnextMotion.stagger)

  const now = model.generatedAt
  const emphasis = selectHomeEmphasis(model)
  const featured = pickFeaturedLiveMatch(model)
  const decision = pickDecisionMatch(model)

  const openPredictor = () => onIntent?.({ kind: 'open-predictor' })
  const openLeagues = () => onIntent?.({ kind: 'open-leagues' })
  const openMatch = (matchId: string) => onIntent?.({ kind: 'open-match', matchId })

  const primaryAction = () => {
    switch (model.primaryAction.type) {
      case 'predict':
      case 'review':
        openPredictor()
        return
      case 'joinLeague':
        openLeagues()
        return
      case 'watchLive':
        // The button literally promises Match Centre. A destination without a
        // fixture id can only reach Matches, so carry the exact featured match
        // Home is already presenting rather than letting a later layer guess.
        if (featured) openMatch(featured.id)
        return
    }
  }

  const allMatches = [
    ...model.liveMatches,
    ...model.upcomingMatches,
    ...model.recentResults,
  ]

  // The match on the stage is not repeated in the list below it. Competition
  // emphasis puts no match on the stage, so nothing is withheld from the list.
  const staged =
    emphasis === 'live' ? featured : emphasis === 'decision' ? decision : null

  /*
   * AND NEITHER IS A RESULT THE RECAP ZONE ALREADY SHOWED.
   *
   * "Since you were last here" draws a handful of settled matches at the top of
   * the page with the reader's own call beside each. Around the Grounds then
   * draws every settled match again under "Already settled" — so on the one day
   * the recap zone appears, the page showed the same three results twice, forty
   * lines apart, with the second copy carrying points the first deliberately
   * omits. That reads as two different things having happened.
   *
   * The rule is the one directly above, applied to a second zone: a match shown
   * higher up is not repeated lower down. What Around the Grounds keeps is
   * everything the recap zone did NOT have room for, which is exactly what the
   * "and N more" line promised was still there.
   */
  const alreadyShown = new Set(
    (model.sinceLastVisit?.results ?? []).map((match) => match.id),
  )
  const supporting = allMatches.filter(
    (match) => match.id !== staged?.id && !alreadyShown.has(match.id),
  )

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
        <ActionBanner action={model.primaryAction} now={now} onAction={primaryAction} />
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
          {emphasis === 'live' && featured ? (
            <FeaturedMatch match={featured} onOpenMatch={openMatch} />
          ) : null}
          {emphasis === 'decision' && decision ? (
            <DecisionHero match={decision} now={now} onAction={primaryAction} />
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
            onOpenMatch={openMatch}
            onOpenPredictor={openPredictor}
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

      {/*
        HOW YOU DID, UNDER EVERYTHING THAT IS HAPPENING.

        A BAND RATHER THAN A GRID AREA, deliberately. `.body` places three named
        areas across three widths and three emphases — nine declarations, each
        tuned against a specific void the composition used to open — and a
        fourth area would mean editing all nine to add something that is not
        football and not an action. The recap is neither, so it sits below the
        grid at page width in every emphasis, which is also the right reading
        order: what needs you, what is happening, what happened, then how you
        did. It renders nothing at all until a matchweek has settled.
      */}
      <motion.div
        className={styles.recapBand}
        data-vnext-zone="recap-band"
        variants={rise}
        initial="hidden"
        animate="visible"
      >
        <MatchweekRecap recap={model.matchweekRecap} />
      </motion.div>
    </VNextShell>
  )
}
