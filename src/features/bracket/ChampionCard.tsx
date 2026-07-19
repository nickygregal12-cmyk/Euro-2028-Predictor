import { TeamFlag } from '../../design-system'
import { TrophyIcon } from '../../design-system/icons'
import s from './ChampionCard.module.css'

export type ChampionCardProps = {
  name: string
  countryCode: string
}

/**
 * The picked champion (design-system §5). Accent-bordered card, larger flag,
 * trophy in accent green. Champion is ALWAYS accent green, never gold — gold is
 * jokers only; this card is that rule's proof case.
 */
export function ChampionCard({ name, countryCode }: ChampionCardProps) {
  return (
    <section className={s.card} aria-label={`Your champion: ${name}`}>
      <span className={s.eyebrow}>
        <TrophyIcon size={14} className={s.trophy} /> Your champion
      </span>
      <div className={s.body}>
        <TeamFlag countryCode={countryCode} label={name} size="champion" />
        <span className={s.name}>{name}</span>
      </div>
    </section>
  )
}
