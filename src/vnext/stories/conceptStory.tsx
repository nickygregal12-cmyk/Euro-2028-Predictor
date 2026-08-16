import type { ReactElement } from 'react'
import type { StoryObj } from '@storybook/react-vite'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'

/**
 * The five reviews every Home concept owes, built once.
 *
 * WHY A HELPER AND NOT THREE COPIES. The comparison between A, B and C is only
 * honest if all three are reviewed at the SAME widths, in the SAME frames, at
 * the SAME scale, against the SAME fixture. A helper makes that structural
 * rather than a thing three story files have to remember; if one concept ever
 * gets a sixth width to make it look better, it will be a visible diff here
 * rather than a quiet extra export over there.
 *
 * The frames come from `WorkshopCanvas`, so every one of them is the honest
 * container-framed review: a 430px frame composes as a phone even when the
 * browser showing it is 1920 wide.
 */
export function conceptStories(concept: ReactElement) {
  const phone375: StoryObj = {
    parameters: { layout: 'fullscreen' },
    render: () => <WorkshopCanvas viewports={['phone-375']}>{concept}</WorkshopCanvas>,
  }

  const phone430: StoryObj = {
    parameters: { layout: 'fullscreen' },
    render: () => <WorkshopCanvas viewports={['phone-430']}>{concept}</WorkshopCanvas>,
  }

  const tablet768: StoryObj = {
    parameters: { layout: 'fullscreen' },
    render: () => <WorkshopCanvas viewports={['tablet-768']}>{concept}</WorkshopCanvas>,
  }

  const laptop1440: StoryObj = {
    parameters: { layout: 'fullscreen' },
    render: () => (
      <WorkshopCanvas viewports={['laptop-1440']} scale={0.8}>
        {concept}
      </WorkshopCanvas>
    ),
  }

  const desktop1920: StoryObj = {
    parameters: { layout: 'fullscreen' },
    render: () => (
      <WorkshopCanvas viewports={['desktop-1920']} scale={0.62}>
        {concept}
      </WorkshopCanvas>
    ),
  }

  const mobileAndDesktop: StoryObj = {
    parameters: { layout: 'fullscreen' },
    render: () => (
      <WorkshopCanvas viewports={['phone-430', 'laptop-1440']} scale={0.7}>
        {concept}
      </WorkshopCanvas>
    ),
  }

  const allWidths: StoryObj = {
    parameters: { layout: 'fullscreen' },
    render: () => (
      <WorkshopCanvas
        viewports={[
          'phone-375',
          'phone-430',
          'tablet-768',
          'laptop-1440',
          'desktop-1920',
        ]}
        scale={0.36}
      >
        {concept}
      </WorkshopCanvas>
    ),
  }

  const reducedMotion: StoryObj = {
    parameters: { layout: 'fullscreen' },
    render: () => (
      <WorkshopCanvas
        viewports={['phone-430', 'laptop-1440']}
        scale={0.7}
        motion="reduced"
      >
        {concept}
      </WorkshopCanvas>
    ),
  }

  return {
    phone375,
    phone430,
    tablet768,
    laptop1440,
    desktop1920,
    mobileAndDesktop,
    allWidths,
    reducedMotion,
  }
}
