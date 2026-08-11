import { useId } from 'react'
import { presentBriefing, type BriefingInput } from './briefingModel'
import styles from './BriefingPanel.module.css'

/**
 * `INNOV-016` on screen: one strip that answers "do I need to do anything
 * today?" before the player reads anything else.
 *
 * IT SITS ABOVE THE SECTIONS AND REPLACES NONE OF THEM. Next, Today and the
 * recap are where a player acts; this is the sentence that tells them whether
 * to. It carries no link of its own for that reason — everything it mentions is
 * a tap away in the section beneath it, and a second route to the same place
 * would just be a second thing to keep in step.
 *
 * IT RENDERS NOTHING WHEN THERE IS NOTHING. A quiet briefing is not a panel
 * saying "0 matches, 0 to do": it is no panel.
 *
 * ONE PARAGRAPH FOR ASSISTIVE TECHNOLOGY, FOUR LINES FOR A READER. The visual
 * form is a run of short lines because that is what scans; a screen reader gets
 * the same facts as one sentence rather than four fragments with no connective
 * tissue.
 */

export type BriefingPanelProps = {
  input: BriefingInput
}

export function BriefingPanel({ input }: BriefingPanelProps) {
  const headingId = useId()
  const briefing = presentBriefing(input)

  if (briefing.quiet) return null

  const spoken = [
    briefing.footballLine,
    briefing.actionLine,
    briefing.lockLine,
    briefing.standingLine,
    briefing.worthKnowing,
  ]
    .filter((line): line is string => line !== null && line.length > 0)
    .join(' ')

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 className={styles.heading} id={headingId}>
        {briefing.dateLabel || 'Today'}
      </h2>

      <p className={styles.srOnly}>{spoken}</p>

      <ul className={styles.lines} aria-hidden="true">
        <li className={styles.line}>{briefing.footballLine}</li>
        <li className={styles.lineStrong}>{briefing.actionLine}</li>
        {briefing.lockLine ? <li className={styles.line}>{briefing.lockLine}</li> : null}
        {briefing.standingLine ? <li className={styles.line}>{briefing.standingLine}</li> : null}
      </ul>

      {/* Only ever present when a caller supplied an authoritative fact. There
          is no fallback sentence, deliberately. */}
      {briefing.worthKnowing ? (
        <p className={styles.worthKnowing} aria-hidden="true">
          <span className={styles.worthKnowingTag}>Worth knowing</span>
          {briefing.worthKnowing}
        </p>
      ) : null}
    </section>
  )
}
