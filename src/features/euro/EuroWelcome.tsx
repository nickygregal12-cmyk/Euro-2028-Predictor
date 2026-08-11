import { Button, Workspace } from '../../design-system'
import { useSite } from '../../app/site/SiteProvider'
import s from '../shared.module.css'
import styles from './EuroDestinationPage.module.css'

/**
 * First sign-in, on the Euro deployment.
 *
 * WHY IT IS NOT THE ONBOARDING JOURNEY. `OnboardingJourney` is four domestic
 * steps: follow weekly competitions from the published catalogue, pick a
 * favourite club from those competitions' clubs, join the games those
 * competitions run, and review it. Every one of those is a fact about the weekly
 * platform, and a first-time visitor to the tournament's own domain was being
 * walked through all four — asked to follow the Scottish Premiership on the way
 * into Euro 2028. That is the same defect as the four destinations: the other
 * product, at this product's address.
 *
 * WHY IT IS NOT AN INVISIBLE REDIRECT EITHER. Marking the account welcomed and
 * navigating away silently is indistinguishable from the app losing the click.
 * One screen that says the account is made and what it is for costs a tap and
 * tells the truth.
 *
 * IT ASKS FOR NOTHING, DELIBERATELY. There is no Euro competition to follow, no
 * tournament club to favourite and no game to enter, so there is no question this
 * could ask whose answer it could store. When the tournament's own journeys
 * return, the step that belongs here returns with them.
 *
 * IT JOINS NOTHING. Continuing is not entry to any game or private container, on
 * either site.
 */
export function EuroWelcome({
  displayName,
  onFinished,
}: {
  displayName: string | null
  onFinished: () => void
}) {
  const site = useSite()
  const sibling = site.routes.siblingSiteOrigin

  return (
    <div className={s.page}>
      <Workspace width="reading">
        <header className={s.header}>
          <p className={s.eyebrow}>Welcome</p>
          <h1 className={s.title}>
            {displayName ? `You’re in, ${displayName}.` : 'You’re in.'}
          </h1>
          <p className={s.sub}>
            Your account is ready for {site.brand.productName}
            {sibling ? ` and for ${site.routes.siblingSiteName}` : ''} — it is the same
            account on both, so you never sign up twice.
          </p>
        </header>

        <section className={styles.section} aria-labelledby="euro-welcome-next">
          <h2 className={styles.sectionHeading} id="euro-welcome-next">
            What happens next
          </h2>
          <p className={styles.sectionBody}>
            Euro 2028 opens when its draw is made. Nothing needs doing until then, and
            having an account does not enter you into anything — every game is joined
            separately, wherever you play it.
          </p>
          {sibling ? (
            <p className={styles.sectionBody}>
              {site.routes.siblingSiteName} is running every matchweek now, on this same
              account —{' '}
              <a className={styles.inlineLink} href={sibling} rel="noreferrer">
                play it there
              </a>
              .
            </p>
          ) : null}
        </section>

        <Button onClick={onFinished}>Continue</Button>
      </Workspace>
    </div>
  )
}
