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
  PlayerChip,
  StatCard,
  type JokerButtonState,
  type TieResolverTeam,
} from '../design-system'
import { InfoIcon } from '../design-system/icons'
import { PointsBreakdown } from '../features/scoring'
import type { ScoreEvent } from '../domain/tournament/scoreEvents'
import {
  RoundSwitcher,
  TieCard,
  ChampionCard,
  type RoundKey,
  type TieSide,
} from '../features/bracket'
import { PlacedJokerCard } from '../features/predict/PlacedJokerCard'
import { GoldenBootPicker } from '../features/predict/GoldenBootPicker'
import { rankLeaderboard } from '../domain/tournament/rankLeaderboard'
import { LeaderboardRow } from '../features/league/LeaderboardRow'
import { LeagueMemberRow } from '../features/leagues/LeagueMemberRow'
import { MyLeagueCard } from '../features/leagues/MyLeagueCard'
import { LeaguePreviewCard } from '../features/leagues/LeaguePreviewCard'
import { InvitePanel } from '../features/leagues/InvitePanel'
import { LoginForm } from '../features/auth/LoginForm'
import { SignUpForm } from '../features/auth/SignUpForm'
import { WelcomeScreen } from '../features/welcome/WelcomeScreen'
import { ProfileScreen } from '../features/profile/ProfileScreen'
import { StatStrip } from '../features/home/StatStrip'
import { TodayCard } from '../features/home/TodayCard'
import { CatchUpLine } from '../features/home/CatchUpLine'
import { LeagueSnapshot } from '../features/home/LeagueSnapshot'
import type { TodaySection } from '../features/home/useHomeData'

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

// Sample scored events for the Points breakdown — a plausible mid-tournament
// slice: exact scores, a jokered match (gold pill), a group order, knockout
// progression. Awards stays empty so the "0 · pending" category shows.
const SAMPLE_SCORE_EVENTS: ScoreEvent[] = [
  {
    id: 'gm1',
    category: 'group_matches',
    explanation: 'Sco 2–1 Eng · exact score',
    flag: SCO,
    points: 5,
  },
  {
    id: 'gm2',
    category: 'group_matches',
    explanation: 'Esp 3–1 Ita · correct result',
    flag: ESP,
    points: 3,
  },
  {
    id: 'gm3',
    category: 'group_matches',
    explanation: 'Fra 2–0 Ger · exact score',
    flag: FRA,
    points: 10,
    joker: true,
  },
  {
    id: 'gm4',
    category: 'group_matches',
    explanation: 'Por 0–2 Wal · wrong',
    flag: POR,
    points: 0,
  },
  {
    id: 'gp1',
    category: 'group_positions',
    explanation: 'Group A · full order correct',
    points: 13,
  },
  {
    id: 'ko1',
    category: 'knockout',
    explanation: 'Spain · reached the semi-finals',
    flag: ESP,
    points: 45,
  },
]

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

// Bracket tie sides. Real teams pre-draw have no flag (empty countryCode), same
// as the live app, so these use the placeholder-flag look throughout.
const sideEng: TieSide = { kind: 'team', teamId: 'eng', name: 'England', countryCode: 'gb-eng' }
const sideEsp: TieSide = { kind: 'team', teamId: 'esp', name: 'Spain', countryCode: 'es' }
const placeholderSide: TieSide = {
  kind: 'placeholder',
  feederRef: 'R16-3',
  label: 'Winner R16 · Newcastle tie',
}

function RoundSwitcherDemo() {
  const [active, setActive] = useState<RoundKey>('R16')
  return (
    <RoundSwitcher
      active={active}
      onSelect={setActive}
      rounds={[
        { key: 'R16', label: 'R16', picked: 8, total: 8 },
        { key: 'QF', label: 'QF', picked: 3, total: 4 },
        { key: 'SF', label: 'SF', picked: 0, total: 2 },
        { key: 'FINAL', label: 'Final', picked: 0, total: 1 },
      ]}
    />
  )
}

function TieCardPickDemo() {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <TieCard
      provenance="R16 · Winner A v Runner-up C"
      date="24 Jun"
      venue="Cardiff"
      venueCountryCode="gb-wls"
      home={sideEng}
      away={sideEsp}
      pickedTeamId={picked}
      onPick={setPicked}
    />
  )
}

// Hostile-data league members (design-system §6 hostile-data rule): 20+ members,
// longest plausible names, ties, the user mid-table, non-submitters. Ranked with
// the real domain (rankLeaderboard) so shared ranks + null-pre-results are honest.
const LEAGUE_MEMBERS = [
  { userId: 'u1', displayName: 'The Undisputed Champion Of All Groups', totalPoints: 148, latest: 22, isYou: false, hasEntry: true },
  { userId: 'u2', displayName: 'Anne-Marie Ndlovu-Okonkwo', totalPoints: 142, latest: 18, isYou: false, hasEntry: true },
  { userId: 'u3', displayName: 'Zoë Müller', totalPoints: 142, latest: 18, isYou: false, hasEntry: true },
  { userId: 'u4', displayName: 'xX_Predictor_Xx', totalPoints: 131, latest: 12, isYou: true, hasEntry: true },
  { userId: 'u5', displayName: 'Ng', totalPoints: 131, latest: 12, isYou: false, hasEntry: true },
  { userId: 'u6', displayName: "O'Sullivan", totalPoints: 96, latest: 6, isYou: false, hasEntry: true },
  { userId: 'u7', displayName: 'Al', totalPoints: 0, latest: null, isYou: false, hasEntry: false, predictedCount: 12 },
  { userId: 'u8', displayName: 'María-José da Silva', totalPoints: 0, latest: null, isYou: false, hasEntry: false, predictedCount: 0 },
]

function LeagueMembersDemo({ revealed }: { revealed: boolean }) {
  const [expanded, setExpanded] = useState<string | null>('u4')
  const ranked = rankLeagueMembersDemo(LEAGUE_MEMBERS)
  return (
    <div className={styles.leagueTable}>
      {ranked.map((m) => (
        <LeagueMemberRow
          key={m.userId}
          rank={m.rank}
          name={m.displayName}
          totalPoints={m.totalPoints}
          latestPoints={m.latest}
          isYou={m.isYou}
          movement={m.rank === 1 ? 'up' : m.userId === 'u5' ? 'down' : 'none'}
          hasEntry={m.hasEntry}
          progress={
            !m.hasEntry && !revealed ? { predicted: m.predictedCount ?? 0, total: 36 } : null
          }
          championPick={revealed && m.hasEntry ? (m.userId === 'u1' ? ESP : ENG) : undefined}
          championEliminated={revealed && m.userId === 'u2'}
          expanded={expanded === m.userId}
          onToggle={() => setExpanded((c) => (c === m.userId ? null : m.userId))}
          revealed={revealed}
          stats={{ exact: 9, correct: 14, maxLeft: 512 }}
          onProfile={() => {}}
          onHeadToHead={() => {}}
        />
      ))}
    </div>
  )
}

// Local copy of the ranking call so the demo carries the extra member fields.
function rankLeagueMembersDemo<T extends { displayName: string; totalPoints: number; isYou: boolean }>(
  rows: T[],
) {
  return rankLeaderboard(rows)
}

// Hostile-data Home fixtures for the Today card. Longest plausible team names,
// live + upcoming + full-time rows, a missing prediction.
const HOME_FIXTURE = (over: Partial<import('../features/home/useHomeData').TodayFixture> = {}) => ({
  matchId: Math.random().toString(),
  matchRef: 'GA-1',
  group: 'A',
  matchday: 1,
  home: SCO,
  away: ENG,
  kickoffAt: '2028-06-14T19:00:00Z',
  matchDate: '2028-06-14',
  prediction: { home: 2, away: 1 },
  result: null,
  live: false,
  ...over,
})

const TODAY_LIVE: TodaySection = {
  kind: 'today',
  anyLive: true,
  fixtures: [
    HOME_FIXTURE({ live: true, result: { home: 1, away: 0 }, home: SCO, away: ENG }),
    HOME_FIXTURE({ kickoffAt: '2028-06-14T16:00:00Z', home: ESP, away: ITA, prediction: null }),
    HOME_FIXTURE({ result: { home: 2, away: 2 }, home: FRA, away: GER, prediction: { home: 1, away: 2 } }),
  ],
}
const TODAY_NEXT: TodaySection = {
  kind: 'next',
  dateISO: '2028-06-09',
  fixtures: [HOME_FIXTURE({ home: WAL, away: POR, prediction: { home: 0, away: 3 } })],
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

      <Section title="Knockout bracket">
        <Label>round switcher (interactive)</Label>
        <RoundSwitcherDemo />

        <Label>tie — pick a winner (interactive)</Label>
        <TieCardPickDemo />

        <Label>tie — unpicked</Label>
        <TieCard
          provenance="R16 · Winner B v 3rd Group D"
          date="25 Jun"
          venue="Newcastle"
          venueCountryCode="gb-eng"
          home={sideEng}
          away={sideEsp}
          pickedTeamId={null}
          onPick={() => {}}
        />

        <Label>tie — picked (winner + loser)</Label>
        <TieCard
          provenance="R16 · Winner A v Runner-up C"
          date="24 Jun"
          venue="Cardiff"
          venueCountryCode="gb-wls"
          home={sideEng}
          away={sideEsp}
          pickedTeamId="eng"
          onPick={() => {}}
        />

        <Label>tie — one feeder undecided (placeholder)</Label>
        <TieCard
          provenance="QF · Winner R16-3 v Winner R16-1"
          date="30 Jun"
          venue="Wembley"
          venueCountryCode="gb-eng"
          home={placeholderSide}
          away={sideEsp}
          pickedTeamId={null}
        />

        <Label>tie — both feeders undecided (placeholders)</Label>
        <TieCard
          provenance="SF · Winner QF-1 v Winner QF-2"
          date="4 Jul"
          venue="Wembley"
          venueCountryCode="gb-eng"
          home={{ kind: 'placeholder', feederRef: 'QF-1', label: 'Winner QF · Wembley tie' }}
          away={{ kind: 'placeholder', feederRef: 'QF-2', label: 'Winner QF · Dublin tie' }}
          pickedTeamId={null}
        />

        <Label>champion card (Final, picked)</Label>
        <ChampionCard name="England" countryCode="gb-eng" />
      </Section>

      <Section title="Placed joker (Jokers overview)">
        <Label>movable — before kickoff (remove / move)</Label>
        <PlacedJokerCard
          group="A"
          matchday={1}
          date="9 Jun"
          home={ENG}
          away={ESP}
          homeScore={2}
          awayScore={1}
          committed={false}
          onRemove={() => {}}
          onMove={() => {}}
        />

        <Label>committed — after kickoff (gold, permanent)</Label>
        <PlacedJokerCard
          group="C"
          matchday={2}
          date="14 Jun"
          home={GER}
          away={ITA}
          homeScore={0}
          awayScore={0}
          committed
        />
      </Section>

      <Section title="Golden boot picker (Review · Awards)">
        <Label>empty — squads not confirmed yet</Label>
        <GoldenBootPicker
          points={25}
          query=""
          onQueryChange={() => {}}
          results={[]}
          selected={null}
          onSelect={() => {}}
          onClear={() => {}}
          emptyNote="Player search available once squads are confirmed — closer to the tournament."
        />

        <Label>with results (squads confirmed — future data)</Label>
        <GoldenBootPicker
          points={25}
          query="kane"
          onQueryChange={() => {}}
          results={[
            { id: '1', name: 'Harry Kane', teamName: 'England' },
            { id: '2', name: 'Harvey Barnes', teamName: 'England' },
          ]}
          selected={null}
          onSelect={() => {}}
          onClear={() => {}}
          emptyNote="No players match."
        />

        <Label>selected (removable chip)</Label>
        <GoldenBootPicker
          points={25}
          query=""
          onQueryChange={() => {}}
          results={[]}
          selected={{ id: '1', name: 'Harry Kane', teamName: 'England' }}
          onSelect={() => {}}
          onClear={() => {}}
          emptyNote=""
        />
      </Section>

      <Section title="Leaderboard row (League)">
        <Label>pre-results (rank dash, all level)</Label>
        <div>
          <LeaderboardRow rank={null} name="Alex Turner" points={0} />
          <LeaderboardRow rank={null} name="Jordan Blake" points={0} isYou />
          <LeaderboardRow rank={null} name="Priya Shah" points={0} />
        </div>

        <Label>ranked (shared rank on ties, current user + movement)</Label>
        <div>
          <LeaderboardRow rank={1} name="Priya Shah" points={128} movement="up" />
          <LeaderboardRow rank={2} name="Alex Turner" points={115} movement="down" />
          <LeaderboardRow rank={2} name="Jordan Blake" points={115} isYou movement="none" />
          <LeaderboardRow rank={4} name="Sam Okafor" points={98} movement="up" />
        </div>

        <Label>league rows (champion-pick flag; hostile-long name truncates)</Label>
        <div>
          <LeaderboardRow rank={1} name="Priya Shah" points={128} movement="up" championPick={ESP} />
          <LeaderboardRow
            rank={2}
            name="Maximilian von Habsburg-Lothringen"
            points={115}
            movement="down"
            championPick={FRA}
          />
          <LeaderboardRow
            rank={3}
            name="Jordan Blake"
            points={98}
            isYou
            championPick={GER}
            championEliminated
          />
        </div>
      </Section>

      <Section title="PlayerChip">
        <Label>sizes (sm / md / lg)</Label>
        <div className={styles.row}>
          <PlayerChip name="Alex Turner" size="sm" />
          <PlayerChip name="Alex Turner" size="md" />
          <PlayerChip name="Alex Turner" size="lg" />
        </div>
        <Label>current user, single-word, and hostile-long (truncates)</Label>
        <div className={styles.stack} style={{ maxWidth: 260 }}>
          <PlayerChip name="Jordan Blake" you />
          <PlayerChip name="Cristiano" />
          <PlayerChip name="Maximilian von Habsburg-Lothringen III" />
          <PlayerChip name="🦁 Leo" />
        </div>
      </Section>

      <Section title="StatCard (profile stat grid)">
        <div className={styles.statGrid}>
          <StatCard label="Points" value={128} />
          <StatCard label="Overall rank" value="#3" accent movement="up" />
          <StatCard label="Exact scores" value={7} />
          <StatCard label="Accuracy" value="61%" />
        </div>
        <Label>empty / pre-results (dashes) + tappable</Label>
        <div className={styles.statGrid}>
          <StatCard label="Points" value="—" />
          <StatCard label="Overall rank" value="—" />
          <StatCard label="Points today" value={12} accent onClick={() => {}} />
          <StatCard label="Best league" value="2nd" movement="down" />
        </div>
      </Section>

      <Section title="Points breakdown (Profile / own points)">
        <Label>mid-tournament (categories, joker pill, pending Awards)</Label>
        <PointsBreakdown events={SAMPLE_SCORE_EVENTS} defaultExpanded />
        <Label>no results yet (every category pending, total 0)</Label>
        <PointsBreakdown events={[]} />
      </Section>

      <Section title="Auth — log in (docs/auth-plan.md §3)">
        <Label>default</Label>
        <LoginForm onSubmit={() => {}} />

        <Label>submitting</Label>
        <LoginForm onSubmit={() => {}} submitting />

        <Label>error (wrong password)</Label>
        <LoginForm
          onSubmit={() => {}}
          error="That email or password isn't right. Please try again."
        />
      </Section>

      <Section title="Auth — sign up">
        <Label>default</Label>
        <SignUpForm onSubmit={() => {}} />

        <Label>submitting</Label>
        <SignUpForm onSubmit={() => {}} submitting />

        <Label>error (existing account)</Label>
        <SignUpForm
          onSubmit={() => {}}
          error="An account with this email already exists. Try logging in instead."
        />
      </Section>

      <Section title="My-league card (League hub)">
        <MyLeagueCard name="The Office Sweepstake" memberCount={14} isOwner rank={1} movement="up" onOpen={() => {}} />
        <MyLeagueCard name="The Undisputed Champions Of All Group Stages Ever" memberCount={22} isOwner={false} rank={null} onOpen={() => {}} />
        <MyLeagueCard name="Fam" memberCount={1} isOwner rank={null} onOpen={() => {}} />
      </Section>

      <Section title="Invite panel (share moment / header chip)">
        <Label>full — post-create share moment</Label>
        <InvitePanel leagueName="The Office Sweepstake" code="ABC234" mode="full" />
        <Label>chip — detail header</Label>
        <InvitePanel leagueName="The Office Sweepstake" code="ABC234" mode="chip" />
      </Section>

      <Section title="League preview (join / deep link)">
        <LeaguePreviewCard
          preview={{ id: 'x', name: 'The Office Sweepstake', memberCount: 14, ownerName: 'Priya Shah', isMember: false }}
          onJoin={() => {}}
          onDecline={() => {}}
        />
        <Label>already a member</Label>
        <LeaguePreviewCard
          preview={{ id: 'x', name: 'The Office Sweepstake', memberCount: 14, ownerName: 'Priya Shah', isMember: true }}
          onJoin={() => {}}
          onDecline={() => {}}
        />
      </Section>

      <Section title="League member rows — pre-lock (stats hidden, no champion flag)">
        <LeagueMembersDemo revealed={false} />
      </Section>

      <Section title="League member rows — post-lock (champion flags, stats revealed)">
        <LeagueMembersDemo revealed />
      </Section>

      <Section title="Profile — own, populated (full group stage of history)">
        <ProfileScreen
          kind="full"
          header={{ displayName: 'Alex Turner', isOwn: true, champion: SCO, championEliminated: false, leaguesCount: 3 }}
          stats={{ totalPoints: 148, rank: 4, exactScores: 9, correctResults: 14, scoredMatches: 30, accuracyPercent: 77 }}
          events={SAMPLE_SCORE_EVENTS}
          locked
          onViewEntry={() => {}}
        />
      </Section>

      <Section title="Profile — hostile name, champion eliminated (tombstone)">
        <ProfileScreen
          kind="full"
          header={{
            displayName: 'Maximilian von Habsburg-Lothringen III',
            isOwn: false,
            champion: SCO,
            championEliminated: true,
            leaguesCount: 1,
          }}
          stats={{ totalPoints: 96, rank: 96, exactScores: 3, correctResults: 8, scoredMatches: 24, accuracyPercent: 46 }}
          events={SAMPLE_SCORE_EVENTS}
          locked={false}
          onH2H={() => {}}
        />
      </Section>

      <Section title="Profile — new user (zero history, pre-results, tied)">
        <ProfileScreen
          kind="full"
          header={{ displayName: 'Ng', isOwn: true, champion: null, championEliminated: false, leaguesCount: 0 }}
          stats={{ totalPoints: 0, rank: null, exactScores: 0, correctResults: 0, scoredMatches: 0, accuracyPercent: null }}
          events={[]}
          locked={false}
          onEdit={() => {}}
        />
      </Section>

      <Section title="Profile — another player, pre-lock (reveal-gated hidden state)">
        <ProfileScreen
          kind="hidden"
          displayName="José Peña"
          leaguesCount={2}
          hasEntry
          lockDateLabel="9 June 2028"
        />
      </Section>

      <Section title="/welcome screen">
        <WelcomeScreen displayName="Alex" onStart={() => {}} onScoring={() => {}} />
        <Label>hostile long display name (no overflow at 360px)</Label>
        <WelcomeScreen
          displayName="Maximilian von Habsburg-Lothringen III"
          onStart={() => {}}
          onScoring={() => {}}
        />
      </Section>

      <Section title="Home — stat strip (during tournament)">
        <StatStrip
          totalPoints={148}
          pointsToday={12}
          rank={4}
          entryCount={2140}
          bestLeagueRank={1}
          hasLeague
          onPoints={() => {}}
          onToday={() => {}}
          onRank={() => {}}
          onLeague={() => {}}
        />
        <Label>pre-results / no league</Label>
        <StatStrip
          totalPoints={0}
          pointsToday={0}
          rank={null}
          entryCount={2140}
          bestLeagueRank={null}
          hasLeague={false}
          onPoints={() => {}}
          onToday={() => {}}
          onRank={() => {}}
          onLeague={() => {}}
        />
      </Section>

      <Section title="Home — Today card">
        <Label>live (cyan border) + upcoming + full-time rows</Label>
        <TodayCard section={TODAY_LIVE} onOpenMatch={() => {}} />
        <Label>no matches today → next matchday</Label>
        <TodayCard section={TODAY_NEXT} onOpenMatch={() => {}} />
        <Label>nothing scheduled</Label>
        <TodayCard section={{ kind: 'none' }} onOpenMatch={() => {}} />
      </Section>

      <Section title="Home — catch-up line + league snapshot">
        <CatchUpLine catchUp={{ pointsDelta: 18, rankDelta: null }} />
        <LeagueSnapshot
          league={{ id: 'x', name: 'The Undisputed Champions Of All Group Stages', memberCount: 22, rank: 1, gapToTop: 0, lastActivityMs: 0 }}
          onOpen={() => {}}
          onCreate={() => {}}
        />
        <LeagueSnapshot
          league={{ id: 'y', name: 'Fam', memberCount: 6, rank: 4, gapToTop: 23, lastActivityMs: 0 }}
          onOpen={() => {}}
          onCreate={() => {}}
        />
        <Label>no leagues → create prompt</Label>
        <LeagueSnapshot league={null} onOpen={() => {}} onCreate={() => {}} />
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
