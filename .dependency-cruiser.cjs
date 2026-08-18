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
      comment: 'Production source may not depend on dev-only harnesses.',
      from: { path: '^src/(?!dev/)' },
      to: { path: '^src/dev/' },
    },
    {
      name: 'domain-remains-framework-free',
      severity: 'error',
      comment: 'Domain rules must not acquire UI, query-client or hosted-data dependencies.',
      from: { path: '^src/domain/' },
      to: {
        path: '^node_modules/(react|react-dom|react-router|@tanstack|@supabase)/',
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
      name: 'no-unresolvable-dependencies',
      severity: 'error',
      from: { path: '^src/' },
      to: { couldNotResolve: true },
    },
    {
      name: 'no-circular-dependencies',
      severity: 'warn',
      comment: 'Visible on day one; promote to error once the current baseline is proven cycle-free.',
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
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
      },
    },
  },
}
