import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type MotionStyle } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  Gauge,
  Goal,
  Home,
  LockKeyhole,
  Menu,
  Minus,
  Plus,
  Settings,
  ShieldCheck,
  Target,
  Trophy,
  UserRound,
  Users,
  X,
  Zap,
} from 'lucide-react'
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { CLUBS, FIXTURES, GAME_MODES, LEADERBOARD, LEAGUES } from './data'
import { PrototypeProvider, usePrototype } from './store'
import type { Club, Fixture, LeagueId } from './types'
import './premium.css'

const ease = [0.22, 1, 0.36, 1] as const

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-3" aria-label="Touchline home">
      <span className="brand-mark"><span /></span>
      <span className={compact ? 'hidden sm:block' : ''}>
        <strong className="font-display text-[15px] tracking-[.22em]">TOUCHLINE</strong>
        <small className="block text-[8px] uppercase tracking-[.3em] text-[var(--muted)]">Read the game</small>
      </span>
    </Link>
  )
}

function ClubBadge({ club, size = 'md' }: { club: Club; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={`club-badge club-badge--${size}`}
      style={{ '--club': club.colour } as React.CSSProperties}
      role="img"
      aria-label={club.name}
      title={club.name}
    >
      {club.shortName.slice(0, 2)}
    </span>
  )
}

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8%' }}
      transition={{ duration: 0.65, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function Button({
  children,
  to,
  variant = 'primary',
  onClick,
  type = 'button',
  disabled = false,
  className = '',
}: {
  children: ReactNode
  to?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  const classes = `premium-button premium-button--${variant} ${className}`
  const content = <>{children}<ArrowRight size={16} strokeWidth={2.2} /></>
  return to ? <Link to={to} className={classes}>{content}</Link> : <button type={type} onClick={onClick} className={classes} disabled={disabled}>{content}</button>
}

function useDialogA11y(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => dialogRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [open, onClose])

  return dialogRef
}

function LeagueSwitcher({ compact = false }: { compact?: boolean }) {
  const { league, setLeague } = usePrototype()
  return (
    <div className={`league-switcher ${compact ? 'league-switcher--compact' : ''}`} role="group" aria-label="Football league">
      {(Object.keys(LEAGUES) as LeagueId[]).map((id) => (
        <button key={id} onClick={() => setLeague(id)} aria-pressed={league === id}>
          <span className="league-dot" />
          {compact ? LEAGUES[id].short : LEAGUES[id].name}
        </button>
      ))}
    </div>
  )
}

function Countdown({ minimal = false }: { minimal?: boolean }) {
  const [seconds, setSeconds] = useState(18 * 3600 + 42 * 60 + 18)
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')
  if (minimal) return <span className="tabular-nums">{hours}:{minutes}:{secs}</span>
  return (
    <div className="countdown" role="timer" aria-label={`${hours} hours ${minutes} minutes until deadline`}>
      <Clock3 size={16} />
      <div><span>Predictions lock in</span><strong>{hours}:{minutes}:{secs}</strong></div>
      <div className="countdown-bar"><motion.span initial={{ width: 0 }} animate={{ width: '68%' }} transition={{ duration: 1.2, ease }} /></div>
    </div>
  )
}

function ScoreSelector({ value, onChange, label }: { value: number; onChange: (next: number) => void; label: string }) {
  return (
    <div className="score-selector" role="group" aria-label={`${label} predicted score`}>
      <button onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Decrease ${label} score`}><Minus size={14} /></button>
      <motion.input
        key={value}
        initial={{ scale: .75, opacity: .4 }}
        animate={{ scale: 1, opacity: 1 }}
        type="number"
        min="0"
        max="20"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(Math.min(20, Math.max(0, Number(event.target.value))))}
        aria-label={`${label} score`}
      />
      <button onClick={() => onChange(Math.min(20, value + 1))} aria-label={`Increase ${label} score`}><Plus size={14} /></button>
    </div>
  )
}

function FixtureCard({ fixture, demo = false, onSignUp }: { fixture: Fixture; demo?: boolean; onSignUp?: () => void }) {
  const { predictions, setPrediction, signedIn } = usePrototype()
  const score = predictions[fixture.id] ?? { home: 0, away: 0 }
  const setSide = (side: 'home' | 'away', value: number) => setPrediction(fixture.id, { ...score, [side]: value })
  return (
    <motion.article layout className="fixture-card" whileHover={{ y: -4 }} transition={{ duration: .25 }}>
      <header>
        <span>{new Date(fixture.kickoff).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        <strong>{new Date(fixture.kickoff).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong>
        <span className="fixture-status"><span /> Open</span>
      </header>
      <div className="fixture-team">
        <ClubBadge club={fixture.home} />
        <div><strong>{fixture.home.name}</strong><span>Home</span></div>
        <ScoreSelector value={score.home} onChange={(value) => setSide('home', value)} label={fixture.home.name} />
      </div>
      <div className="fixture-team">
        <ClubBadge club={fixture.away} />
        <div><strong>{fixture.away.name}</strong><span>Away</span></div>
        <ScoreSelector value={score.away} onChange={(value) => setSide('away', value)} label={fixture.away.name} />
      </div>
      <footer>
        <span><Goal size={14} /> {fixture.venue}</span>
        {demo ? <button onClick={() => signedIn ? undefined : onSignUp?.()}>Save prediction <ChevronRight size={14} /></button> : <span className="saved-state"><Check size={13} /> Auto-saved</span>}
      </footer>
    </motion.article>
  )
}

function SignUpPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useDialogA11y(open, onClose)
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="signup-title" className="signup-modal" initial={{ opacity: 0, y: 30, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: .96 }} transition={{ ease }} onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
            <span className="modal-icon"><Trophy /></span>
            <p className="eyebrow">Your call is in</p>
            <h2 id="signup-title">Make it count.</h2>
            <p>Create your free Touchline account to enter this game week, track every result and take your place in the table.</p>
            <Button to="/sign-up" className="w-full justify-center">Create free account</Button>
            <Link to="/sign-in" className="modal-signin">Already playing? Sign in</Link>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

const PUBLIC_LINKS = [
  ['How it works', '/how-it-works'],
  ['Game modes', '/game-modes'],
  ['Fixtures', '/fixtures'],
  ['Leaderboard', '/app/leaderboards'],
] as const

function PublicNav() {
  const [open, setOpen] = useState(false)
  const closeMenu = () => setOpen(false)
  const menuRef = useDialogA11y(open, closeMenu)
  return (
    <header className="public-nav">
      <div className="nav-inner">
        <Brand />
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary navigation">
          {PUBLIC_LINKS.map(([label, path]) => <NavLink key={path} to={path}>{label}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/sign-in" className="nav-signin">Sign in</Link>
          <Button to="/sign-up">Join now</Button>
        </div>
        <button className="mobile-menu-button lg:hidden" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-menu" aria-label="Open menu"><Menu /></button>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.div ref={menuRef} tabIndex={-1} id="mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation menu" className="mobile-menu" initial={{ opacity: 0, clipPath: 'circle(0% at 90% 5%)' }} animate={{ opacity: 1, clipPath: 'circle(150% at 90% 5%)' }} exit={{ opacity: 0, clipPath: 'circle(0% at 90% 5%)' }} transition={{ duration: .65, ease }}>
            <div className="flex items-center justify-between"><Brand /><button onClick={closeMenu} aria-label="Close menu"><X /></button></div>
            <nav>{PUBLIC_LINKS.map(([label, path], index) => <motion.div key={path} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .12 + index * .06 }}><Link to={path} onClick={closeMenu}><span>0{index + 1}</span>{label}<ArrowRight /></Link></motion.div>)}</nav>
            <Button to="/sign-up" className="w-full justify-center">Start predicting</Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}

function LandingPage() {
  const { league } = usePrototype()
  const fixtures = FIXTURES.filter((fixture) => fixture.leagueId === league)
  const [prompt, setPrompt] = useState(false)
  const [fixtureIndex, setFixtureIndex] = useState(0)
  const activeFixture = fixtures[fixtureIndex % fixtures.length]
  return (
    <div className="public-page">
      <PublicNav />
      <main>
        <section className="hero-section">
          <div className="hero-grid" aria-hidden="true" />
          <motion.div className="hero-orbit" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 80, ease: 'linear' }} aria-hidden="true" />
          <div className="hero-content">
            <Reveal><p className="eyebrow"><span className="live-dot" /> Game week 26 is open</p></Reveal>
            <motion.h1 aria-label="Prove you know football." initial={{ opacity: 0, y: 38 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .85, ease }}>
              Prove you know<br /><em>football.</em>
            </motion.h1>
            <Reveal delay={.12}><p className="hero-copy">Predict every match. Survive every game week. Become champion—and make sure your mates hear about it.</p></Reveal>
            <Reveal delay={.2} className="hero-actions"><Button to="/sign-up">Start predicting</Button><Button to="/fixtures" variant="secondary">This week’s fixtures</Button></Reveal>
            <Reveal delay={.28}><div className="hero-proof"><div className="avatar-stack"><span>MR</span><span>CF</span><span>AK</span><span>+</span></div><p><strong>26,280</strong> supporters playing<br /><span>184,302 predictions this week</span></p></div></Reveal>
          </div>
          <motion.div className="hero-fixture-panel" initial={{ opacity: 0, x: 50, rotate: 1.5 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ duration: .9, delay: .2, ease }}>
            <div className="panel-heading"><div><span>Live game week</span><strong>{LEAGUES[league].name}</strong></div><LeagueSwitcher compact /></div>
            <Countdown />
            {activeFixture ? <AnimatePresence mode="wait"><motion.div key={activeFixture.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}><FixtureCard fixture={activeFixture} demo onSignUp={() => setPrompt(true)} /></motion.div></AnimatePresence> : null}
            <div className="panel-pagination"><span><b>{String(fixtureIndex + 1).padStart(2, '0')}</b> / {String(fixtures.length).padStart(2, '0')} fixtures</span><div><button onClick={() => setFixtureIndex((fixtureIndex - 1 + fixtures.length) % fixtures.length)} aria-label="Previous fixture"><ArrowDown className="rotate-90" /></button><button onClick={() => setFixtureIndex((fixtureIndex + 1) % fixtures.length)} aria-label="Next fixture"><ArrowDown className="-rotate-90" /></button></div></div>
          </motion.div>
          <a href="#how" className="scroll-cue"><span>Scroll to explore</span><ArrowDown size={17} /></a>
        </section>

        <section className="signal-strip" aria-label="Community statistics">
          {[['26K+', 'active players'], ['184K', 'picks this week'], ['61%', 'average accuracy'], ['42', 'private leagues formed today']].map(([number, label]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}
        </section>

        <section id="how" className="section-shell how-section">
          <Reveal><div className="section-heading"><div><p className="eyebrow">How it works</p><h2>Three steps.<br />Endless debate.</h2></div><p>Nothing to study. Nothing to buy. Just your football judgement against everyone else’s.</p></div></Reveal>
          <div className="steps-grid">
            {(
              [
                ['01', 'Choose your league', 'Premier League or Scottish Premiership. Add the other whenever you fancy it.', ShieldCheck],
                ['02', 'Make your calls', 'Predict each score, select your survivor and back yourself head to head.', Target],
                ['03', 'Own the table', 'Earn points, climb rankings and collect proof for the group chat.', Trophy],
              ] satisfies [string, string, string, LucideIcon][]
            ).map(([number, title, copy, Icon], index) => (
              <Reveal key={String(title)} delay={index * .08}><article className="step-card"><span>{String(number)}</span><Icon size={26} /><h3>{String(title)}</h3><p>{String(copy)}</p></article></Reveal>
            ))}
          </div>
        </section>

        <section className="modes-section">
          <div className="section-shell">
            <Reveal><div className="section-heading light"><div><p className="eyebrow">Three ways to win</p><h2>Know the score.<br />Feel the pressure.</h2></div><Button to="/game-modes" variant="secondary">Explore game modes</Button></div></Reveal>
            <div className="mode-showcase">
              {GAME_MODES.map((mode, index) => (
                <Reveal key={mode.id} delay={index * .08}><motion.article className="mode-card" whileHover={{ y: -8 }} style={{ '--mode-accent': mode.accent } as MotionStyle}>
                  <div className="mode-index">0{index + 1}</div><div className="mode-icon">{index === 0 ? <Target /> : index === 1 ? <Flame /> : <Trophy />}</div><p className="eyebrow">{mode.eyebrow}</p><h3>{mode.name}</h3><p>{mode.description}</p><div className="mode-rule"><Check size={14} />{mode.rule}</div><Link to="/sign-up">Play {mode.name}<ArrowRight size={15} /></Link>
                </motion.article></Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section-shell competition-preview">
          <Reveal><div className="section-heading"><div><p className="eyebrow">The competition</p><h2>Form is temporary.<br />The table remembers.</h2></div><p>Live ranks, weekly rivalries and enough data to explain exactly why you are—or are not—top.</p></div></Reveal>
          <div className="competition-grid">
            <Reveal><LeaderboardCard /></Reveal>
            <Reveal delay={.08}><div className="rival-card"><div className="rival-card__top"><span>Next head-to-head</span><b>GW 26</b></div><div className="rival-versus"><div><span className="large-avatar">JA</span><strong>You</strong><small>4th · W W D</small></div><em>VS</em><div><span className="large-avatar opponent">TM</span><strong>Theo M.</strong><small>7th · W L W</small></div></div><div className="rival-footer"><span><Zap size={14} /> 2 places separate you</span><Link to="/app/championship">View matchup <ChevronRight size={14} /></Link></div></div></Reveal>
          </div>
        </section>

        <section className="testimonials section-shell">
          <Reveal><p className="eyebrow">From the terraces</p><blockquote>“It has completely changed Saturday. Every late goal now comes with six messages and at least one accusation.”</blockquote><div className="quote-author"><span className="large-avatar">EM</span><p><strong>Erin M.</strong><br />Hearts supporter · Edinburgh</p></div></Reveal>
        </section>

        <section className="final-cta"><div className="final-cta__grid" /><Reveal><Brand /><h2>Your football knowledge.<br /><em>On the record.</em></h2><p>Free to play. Two leagues. Three ways to win.</p><Button to="/sign-up">Make your first prediction</Button></Reveal></section>
      </main>
      <PublicFooter />
      <SignUpPrompt open={prompt} onClose={() => setPrompt(false)} />
    </div>
  )
}

function LeaderboardCard() {
  return <div className="leaderboard-card"><header><div><span>Global predictor</span><strong>Top form</strong></div><span className="leaderboard-period">Game week 26</span></header><div className="leaderboard-list">{LEADERBOARD.slice(0, 4).map((player) => <div key={player.name} className="leader-row"><span className="rank">{String(player.rank).padStart(2, '0')}</span><span className="mini-avatar">{player.avatar}</span><div><strong>{player.name}</strong><small>{player.club}</small></div><div className="leader-points"><strong>{player.points}</strong><span>{player.movement > 0 ? `↑ ${player.movement}` : player.movement < 0 ? `↓ ${Math.abs(player.movement)}` : '—'}</span></div></div>)}</div><Link to="/app/leaderboards">View full leaderboard <ArrowRight size={15} /></Link></div>
}

function PublicFooter() {
  return <footer className="public-footer"><Brand /><div><Link to="/how-it-works">How it works</Link><Link to="/game-modes">Game modes</Link><Link to="/fixtures">Fixtures</Link><Link to="/sign-in">Sign in</Link></div><p>© 2028 Touchline. Football predictions, never betting.</p></footer>
}

function FixturesPage() {
  const { league } = usePrototype()
  const [prompt, setPrompt] = useState(false)
  const fixtures = FIXTURES.filter((fixture) => fixture.leagueId === league)
  return <PublicLayout><section className="inner-hero"><p className="eyebrow">Game week {LEAGUES[league].week}</p><h1>This week’s fixtures.</h1><p>Try your score calls now. Create an account only when you are ready to enter.</p><LeagueSwitcher /></section><section className="fixtures-layout"><aside><Countdown /><div className="rule-note"><Target /><div><strong>Predictor scoring</strong><p>3 points for the exact score. 1 for the correct result. Nothing for a miss.</p></div></div></aside><div className="fixture-list">{fixtures.map((fixture) => <FixtureCard key={fixture.id} fixture={fixture} demo onSignUp={() => setPrompt(true)} />)}<Button onClick={() => setPrompt(true)} className="w-full justify-center">Enter these predictions</Button></div></section><SignUpPrompt open={prompt} onClose={() => setPrompt(false)} /></PublicLayout>
}

function PublicLayout({ children }: { children: ReactNode }) { return <div className="public-page"><PublicNav /><main className="public-inner">{children}</main><PublicFooter /></div> }

function InfoPage({ mode }: { mode: 'how' | 'modes' }) {
  return <PublicLayout><section className="inner-hero"><p className="eyebrow">{mode === 'how' ? 'No learning curve' : 'Choose your pressure'}</p><h1>{mode === 'how' ? 'Football knowledge, scored.' : 'Three ways to prove it.'}</h1><p>{mode === 'how' ? 'Join in under two minutes, predict the real fixtures and see where your judgement stands.' : 'Play one mode or all three. Every format rewards a different kind of football brain.'}</p></section>{mode === 'how' ? <section className="editorial-steps">{['Choose your competition', 'Make predictions before the deadline', 'Score points and climb the table'].map((title, index) => <Reveal key={title}><article><span>0{index + 1}</span><h2>{title}</h2><p>{index === 0 ? 'Pick England or Scotland. You can add another competition later.' : index === 1 ? 'Touch-friendly controls, automatic saving and a clear lock time on every call.' : 'Follow every result live, compare with friends and carry your form into the next week.'}</p></article></Reveal>)}</section> : <section className="mode-detail-grid">{GAME_MODES.map((game, index) => <article key={game.id}><span>0{index + 1}</span><div className="mode-icon">{index === 0 ? <Target /> : index === 1 ? <Flame /> : <Trophy />}</div><p className="eyebrow">{game.eyebrow}</p><h2>{game.name}</h2><p>{game.description}</p><strong>{game.rule}</strong><Button to="/sign-up">Join this mode</Button></article>)}</section>}</PublicLayout>
}

function AuthPage({ kind }: { kind: 'signup' | 'signin' | 'forgot' }) {
  const navigate = useNavigate()
  const { signIn } = usePrototype()
  const [error, setError] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (kind === 'signup' && String(form.get('name')).trim().length < 2) { setError('Enter a display name with at least two characters.'); return }
    if (!String(form.get('email')).includes('@')) { setError('Enter a valid email address.'); return }
    if (kind !== 'forgot' && String(form.get('password')).length < 8) { setError('Use at least eight characters for your password.'); return }
    if (kind === 'signup') {
      navigate(`/verify-email?email=${encodeURIComponent(String(form.get('email')))}`)
      return
    }
    if (kind === 'forgot') {
      navigate(`/reset-sent?email=${encodeURIComponent(String(form.get('email')))}`)
      return
    }
    signIn()
    navigate('/app')
  }
  return <div className="auth-page"><div className="auth-brand"><Brand /></div><div className="auth-art"><div className="auth-art__pitch" /><div className="auth-quote"><p>“The table doesn’t care how confident you sounded on Friday.”</p><span>TOUCHLINE / 2028</span></div></div><main className="auth-panel"><div className="auth-form"><p className="eyebrow">{kind === 'signup' ? 'Join the competition' : kind === 'signin' ? 'Welcome back' : 'Reset access'}</p><h1>{kind === 'signup' ? 'Put your name on it.' : kind === 'signin' ? 'Back for more?' : 'No drama.'}</h1><p>{kind === 'signup' ? 'Free account. First prediction in under two minutes.' : kind === 'signin' ? 'Your fixtures and competitions are waiting.' : 'We’ll send a secure reset link to your inbox.'}</p><form onSubmit={submit} noValidate>{kind === 'signup' ? <label>Display name<input name="name" autoComplete="name" required placeholder="What should we call you?" /></label> : null}<label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>{kind !== 'forgot' ? <label>Password<input name="password" type="password" autoComplete={kind === 'signup' ? 'new-password' : 'current-password'} minLength={8} required placeholder="At least 8 characters" /></label> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}<Button type="submit" className="w-full justify-center">{kind === 'signup' ? 'Create free account' : kind === 'signin' ? 'Sign in' : 'Send reset link'}</Button></form>{kind === 'signin' ? <Link to="/forgot-password" className="text-link">Forgotten password?</Link> : null}<div className="auth-divider"><span>or continue with</span></div><button className="social-button" disabled title="Social sign-in is not connected in this prototype">G <span>Google · coming soon</span></button><p className="auth-switch">{kind === 'signup' ? <>Already playing? <Link to="/sign-in">Sign in</Link></> : <>New to Touchline? <Link to="/sign-up">Join free</Link></>}</p></div></main></div>
}

function AuthStatusPage({ kind }: { kind: 'verify' | 'created' | 'reset' }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn } = usePrototype()
  const [resent, setResent] = useState(false)
  const email = searchParams.get('email') ?? 'your email address'
  const verify = () => {
    signIn()
    navigate('/account-created')
  }
  const content = {
    verify: {
      eyebrow: 'Check your inbox',
      title: 'One last touch.',
      copy: <>We sent a verification link to <strong>{email}</strong>. Open it to secure your account and choose your competition.</>,
      action: 'I’ve verified my email',
    },
    created: {
      eyebrow: 'Account ready',
      title: 'You’re on the teamsheet.',
      copy: <>Your Touchline account is ready. Four quick choices stand between you and your first prediction.</>,
      action: 'Set up my profile',
    },
    reset: {
      eyebrow: 'Reset link sent',
      title: 'Check your email.',
      copy: <>If an account exists for <strong>{email}</strong>, a secure password-reset link is on its way.</>,
      action: 'Back to sign in',
    },
  }[kind]
  const next = kind === 'verify' ? verify : () => navigate(kind === 'created' ? '/onboarding' : '/sign-in')

  return <div className="auth-status-page"><div className="auth-status-brand"><Brand /></div><main><motion.span initial={{ scale: .7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="auth-status-icon">{kind === 'verify' ? <Bell /> : kind === 'created' ? <Trophy /> : <LockKeyhole />}</motion.span><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.copy}</p><Button onClick={next}>{content.action}</Button>{kind === 'verify' ? <button className="text-link" onClick={() => setResent(true)} disabled={resent}>{resent ? 'Verification email resent' : 'Resend verification email'}</button> : null}</main></div>
}

function OnboardingPage() {
  const navigate = useNavigate()
  const { league, setLeague } = usePrototype()
  const [step, setStep] = useState(1)
  const [modes, setModes] = useState<string[]>(['predictor'])
  const [avatar, setAvatar] = useState('JA')
  const next = () => step < 4 ? setStep(step + 1) : navigate('/app/predictor')
  return <div className="onboarding-page"><header><Brand /><span>Step {step} of 4</span></header><div className="onboarding-progress"><motion.span animate={{ width: `${step * 25}%` }} transition={{ ease }} /></div><main><AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: .35, ease }}>{step === 1 ? <><p className="eyebrow">Your competition</p><h1>Where do you know best?</h1><p>Start with one league. Join the other whenever you like.</p><div className="onboarding-options">{(Object.keys(LEAGUES) as LeagueId[]).map((id) => <button key={id} onClick={() => setLeague(id)} aria-pressed={league === id} className={league === id ? 'selected' : ''}><span className="league-emblem">{id === 'premier-league' ? 'PL' : 'SP'}</span><div><strong>{LEAGUES[id].name}</strong><span>Game week {LEAGUES[id].week} · {LEAGUES[id].players} players</span><small>Next deadline · Saturday 12:00</small></div>{league === id ? <Check /> : null}</button>)}</div></> : step === 2 ? <><p className="eyebrow">Choose your formats</p><h1>How do you want to win?</h1><p>Join one or all three. You can change this later.</p><div className="onboarding-options">{GAME_MODES.map((mode) => <button key={mode.id} onClick={() => setModes((current) => current.includes(mode.id) ? current.filter((item) => item !== mode.id) : [...current, mode.id])} aria-pressed={modes.includes(mode.id)} className={modes.includes(mode.id) ? 'selected' : ''}><span className="league-emblem">{mode.id === 'predictor' ? <Target /> : mode.id === 'last-man-standing' ? <Flame /> : <Trophy />}</span><div><strong>{mode.name}</strong><span>{mode.description}</span></div>{modes.includes(mode.id) ? <Check /> : null}</button>)}</div></> : step === 3 ? <><p className="eyebrow">Make it yours</p><h1>Your match-day identity.</h1><p>Choose a badge and switch on a useful reminder.</p><div className="profile-setup"><div className="avatar-options" role="group" aria-label="Choose an avatar">{['JA', '⚡', '11', '★'].map((option) => <button key={option} onClick={() => setAvatar(option)} aria-pressed={avatar === option} className={avatar === option ? 'selected' : ''}>{option}</button>)}</div><label>Supported club<select defaultValue={league === 'premier-league' ? 'Arsenal' : 'Celtic'}><option>Arsenal</option><option>Liverpool</option><option>Celtic</option><option>Rangers</option><option>Hearts</option></select></label><label className="toggle-line"><span><strong>Deadline reminders</strong><small>One useful nudge, three hours before lock</small></span><input type="checkbox" defaultChecked /></label></div></> : <><p className="eyebrow">You’re in</p><h1>Make the first call.</h1><p>Your Predictor entry is ready. We’ll take you straight to this week’s fixtures.</p><div className="onboarding-success"><span><Check /></span><div><strong>{LEAGUES[league].name}</strong><p>Game week {LEAGUES[league].week} · 3 predictions waiting</p></div></div></>}</motion.div></AnimatePresence><div className="onboarding-actions">{step > 1 ? <button onClick={() => setStep(step - 1)}>Back</button> : <span />}<Button onClick={next}>{step === 4 ? 'Start predicting' : 'Continue'}</Button></div></main></div>
}

const APP_NAV = [
  ['Home', '/app', Home], ['Predict', '/app/predictor', Target], ['Competitions', '/app/competitions', Trophy], ['Leaderboards', '/app/leaderboards', Gauge], ['Activity', '/app/activity', Activity], ['Profile', '/app/profile', UserRound],
] as const

function SignedInLayout() {
  const location = useLocation()
  const { signOut } = usePrototype()
  const navigate = useNavigate()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unread, setUnread] = useState(true)
  const notifications = [
    ['Predictions close in 18 hours', 'Three Premier League fixtures are waiting.'],
    ['You climbed 26 places', 'Game week 25 moved you to 184th.'],
    ['The Away End invited you', 'Join the private Championship before Friday.'],
  ]

  return <div className="signed-layout"><aside className="app-sidebar"><Brand compact /><nav>{APP_NAV.map(([label, path, Icon]) => <NavLink key={path} to={path} end={path === '/app'}><Icon size={19} /><span>{label}</span></NavLink>)}</nav><div className="sidebar-bottom"><Link to="/app/settings"><Settings size={19} /><span>Settings</span></Link><button onClick={() => { signOut(); navigate('/') }}><ArrowRight className="rotate-180" size={19} /><span>Sign out</span></button></div></aside><header className="app-topbar"><div><p>{location.pathname === '/app' ? 'Home' : APP_NAV.find(([, path]) => location.pathname.startsWith(path) && path !== '/app')?.[0] ?? 'Touchline'}</p><span>Premier League · GW 26</span></div><div className="topbar-actions"><Countdown minimal /><button aria-label="Notifications" aria-expanded={notificationsOpen} aria-controls="notification-centre" className={unread ? 'has-notification' : ''} onClick={() => setNotificationsOpen((current) => !current)}><Bell /></button><Link to="/app/profile" className="mini-avatar" aria-label="Open profile">JA</Link></div>{notificationsOpen ? <motion.section id="notification-centre" className="notification-centre" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} aria-label="Notifications"><header><div><p className="eyebrow">Notifications</p><h2>Your match-day feed</h2></div><button onClick={() => { setUnread(false); setNotificationsOpen(false) }}>Mark all read</button></header>{notifications.map(([title, copy], index) => <Link key={title} to={index === 0 ? '/app/predictor' : index === 1 ? '/app/leaderboards' : '/app/competitions'} onClick={() => setNotificationsOpen(false)}><span className="activity-icon">{index === 0 ? <Clock3 /> : index === 1 ? <ArrowDown className="rotate-180" /> : <Users />}</span><span><strong>{title}</strong><small>{copy}</small></span>{unread ? <i role="img" aria-label="Unread" /> : null}</Link>)}</motion.section> : null}</header><main className="app-main"><Routes><Route index element={<DashboardPage />} /><Route path="predictor" element={<PredictorPage />} /><Route path="last-man-standing" element={<LmsPage />} /><Route path="championship" element={<ChampionshipPage />} /><Route path="competitions" element={<CompetitionsPage />} /><Route path="leaderboards" element={<LeaderboardsPage />} /><Route path="activity" element={<ActivityPage />} /><Route path="profile" element={<ProfilePage />} /><Route path="settings" element={<SettingsPage />} /></Routes></main><nav className="mobile-bottom-nav" aria-label="App navigation">{APP_NAV.slice(0, 5).map(([label, path, Icon]) => <NavLink key={path} to={path} end={path === '/app'}><Icon /><span>{label}</span></NavLink>)}</nav></div>
}

function DashboardPage() {
  const { league, predictions } = usePrototype()
  const fixtures = FIXTURES.filter((fixture) => fixture.leagueId === league)
  const completed = fixtures.filter((fixture) => predictions[fixture.id]).length
  return <PageTransition><div className="app-page dashboard-page"><section className="dashboard-welcome"><div><p className="eyebrow">Saturday, 19 February</p><h1>Morning, Jamie.</h1><p>{completed < fixtures.length ? `${fixtures.length - completed} score calls still need you.` : 'You are ready for the weekend.'}</p></div><Countdown /></section><section className="urgent-card"><div className="urgent-card__copy"><span className="urgent-icon"><Clock3 /></span><div><p className="eyebrow">Priority action</p><h2>Finish your Predictor entry</h2><p>{completed} of {fixtures.length} fixtures complete · locks Saturday at 12:00</p></div></div><div className="completion-ring" style={{ '--progress': `${(completed / fixtures.length) * 360}deg` } as React.CSSProperties}><strong>{Math.round((completed / fixtures.length) * 100)}%</strong></div><Button to="/app/predictor">Continue predictions</Button></section><section className="dashboard-stats">{[['Current rank', '#184', '↑ 26 this week'], ['Season points', '168', '+11 last game week'], ['Exact scores', '18', 'Top 12% globally'], ['Prediction form', 'W W D W', 'Four-week record']].map(([label, value, sub]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{sub}</small></article>)}</section><div className="dashboard-grid"><section><div className="app-section-heading"><div><p className="eyebrow">Your competitions</p><h2>Everything in play</h2></div><Link to="/app/competitions">View all <ArrowRight /></Link></div><div className="active-competition-list"><CompetitionMini icon={<Target />} title="Global Predictor" status={`${completed}/${fixtures.length} predicted`} accent="green" /><CompetitionMini icon={<Flame />} title="Saturday Survivor" status="Pick pending" accent="amber" /><CompetitionMini icon={<Trophy />} title="The Away End" status="vs Theo · Sat" accent="sky" /></div></section><section><div className="app-section-heading"><div><p className="eyebrow">Friends</p><h2>Latest activity</h2></div></div><ActivityList compact /></section></div></div></PageTransition>
}

function CompetitionMini({ icon, title, status, accent }: { icon: ReactNode; title: string; status: string; accent: string }) { return <Link to={title.includes('Survivor') ? '/app/last-man-standing' : title.includes('Away') ? '/app/championship' : '/app/predictor'} className={`competition-mini ${accent}`}><span>{icon}</span><div><strong>{title}</strong><small>{status}</small></div><ChevronRight /></Link> }

function PredictorPage() {
  const { league, predictions, submitted, submitPredictions } = usePrototype()
  const fixtures = FIXTURES.filter((fixture) => fixture.leagueId === league)
  const completed = fixtures.filter((fixture) => predictions[fixture.id]).length
  const [toast, setToast] = useState(false)
  const ready = completed === fixtures.length
  const submit = () => { if (!ready) return; submitPredictions(); setToast(true); window.setTimeout(() => setToast(false), 3000) }
  return <PageTransition><div className="app-page predictor-page"><header className="predictor-header"><div><p className="eyebrow">Predictor · Game week {LEAGUES[league].week}</p><h1>Call the scores.</h1><p>3 points exact · 1 point correct result · Edit until each fixture kicks off.</p></div><LeagueSwitcher compact /></header><div className="predictor-status"><div><span>Entry progress</span><strong>{completed} / {fixtures.length}</strong></div><div className="progress-track"><motion.span animate={{ width: `${(completed / fixtures.length) * 100}%` }} /></div><span>{submitted ? <><Check /> Entry submitted</> : <><Clock3 /> Auto-saving</>}</span></div><div className="predictor-layout"><div className="fixture-list">{fixtures.map((fixture, index) => <motion.div key={fixture.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .07 }}><FixtureCard fixture={fixture} /></motion.div>)}</div><aside className="submit-panel"><Countdown /><div className="submit-summary"><p className="eyebrow">Entry summary</p><div><span>Fixtures</span><strong>{fixtures.length}</strong></div><div><span>Completed</span><strong>{completed}</strong></div><div><span>Remaining</span><strong>{fixtures.length - completed}</strong></div></div><Button onClick={submit} disabled={!ready} className="w-full justify-center">{submitted ? 'Update predictions' : ready ? 'Submit predictions' : `${fixtures.length - completed} predictions remaining`}</Button><p><LockKeyhole size={13} /> You can edit until each kick-off.</p></aside></div><AnimatePresence>{toast ? <motion.div role="status" aria-live="polite" className="success-toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}><span><Check /></span><div><strong>Predictions submitted</strong><p>Your game-week entry is on the record.</p></div></motion.div> : null}</AnimatePresence></div></PageTransition>
}

function LmsPage() {
  const { league, lmsSelection, setLmsSelection } = usePrototype()
  const fixtures = FIXTURES.filter((fixture) => fixture.leagueId === league)
  const options = fixtures.flatMap((fixture) => [{ club: fixture.home, opponent: fixture.away, home: true }, { club: fixture.away, opponent: fixture.home, home: false }])
  const [confirmed, setConfirmed] = useState(false)
  const choose = (clubId: string, selected: boolean) => { setConfirmed(false); setLmsSelection(selected ? null : clubId) }
  return <PageTransition><div className="app-page"><header className="predictor-header"><div><p className="eyebrow">Last Man Standing · Round 9</p><h1>One winner. Choose well.</h1><p>You cannot use the same club twice. A draw sends you out.</p></div><div className="survivor-count"><strong>284</strong><span>still alive</span></div></header><div className="lms-status-row"><span className="alive"><ShieldCheck /> Still alive</span><span>8 picks survived</span><Countdown minimal /></div><div className="lms-grid">{options.map(({ club: option, opponent, home }, index) => { const used = index === 3; const selected = lmsSelection === option.id; return <motion.button key={option.id} disabled={used} aria-pressed={selected} className={`lms-option ${selected ? 'selected' : ''} ${used ? 'used' : ''}`} onClick={() => choose(option.id, selected)} {...(used ? {} : { whileHover: { y: -3 } })}><div className="lms-option__top"><ClubBadge club={option} size="lg" />{selected ? <span className="selected-check"><Check /></span> : null}</div><strong>{option.name}</strong><span>{home ? 'Home' : 'Away'} vs {opponent.name}</span><div className="form-row" role="group" aria-label={`Recent form ${option.form.join(', ')}`}>{option.form.map((result, formIndex) => <i key={formIndex} className={result.toLowerCase()}>{result}</i>)}</div><footer>{used ? <><LockKeyhole /> Used in round 4</> : <><Users /> {18 + index * 4}% selected</>}</footer></motion.button> })}</div><div className="sticky-action" aria-live="polite"><div><span>Your selection</span><strong>{confirmed ? 'Selection confirmed' : lmsSelection ? Object.values(CLUBS).find((item) => item.id === lmsSelection)?.name : 'No club selected'}</strong></div><Button disabled={!lmsSelection || confirmed} onClick={() => setConfirmed(true)}>{confirmed ? 'Confirmed' : lmsSelection ? 'Confirm selection' : 'Choose a club'}</Button></div></div></PageTransition>
}

function ChampionshipPage() {
  return <PageTransition><div className="app-page"><header className="predictor-header"><div><p className="eyebrow">Predictor Championship · Match day 14</p><h1>Head to head.</h1><p>Higher prediction score wins the fixture. Three league points are waiting.</p></div><span className="match-status"><span /> Predictions hidden until lock</span></header><section className="h2h-stage"><div className="h2h-player"><span className="profile-avatar">JA</span><small>4th · Arsenal</small><h2>Jamie Anderson</h2><div className="form-row"><i className="w">W</i><i className="w">W</i><i className="d">D</i><i className="w">W</i><i className="l">L</i></div></div><div className="h2h-centre"><span>Match day 14</span><strong>VS</strong><Countdown minimal /></div><div className="h2h-player"><span className="profile-avatar opponent">TM</span><small>7th · Newcastle</small><h2>Theo Martin</h2><div className="form-row"><i className="w">W</i><i className="l">L</i><i className="w">W</i><i className="d">D</i><i className="w">W</i></div></div></section><div className="championship-grid"><LeaderboardCard /><section className="playoff-card"><header><div><p className="eyebrow">Season route</p><h2>Playoff picture</h2></div><Trophy /></header><div className="qualification-line"><span>Top four qualify</span><b>12 matches left</b></div>{[['1', 'Maya R.', '31'], ['2', 'Callum F.', '29'], ['3', 'Aisha K.', '28'], ['4', 'You', '26'], ['5', 'Erin M.', '24']].map(([rank, name, points]) => <div key={name} className={`playoff-row ${name === 'You' ? 'you' : ''}`}><span>{rank}</span><strong>{name}</strong><b>{points} pts</b></div>)}</section></div></div></PageTransition>
}

function CreateCompetitionDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (name: string) => void }) {
  const dialogRef = useDialogA11y(open, onClose)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('competition-name')).trim()
    if (name) onCreated(name)
  }
  return <AnimatePresence>{open ? <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}><motion.div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="competition-dialog-title" className="signup-modal competition-dialog" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close"><X /></button><p className="eyebrow">Private competition</p><h2 id="competition-dialog-title">Create your league.</h2><p>Invite friends with a private code and settle the season properly.</p><form onSubmit={submit}><label>Competition name<input name="competition-name" required minLength={3} placeholder="e.g. Saturday Regulars" /></label><label>Game mode<select name="game-mode"><option>Predictor</option><option>Last Man Standing</option><option>Predictor Championship</option></select></label><label>Participant limit<select name="participant-limit"><option>20 players</option><option>40 players</option><option>100 players</option></select></label><Button type="submit" className="w-full justify-center">Create competition</Button></form></motion.div></motion.div> : null}</AnimatePresence>
}

function CompetitionsPage() {
  const [tab, setTab] = useState<'active' | 'discover' | 'completed' | 'invite'>('active')
  const [createOpen, setCreateOpen] = useState(false)
  const [createdName, setCreatedName] = useState('')
  const [inviteJoined, setInviteJoined] = useState(false)
  const create = (name: string) => { setCreatedName(name); setCreateOpen(false); setTab('active') }
  const joinInvite = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setInviteJoined(true) }
  const tabs = [['active', 'Active'], ['discover', 'Discover'], ['completed', 'Completed'], ['invite', 'Invite code']] as const
  return <PageTransition><div className="app-page"><header className="predictor-header"><div><p className="eyebrow">Competitions</p><h1>Find your crowd.</h1><p>Global tables, private leagues and every game format in one place.</p></div><Button onClick={() => setCreateOpen(true)}>Create private league</Button></header><div className="competition-tabs" role="tablist" aria-label="Competition views">{tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>{createdName && tab === 'active' ? <div className="inline-success" role="status"><Check /> <span><strong>{createdName}</strong> was created. Invite code: <b>TOUCH-28</b></span></div> : null}{tab === 'invite' ? <section className="invite-code-panel"><p className="eyebrow">Private invitation</p><h2>Enter an invite code.</h2><p>Codes are case-insensitive and usually shared by the competition organiser.</p><form onSubmit={joinInvite}><label><span className="sr-only">Invite code</span><input aria-label="Invite code" required minLength={6} placeholder="TOUCH-28" /></label><Button type="submit">Join competition</Button></form>{inviteJoined ? <p role="status" className="inline-success"><Check /> Invite accepted. The competition is now in Active.</p> : null}</section> : tab === 'completed' ? <section className="empty-state"><Trophy /><p className="eyebrow">Completed competitions</p><h2>Your next trophy starts here.</h2><p>Completed competitions and season records will collect here once results are final.</p><Button onClick={() => setTab('discover')}>Discover competitions</Button></section> : <div className="competition-card-grid">{GAME_MODES.map((mode, index) => <article key={mode.id} className="competition-card"><div className="competition-card__visual"><span>{index === 0 ? <Target /> : index === 1 ? <Flame /> : <Trophy />}</span><b>{index === 0 ? '26,280' : index === 1 ? '1,842' : '20'} players</b></div><p className="eyebrow">{index === 2 ? 'Private league' : tab === 'discover' ? 'Open to join' : 'Global competition'}</p><h2>{index === 0 ? 'Premier Predictor' : index === 1 ? 'Saturday Survivor' : 'The Away End'}</h2><p>{mode.description}</p><div className="competition-meta"><span><CalendarDays /> GW {26 - index}</span><span><Users /> {index === 2 ? '14 / 20' : 'Open'}</span></div><Link to={index === 0 ? '/app/predictor' : index === 1 ? '/app/last-man-standing' : '/app/championship'}>{tab === 'discover' ? 'Join competition' : 'Open competition'} <ArrowRight /></Link></article>)}</div>}<CreateCompetitionDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={create} /></div></PageTransition>
}

function LeaderboardsPage() {
  const rows = [...LEADERBOARD, { rank: 184, name: 'Jamie Anderson', club: 'Arsenal', points: 142, accuracy: 57, streak: 4, movement: 26, avatar: 'JA' }]
  const [mode, setMode] = useState('Predictor')
  return <PageTransition><div className="app-page"><header className="predictor-header"><div><p className="eyebrow">Leaderboards</p><h1>Know your place.</h1><p>Global form, friends and every competition you have entered.</p></div></header><div className="filter-row"><div role="group" aria-label="Game mode">{['Predictor', 'Last Man Standing', 'Championship'].map((label) => <button key={label} aria-pressed={mode === label} className={mode === label ? 'active' : ''} onClick={() => setMode(label)}>{label}</button>)}</div><label className="filter-select"><span className="sr-only">League</span><select defaultValue="Premier League"><option>Premier League</option><option>Scottish Premiership</option></select><ChevronDown /></label><label className="filter-select"><span className="sr-only">Period</span><select defaultValue="Game week 26"><option>Game week 26</option><option>February</option><option>Season</option><option>Friends</option></select><ChevronDown /></label></div><p className="table-context" aria-live="polite">Showing {mode} · global standings</p><div className="full-table"><header><span>Rank</span><span>Player</span><span>Accuracy</span><span>Streak</span><span>Points</span></header>{rows.map((player) => <div key={player.name} className={player.name.includes('Jamie') ? 'current-user' : ''}><span className="table-rank">{player.rank}</span><span className="table-player"><i className="mini-avatar">{player.avatar}</i><span><strong>{player.name}</strong><small>{player.club}</small></span></span><span>{player.accuracy}%</span><span><Flame size={14} /> {player.streak}</span><strong>{player.points} <small className={player.movement >= 0 ? 'up' : 'down'}>{player.movement > 0 ? `↑${player.movement}` : player.movement}</small></strong></div>)}</div></div></PageTransition>
}

function ActivityList({ compact = false }: { compact?: boolean }) {
  const items = [['Maya climbed to #1', 'Exact 2–1 call at Anfield', '8m'], ['Callum survived round 8', 'Celtic won 3–0', '24m'], ['The Away End invited you', 'Private Championship', '1h'], ['You gained 26 places', '11 points in game week 25', '2h']]
  return <div className={`activity-list ${compact ? 'compact' : ''}`}>{items.map(([title, copy, time], index) => <div key={title}><span className="activity-icon">{index === 0 ? <Crown /> : index === 1 ? <Flame /> : index === 2 ? <Users /> : <ArrowDown className="rotate-180" />}</span><div><strong>{title}</strong><p>{copy}</p></div><time>{time}</time></div>)}</div>
}

function ActivityPage() { return <PageTransition><div className="app-page narrow-app-page"><header className="predictor-header"><div><p className="eyebrow">Activity</p><h1>Your football week.</h1><p>Results, rivals, invitations and rank changes worth knowing about.</p></div><Link className="icon-button" aria-label="Notification settings" to="/app/settings"><Bell /></Link></header><ActivityList /></div></PageTransition> }

function ProfilePage() {
  return <PageTransition><div className="app-page"><section className="profile-hero"><div className="profile-identity"><span className="profile-avatar">JA</span><div><p className="eyebrow">Member since August 2027</p><h1>Jamie Anderson</h1><p>Arsenal · Edinburgh</p></div></div><Button to="/app/settings" variant="secondary">Edit profile</Button></section><section className="profile-stat-grid">{[['184', 'Global rank'], ['412', 'Total predictions'], ['18', 'Exact scores'], ['57%', 'Accuracy'], ['4', 'Trophies']].map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</section><div className="profile-grid"><section className="trophy-cabinet"><div className="app-section-heading"><div><p className="eyebrow">Cabinet</p><h2>Honours</h2></div></div><div>{[['GW', 'Game-week winner', 'Oct 2027'], ['LMS', 'Final eight', 'Dec 2027'], ['H2H', 'Playoff qualifier', '2027'], ['5X', 'Five exact scores', 'Feb 2028']].map(([icon, title, date]) => <article key={title}><span>{icon}</span><strong>{title}</strong><small>{date}</small></article>)}</div></section><section className="form-card"><p className="eyebrow">Recent form</p><h2>Trending up</h2><div className="profile-chart" role="img" aria-label="Recent form trend rising over six game weeks"><span style={{ height: '30%' }} /><span style={{ height: '48%' }} /><span style={{ height: '42%' }} /><span style={{ height: '68%' }} /><span style={{ height: '82%' }} /><span style={{ height: '74%' }} /></div><p>Top 12% over the last six game weeks.</p></section></div></div></PageTransition>
}

function SettingsPage() {
  const [status, setStatus] = useState('')
  return <PageTransition><div className="app-page narrow-app-page"><header className="predictor-header"><div><p className="eyebrow">Settings</p><h1>Your account.</h1><p>Keep reminders useful and your profile under control.</p></div></header><section className="settings-card"><h2>Notifications</h2>{[['Deadline reminders', 'Three hours before predictions lock'], ['Results and rank changes', 'A compact game-week summary'], ['Competition invitations', 'When a friend adds you'], ['Product updates', 'Occasional Touchline news']].map(([title, copy], index) => <label key={title}><span><strong>{title}</strong><small>{copy}</small></span><input type="checkbox" defaultChecked={index < 3} /></label>)}</section><section className="settings-card"><h2>Account</h2><button onClick={() => setStatus('A secure email-change link was sent.')}>Change email <ChevronRight /></button><button onClick={() => setStatus('A secure password-reset link was sent.')}>Change password <ChevronRight /></button><button className="danger" onClick={() => setStatus('Account deletion is disabled in this prototype.')}>Delete account <ChevronRight /></button>{status ? <p className="settings-status" role="status">{status}</p> : null}</section></div></PageTransition>
}

function PageTransition({ children }: { children: ReactNode }) { return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .35, ease }}>{children}</motion.div> }

function PremiumRoutes() {
  return <Routes><Route path="/" element={<LandingPage />} /><Route path="/how-it-works" element={<InfoPage mode="how" />} /><Route path="/game-modes" element={<InfoPage mode="modes" />} /><Route path="/fixtures" element={<FixturesPage />} /><Route path="/sign-up" element={<AuthPage kind="signup" />} /><Route path="/sign-in" element={<AuthPage kind="signin" />} /><Route path="/forgot-password" element={<AuthPage kind="forgot" />} /><Route path="/verify-email" element={<AuthStatusPage kind="verify" />} /><Route path="/account-created" element={<AuthStatusPage kind="created" />} /><Route path="/reset-sent" element={<AuthStatusPage kind="reset" />} /><Route path="/onboarding" element={<OnboardingPage />} /><Route path="/app/*" element={<SignedInLayout />} /><Route path="/auth/signup" element={<Navigate to="/sign-up" replace />} /><Route path="/auth/login" element={<Navigate to="/sign-in" replace />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>
}

export function PremiumApp() {
  return <PrototypeProvider><BrowserRouter basename="/preview"><MotionConfig reducedMotion="user"><AnimatePresence mode="wait"><PremiumRoutes /></AnimatePresence></MotionConfig></BrowserRouter></PrototypeProvider>
}
