import { NON_AFFILIATION_SHORT } from '../../vnext/models/about'
import { Component, Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import type { ReactElement } from 'react'
import { Link } from 'react-router'
import { useTheme } from '../../app/providers/ThemeProvider'
import { useSite } from '../../app/site/SiteProvider'
import { siteBrandCopy } from '../../app/site/sitePublicMetadata'
import { CheckIcon, ChevronRightIcon, MoonIcon, SunIcon } from '../../design-system/icons'
import {
  DOMESTIC_COMPETITIONS,
  EXPERIENCE_FEATURES,
  GAMES,
  HOW_STEPS,
  LANDING_NAV,
  LANDING_SECTION_ORDER,
  LEGAL_LINKS,
  type LandingSectionId,
} from './landingContent'
import { PREVIEW_STEPS, previewStepAt } from './landingPreviewScript'
import { previewBoxStyle } from './previewDevice'
import type { ProductPreviewVariant } from './previewDevice'
import { useScriptedPreview } from './useScriptedPreview'
import s from './LandingPage.module.css'

/**
 * THE PREVIEW ARRIVES AFTER THE PAGE, AND THAT IS DELIBERATE.
 *
 * `ProductPreview` drags four real vNext surfaces, the application shell and
 * Framer Motion behind it — measured at roughly seventy-seven kilobytes
 * compressed. That is a reasonable price for a marketing page to pay for a
 * product it cannot otherwise show, and an unreasonable one to pay BEFORE the
 * headline renders: the first thing an anonymous visitor needs is the
 * proposition and the sign-up action, and neither of them is in that chunk.
 *
 * SO IT COSTS NO LAYOUT SHIFT. `PreviewFrameSkeleton` reserves the exact box
 * from `previewDevice.ts` — the same width, the same aspect ratio, the same
 * numbers the device itself uses — so the page is its final height from the
 * first paint and the device lands inside a hole already cut for it.
 *
 * IT DOES CHANGE ONE CLAIM THIS PAGE USED TO MAKE, and the change is worth
 * stating rather than discovering: the preview is no longer complete on the
 * first paint. It is complete one chunk later. What has not changed is that
 * nothing about it waits on an account, a service, a clock or a write.
 */
const ProductPreview = lazy(() =>
  import('./ProductPreview').then((module) => ({ default: module.ProductPreview })),
)

/**
 * THE PREVIEW MAY FAIL WITHOUT TAKING THE PAGE WITH IT.
 *
 * A lazily-imported chunk can fail to arrive — a dropped connection mid-visit, a
 * stale hashed filename after a deploy while the tab was open — and a rejected
 * `React.lazy` throws to the nearest boundary. Above this one that is
 * `ApplicationErrorBoundary`, which would replace the entire landing page.
 *
 * That trade is the wrong way round. The page's job is the proposition and the
 * sign-up action, and the preview is the supporting argument. Losing the
 * argument costs a visitor a picture; losing the page costs them the product.
 * So the failure is contained here, and what remains is the box the device was
 * going to sit in — no error text, because a marketing page apologising for a
 * missing screenshot is worse than a quiet space where one was.
 */
class PreviewBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  public state = { failed: false }

  public static getDerivedStateFromError() {
    return { failed: true }
  }

  public render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * The device's box, before the device.
 *
 * SHAPE-PRESERVING AND EMPTY. It reserves the frame and says nothing about what
 * is coming: a skeleton that drew rows, a table or a scoreline would be
 * inventing football to fill a gap, which is exactly what a preview of a real
 * product must not do. The border and the surface are the frame's own, so what
 * arrives is the picture inside a box that was already there.
 */
function PreviewFrameSkeleton({ variant }: { variant: ProductPreviewVariant }): ReactElement {
  return (
    <div
      className={
        variant === 'phone'
          ? `${s.previewSkeleton} ${s.previewSkeletonPhone}`
          : s.previewSkeleton
      }
      style={previewBoxStyle(variant)}
      aria-hidden="true"
    />
  )
}

/**
 * The public landing page — the anonymous root (modernisation plan Appendix E).
 *
 * WHAT THIS REPLACES. Until now an anonymous visitor arriving at `/` was sent
 * straight to `/auth/login`: the first thing anyone saw of the product was a
 * password field for an account they did not have. E.1 makes the root
 * anonymous experience a conversion page instead, and this is that page.
 *
 * IT IS PRESENTATION ONLY. Appendix E sits below the ADRs and cannot change a
 * scoring, lock, membership, settlement, progression or reveal rule — so this
 * page reads nothing, writes nothing and calls no service. Its only outbound
 * links are to the real `/auth/signup` and `/auth/login` routes, which own
 * account creation exactly as they did before.
 *
 * NOTHING IS SILENTLY JOINED, and the copy says so where a visitor would
 * otherwise assume otherwise (E.6). Following a competition is not game entry
 * and joining one game is not joining another, so the games section states
 * that Last Man Standing is joined separately rather than implying a bundle.
 *
 * THE TWO PRODUCT PREVIEWS ARE PICTURES, exposed to assistive technology as a
 * single described image each. See `landingContent.ts` for why invented ranks
 * and points must not be announced as though they were the visitor's own.
 *
 * Deliberate departures from `docs/design/hub-landing-prototype.html`, all of
 * them forced by an authority above the prototype:
 *
 *  - the prototype's Touchline brand marks and cool blue palette are not
 *    adopted — brand selection is deferred under ADR 0019, so this renders in
 *    the production design system with the palette in force;
 *  - the hero uses `--fs-6`, the top of the fixed six-step type scale, rather
 *    than the prototype's larger clamped display size. §11.7 forbids inventing
 *    an off-scale size and `foundationTokens.test.ts` fails a seventh step;
 *  - the prototype's account modal is replaced by links to the real auth
 *    routes. It existed to mock a flow this application already implements.
 */
export function LandingPage(): ReactElement {
  return (
    <div className={s.page}>
      <a className={s.skipLink} href="#main-content">
        Skip to content
      </a>

      <LandingHeader />

      <main id="main-content" className={s.main} tabIndex={-1}>
        {/* Section order comes from Appendix E.3's array rather than from the
            nesting here, so the page cannot be quietly reordered away from the
            authority while the authority still claims to describe it. */}
        {LANDING_SECTION_ORDER.map((id) => (
          <LandingSection key={id} id={id} />
        ))}
      </main>

      <LandingFooter />
    </div>
  )
}

function LandingHeader(): ReactElement {
  const { theme, toggle } = useTheme()
  // The product's own name, from the one configuration that decides it. Both
  // deployments render this component's siblings; only one renders this page,
  // but a hard-coded name here is how the two products start disagreeing about
  // what they are called.
  const site = useSite()
  const brand = siteBrandCopy(site.variant)

  return (
    <header className={s.header}>
      <div className={s.headerInner}>
        <span className={s.brand}>
          <span className={s.brandMark} aria-hidden="true">
            {brand.monogram}
          </span>
          <span className={s.brandCopy}>
            {site.brand.productName}
            <small>Weekly prediction games</small>
          </span>
        </span>

        {/* Phone omits the in-page anchors rather than hiding them behind a
            menu: the page is one short scroll, and a second navigation system
            for four links is more surface than the links are worth. Sign in
            and the primary action stay visible at every width. */}
        <nav className={s.headerNav} aria-label="Landing page sections">
          {LANDING_NAV.map(({ id, label }) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>

        <div className={s.headerActions}>
          <button
            type="button"
            className={s.iconButton}
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
          <Link className={`${s.cta} ${s.ctaQuiet} ${s.ctaSmall}`} to="/auth/login">
            Sign in
          </Link>
          {/* "Create account" rather than the hero's fuller wording: the header
              is one non-wrapping row and this is the widest thing in it, so the
              label is the part that has to give at 390px. */}
          <Link className={`${s.cta} ${s.ctaPrimary} ${s.ctaSmall}`} to="/auth/signup">
            Create account
          </Link>
        </div>
      </div>
    </header>
  )
}

function LandingSection({ id }: { id: LandingSectionId }): ReactElement {
  switch (id) {
    case 'hero':
      return <HeroSection />
    case 'proof':
      return <ProofSection />
    case 'how':
      return <HowSection />
    case 'experience':
      return <ExperienceSection />
    case 'leagues':
      return <LeaguesSection />
    case 'games':
      return <GamesSection />
    case 'final':
      return <FinalSection />
  }
}

function HeroSection(): ReactElement {
  const { theme } = useTheme()

  return (
    <section className={s.hero} id="hero" aria-labelledby="hero-heading">
      <div className={s.shell}>
        <div className={s.heroGrid}>
          <div className={s.heroCopy}>
            <p className={s.eyebrow}>Weekly football prediction games</p>
            <h1 className={s.heroHeading} id="hero-heading">
              Make every match mean more.
            </h1>
            <p className={s.heroLead}>
              Predict the scores, climb live standings and compete with your friends across the
              Scottish Premiership and Premier League — from one focused football hub.
            </p>
            <div className={s.heroActions}>
              <Link className={`${s.cta} ${s.ctaPrimary}`} to="/auth/signup">
                Create your free account
                <ChevronRightIcon size={18} />
              </Link>
              <a className={`${s.cta} ${s.ctaSecondary}`} href="#experience">
                See the experience
              </a>
              {/* The third path the acquisition direction asks for, beside
                  signing up and signing in: learning how each game works. It is
                  an in-page anchor rather than a route, because the explainer a
                  signed-in player reads at `/more/scoring` is behind the auth
                  gate — sending a visitor to a page that bounces them to login
                  would be a call to action that does not act. */}
              <a className={`${s.cta} ${s.ctaQuiet}`} href="#games">
                How the games work
              </a>
            </div>
            <ul className={s.trustRow}>
              {['Free to join', 'Nothing predicted for you', 'Private leagues'].map((item) => (
                <li key={item}>
                  <span className={s.trustCheck} aria-hidden="true">
                    <CheckIcon size={13} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* THE DEVICE SITS UNDER THE COPY RATHER THAN BESIDE IT, and the
              reason is legibility rather than taste. The frame renders the
              product at its real 1280px viewport and scales the result down; in
              a half-width hero column that scale is roughly 0.55 and the
              product's body text lands under eight pixels, which is a picture
              of a product nobody can read. Given the full content width it
              lands near 0.9, which is a product. */}
          <DesktopStory theme={theme} />
        </div>
      </div>
    </section>
  )
}

/**
 * THE DESKTOP STORY — the real product, at the width the rail needs.
 *
 * It renders at 1280px, which is the width `VNextShell` requires before its
 * navigation rail becomes real, and the page scales the result to whatever room
 * the column has. Below 1024px the whole band is absent rather than shrunk: a
 * desktop composition squeezed onto a phone is a picture of neither product,
 * and the phone story further down is the one that visitor actually wants.
 *
 * THE STEP CONTROLS ARE OUTSIDE THE DEVICE, and that is a rule rather than a
 * layout preference. Everything inside the frame is the product and is inert;
 * a real control in there would be indistinguishable from the product's own,
 * and a visitor who pressed "Continue" expecting to predict something would
 * have been told a lie by the page that was selling them the product. These
 * controls step the PREVIEW and say so in their accessible names.
 */
function DesktopStory({ theme }: { theme: 'dark' | 'light' }): ReactElement {
  const { index, containerRef, goTo, playing } = useScriptedPreview()
  const step = previewStepAt(index)

  return (
    <div className={`${s.previewStage} ${s.previewStageDesktop}`} ref={containerRef}>
      <PreviewBoundary fallback={<PreviewFrameSkeleton variant="desktop" />}>
        <Suspense fallback={<PreviewFrameSkeleton variant="desktop" />}>
          <ProductPreview
            variant="desktop"
            theme={theme}
            phaseIndex={index}
            description={step.description}
          />
        </Suspense>
      </PreviewBoundary>
      <PreviewSteps index={index} goTo={goTo} playing={playing} />
    </div>
  )
}

/**
 * The preview's own step controls.
 *
 * OUTSIDE THE DEVICE AND LABELLED AS THE PREVIEW'S. Each control names the step
 * it shows, so a screen-reader user gets "Show the football happens" rather than
 * a row of identical dots — and nothing here could be mistaken for a control
 * over a real account, because there is no account.
 *
 * THE STEP NAMES ARE VISIBLE TEXT, not tooltips. They double as the caption for
 * the frame on screen, which is what makes the sequence legible to somebody who
 * arrives mid-loop. The sentence beneath names what CHANGED, because a device
 * that moved without saying why is decoration.
 */
function PreviewSteps({
  index,
  goTo,
  playing,
}: {
  index: number
  goTo: (index: number) => void
  playing: boolean
}): ReactElement {
  const step = previewStepAt(index)

  return (
    <div className={s.previewSteps}>
      {/* Announced on change so the sequence is followable without sight of it,
          and only while it is advancing on its own: a visitor who is stepping by
          hand already knows where they are, and announcing their own presses
          back at them is noise. */}
      <p className={s.previewStepLabel} aria-live={playing ? 'polite' : 'off'}>
        <strong>{step.step}</strong>
        <span>{step.headline}</span>
      </p>
      <div className={s.previewStepDots} role="group" aria-label="Preview steps">
        {PREVIEW_STEPS.map((entry, position) => (
          <button
            key={entry.id}
            type="button"
            className={
              position === index ? `${s.previewDotStep} ${s.previewDotStepOn}` : s.previewDotStep
            }
            aria-current={position === index}
            aria-label={`Show preview step ${position + 1} of ${PREVIEW_STEPS.length}: ${entry.step}`}
            onClick={() => goTo(position)}
          />
        ))}
      </div>
    </div>
  )
}


function ProofSection(): ReactElement {
  return (
    <section className={s.proof} id="proof" aria-label="The competitions behind the weekly product">
      <div className={`${s.shell} ${s.proofInner}`}>
        <p>Built around the leagues you follow every week</p>
        <div className={s.proofPair}>
          {DOMESTIC_COMPETITIONS.map(({ code, name }) => (
            <span key={code} className={s.proofItem}>
              <span className={s.identity}>{code}</span>
              {name}
            </span>
          ))}
        </div>
        <p>Tournaments stay separate, so the weekly hub stays clear.</p>
      </div>
    </section>
  )
}

function HowSection(): ReactElement {
  return (
    <section className={s.section} id="how" aria-labelledby="how-heading">
      <div className={s.shell}>
        <div className={s.sectionHead}>
          <p className={s.eyebrow}>Simple from the first matchweek</p>
          <h2 id="how-heading">Three steps. One season of bragging rights.</h2>
          <p className={s.sectionLead}>
            The habit makes sense immediately. The competitive depth appears later, when it starts
            to be useful.
          </p>
        </div>
        <ol className={s.stepList}>
          {HOW_STEPS.map((step) => (
            <li key={step.number} className={s.stepRow}>
              <span className={s.stepNumber}>{step.number}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function ExperienceSection(): ReactElement {
  const { theme } = useTheme()

  return (
    <section className={s.section} id="experience" aria-labelledby="experience-heading">
      <div className={`${s.shell} ${s.experienceGrid}`}>
        <PhoneStory theme={theme} />
        <div>
          <p className={s.eyebrow}>Premium without being complicated</p>
          <div className={s.sectionHead}>
            <h2 id="experience-heading">Your whole football week, prioritised for you.</h2>
            <p className={s.sectionLead}>
              Signed in, the hub identifies the one action that matters now, then gives quiet
              access to your rank, competitions, leagues and live matches.
            </p>
          </div>
          <ul className={s.featureList}>
            {EXPERIENCE_FEATURES.map((feature) => (
              <li key={feature.title} className={s.featureRow}>
                <span className={s.featureIcon} aria-hidden="true">
                  <CheckIcon size={14} />
                </span>
                <div>
                  <strong>{feature.title}</strong>
                  <p>{feature.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/**
 * THE PHONE STORY — the same five phases, on the composition a phone gets.
 *
 * IT RUNS THE SAME PHASES AS THE DESKTOP DEVICE ON PURPOSE. Two scripts would be
 * two things to keep truthful, and the second one to drift would be the one
 * showing a product state the first had stopped claiming.
 *
 * WHAT DIFFERS IS THE COMPOSITION, AND THE PRODUCT DECIDES IT RATHER THAN THIS
 * FILE. `VNextShell.module.css` is written against `@container vnext-shell`, so
 * a 390px frame gets the real bottom bar and the real single-column layout while
 * the 1280px frame above gets the real rail — on the same page, at the same
 * viewport. The claim this section makes about the product adapting is therefore
 * demonstrated rather than illustrated.
 *
 * ITS OWN VISIBILITY, ITS OWN TIMER. It is most of a page below the hero, so
 * sharing the desktop device's observer would run it while it is off screen and
 * stop it while it is being read.
 */
function PhoneStory({ theme }: { theme: 'dark' | 'light' }): ReactElement {
  const { index, containerRef, goTo, playing } = useScriptedPreview()
  const step = previewStepAt(index)

  return (
    <div className={s.previewStage} ref={containerRef}>
      <PreviewBoundary fallback={<PreviewFrameSkeleton variant="phone" />}>
        <Suspense fallback={<PreviewFrameSkeleton variant="phone" />}>
          <ProductPreview
            variant="phone"
            theme={theme}
            phaseIndex={index}
            description={step.description}
          />
        </Suspense>
      </PreviewBoundary>
      <PreviewSteps index={index} goTo={goTo} playing={playing} />
    </div>
  )
}

function LeaguesSection(): ReactElement {
  const { theme } = useTheme()
  // THE TABLE PHASE, HELD STILL. This section is making one claim — that a
  // private league is a real table with your name in it — and the surface that
  // answers it is the product's own Leagues screen. It does not animate: a
  // second sequence running beside the one in the hero would be two things
  // moving for one point, and there is nothing here that changes over a week.
  //
  // FOUND BY ID IN THE CAPTION LIST rather than in the phase list, because the
  // caption list is eager and the phase list is not. `landingContent.test.ts`
  // holds the two to the same ids in the same order, which is what makes this a
  // lookup rather than a guess.
  const tableIndex = PREVIEW_STEPS.findIndex((entry) => entry.id === 'table')

  return (
    <section className={s.section} id="leagues" aria-labelledby="leagues-heading">
      <div className={s.shell}>
        <div className={s.sectionHead}>
          <p className={s.eyebrow}>Better with your people</p>
          <h2 id="leagues-heading">Turn the group chat into a season-long competition.</h2>
          <p className={s.sectionLead}>
            Create one private league, invite your friends, and let the weekly football provide the
            conversation.
          </p>
        </div>

        <div className={s.leagueGrid}>
          <div className={s.leagueAction}>
            <div>
              <h3>Your friends. Your table. Every week.</h3>
              <p>
                The same predictions count in the overall standings and in every Match Predictor
                league you join. No duplicate cards, and no hidden differences between them.
              </p>
            </div>
            <Link className={`${s.cta} ${s.ctaPrimary}`} to="/auth/signup">
              Create a league free
            </Link>
          </div>

          {tableIndex < 0 ? null : (
            <PreviewBoundary fallback={<PreviewFrameSkeleton variant="phone" />}>
              <Suspense fallback={<PreviewFrameSkeleton variant="phone" />}>
                <ProductPreview
                  variant="phone"
                  motion="still"
                  theme={theme}
                  phaseIndex={tableIndex}
                  description={previewStepAt(tableIndex).description}
                />
              </Suspense>
            </PreviewBoundary>
          )}
        </div>
      </div>
    </section>
  )
}

function GamesSection(): ReactElement {
  return (
    <section className={s.section} id="games" aria-labelledby="games-heading">
      <div className={s.shell}>
        <div className={s.sectionHead}>
          <p className={s.eyebrow}>Three games, one season</p>
          <h2 id="games-heading">Three ways to win the same season.</h2>
          <p className={s.sectionLead}>
            Each one is its own game with its own table, and each is joined on its own. Play one,
            play all three, or add another halfway through.
          </p>
        </div>
        <ul className={s.gameList}>
          {GAMES.map((game) => (
            <li key={game.name} className={s.gameRow}>
              <span className={`${s.gameMark} ${s.numeric}`}>{game.mark}</span>
              <div>
                <h3>{game.name}</h3>
                <p>{game.body}</p>
              </div>
              <span className={s.gameMeta}>{game.meta}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function FinalSection(): ReactElement {
  return (
    <section className={s.finalCta} id="final" aria-labelledby="final-heading">
      <div className={s.shell}>
        <div className={s.ctaPanel}>
          <p className={s.eyebrow}>Ready for the new season</p>
          <h2 id="final-heading">Make your first prediction before everyone else does.</h2>
          <p>
            Create one account, then choose the competitions and games you want. Nothing is joined
            for you.
          </p>
          <div className={s.heroActions}>
            <Link className={`${s.cta} ${s.ctaPrimary}`} to="/auth/signup">
              Create your free account
              <ChevronRightIcon size={18} />
            </Link>
            <Link className={`${s.cta} ${s.ctaSecondary}`} to="/auth/login">
              Already a member? Sign in
            </Link>
            <a className={`${s.cta} ${s.ctaQuiet}`} href="#games">
              How the games work
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function LandingFooter(): ReactElement {
  return (
    <footer className={s.footer}>
      <div className={`${s.shell} ${s.footerInner}`}>
        <span className={s.brand}>
          <span className={s.brandMark} aria-hidden="true">
            FP
          </span>
          <span className={s.brandCopy}>Football Prediction Hub</span>
        </span>
        <nav className={s.footerLinks} aria-label="Footer">
          <a href="#how">How it works</a>
          {/* ADR 0017 asks for the non-affiliation statement to be reachable
              from the footer, and the legal row is where the policies join it as
              they are published.

              A DECLARED ROUTE OF `null` DRAWS NOTHING. Privacy and Terms do not
              exist yet — no route, no redirect, no document — and a footer link
              to one would answer Not Found, which reads as a document that
              exists and was withheld. That is worse than an absent link, and it
              is the same rule the About page's own link list follows. The shape
              is ready; publishing either is a one-line change here. */}
          {LEGAL_LINKS.map(({ label, to }) =>
            to === null ? null : (
              <Link key={label} to={to}>
                {label}
              </Link>
            ),
          )}
          <Link to="/auth/login">Sign in</Link>
          <Link to="/auth/signup">Create account</Link>
        </nav>
        {/* THE POSITION ITSELF, IN ONE LINE. A visitor who never opens the page
            still reads the claim that matters, and it is the SAME sentence the
            page and the signed-in shell carry — one fact, one wording. */}
        <p className={s.footerNote}>{NON_AFFILIATION_SHORT}</p>
      </div>
    </footer>
  )
}
