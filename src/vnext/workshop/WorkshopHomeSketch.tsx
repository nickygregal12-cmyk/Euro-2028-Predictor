import type { HomeModel } from '../models/home'
import { AppFrame } from '../foundations/layout/AppFrame'
import { Rail, RailItem } from '../foundations/layout/Rail'
import { formatNumber, formatOrdinal } from '../foundations/format'
import surfaces from '../foundations/surfaces.module.css'
import typography from '../foundations/typography.module.css'
import { MatchCard } from '../components/football/MatchCard'
import { PrimaryActionCard } from '../components/game/PrimaryActionCard'
import { RankMovementIndicator } from '../components/game/RankMovementIndicator'
import { StatTile } from '../components/game/StatTile'
import { LeagueLadder } from '../components/social/LeagueLadder'
import { RivalStrip } from '../components/social/RivalStrip'
import { VNextNav, defaultNavItems } from '../components/navigation/VNextNav'
import type { VNextNavItem } from '../components/navigation/VNextNav'
import styles from './WorkshopHomeSketch.module.css'

export type WorkshopHomeSketchProps = {
  model: HomeModel
}

/**
 * A SKETCH. NOT THE HOME SCREEN.
 *
 * This exists to prove that the foundations, the model and the components fit
 * together at every workshop width — that the frame's four compositions hold,
 * that a rail works inside a column, that the social components survive a
 * 375px phone and a 1920px desktop.
 *
 * It is deliberately obvious rather than designed. No layout decision here is
 * approved, nothing about it should be propagated, and the next stage exists
 * precisely to throw it away in favour of three materially different Home
 * concepts. If this composition starts being cited as "the Home layout", that
 * is the failure this comment is trying to prevent.
 */
export function WorkshopHomeSketch({ model }: WorkshopHomeSketchProps) {
  const now = model.generatedAt
  const openPredictions = model.primaryAction.progress
    ? model.primaryAction.progress.total - model.primaryAction.progress.completed
    : 0

  return (
    <AppFrame
      navBar={
        <VNextNav
          variant="bar"
          activeId="home"
          items={navItemsWithBadge(openPredictions)}
        />
      }
      navRail={
        <VNextNav
          variant="rail"
          activeId="home"
          items={navItemsWithBadge(openPredictions)}
        />
      }
      context={<CompetitionContextBlock model={model} />}
      personal={
        <>
          {model.privateLeagues.map((league) => (
            <LeagueLadder key={league.id} league={league} />
          ))}
          <RivalStrip rivals={model.rivals} />
        </>
      }
    >
      <PrimaryActionCard action={model.primaryAction} now={now} />

      {model.liveMatches.length > 0 ? (
        <Rail title="Live now" meta={`${model.liveMatches.length} matches`}>
          {model.liveMatches.map((match) => (
            <RailItem key={match.id}>
              <MatchCard
                match={match}
                now={now}
                variant={match.isFeatured ? 'feature' : 'standard'}
                showContext={match.isFeatured}
              />
            </RailItem>
          ))}
        </Rail>
      ) : null}

      <Rail title="Next up" meta="Predictions lock at kick-off">
        {model.upcomingMatches.map((match) => (
          <RailItem key={match.id}>
            <MatchCard match={match} now={now} showContext />
          </RailItem>
        ))}
      </Rail>

      <section className={styles.stats} aria-label="Your form">
        <StatTile
          label="Total points"
          value={formatNumber(model.recentPerformance.totalPoints)}
          meta={`${model.recentPerformance.pointsToday} banked today`}
        />
        <StatTile
          label="Overall rank"
          value={formatOrdinal(model.recentPerformance.rank)}
          meta={`of ${formatNumber(model.recentPerformance.rankOutOf)}`}
          trailing={
            <RankMovementIndicator
              movement={model.recentPerformance.rankMovement}
            />
          }
        />
        <StatTile
          label="On the pitch"
          value={model.recentPerformance.provisionalPoints}
          meta="Provisional, not awarded"
          tone="live"
        />
        <StatTile
          label="Exact scores"
          value={model.recentPerformance.accuracy.exact}
          meta={`of ${model.recentPerformance.accuracy.predicted} predicted`}
          tone="accent"
        />
      </section>

      {model.recentResults.length > 0 ? (
        <Rail title="Settled" meta="How the last round finished">
          {model.recentResults.map((match) => (
            <RailItem key={match.id}>
              <MatchCard match={match} now={now} showContext />
            </RailItem>
          ))}
        </Rail>
      ) : null}
    </AppFrame>
  )
}

function CompetitionContextBlock({ model }: { model: HomeModel }) {
  return (
    <div className={`${surfaces.surface} ${styles.context}`}>
      <p className={typography.label}>{model.competition.shortName}</p>
      <p className={`${typography.title} ${typography.clamp2}`}>
        {model.competition.matchweekLabel}
      </p>
      <p className={typography.caption}>
        {model.competition.name} · {model.competition.seasonLabel}
      </p>
      <p className={`${typography.caption} ${typography.muted}`}>
        Playing as {model.user.name}
      </p>
    </div>
  )
}

/** The default destinations, with the open-prediction count on Fixtures. */
function navItemsWithBadge(openPredictions: number): readonly VNextNavItem[] {
  return defaultNavItems.map((item) =>
    item.id === 'fixtures' ? { ...item, badge: openPredictions } : item,
  )
}
