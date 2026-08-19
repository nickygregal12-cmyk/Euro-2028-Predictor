import { motion } from 'framer-motion'
import type { AboutModel } from '../models/about'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import text from '../foundations/typography.module.css'
import styles from './about.module.css'

/**
 * ABOUT & DISCLAIMER — the product's public position, in the product's own
 * visual language.
 *
 * ============================ WHY IT IS A PAGE ==========================
 *
 * ADR 0017 asks for *"an unambiguous non-affiliation statement in the footer
 * and terms"*, and this product had neither. The obvious cheap answer — a
 * paragraph of legal text under every page — is the wrong one twice over: it is
 * unreadable where it matters and it makes every surface look like a document.
 * So the position lives on one page, and every surface carries a compact line
 * pointing at it.
 *
 * ============================ IT IS NOT ONE OF THE FOUR =================
 *
 * `home | matches | games | leagues` belong to the ACTIVE COMPETITION.
 * About belongs to the platform, and a platform page is not a football
 * destination — so it renders with `destination="none"` and nothing in the
 * navigation lights up while a reader is here. It is also readable with no
 * competition at all, which is what makes it work for a signed-out visitor
 * arriving from the landing footer.
 *
 * ============================ IT LOOKS LIKE THE PRODUCT =================
 *
 * A measure-limited column, the lane's own type ramp, one card per section.
 * The point is that a reader recognises this as the same product rather than a
 * pasted-in legal document — but nothing here is styled to be skimmed past
 * either: full type size, full contrast, no grey small print.
 *
 * ============================ AND IT DECIDES NOTHING ====================
 *
 * Every sentence is in `fixtures/about/content.ts`, which is where the reasons
 * for each claim are recorded. This file chooses no wording, and a link with no
 * destination is simply not drawn — a legal link that answers Not Found reads
 * as a document that exists and was withheld.
 */

export type VNextAboutProps = {
  readonly model: AboutModel
}

export function VNextAbout({ model }: VNextAboutProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const links = model.links.filter((link) => link.href !== null)

  return (
    <VNextShell
      destination="none"
      header={<VNextPageHeader title={model.title} competition="Predictor Hub" context="About" />}
    >
      <motion.div
        variants={rise}
        initial="hidden"
        animate="visible"
        className={styles.page}
      >
        <p className={`${text.body} ${styles.summary}`} data-vnext-zone="summary">
          {model.summary}
        </p>

        {model.sections.map((section) => (
          <section
            key={section.id}
            className={styles.section}
            aria-labelledby={`about-${section.id}`}
            data-vnext-zone={section.id}
          >
            <h2 id={`about-${section.id}`} className={`${text.title} ${styles.heading}`}>
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className={`${text.body} ${styles.paragraph}`}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        {links.length === 0 ? null : (
          <nav className={styles.links} aria-label="Policies and contact" data-vnext-zone="links">
            {links.map((link) => (
              <a key={link.label} className={styles.link} href={link.href ?? undefined}>
                {link.label}
              </a>
            ))}
          </nav>
        )}
      </motion.div>
    </VNextShell>
  )
}
