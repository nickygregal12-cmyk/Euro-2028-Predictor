import type { ReactElement } from 'react'
import { Link } from 'react-router'
import { useTheme } from '../../app/providers/ThemeProvider'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  MoonIcon,
  SunIcon,
} from '../../design-system/icons'
import {
  DOMESTIC_COMPETITIONS,
  EXPERIENCE_FEATURES,
  GAMES,
  HOW_STEPS,
  HUB_PREVIEW_DESCRIPTION,
  LANDING_NAV,
  LANDING_SECTION_ORDER,
  PHONE_PREVIEW_DESCRIPTION,
  PREVIEW_CONTEXT_SLOTS,
  PREVIEW_LEAGUE_ROWS,
  type LandingSectionId,
} from './landingContent'
import s from './LandingPage.module.css'

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

  return (
    <header className={s.header}>
      <div className={s.headerInner}>
        <span className={s.brand}>
          <span className={s.brandMark} aria-hidden="true">
            FP
          </span>
          <span className={s.brandCopy}>
            Football Prediction Hub
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

          <HubPreview />
        </div>
      </div>
    </section>
  )
}

/**
 * The desktop Hub preview.
 *
 * `role="img"` with a written description is the whole accessibility contract
 * here: ARIA makes an image's descendants presentational, so the invented
 * competitions, ranks and points below are described once, honestly, as a
 * picture of the product rather than announced as the visitor's own standings.
 */
function HubPreview(): ReactElement {
  return (
    <div className={s.preview} role="img" aria-label={HUB_PREVIEW_DESCRIPTION}>
      <div className={s.previewChrome}>
        <span className={s.previewDot} />
        <span className={s.previewDot} />
        <span className={s.previewDot} />
        <span className={s.previewChromeLabel}>Signed-in Hub preview</span>
      </div>
      <div className={s.previewApp}>
        <div className={s.previewRail}>
          <span className={s.brandMark}>FP</span>
          {['Hub', 'Predict', 'Leagues', 'Games', 'More'].map((item, index) => (
            <span
              key={item}
              className={index === 0 ? `${s.railItem} ${s.railItemActive}` : s.railItem}
            >
              {item.slice(0, 1)}
            </span>
          ))}
        </div>

        <div className={s.previewMain}>
          <p className={s.previewKicker}>Tuesday 4 August</p>
          <p className={s.previewTitle}>Good evening</p>
          <p className={s.previewSub}>One action needs your attention.</p>

          <div className={s.previewAction}>
            <div>
              <p className={s.previewActionMeta}>Premier League · Match Predictor</p>
              <p className={s.previewActionTitle}>Finish your Matchweek 1 picks</p>
              <p className={s.previewActionBody}>Seven saved. Three fixtures still need a score.</p>
            </div>
            <span className={`${s.cta} ${s.ctaPrimary} ${s.ctaSmall}`}>Continue</span>
          </div>

          <p className={s.previewLabel}>Your competitions</p>
          <div className={s.previewRows}>
            <PreviewRow code="PL" name="Premier League" detail="Matchweek 1 · 7/10 complete" value="14th" movement="up" />
            <PreviewRow code="SP" name="Scottish Premiership" detail="Matchweek 1 · complete" value="6th" movement="up" />
          </div>

          <p className={s.previewLabel}>Your leagues</p>
          <div className={s.previewRows}>
            <PreviewRow code="SN" name="Saturday Night League" detail="12 players" value="4th" movement="none" />
          </div>

          <p className={s.previewSave}>Predictions saved · 17:43</p>
        </div>

        {/* E.7 allows the desktop preview exactly three contextual slots —
            time-critical, live and social — so the rail renders the declared
            three and a fourth would have to be added to the authority first. */}
        <div className={s.previewContext}>
          {PREVIEW_CONTEXT_SLOTS.map((slot) => (
            <div key={slot.kind} className={s.contextSlot}>
              <p className={s.contextLabel}>
                {slot.kind === 'live' ? <span className={s.livePip} /> : null}
                {slot.label}
              </p>
              <p className={s.contextValue}>{slot.value}</p>
              <p className={s.contextDetail}>{slot.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PreviewRow({
  code,
  name,
  detail,
  value,
  movement,
}: {
  code: string
  name: string
  detail: string
  value: string
  movement: 'up' | 'down' | 'none'
}): ReactElement {
  return (
    <div className={s.previewRow}>
      <span className={s.identity}>{code}</span>
      <span className={s.previewRowCopy}>
        <strong>{name}</strong>
        <small>{detail}</small>
      </span>
      <span className={s.previewRowValue}>
        {value}
        {movement === 'up' ? <ChevronUpIcon size={14} className={s.moveUp} /> : null}
        {movement === 'down' ? <ChevronDownIcon size={14} className={s.moveDown} /> : null}
      </span>
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
  return (
    <section className={s.section} id="experience" aria-labelledby="experience-heading">
      <div className={`${s.shell} ${s.experienceGrid}`}>
        <PhonePreview />
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

/** The phone preview — a picture, for the same reason as the desktop one. */
function PhonePreview(): ReactElement {
  return (
    <div className={s.phone} role="img" aria-label={PHONE_PREVIEW_DESCRIPTION}>
      <div className={s.phoneScreen}>
        <div className={s.phoneTop}>
          <strong>Good evening</strong>
          <span className={s.avatar}>NG</span>
        </div>
        <div className={s.phoneContent}>
          <div className={s.phoneAction}>
            <p className={s.eyebrow}>Next action</p>
            <p className={s.phoneActionTitle}>Finish your Premier League picks</p>
            <p className={s.phoneActionBody}>Seven scores saved. Three fixtures still need one.</p>
            <div className={s.phoneActionFooter}>
              <span className={s.phoneDeadline}>
                Deadline
                <strong>Fri 18:30</strong>
              </span>
              <span className={`${s.cta} ${s.ctaPrimary} ${s.ctaSmall}`}>Continue</span>
            </div>
          </div>

          <p className={s.previewLabel}>Your competitions</p>
          <div className={s.previewRows}>
            <PreviewRow code="PL" name="Premier League" detail="7/10 complete" value="14th" movement="none" />
            <PreviewRow code="SP" name="Scottish Premiership" detail="Complete" value="6th" movement="none" />
          </div>
          <p className={s.previewLabel}>Your leagues</p>
          <div className={s.previewRows}>
            <PreviewRow code="SN" name="Saturday Night League" detail="12 players" value="4th" movement="none" />
          </div>
        </div>
        <div className={s.phoneNav}>
          {['Hub', 'Predict', 'Leagues', 'Games', 'More'].map((item, index) => (
            <span key={item} className={index === 0 ? s.phoneNavActive : undefined}>
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function LeaguesSection(): ReactElement {
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

          <div className={s.leaguePreview} role="img" aria-label="Preview of a private league table: five players ranked by points, with recent form and rank movement, and the signed-in player highlighted in fourth.">
            <div className={s.leagueHead}>
              <span>#</span>
              <span>Player</span>
              {/* Same class as the rows' form cell, so the head disappears with
                  the column it names rather than sliding out of register. */}
              <span className={s.leagueForm}>Last 3</span>
              <span>Pts</span>
            </div>
            {PREVIEW_LEAGUE_ROWS.map((row) => (
              <div
                key={row.position}
                className={row.isViewer ? `${s.leagueRow} ${s.leagueRowViewer}` : s.leagueRow}
              >
                <span className={s.numeric}>{row.position}</span>
                <span className={s.leaguePlayer}>
                  <span className={s.avatar}>{row.initials}</span>
                  {row.name}
                </span>
                <span className={`${s.numeric} ${s.leagueForm}`}>{row.form}</span>
                <span className={s.numeric}>{row.points}</span>
              </div>
            ))}
          </div>
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
          <Link to="/auth/login">Sign in</Link>
          <Link to="/auth/signup">Create account</Link>
        </nav>
      </div>
    </footer>
  )
}
