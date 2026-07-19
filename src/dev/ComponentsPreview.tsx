import { useState, type ReactNode } from 'react'
import styles from './ComponentsPreview.module.css'
import {
  ScoreInput,
  TeamFlag,
  JokerButton,
  JokerCounter,
  MatchCard,
  GroupTable,
  ThirdPlaceTable,
  type JokerButtonState,
} from '../design-system'

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

/** Every component in every state — rendered once per theme by ComponentsPreview. */
function Gallery() {
  return (
    <div className={styles.gallery}>
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
