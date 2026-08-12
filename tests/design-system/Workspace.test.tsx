import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Workspace } from '../../src/design-system/Workspace'

describe('Workspace contextual panel', () => {
  it('makes the desktop overflow region keyboard focusable', () => {
    render(
      <Workspace asideLabel="Platform operations" aside={<p>Job health</p>}>
        <p>Main work</p>
      </Workspace>,
    )

    expect(
      screen.getByRole('complementary', { name: 'Platform operations' }),
    ).toHaveAttribute('tabindex', '0')
  })
})
