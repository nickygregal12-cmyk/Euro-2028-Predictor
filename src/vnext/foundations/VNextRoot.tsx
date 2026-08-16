import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { VNextReducedMotionContext } from './motion'
import './tokens.css'
import styles from './VNextRoot.module.css'

export type VNextMotionSetting = 'system' | 'reduced' | 'full'

export type VNextRootProps = {
  children: ReactNode
  /**
   * `system` is the production behaviour and the default. The other two exist
   * so a reviewer can compare both motion paths side by side in the workshop
   * without changing an operating-system setting.
   */
  motion?: VNextMotionSetting
  /** Fills its container instead of the viewport. Used inside device frames. */
  fill?: boolean
}

/**
 * The boundary of the vNext lane.
 *
 * Everything vNext renders sits inside this element, and every vNext token is
 * declared on its `data-vnext` attribute. That is what keeps the two frontends
 * apart: no vNext value is defined at `:root`, so the live product cannot
 * inherit one, and vNext is free to look nothing like it.
 */
export function VNextRoot({
  children,
  motion = 'system',
  fill = false,
}: VNextRootProps) {
  const override = motion === 'system' ? null : motion === 'reduced'

  return (
    <VNextReducedMotionContext.Provider value={override}>
      {/* MotionConfig covers Framer's own defaults; the context above covers the
          variants this codebase writes by hand. Both are needed: one without the
          other leaves half the motion unreduced. */}
      <MotionConfig reducedMotion={reducedMotionSetting(motion)}>
        <div
          data-vnext=""
          data-vnext-motion={motion === 'system' ? undefined : motion}
          className={`${styles.root} ${fill ? styles.fill : ''}`}
        >
          {children}
        </div>
      </MotionConfig>
    </VNextReducedMotionContext.Provider>
  )
}

function reducedMotionSetting(
  motion: VNextMotionSetting,
): 'user' | 'always' | 'never' {
  if (motion === 'reduced') return 'always'
  if (motion === 'full') return 'never'
  return 'user'
}
