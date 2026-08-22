import { motion } from 'framer-motion'
import type { HomeModel } from '../models/home'
import type { Match } from '../models/football'
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
 * HOME'S OUTWARD INTENT. No URL, router or application service belongs here.
 * The connected screen translates these into the existing shell/application
 * navigation seam.
 */
export type HomeIntent =
  | { readonly kind: 'primary-action'; readonly action: HomeModel['primaryAction']['type'] }
  | { readonly kind: 'prediction'; readonly fixtureId: string }
  | { readonly kind: 'match-centre'; readonly fixtureId: string }

export type VNextHomeProps = {
  model: HomeModel
  onIntent?: ((intent: HomeIntent) => void) | undefined
}

const GROUNDS_TITLE = {
  live: 'Around the grounds',
  decision: 'The rest of the matchweek',
  competition: 'The football',
} as const

export function VNextHome({ model, onIntent }: VNextHomeProps) {
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

  const staged =
    emphasis === 'live' ? featured : emphasis === 'decision' ? decision : null

  const alreadyShown = new Set(
    (model.sinceLastVisit?.results ?? []).map((match) => match.id),
  )
  const supporting = allMatches.filter(
    (match) => match.id !== staged?.id && !alreadyShown.has(match.id),
  )

  const activateFixture = (match: Match) => {
    onIntent?.(
      match.status === 'upcoming'
        ? { kind: 'prediction', fixtureId: match.id }
        : { kind: 'match-centre', fixtureId: match.id },
    )
  }

  return (
    <VNextShell
      destination="home"
      header={<HomeMasthead model={model} />}
      competitionColours={model.competition.colours}
    >
      <FixtureTicker matches={allMatches} now={now} />

      <SinceYouWereHere since={model.sinceLastVisit} />

      {emphasis === 'decision' ? null : (
        <ActionBanner
          action={model.primaryAction}
          now={now}
          onActivate={() =>
            onIntent?.({ kind: 'primary-action', action: model.primaryAction.type })
          }
        />
      )}

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
            <FeaturedMatch
              match={featured}
              onActivate={() =>
                onIntent?.({ kind: 'match-centre', fixtureId: featured.id })
              }
            />
          ) : null}
          {emphasis === 'decision' && decision ? (
            <DecisionHero
              match={decision}
              now={now}
              onActivate={() =>
                onIntent?.({ kind: 'prediction', fixtureId: decision.id })
              }
            />
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
            onActivate={activateFixture}
          />
        </motion.div>

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
