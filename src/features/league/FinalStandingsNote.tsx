import { TrophyIcon } from '../../design-system/icons'
import n from './finalStandingsNote.module.css'

export function FinalStandingsNote() {
  return (
    <section className={n.note} aria-labelledby="final-standings-heading">
      <TrophyIcon size={20} className={n.icon} />
      <div>
        <h2 id="final-standings-heading" className={n.title}>Final standings</h2>
        <p className={n.copy}>
          Equal points are separated by exact scores, correct outcomes, correct knockout teams,
          a correct champion, then the closest predicted group-stage goals total. Players still
          level after all five share the position.
        </p>
      </div>
    </section>
  )
}
