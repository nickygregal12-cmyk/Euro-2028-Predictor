import type { HomeModel } from '../models/home'
import { AppFrame } from '../foundations/layout/AppFrame'
import { Rail, RailItem } from '../foundations/layout/Rail'
import surfaces from '../foundations/surfaces.module.css'
import typography from '../foundations/typography.module.css'
import { MatchCard } from '../components/football/MatchCard'
import { LeagueLadder } from '../components/social/LeagueLadder'
import { VNextNav } from '../components/navigation/VNextNav'
import styles from './AppFrameProbe.module.css'

export type AppFrameProbeProps = {
  model: HomeModel
}

/**
 * A TEST RIG FOR `AppFrame`. NOT A DESIGN, AND NOT A HOME CONCEPT.
 *
 * WHAT IT REPLACED, AND WHY THAT MATTERS. `WorkshopHomeSketch` was the Stage 2
 * throwaway that proved the foundations fitted together. Stage 3 replaced it
 * with three real Home concepts, so its design purpose is gone — but one thing
 * it was carrying was not a design at all: `e2e/vnext-workshop-layout.spec.ts`
 * measures `AppFrame`'s four compositions in a real browser through it, because
 * jsdom evaluates no container query. Deleting the sketch outright would have
 * deleted that measurement with it.
 *
 * So the sketch is gone and this is what is left: the smallest composition that
 * populates all four of the frame's regions, with no layout opinion of its own.
 * It is deliberately plain, it is hidden from the Storybook review sidebar
 * (`tags: ['!dev']`), and it is named after the thing it probes rather than
 * after a screen — because the failure the sketch's own comment warned about
 * was somebody citing a rig as "the Home layout".
 *
 * If a Home concept ever adopts `AppFrame`, this can go and the spec can point
 * at that instead. Until then, an unused layout primitive with a browser-level
 * contract needs something to render it.
 */
export function AppFrameProbe({ model }: AppFrameProbeProps) {
  const now = model.generatedAt

  return (
    <AppFrame
      navBar={<VNextNav variant="bar" activeId="home" />}
      navRail={<VNextNav variant="rail" activeId="home" />}
      context={
        <div className={`${surfaces.surface} ${styles.block}`}>
          <p className={typography.label}>Context region</p>
          <p className={typography.caption}>
            {model.competition.name} · {model.competition.matchweekLabel}
          </p>
        </div>
      }
      personal={
        <>
          {model.privateLeagues.map((league) => (
            <LeagueLadder key={league.id} league={league} />
          ))}
        </>
      }
    >
      <div className={`${surfaces.surface} ${styles.block}`}>
        <p className={typography.label}>Main region</p>
        <p className={typography.caption}>
          The football workspace. The rail below is what the spec measures for
          the container-relative card cap.
        </p>
      </div>

      <Rail title="Frame probe rail" meta="Cards sized against the frame">
        {[...model.liveMatches, ...model.upcomingMatches].map((match) => (
          <RailItem key={match.id}>
            <MatchCard match={match} now={now} />
          </RailItem>
        ))}
      </Rail>
    </AppFrame>
  )
}
