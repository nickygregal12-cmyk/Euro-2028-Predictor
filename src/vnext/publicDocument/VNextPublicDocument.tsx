import { useId } from 'react'
import { motion } from 'framer-motion'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import type { PublicDocumentModel } from '../models/publicDocument'
import text from '../foundations/typography.module.css'
import styles from '../about/about.module.css'

/**
 * The shared public-document presentation for Privacy and Terms.
 *
 * It deliberately reuses the About page's readable measure and full-contrast
 * card treatment. Policy content is not small print, and a public document is
 * a platform page rather than a fifth competition destination.
 */
export function VNextPublicDocument({ model }: { readonly model: PublicDocumentModel }) {
  const sectionIds = useId()
  const rise = useVNextMotion(vnextMotion.riseIn)

  return (
    <VNextShell
      destination="none"
      header={
        <VNextPageHeader
          title={model.title}
          competition="Predictor Hub"
          context={model.context}
        />
      }
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
            aria-labelledby={`${sectionIds}-${section.id}`}
            data-vnext-zone={section.id}
          >
            <h2 id={`${sectionIds}-${section.id}`} className={`${text.title} ${styles.heading}`}>
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className={`${text.body} ${styles.paragraph}`}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <nav className={styles.links} aria-label="Policies and contact" data-vnext-zone="links">
          {model.links.map((link) => (
            <a key={link.label} className={styles.link} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </motion.div>
    </VNextShell>
  )
}
