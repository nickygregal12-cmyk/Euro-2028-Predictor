import { useState, type ReactNode } from 'react'
import styles from './ComponentsPreview.module.css'
import {
  Button,
  TextInput,
  EmptyState,
  PageShell,
  type NavKey,
  Alert,
  Toast,
  Skeleton,
  Modal,
  ConfirmModal,
  ProgressBar,
  StatusBadge,
  ScoreInput,
  TeamFlag,
  JokerButton,
  JokerCounter,
  MatchCard,
  GroupTable,
  ThirdPlaceTable,
  TieResolver,
  type JokerButtonState,
  type TieResolverTeam,
} from '../design-system'
import { InfoIcon } from '../design-system/icons'

// Sample data — real flag-icons codes so the outline is visible on white-heavy
// flags (England). This is a dev harness only; no domain logic here.
const ENG = { name: 'England', countryCode: 'gb-eng' }
const SCO = { name: 'Scotland', countryCode: 'gb-sct' }
const WAL = { name: 'Wales', countryCode: 'gb-wls' }
const ESP = { name: 'Spain', countryCode: 'es' }
const FRA = { name: 'France', countryCode: 'fr' }
const GER = { name: 'Germany', countryCode: 'de' }
const ITA = { name: 'Italy', countryCode: 'it' }
const POR = { name: 'Portugal', countryCode: 'pt' }

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.stack}>{children}</div>
    </section>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <span className={styles.label}>{children}</span>
}

function ScoreInputDemo() {
  const [v, setV] = useState<number | null>(2)
  return <ScoreInput value={v} ariaLabel="Home score" onChange={setV} />
}

// Home exists as a stub; every other section is not built yet and routes to a
// "coming soon" EmptyState (per the design-system brief).
const COMING_SOON: Record<Exclude<NavKey, 'home'>, string> = {
  predict: 'Predict',
  league: 'League',
  more: 'More',
}

function PageShellDemo() {
  const [active, setActive] = useState<NavKey>('home')
  return (
    <div className={styles.shellFrame}>
      <PageShell
        title={active === 'home' ? 'Home' : COMING_SOON[active]}
        active={active}
        onNavigate={setActive}
      >
        {active === 'home' ? (
          <EmptyState
            icon={<InfoIcon size={22} />}
            title="Welcome to the predictor"
            description="Pick a tab below. Sections that aren't built yet show a coming-soon state."
          />
        ) : (
          <EmptyState
            title={`${COMING_SOON[active]} — coming soon`}
            description="This section arrives in a later tier of the build plan."
          />
        )}
      </PageShell>
    </div>
  )
}

function ModalDemo() {
  const [plainOpen, setPlainOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  return (
    <div className={styles.row}>
      <Button variant="secondary" onClick={() => setPlainOpen(true)}>
        Open modal
      </Button>
      <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
        Leave league…
      </Button>
      <Modal
        open={plainOpen}
        onClose={() => setPlainOpen(false)}
        title="How scoring works"
        footer={
          <Button variant="primary" onClick={() => setPlainOpen(false)}>
            Got it
          </Button>
        }
      >
        Exact score earns 5 points, correct result earns 3. Jokers double a
        match's points.
      </Modal>
      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Leave this league?"
        confirmLabel="Leave league"
        destructive
      >
        You'll lose your place on the table and can only rejoin with a new
        invite.
      </ConfirmModal>
    </div>
  )
}

function ToastDemo() {
  const [open, setOpen] = useState(true)
  return (
    <div className={styles.stack}>
      {open ? (
        <Toast variant="success" message="Prediction saved." onDismiss={() => setOpen(false)} />
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Show toast
        </Button>
      )}
    </div>
  )
}

function TextInputDemo() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  return (
    <div className={styles.stack}>
      <TextInput
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextInput
        label="Display name"
        hint="Shown on league tables."
        value=""
        onChange={() => {}}
      />
      <TextInput
        label="Password"
        type="password"
        placeholder="••••••••"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      <TextInput
        label="Email"
        type="email"
        value="not-an-email"
        onChange={() => {}}
        error="Enter a valid email address."
      />
    </div>
  )
}

function JokerToggleDemo() {
  const [state, setState] = useState<JokerButtonState>('available')
  return (
    <JokerButton state={state} onToggle={() => setState((s) => (s === 'available' ? 'on' : 'available'))} />
  )
}

function EditableCardDemo() {
  const [home, setHome] = useState<number | null>(2)
  const [away, setAway] = useState<number | null>(1)
  const [joker, setJoker] = useState<'available' | 'on'>('available')
  return (
    <MatchCard
      state="editable"
      group="A"
      matchday={2}
      date="14 Jun"
      venue="Cardiff"
      venueCountryCode="gb-wls"
      home={SCO}
      away={WAL}
      homeScore={home}
      awayScore={away}
      onHomeScoreChange={setHome}
      onAwayScoreChange={setAway}
      saveStatus="saved"
      jokerState={joker}
      onToggleJoker={() => setJoker((j) => (j === 'available' ? 'on' : 'available'))}
    />
  )
}

function TieResolverDemo() {
  const teams: TieResolverTeam[] = [
    { id: 'ger', name: 'Germany', countryCode: 'de' },
    { id: 'ita', name: 'Italy', countryCode: 'it' },
  ]
  const [resolved, setResolved] = useState(false)
  return (
    <TieResolver
      title="Group A"
      reason="These teams can't be split by predicted results — in the real tournament this would come down to things like disciplinary records that can't be predicted. Choose the order you expect."
      teams={teams}
      resolved={resolved}
      saveStatus={resolved ? 'saved' : 'idle'}
      onResolve={() => setResolved(true)}
    />
  )
}

/** Every component in every state — rendered once per theme by ComponentsPreview. */
function Gallery() {
  return (
    <div className={styles.gallery}>
      <Section title="Button">
        <div className={styles.row}>
          <Label>primary</Label>
          <Button variant="primary">Save prediction</Button>
          <Button variant="primary" loading>
            Save prediction
          </Button>
          <Button variant="primary" disabled>
            Save prediction
          </Button>
        </div>
        <div className={styles.row}>
          <Label>secondary</Label>
          <Button variant="secondary">Cancel</Button>
          <Button variant="secondary" loading>
            Cancel
          </Button>
          <Button variant="secondary" disabled>
            Cancel
          </Button>
        </div>
        <div className={styles.row}>
          <Label>destructive</Label>
          <Button variant="destructive">Leave league</Button>
          <Button variant="destructive" loading>
            Leave league
          </Button>
        </div>
        <div className={styles.row}>
          <Label>full width</Label>
          <Button variant="primary" fullWidth>
            Continue
          </Button>
        </div>
      </Section>

      <Section title="TextInput">
        <TextInputDemo />
      </Section>

      <Section title="PageShell + BottomNav">
        <PageShellDemo />
      </Section>

      <Section title="ProgressBar">
        <ProgressBar value={18} max={36} label="Predictions" showValue />
        <ProgressBar value={100} max={100} label="Group A" showValue />
        <ProgressBar value={0} max={36} />
      </Section>

      <Section title="StatusBadge">
        <div className={styles.row}>
          <StatusBadge variant="locked" />
          <StatusBadge variant="live" />
          <StatusBadge variant="submitted" />
        </div>
      </Section>

      <Section title="Modal">
        <ModalDemo />
      </Section>

      <Section title="Alert">
        <Alert variant="info">Deadlines are shown in your local time.</Alert>
        <Alert variant="success" title="Predictions submitted">
          Your group-stage picks are locked in.
        </Alert>
        <Alert variant="warning">Entry closes in 2 hours — unsaved picks won't count.</Alert>
        <Alert variant="error" title="Couldn't save" onDismiss={() => {}}>
          Check your connection and try again.
        </Alert>
      </Section>

      <Section title="Toast">
        <ToastDemo />
        <Toast variant="error" message="Save failed — retry." onDismiss={() => {}} />
        <Toast variant="info" message="You're back online." />
      </Section>

      <Section title="Skeleton">
        <div className={styles.row}>
          <Skeleton width={30} height={20} radius="input" />
          <Skeleton width={120} height={16} />
          <Skeleton width={44} height={44} radius="circle" />
        </div>
        <Skeleton lines={3} />
      </Section>

      <Section title="EmptyState">
        <EmptyState
          icon={<InfoIcon size={22} />}
          title="No predictions yet"
          description="Your group-stage picks will show up here once you start."
          action={<Button variant="primary">Start predicting</Button>}
        />
        <EmptyState title="Leagues — coming soon" description="Private leagues arrive in a later update." />
      </Section>

      <Section title="TeamFlag">
        <div className={styles.row}>
          <Label>card 30×20</Label>
          <TeamFlag countryCode="gb-eng" label="England" size="card" />
          <TeamFlag countryCode="fr" label="France" size="card" />
        </div>
        <div className={styles.row}>
          <Label>table 26×17</Label>
          <TeamFlag countryCode="es" label="Spain" size="table" />
          <TeamFlag countryCode="gb-eng" label="England" size="table" />
        </div>
        <div className={styles.row}>
          <Label>venue 18×12</Label>
          <TeamFlag countryCode="gb-wls" label="Cardiff (host venue)" size="venue" />
        </div>
      </Section>

      <Section title="ScoreInput">
        <div className={styles.row}>
          <Label>editable</Label>
          <ScoreInputDemo />
          <ScoreInput value={null} ariaLabel="Empty score" onChange={() => {}} />
          <Label>locked</Label>
          <ScoreInput value={1} ariaLabel="Locked score" locked />
        </div>
      </Section>

      <Section title="JokerCounter">
        <div className={styles.row}>
          <Label>0 used</Label>
          <JokerCounter used={0} />
        </div>
        <div className={styles.row}>
          <Label>2 used</Label>
          <JokerCounter used={2} />
        </div>
        <div className={styles.row}>
          <Label>all used</Label>
          <JokerCounter used={5} />
        </div>
      </Section>

      <Section title="JokerButton">
        <div className={styles.row}>
          <Label>available</Label>
          <JokerButton state="available" />
          <Label>on</Label>
          <JokerButton state="on" />
          <Label>toggle</Label>
          <JokerToggleDemo />
        </div>
      </Section>

      <Section title="MatchCard — editable">
        <EditableCardDemo />
        <MatchCard
          state="editable"
          group="B"
          matchday={1}
          date="10 Jun"
          venue="Manchester"
          venueCountryCode="gb-eng"
          home={ENG}
          away={ESP}
          homeScore={1}
          awayScore={1}
          saveStatus="saving"
        />
        <MatchCard
          state="editable"
          group="B"
          matchday={1}
          date="10 Jun"
          venue="Dublin"
          venueCountryCode="ie"
          home={GER}
          away={ITA}
          homeScore={0}
          awayScore={2}
          saveStatus="error"
          onRetrySave={() => {}}
        />
        <MatchCard
          state="editable"
          group="C"
          matchday={1}
          date="11 Jun"
          venue="Wembley"
          venueCountryCode="gb-eng"
          home={FRA}
          away={POR}
          homeScore={2}
          awayScore={0}
          saveStatus="saved"
          jokerState="on"
          onToggleJoker={() => {}}
        />
        <MatchCard
          state="editable"
          group="C"
          matchday={1}
          date="11 Jun"
          venue="Wembley"
          venueCountryCode="gb-eng"
          home={FRA}
          away={POR}
          homeScore={2}
          awayScore={0}
          saveStatus="idle"
          showChevron
          onOpen={() => {}}
        />
      </Section>

      <Section title="MatchCard — locked">
        <MatchCard
          state="locked"
          group="A"
          matchday={1}
          date="9 Jun"
          venue="Cardiff"
          venueCountryCode="gb-wls"
          home={SCO}
          away={WAL}
          homeScore={1}
          awayScore={1}
          countdown="2d 4h"
          jokerState="available"
          onToggleJoker={() => {}}
        />
      </Section>

      <Section title="MatchCard — scored">
        <MatchCard
          state="scored"
          group="A"
          matchday={1}
          date="9 Jun"
          venue="Cardiff"
          venueCountryCode="gb-wls"
          home={SCO}
          away={WAL}
          homeScore={2}
          awayScore={1}
          result={{ home: 2, away: 1 }}
          score={{ kind: 'exact', points: 5, joker: false }}
        />
        <MatchCard
          state="scored"
          group="B"
          matchday={1}
          date="10 Jun"
          venue="Manchester"
          venueCountryCode="gb-eng"
          home={ENG}
          away={ESP}
          homeScore={2}
          awayScore={0}
          result={{ home: 3, away: 1 }}
          score={{ kind: 'correct', points: 3, joker: false }}
        />
        <MatchCard
          state="scored"
          group="C"
          matchday={1}
          date="11 Jun"
          venue="Wembley"
          venueCountryCode="gb-eng"
          home={FRA}
          away={POR}
          homeScore={0}
          awayScore={0}
          result={{ home: 2, away: 1 }}
          score={{ kind: 'wrong', points: 0, joker: false }}
        />
        <MatchCard
          state="scored"
          group="A"
          matchday={2}
          date="14 Jun"
          venue="Cardiff"
          venueCountryCode="gb-wls"
          home={SCO}
          away={GER}
          homeScore={2}
          awayScore={1}
          result={{ home: 2, away: 1 }}
          score={{ kind: 'exact', points: 10, joker: true }}
          jokerState="committed"
        />
      </Section>

      <Section title="GroupTable">
        <GroupTable
          caption="Group A"
          rows={[
            { position: 1, team: ESP, played: 3, goalDifference: 5, points: 9 },
            { position: 2, team: ITA, played: 3, goalDifference: 1, points: 4 },
            { position: 3, team: SCO, played: 3, goalDifference: -1, points: 4 },
            { position: 4, team: WAL, played: 3, goalDifference: -5, points: 1 },
          ]}
        />
      </Section>

      <Section title="ThirdPlaceTable">
        <ThirdPlaceTable
          rows={[
            { position: 1, groupLetter: 'C', team: FRA, played: 3, goalDifference: 2, points: 4 },
            { position: 2, groupLetter: 'A', team: SCO, played: 3, goalDifference: 1, points: 4 },
            { position: 3, groupLetter: 'E', team: POR, played: 3, goalDifference: 0, points: 4 },
            { position: 4, groupLetter: 'B', team: GER, played: 3, goalDifference: 0, points: 3 },
            { position: 5, groupLetter: 'D', team: ITA, played: 3, goalDifference: -1, points: 3 },
            { position: 6, groupLetter: 'F', team: ENG, played: 3, goalDifference: -3, points: 2 },
          ]}
        />
        <ThirdPlaceTable
          rows={[
            { position: 1, groupLetter: 'C', team: FRA, played: 3, goalDifference: 2, points: 4 },
            { position: 2, groupLetter: 'A', team: SCO, played: 3, goalDifference: 1, points: 4 },
            { position: 3, groupLetter: 'E', team: POR, played: 3, goalDifference: 0, points: 4 },
            { position: 4, groupLetter: 'B', team: GER, played: 3, goalDifference: 0, points: 3 },
            { position: 5, groupLetter: 'D', team: ITA, played: 3, goalDifference: 0, points: 3 },
            { position: 6, groupLetter: 'F', team: ENG, played: 3, goalDifference: -3, points: 2 },
          ]}
          tieResolutionSlot={
            <span className={styles.tieNote}>
              Germany and Italy are tied on every criterion — resolve their order to continue.
            </span>
          }
        />
      </Section>

      <Section title="TieResolver">
        <Label>pending (interactive)</Label>
        <TieResolverDemo />
        <Label>resolved</Label>
        <TieResolver
          title="Best thirds · positions 4 & 5"
          reason="These third-placed teams are level on every criterion we can predict. Choose which you expect to advance."
          teams={[
            { id: 'ned', name: 'Netherlands', countryCode: 'nl' },
            { id: 'cro', name: 'Croatia', countryCode: 'hr' },
          ]}
          resolved
          saveStatus="saved"
          onResolve={() => {}}
        />
        <Label>save failed</Label>
        <TieResolver
          title="Group D"
          reason="These teams can't be split by predicted results. Choose the order you expect."
          teams={[
            { id: 'a', name: 'Team 1', countryCode: '' },
            { id: 'b', name: 'Team 2', countryCode: '' },
            { id: 'c', name: 'Team 3', countryCode: '' },
          ]}
          resolved={false}
          saveStatus="error"
          onResolve={() => {}}
        />
      </Section>
    </div>
  )
}

/**
 * Dev-only preview at /dev/components: the whole design system, every state,
 * side by side in both themes. Not part of the shipped app.
 */
export function ComponentsPreview() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Design system — /dev/components</h1>
        <p className={styles.sub}>Every component and state, dark and light.</p>
      </header>
      <div className={styles.themes}>
        <section data-theme="dark" className={styles.panel}>
          <div className={styles.panelTag}>Dark — Night broadcast</div>
          <Gallery />
        </section>
        <section data-theme="light" className={styles.panel}>
          <div className={styles.panelTag}>Light — Daylight clean</div>
          <Gallery />
        </section>
      </div>
    </div>
  )
}
