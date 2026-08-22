import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

type RoutePacket = {
  routes: readonly string[]
  skills: readonly { readonly name: string; readonly role: string }[]
}

function route(...args: string[]): RoutePacket {
  return JSON.parse(
    execFileSync('node', ['scripts/agent-tools/route-task.mjs', ...args, '--json'], {
      encoding: 'utf8',
    }),
  ) as RoutePacket
}

describe('specialist Agent Skills', () => {
  it('selects the dedicated frontend design authority for explicit UI work', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/home/VNextHome.tsx',
      'Design a polished responsive interface for this page',
    )
    expect(packet.routes).toContain('intentional-ui-design')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-frontend-design')
  })

  it('keeps the UI review skill on explicit review work', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/home/VNextHome.tsx',
      'Review the current UI for visual and interaction issues',
    )
    expect(packet.routes).toContain('vnext-ui-review')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-ui-review')
  })

  it('selects the dedicated web performance specialist for performance work', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/App.tsx',
      'Audit Core Web Vitals, LCP, CLS and TBT for the application',
    )
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-web-performance')
  })

  it('selects the React performance specialist for component performance work', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/home/VNextHome.tsx',
      'Reduce unnecessary React rerenders and improve rendering performance',
    )
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-react-performance')
  })

  it('selects the component composition specialist for API composition work', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/home/VNextHome.tsx',
      'Refactor this component API to use composition instead of boolean props',
    )
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-component-composition')
  })

  it('selects the React Native specialist for mobile native work', () => {
    const packet = route(
      '--no-graph',
      'Build a React Native Expo version of this interaction',
    )
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-react-native')
  })

  it('selects the design system specialist for design-system work', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/foundations/VNextRoot.tsx',
      'Build and document a reusable design system component',
    )
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-design-system-craft')
  })

  it('selects the motion specialist for explicit animation work', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/app/CompetitionSwitcher.tsx',
      'Improve the animation timing and easing on this interaction',
    )
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-motion-craft')
  })

  it('selects the deep UI specialist for high-craft interface work', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/home/VNextHome.tsx',
      'Use deep UI craft to refine the interaction and visual quality',
    )
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-deep-ui-craft')
  })

  it('selects Impeccable-backed Predictor design plus UI review for a redesign task', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/home/VNextHome.tsx',
      'Redesign the vNext Home page',
    )
    expect(packet.routes).toContain('intentional-ui-design')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-frontend-design')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-ui-review')
    expect(packet.skills.map((skill) => skill.name)).not.toContain('predictor-motion-craft')
    expect(packet.skills.filter((skill) => skill.role === 'domain')).toHaveLength(1)
    expect(packet.skills.filter((skill) => skill.role === 'review')).toHaveLength(1)
  })

  it('routes explicit motion work to the narrow Emil specialist without loading general design', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/app/CompetitionSwitcher.tsx',
      'The competition switcher animation feels sluggish',
    )
    expect(packet.routes).toContain('motion-craft')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-motion-craft')
    expect(packet.skills.map((skill) => skill.name)).not.toContain('predictor-frontend-design')
    expect(packet.skills.filter((skill) => skill.role === 'specialist')).toHaveLength(1)
  })

  it('can add motion craft to an explicitly motion-heavy redesign without displacing design or review', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'src/vnext/home/VNextHome.tsx',
      'Redesign the vNext Home page with a motion-heavy animated transition',
    )
    expect(packet.routes).toContain('intentional-ui-design')
    expect(packet.routes).toContain('motion-craft')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-frontend-design')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-ui-review')
    expect(packet.skills.map((skill) => skill.name)).toContain('predictor-motion-craft')
    expect(packet.skills.filter((skill) => skill.role === 'domain')).toHaveLength(1)
    expect(packet.skills.filter((skill) => skill.role === 'review')).toHaveLength(1)
    expect(packet.skills.filter((skill) => skill.role === 'specialist')).toHaveLength(1)
  })

  it('does not add the frontend design skill to non-UI work', () => {
    const packet = route(
      '--no-graph',
      '--path',
      'supabase/migrations/20260816121000_prediction_safety.sql',
      'Review the prediction save contract for race conditions',
    )
    expect(packet.skills.map((skill) => skill.name)).not.toContain('predictor-frontend-design')
    expect(packet.skills.map((skill) => skill.name)).not.toContain('predictor-ui-review')
  })
})
