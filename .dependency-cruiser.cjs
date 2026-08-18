/**
 * Executable dependency boundaries for the application source tree.
 *
 * Written as a standalone config so architecture rules do not become another
 * application dependency. CI invokes the exact dependency-cruiser version from
 * config/agent-tools.json.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-runtime-to-dev-harness',
      severity: 'error',
      comment:
        'Only App.tsx may register dev previews; every other shipped source surface stays independent of src/dev.',
      from: { path: '^src/(?!dev/|App\\.tsx$)' },
      to: { path: '^src/dev/' },
    },
    {
      name: 'domain-remains-framework-free',
      severity: 'error',
      comment: 'Domain rules must not acquire UI, query-client or hosted-data dependencies.',
      from: { path: '^src/domain/' },
      to: {
        path: '^(?:node_modules/)?(?:react(?:-dom|-router)?|@tanstack|@supabase)(?:/|$)',
      },
    },
    {
      name: 'vnext-presentation-does-not-reach-application',
      severity: 'error',
      comment: 'Only src/vnext/integration may reach application services/features or integration adapters.',
      from: { path: '^src/vnext/(?!integration/)' },
      to: {
        path: [
          '^src/services/',
          '^src/features/',
          '^src/vnext/integration/',
        ],
      },
    },
    {
      name: 'vnext-does-not-inherit-legacy-design-system',
      severity: 'error',
      comment: 'vNext is a parallel frontend lane; legacy visual components are not its dependency base.',
      from: { path: '^src/vnext/' },
      to: { path: '^src/design-system/' },
    },
    {
      name: 'source-does-not-import-test-suites',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^(tests|e2e)/' },
    },
    {
      name: 'no-unresolvable-relative-dependencies',
      severity: 'error',
      comment:
        'A relative source import must resolve. Package availability is already owned by npm ci/build and is not duplicated here.',
      from: { path: '^src/' },
      to: { couldNotResolve: true, path: '^\\.' },
    },
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      comment: 'The verified source graph is cycle-free; new cycles fail immediately.',
      from: { path: '^src/' },
      to: { circular: true },
    },
  ],
  options: {
    tsConfig: {
      fileName: 'tsconfig.app.json',
    },
    doNotFollow: {
      path: 'node_modules',
    },
    exclude: {
      path: ['^node_modules/', '^dist/'],
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'browser', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
      },
    },
  },
}
